-- RAWAJ Sprint 4A support requests contract.
--
-- Manual-only migration: review and run from Supabase Dashboard SQL Editor.
-- Do not execute from Lovable or from the frontend.

create extension if not exists pgcrypto;

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  status text not null default 'new',
  subject text not null,
  message text not null,
  related_listing_id uuid references public.listings(id) on delete set null,
  related_report_id uuid references public.listing_reports(id) on delete set null,
  admin_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.support_requests drop constraint if exists support_requests_type_allowed;
alter table public.support_requests
  add constraint support_requests_type_allowed
  check (type in ('complaint', 'suggestion', 'technical_issue', 'abuse_report', 'other'));

alter table public.support_requests drop constraint if exists support_requests_status_allowed;
alter table public.support_requests
  add constraint support_requests_status_allowed
  check (status in ('new', 'under_review', 'resolved', 'rejected'));

alter table public.support_requests drop constraint if exists support_requests_subject_length;
alter table public.support_requests
  add constraint support_requests_subject_length
  check (char_length(btrim(subject)) between 4 and 160);

alter table public.support_requests drop constraint if exists support_requests_message_length;
alter table public.support_requests
  add constraint support_requests_message_length
  check (char_length(btrim(message)) between 10 and 3000);

create index if not exists idx_support_requests_user_created
  on public.support_requests (user_id, created_at desc);

create index if not exists idx_support_requests_status_created
  on public.support_requests (status, created_at desc);

create index if not exists idx_support_requests_listing
  on public.support_requests (related_listing_id)
  where related_listing_id is not null;

create index if not exists idx_support_requests_report
  on public.support_requests (related_report_id)
  where related_report_id is not null;

create or replace function public.rawaj_touch_support_requests_updated_at()
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

drop trigger if exists support_requests_touch_updated_at on public.support_requests;
create trigger support_requests_touch_updated_at
before update on public.support_requests
for each row execute function public.rawaj_touch_support_requests_updated_at();

create or replace function public.rawaj_protect_support_request_user_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to create support requests.';
  end if;

  if new.user_id is distinct from auth.uid() then
    raise exception 'Users can create support requests only for themselves.';
  end if;

  new.status := 'new';
  new.admin_note := null;
  new.reviewed_by := null;
  new.reviewed_at := null;

  return new;
end;
$$;

drop trigger if exists support_requests_protect_user_insert on public.support_requests;
create trigger support_requests_protect_user_insert
before insert on public.support_requests
for each row execute function public.rawaj_protect_support_request_user_insert();

create or replace function public.rawaj_protect_support_request_admin_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_user_can_moderate() then
    raise exception 'Only privileged users can update support request review fields.';
  end if;

  if new.user_id is distinct from old.user_id
    or new.type is distinct from old.type
    or new.subject is distinct from old.subject
    or new.message is distinct from old.message
    or new.related_listing_id is distinct from old.related_listing_id
    or new.related_report_id is distinct from old.related_report_id
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Support request content cannot be changed during review.';
  end if;

  if new.status is distinct from old.status
    or new.admin_note is distinct from old.admin_note
  then
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists support_requests_protect_admin_update on public.support_requests;
create trigger support_requests_protect_admin_update
before update on public.support_requests
for each row execute function public.rawaj_protect_support_request_admin_update();

create or replace function public.rawaj_audit_support_request_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_user_can_moderate() then
    return new;
  end if;

  if new.status is distinct from old.status
    or new.admin_note is distinct from old.admin_note
    or new.reviewed_by is distinct from old.reviewed_by
    or new.reviewed_at is distinct from old.reviewed_at
  then
    perform public.rawaj_insert_audit_log(
      'support_request.reviewed',
      'support_requests',
      new.id::text,
      jsonb_build_object(
        'old_status', old.status,
        'new_status', new.status,
        'has_admin_note', new.admin_note is not null
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists support_requests_audit_review on public.support_requests;
create trigger support_requests_audit_review
after update on public.support_requests
for each row execute function public.rawaj_audit_support_request_review();

alter table public.support_requests enable row level security;

drop policy if exists "support_requests_user_insert" on public.support_requests;
create policy "support_requests_user_insert"
on public.support_requests
for insert
to authenticated
with check (
  user_id = auth.uid()
  and status = 'new'
  and admin_note is null
  and reviewed_by is null
  and reviewed_at is null
);

drop policy if exists "support_requests_user_select_own" on public.support_requests;
create policy "support_requests_user_select_own"
on public.support_requests
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "support_requests_admin_select" on public.support_requests;
create policy "support_requests_admin_select"
on public.support_requests
for select
to authenticated
using (public.current_user_can_moderate());

drop policy if exists "support_requests_admin_update_review" on public.support_requests;
create policy "support_requests_admin_update_review"
on public.support_requests
for update
to authenticated
using (public.current_user_can_moderate())
with check (public.current_user_can_moderate());

comment on table public.support_requests is
  'Real RAWAJ support, complaints, suggestions, technical issues, and abuse follow-up requests.';
