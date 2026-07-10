-- RAWAJ governed seller-review report contract.
--
-- Review reports are entity-specific, like listing and message reports. Reporter
-- identity is always auth.uid(); the reported reviewer is derived from the review.
-- Reports do not auto-hide or mutate approved reviews.

create table if not exists public.seller_review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.seller_reviews(id) on delete cascade,
  reporter_user_id uuid not null references public.profiles(id) on delete cascade,
  reported_reviewer_user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'new',
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seller_review_reports_reason_allowed check (
    reason in ('abuse', 'spam', 'misleading', 'personal_data', 'prohibited_content', 'other')
  ),
  constraint seller_review_reports_status_allowed check (
    status in ('new', 'under_review', 'resolved', 'rejected')
  ),
  constraint seller_review_reports_details_length check (
    details is null or char_length(btrim(details)) <= 1000
  ),
  constraint seller_review_reports_admin_note_length check (
    admin_note is null or char_length(btrim(admin_note)) <= 1000
  )
);

create index if not exists idx_seller_review_reports_status_created
  on public.seller_review_reports (status, created_at desc);

create index if not exists idx_seller_review_reports_review_created
  on public.seller_review_reports (review_id, created_at desc);

create unique index if not exists idx_seller_review_reports_open_unique
  on public.seller_review_reports (review_id, reporter_user_id)
  where status in ('new', 'under_review');

create or replace function public.rawaj_touch_seller_review_reports_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists seller_review_reports_touch_updated_at on public.seller_review_reports;
create trigger seller_review_reports_touch_updated_at
before update on public.seller_review_reports
for each row execute function public.rawaj_touch_seller_review_reports_updated_at();

alter table public.seller_review_reports enable row level security;

drop policy if exists "seller_review_reports_select_own" on public.seller_review_reports;
create policy "seller_review_reports_select_own"
on public.seller_review_reports
for select
to authenticated
using (reporter_user_id = auth.uid());

drop policy if exists "seller_review_reports_admin_select" on public.seller_review_reports;
create policy "seller_review_reports_admin_select"
on public.seller_review_reports
for select
to authenticated
using (public.current_user_can_moderate());

-- Direct client writes are intentionally unsupported. Creation and moderation go
-- through authority-checked RPCs below.

create or replace function public.rawaj_create_seller_review_report(
  p_review_id uuid,
  p_reason text,
  p_details text default null
)
returns public.seller_review_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reporter uuid := auth.uid();
  v_reason text := btrim(coalesce(p_reason, ''));
  v_details text := nullif(btrim(coalesce(p_details, '')), '');
  v_review public.seller_reviews%rowtype;
  v_existing public.seller_review_reports%rowtype;
  v_report public.seller_review_reports%rowtype;
begin
  if v_reporter is null then
    raise exception 'seller_review_report_auth_required';
  end if;

  if p_review_id is null then
    raise exception 'seller_review_report_invalid_review';
  end if;

  if v_reason not in ('abuse', 'spam', 'misleading', 'personal_data', 'prohibited_content', 'other') then
    raise exception 'seller_review_report_invalid_reason';
  end if;

  if v_details is not null and char_length(v_details) > 1000 then
    raise exception 'seller_review_report_details_too_long';
  end if;

  select *
  into v_review
  from public.seller_reviews
  where id = p_review_id;

  if not found or v_review.status <> 'approved' then
    raise exception 'seller_review_report_review_unavailable';
  end if;

  if v_review.reviewer_user_id = v_reporter then
    raise exception 'seller_review_report_self_report_denied';
  end if;

  select *
  into v_existing
  from public.seller_review_reports r
  where r.review_id = p_review_id
    and r.reporter_user_id = v_reporter
    and r.status in ('new', 'under_review')
  order by r.created_at desc
  limit 1;

  if found then
    return v_existing;
  end if;

  insert into public.seller_review_reports (
    review_id,
    reporter_user_id,
    reported_reviewer_user_id,
    reason,
    details,
    status
  )
  values (
    p_review_id,
    v_reporter,
    v_review.reviewer_user_id,
    v_reason,
    v_details,
    'new'
  )
  returning * into v_report;

  return v_report;
exception
  when unique_violation then
    select *
    into v_existing
    from public.seller_review_reports r
    where r.review_id = p_review_id
      and r.reporter_user_id = v_reporter
      and r.status in ('new', 'under_review')
    order by r.created_at desc
    limit 1;

    if found then
      return v_existing;
    end if;

    raise;
end;
$$;

revoke all on function public.rawaj_create_seller_review_report(uuid, text, text) from public;
revoke all on function public.rawaj_create_seller_review_report(uuid, text, text) from anon;
grant execute on function public.rawaj_create_seller_review_report(uuid, text, text) to authenticated;

create or replace function public.rawaj_admin_moderate_seller_review_report(
  p_report_id uuid,
  p_status text,
  p_admin_note text,
  p_expected_updated_at timestamptz
)
returns table (
  report_id uuid,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_report_id uuid;
  v_updated_at timestamptz;
begin
  if v_actor is null
     or not public.current_user_can_moderate() then
    raise exception 'seller_review_report_moderation_permission_required';
  end if;

  if p_status not in ('new', 'under_review', 'resolved', 'rejected') then
    raise exception 'seller_review_report_invalid_status';
  end if;

  if p_expected_updated_at is null then
    raise exception 'seller_review_report_expected_timestamp_required';
  end if;

  if p_admin_note is not null and char_length(btrim(p_admin_note)) > 1000 then
    raise exception 'seller_review_report_admin_note_too_long';
  end if;

  update public.seller_review_reports
  set
    status = p_status,
    admin_note = nullif(btrim(coalesce(p_admin_note, '')), '')
  where seller_review_reports.id = p_report_id
    and seller_review_reports.updated_at = p_expected_updated_at
  returning
    seller_review_reports.id,
    seller_review_reports.updated_at
  into
    v_report_id,
    v_updated_at;

  if v_report_id is null then
    if exists (
      select 1
      from public.seller_review_reports r
      where r.id = p_report_id
    ) then
      raise exception 'stale_seller_review_report';
    end if;

    raise exception 'seller_review_report_not_found';
  end if;

  perform public.rawaj_insert_audit_log(
    'seller_review_report.moderated',
    'seller_review_reports',
    v_report_id::text,
    jsonb_build_object('status', p_status)
  );

  return query
  select v_report_id, v_updated_at;
end;
$$;

revoke all on function public.rawaj_admin_moderate_seller_review_report(
  uuid,
  text,
  text,
  timestamptz
) from public;

revoke all on function public.rawaj_admin_moderate_seller_review_report(
  uuid,
  text,
  text,
  timestamptz
) from anon;

grant execute on function public.rawaj_admin_moderate_seller_review_report(
  uuid,
  text,
  text,
  timestamptz
) to authenticated;

comment on function public.rawaj_create_seller_review_report(uuid, text, text) is
  'Creates or reuses an open seller-review report after deriving reporter and reported reviewer identities server-side.';

comment on function public.rawaj_admin_moderate_seller_review_report(uuid, text, text, timestamptz) is
  'Moderates seller-review reports with permission checks, optimistic concurrency, and audit logging.';
