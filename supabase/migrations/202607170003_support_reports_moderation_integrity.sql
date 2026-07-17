-- RAWAJ Phase 14: Support, Reports & Moderation Integrity.
-- Repository-only, additive migration. Review and apply manually in Supabase.
-- This file must never be executed by CI, the browser, Lovable, or this agent.

create extension if not exists pgcrypto;

-- Preserve public-safe support replies separately from private moderation notes.
alter table public.support_requests
  add column if not exists public_response text;

alter table public.support_requests
  drop constraint if exists support_requests_public_response_length;
alter table public.support_requests
  add constraint support_requests_public_response_length
  check (public_response is null or char_length(btrim(public_response)) <= 2000);

-- Preserve the minimum evidence needed to understand reports after targets are removed.
alter table public.listing_reports
  add column if not exists listing_title_snapshot text,
  add column if not exists listing_owner_id_snapshot uuid;

update public.listing_reports r
set listing_title_snapshot = coalesce(r.listing_title_snapshot, l.title),
    listing_owner_id_snapshot = coalesce(r.listing_owner_id_snapshot, l.owner_id)
from public.listings l
where l.id = r.listing_id
  and (r.listing_title_snapshot is null or r.listing_owner_id_snapshot is null);

alter table public.listing_reports drop constraint if exists listing_reports_listing_id_fkey;
alter table public.listing_reports alter column listing_id drop not null;
alter table public.listing_reports
  add constraint listing_reports_listing_id_fkey
  foreign key (listing_id) references public.listings(id) on delete set null;

alter table public.listing_reports drop constraint if exists listing_reports_report_type_allowed;
alter table public.listing_reports
  add constraint listing_reports_report_type_allowed check (
    report_type in (
      'suspicious_listing', 'fraud', 'prohibited_content', 'abusive_user',
      'misleading_price', 'wrong_info', 'other'
    )
  );

alter table public.listing_reports drop constraint if exists listing_reports_reason_length;
alter table public.listing_reports
  add constraint listing_reports_reason_length
  check (char_length(btrim(reason)) between 4 and 500);

alter table public.message_reports
  add column if not exists message_body_snapshot text,
  add column if not exists listing_id_snapshot uuid,
  add column if not exists listing_title_snapshot text;

update public.message_reports r
set message_body_snapshot = coalesce(r.message_body_snapshot, m.body),
    listing_id_snapshot = coalesce(r.listing_id_snapshot, c.listing_id),
    listing_title_snapshot = coalesce(r.listing_title_snapshot, l.title)
from public.conversation_messages m
join public.conversations c on c.id = m.conversation_id
left join public.listings l on l.id = c.listing_id
where m.id = r.message_id
  and (
    r.message_body_snapshot is null
    or r.listing_id_snapshot is null
    or r.listing_title_snapshot is null
  );

alter table public.message_reports drop constraint if exists message_reports_message_id_fkey;
alter table public.message_reports drop constraint if exists message_reports_conversation_id_fkey;
alter table public.message_reports alter column message_id drop not null;
alter table public.message_reports alter column conversation_id drop not null;
alter table public.message_reports
  add constraint message_reports_message_id_fkey
  foreign key (message_id) references public.conversation_messages(id) on delete set null;
alter table public.message_reports
  add constraint message_reports_conversation_id_fkey
  foreign key (conversation_id) references public.conversations(id) on delete set null;

alter table public.message_reports drop constraint if exists message_reports_reason_allowed;
alter table public.message_reports
  add constraint message_reports_reason_allowed check (
    reason in (
      'abusive_or_suspicious', 'harassment', 'spam', 'fraud',
      'privacy_violation', 'other'
    )
  );

alter table public.seller_review_reports
  add column if not exists review_body_snapshot text;

update public.seller_review_reports r
set review_body_snapshot = coalesce(r.review_body_snapshot, sr.comment)
from public.seller_reviews sr
where sr.id = r.review_id
  and r.review_body_snapshot is null;

alter table public.seller_review_reports drop constraint if exists seller_review_reports_review_id_fkey;
alter table public.seller_review_reports alter column review_id drop not null;
alter table public.seller_review_reports
  add constraint seller_review_reports_review_id_fkey
  foreign key (review_id) references public.seller_reviews(id) on delete set null;

-- Permit only FK evidence-detachment updates in addition to the existing
-- moderation allowlists. No actor gains permission from these trigger guards.
create or replace function public.rawaj_protect_listing_report_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.listing_id is not null and new.listing_id is null
     and (to_jsonb(new) - array['listing_id', 'updated_at'])
       is not distinct from (to_jsonb(old) - array['listing_id', 'updated_at'])
  then return new; end if;
  if (to_jsonb(new) - array['status', 'assigned_to', 'admin_note', 'resolved_at', 'updated_at'])
     is distinct from
     (to_jsonb(old) - array['status', 'assigned_to', 'admin_note', 'resolved_at', 'updated_at'])
  then raise exception 'listing_report_protected_fields'; end if;
  return new;
end;
$$;

create or replace function public.rawaj_protect_message_report_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
       (old.message_id is not null and new.message_id is null)
       or (old.conversation_id is not null and new.conversation_id is null)
     )
     and (to_jsonb(new) - array['message_id', 'conversation_id', 'updated_at'])
       is not distinct from (to_jsonb(old) - array['message_id', 'conversation_id', 'updated_at'])
  then return new; end if;
  if (to_jsonb(new) - array['status', 'admin_note', 'reviewed_by', 'reviewed_at', 'updated_at'])
     is distinct from
     (to_jsonb(old) - array['status', 'admin_note', 'reviewed_by', 'reviewed_at', 'updated_at'])
  then raise exception 'message_report_protected_fields'; end if;
  return new;
end;
$$;

-- Owner support DTOs expose only public fields. Identity always derives from auth.uid().
create or replace function public.rawaj_create_my_support_request(
  p_type text,
  p_subject text,
  p_message text,
  p_related_listing_id uuid default null,
  p_related_report_id uuid default null
)
returns table (
  id uuid, user_id uuid, type text, status text, subject text, message text,
  related_listing_id uuid, related_report_id uuid, public_response text,
  created_at timestamptz, updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_type text := btrim(coalesce(p_type, ''));
  v_subject text := regexp_replace(
    regexp_replace(btrim(coalesce(p_subject, '')), '[[:cntrl:]]', '', 'g'),
    '[[:space:]]+', ' ', 'g'
  );
  v_message text := regexp_replace(btrim(coalesce(p_message, '')), '[[:cntrl:]]', '', 'g');
  v_row public.support_requests%rowtype;
begin
  if v_actor is null then raise exception 'support_auth_required'; end if;
  if v_type not in ('complaint', 'suggestion', 'technical_issue', 'abuse_report', 'other')
  then raise exception 'support_invalid_type'; end if;
  if char_length(v_subject) not between 4 and 160
  then raise exception 'support_invalid_subject'; end if;
  if char_length(v_message) not between 10 and 3000
  then raise exception 'support_invalid_message'; end if;

  if p_related_listing_id is not null and not exists (
    select 1 from public.listings l
    where l.id = p_related_listing_id
      and (l.owner_id = v_actor or l.status = 'approved')
  ) then raise exception 'support_target_unavailable'; end if;

  if p_related_report_id is not null and not exists (
    select 1 from public.listing_reports r
    where r.id = p_related_report_id and r.reporter_id = v_actor
  ) then raise exception 'support_target_unavailable'; end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'support:' || v_actor::text || ':' || v_type || ':' || lower(v_subject), 0
  ));

  select r.* into v_row
  from public.support_requests r
  where r.user_id = v_actor
    and r.type = v_type
    and lower(r.subject) = lower(v_subject)
    and r.status in ('new', 'under_review')
  order by r.created_at desc, r.id desc
  limit 1;

  if v_row.id is null then
    if (select count(*) from public.support_requests r
        where r.user_id = v_actor and r.created_at >= now() - interval '1 hour') >= 10
    then raise exception 'support_rate_limit'; end if;

    insert into public.support_requests (
      user_id, type, status, subject, message, related_listing_id, related_report_id
    ) values (
      v_actor, v_type, 'new', v_subject, v_message,
      p_related_listing_id, p_related_report_id
    ) returning * into v_row;
  end if;

  return query select v_row.id, v_row.user_id, v_row.type, v_row.status,
    v_row.subject, v_row.message, v_row.related_listing_id,
    v_row.related_report_id, v_row.public_response, v_row.created_at, v_row.updated_at;
end;
$$;

create or replace function public.rawaj_fetch_my_support_requests(p_limit integer default 50)
returns table (
  id uuid, user_id uuid, type text, status text, subject text, message text,
  related_listing_id uuid, related_report_id uuid, public_response text,
  created_at timestamptz, updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select r.id, r.user_id, r.type, r.status, r.subject, r.message,
    r.related_listing_id, r.related_report_id, r.public_response,
    r.created_at, r.updated_at
  from public.support_requests r
  where auth.uid() is not null and r.user_id = auth.uid()
  order by r.created_at desc, r.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 50);
$$;

create or replace function public.rawaj_fetch_support_requests_for_admin(p_limit integer default 100)
returns table (
  id uuid, user_id uuid, type text, status text, subject text, message text,
  related_listing_id uuid, related_report_id uuid, public_response text,
  admin_note text, reviewed_by uuid, reviewed_at timestamptz,
  created_at timestamptz, updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select r.id, r.user_id, r.type, r.status, r.subject, r.message,
    r.related_listing_id, r.related_report_id, r.public_response,
    r.admin_note, r.reviewed_by, r.reviewed_at, r.created_at, r.updated_at
  from public.support_requests r
  where auth.uid() is not null and public.current_user_can_moderate()
  order by r.created_at desc, r.id desc
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
$$;

create or replace function public.rawaj_admin_moderate_support_request(
  p_request_id uuid,
  p_status text,
  p_public_response text,
  p_admin_note text,
  p_expected_updated_at timestamptz
)
returns table (request_id uuid, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_row public.support_requests%rowtype;
  v_public text := nullif(btrim(coalesce(p_public_response, '')), '');
  v_note text := nullif(btrim(coalesce(p_admin_note, '')), '');
begin
  if v_actor is null or not public.current_user_can_moderate()
  then raise exception 'support_moderation_permission_required'; end if;
  if p_status not in ('new', 'under_review', 'resolved', 'rejected')
  then raise exception 'support_invalid_status'; end if;
  if p_expected_updated_at is null then raise exception 'support_expected_timestamp_required'; end if;
  if char_length(coalesce(v_public, '')) > 2000 or char_length(coalesce(v_note, '')) > 2000
  then raise exception 'support_note_too_long'; end if;

  select * into v_row from public.support_requests where id = p_request_id for update;
  if v_row.id is null then raise exception 'support_not_found'; end if;
  if v_row.status = p_status and v_row.public_response is not distinct from v_public
     and v_row.admin_note is not distinct from v_note
  then return query select v_row.id, v_row.updated_at; return; end if;
  if v_row.updated_at is distinct from p_expected_updated_at
  then raise exception 'stale_support_request'; end if;
  if not (
    (v_row.status = 'new' and p_status in ('under_review', 'resolved', 'rejected'))
    or (v_row.status = 'under_review' and p_status in ('resolved', 'rejected'))
  ) then raise exception 'support_invalid_transition'; end if;

  update public.support_requests set status = p_status,
    public_response = v_public, admin_note = v_note,
    reviewed_by = v_actor, reviewed_at = now()
  where id = p_request_id returning * into v_row;

  perform public.rawaj_insert_audit_log(
    'support_request.moderated', 'support_requests', v_row.id::text,
    jsonb_build_object('status', p_status, 'has_public_response', v_public is not null)
  );
  if p_status in ('resolved', 'rejected') then
    perform public.rawaj_create_notification(
      v_row.user_id, 'support.status_changed', 'تحديث على طلب الدعم',
      'تم تحديث حالة طلب الدعم الخاص بك.', 'support', v_row.id::text,
      jsonb_build_object('status', p_status)
    );
  end if;
  return query select v_row.id, v_row.updated_at;
end;
$$;

-- Listing reports: target authorization, actor derivation, dedupe, and bounded abuse controls.
create or replace function public.rawaj_create_listing_report_v2(
  p_listing_id uuid,
  p_report_type text,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_reason text := regexp_replace(btrim(coalesce(p_reason, '')), '[[:cntrl:]]', '', 'g');
  v_listing public.listings%rowtype;
  v_report_id uuid;
begin
  if v_actor is null then raise exception 'listing_report_auth_required'; end if;
  if p_report_type not in (
    'suspicious_listing', 'fraud', 'prohibited_content', 'abusive_user',
    'misleading_price', 'wrong_info', 'other'
  ) then raise exception 'listing_report_invalid_type'; end if;
  if char_length(v_reason) not between 4 and 500
     or (p_report_type = 'other' and char_length(v_reason) < 10)
  then raise exception 'listing_report_invalid_reason'; end if;

  select * into v_listing from public.listings
  where id = p_listing_id and status = 'approved';
  if v_listing.id is null then raise exception 'listing_report_target_unavailable'; end if;
  if v_listing.owner_id = v_actor then raise exception 'listing_report_self_report_denied'; end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'listing-report:' || v_actor::text || ':' || p_listing_id::text, 0
  ));
  select r.id into v_report_id from public.listing_reports r
  where r.listing_id = p_listing_id and r.reporter_id = v_actor
    and r.status in ('new', 'in_review')
  order by r.created_at desc, r.id desc limit 1;
  if v_report_id is not null then return v_report_id; end if;

  if (select count(*) from public.listing_reports r
      where r.reporter_id = v_actor and r.created_at >= now() - interval '1 hour') >= 20
  then raise exception 'listing_report_rate_limit'; end if;

  insert into public.listing_reports (
    listing_id, reporter_id, report_type, reason, status,
    listing_title_snapshot, listing_owner_id_snapshot
  ) values (
    v_listing.id, v_actor, p_report_type, v_reason, 'new',
    v_listing.title, v_listing.owner_id
  ) returning id into v_report_id;
  return v_report_id;
end;
$$;

create or replace function public.rawaj_fetch_listing_reports_for_admin(p_limit integer default 100)
returns table (
  id uuid, listing_id uuid, listing_title_snapshot text, reporter_id uuid,
  report_type text, reason text, status text, assigned_to uuid,
  admin_note text, resolved_at timestamptz, created_at timestamptz, updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select r.id, r.listing_id, r.listing_title_snapshot, r.reporter_id,
    r.report_type, r.reason, r.status, r.assigned_to, r.admin_note,
    r.resolved_at, r.created_at, r.updated_at
  from public.listing_reports r
  where auth.uid() is not null and public.current_user_can_moderate()
  order by r.created_at desc, r.id desc
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
$$;

create or replace function public.rawaj_admin_moderate_listing_report_v2(
  p_report_id uuid,
  p_status text,
  p_admin_note text,
  p_expected_updated_at timestamptz
)
returns table (report_id uuid, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_row public.listing_reports%rowtype;
  v_note text := nullif(btrim(coalesce(p_admin_note, '')), '');
begin
  if v_actor is null or not public.current_user_can_moderate()
  then raise exception 'listing_report_moderation_permission_required'; end if;
  if p_status not in ('new', 'in_review', 'resolved', 'dismissed')
  then raise exception 'listing_report_invalid_status'; end if;
  if p_expected_updated_at is null then raise exception 'listing_report_expected_timestamp_required'; end if;
  if char_length(coalesce(v_note, '')) > 1000 then raise exception 'listing_report_note_too_long'; end if;

  select * into v_row from public.listing_reports where id = p_report_id for update;
  if v_row.id is null then raise exception 'listing_report_not_found'; end if;
  if v_row.status = p_status and v_row.admin_note is not distinct from v_note
  then return query select v_row.id, v_row.updated_at; return; end if;
  if v_row.updated_at is distinct from p_expected_updated_at
  then raise exception 'stale_listing_report'; end if;
  if not (
    (v_row.status = 'new' and p_status in ('in_review', 'resolved', 'dismissed'))
    or (v_row.status = 'in_review' and p_status in ('resolved', 'dismissed'))
  ) then raise exception 'listing_report_invalid_transition'; end if;

  update public.listing_reports set status = p_status, assigned_to = v_actor,
    admin_note = v_note,
    resolved_at = case when p_status in ('resolved', 'dismissed') then now() else null end
  where id = p_report_id returning * into v_row;
  perform public.rawaj_insert_audit_log(
    'listing_report.moderated', 'listing_reports', v_row.id::text,
    jsonb_build_object('status', p_status)
  );
  if p_status in ('resolved', 'dismissed') then
    perform public.rawaj_create_notification(
      v_row.reporter_id, 'report.status_changed', 'تحديث على البلاغ',
      'تمت مراجعة البلاغ الذي أرسلته.', null, null,
      jsonb_build_object('status', p_status)
    );
  end if;
  return query select v_row.id, v_row.updated_at;
end;
$$;

-- Message reports remain participant-only and preserve bounded evidence snapshots.
create or replace function public.rawaj_create_message_report(
  p_message_id uuid,
  p_conversation_id uuid,
  p_reason text,
  p_details text default null
)
returns public.message_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_reason text := btrim(coalesce(p_reason, ''));
  v_details text := nullif(regexp_replace(btrim(coalesce(p_details, '')), '[[:cntrl:]]', '', 'g'), '');
  v_message public.conversation_messages%rowtype;
  v_conversation public.conversations%rowtype;
  v_listing_title text;
  v_report public.message_reports%rowtype;
begin
  if v_actor is null then raise exception 'message_report_auth_required'; end if;
  if v_reason not in (
    'abusive_or_suspicious', 'harassment', 'spam', 'fraud', 'privacy_violation', 'other'
  ) then raise exception 'message_report_invalid_reason'; end if;
  if char_length(coalesce(v_details, '')) > 1000
     or (v_reason = 'other' and v_details is null)
  then raise exception 'message_report_invalid_details'; end if;

  select * into v_message from public.conversation_messages
  where id = p_message_id and conversation_id = p_conversation_id and deleted_at is null;
  select * into v_conversation from public.conversations where id = p_conversation_id;
  if v_message.id is null or v_conversation.id is null
     or v_actor not in (v_conversation.buyer_user_id, v_conversation.seller_user_id)
  then raise exception 'message_report_target_unavailable'; end if;
  if v_message.sender_user_id = v_actor then raise exception 'message_report_self_report_denied'; end if;
  select l.title into v_listing_title from public.listings l where l.id = v_conversation.listing_id;

  perform pg_advisory_xact_lock(hashtextextended(
    'message-report:' || v_actor::text || ':' || p_message_id::text, 0
  ));
  select * into v_report from public.message_reports r
  where r.message_id = p_message_id and r.reporter_user_id = v_actor
  order by r.created_at desc limit 1;
  if v_report.id is not null then return v_report; end if;
  if (select count(*) from public.message_reports r
      where r.reporter_user_id = v_actor and r.created_at >= now() - interval '1 hour') >= 20
  then raise exception 'message_report_rate_limit'; end if;

  insert into public.message_reports (
    message_id, conversation_id, reporter_user_id, reported_user_id,
    reason, details, status, message_body_snapshot,
    listing_id_snapshot, listing_title_snapshot
  ) values (
    v_message.id, v_conversation.id, v_actor, v_message.sender_user_id,
    v_reason, v_details, 'new', left(v_message.body, 2000),
    v_conversation.listing_id, v_listing_title
  ) returning * into v_report;
  return v_report;
end;
$$;

drop function if exists public.rawaj_fetch_message_reports_for_admin();
create function public.rawaj_fetch_message_reports_for_admin()
returns table (
  id uuid, message_id uuid, conversation_id uuid, reporter_user_id uuid,
  reported_user_id uuid, reason text, details text, status text, admin_note text,
  reviewed_by uuid, reviewed_at timestamptz, created_at timestamptz,
  updated_at timestamptz, message_body text, listing_id uuid,
  listing_title text, reporter_display_name text, reported_display_name text
)
language sql
security definer
set search_path = public
as $$
  select r.id, r.message_id, r.conversation_id, r.reporter_user_id,
    r.reported_user_id, r.reason, r.details, r.status, r.admin_note,
    r.reviewed_by, r.reviewed_at, r.created_at, r.updated_at,
    coalesce(r.message_body_snapshot, m.body),
    coalesce(r.listing_id_snapshot, c.listing_id),
    coalesce(r.listing_title_snapshot, l.title),
    coalesce(reporter.display_name, reporter.first_name, 'RAWAJ user'),
    coalesce(reported.display_name, reported.first_name, 'RAWAJ user')
  from public.message_reports r
  left join public.conversation_messages m on m.id = r.message_id
  left join public.conversations c on c.id = r.conversation_id
  left join public.listings l on l.id = coalesce(r.listing_id_snapshot, c.listing_id)
  left join public.profiles reporter on reporter.id = r.reporter_user_id
  left join public.profiles reported on reported.id = r.reported_user_id
  where auth.uid() is not null and public.current_user_can_moderate()
  order by r.created_at desc, r.id desc
  limit 100;
$$;

create or replace function public.rawaj_admin_moderate_message_report(
  p_report_id uuid, p_status text, p_admin_note text, p_expected_updated_at timestamptz
)
returns table (report_id uuid, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_row public.message_reports%rowtype;
  v_note text := nullif(btrim(coalesce(p_admin_note, '')), '');
begin
  if v_actor is null or not public.current_user_can_moderate()
  then raise exception 'message_report_moderation_permission_required'; end if;
  if p_status not in ('new', 'under_review', 'resolved', 'rejected')
  then raise exception 'message_report_invalid_status'; end if;
  if p_expected_updated_at is null then raise exception 'message_report_expected_timestamp_required'; end if;
  if char_length(coalesce(v_note, '')) > 1000 then raise exception 'message_report_note_too_long'; end if;
  select * into v_row from public.message_reports where id = p_report_id for update;
  if v_row.id is null then raise exception 'message_report_not_found'; end if;
  if v_row.status = p_status and v_row.admin_note is not distinct from v_note
  then return query select v_row.id, v_row.updated_at; return; end if;
  if v_row.updated_at is distinct from p_expected_updated_at
  then raise exception 'stale_message_report'; end if;
  if not (
    (v_row.status = 'new' and p_status in ('under_review', 'resolved', 'rejected'))
    or (v_row.status = 'under_review' and p_status in ('resolved', 'rejected'))
  ) then raise exception 'message_report_invalid_transition'; end if;
  update public.message_reports set status = p_status, admin_note = v_note,
    reviewed_by = v_actor, reviewed_at = now()
  where id = p_report_id returning * into v_row;
  perform public.rawaj_insert_audit_log(
    'message_report.moderated', 'message_reports', v_row.id::text,
    jsonb_build_object('status', p_status)
  );
  if p_status in ('resolved', 'rejected') then
    perform public.rawaj_create_notification(
      v_row.reporter_user_id, 'report.status_changed', 'تحديث على البلاغ',
      'تمت مراجعة البلاغ الذي أرسلته.', null, null,
      jsonb_build_object('status', p_status)
    );
  end if;
  return query select v_row.id, v_row.updated_at;
end;
$$;

-- Conversation blocks derive both actor and target from the locked conversation.
create or replace function public.rawaj_block_conversation_participant(
  p_conversation_id uuid,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_conversation public.conversations%rowtype;
  v_target uuid;
  v_reason text := nullif(regexp_replace(btrim(coalesce(p_reason, '')), '[[:cntrl:]]', '', 'g'), '');
  v_id uuid;
begin
  if v_actor is null then raise exception 'conversation_block_auth_required'; end if;
  if char_length(coalesce(v_reason, '')) > 300 then raise exception 'conversation_block_reason_too_long'; end if;
  select * into v_conversation from public.conversations
  where id = p_conversation_id for update;
  if v_conversation.id is null
     or v_actor not in (v_conversation.buyer_user_id, v_conversation.seller_user_id)
  then raise exception 'conversation_block_target_unavailable'; end if;
  v_target := case when v_actor = v_conversation.buyer_user_id
    then v_conversation.seller_user_id else v_conversation.buyer_user_id end;
  if v_target is null or v_target = v_actor then raise exception 'conversation_block_self_denied'; end if;
  perform pg_advisory_xact_lock(hashtextextended(
    'conversation-block:' || p_conversation_id::text || ':' || v_actor::text, 0
  ));
  select b.id into v_id from public.user_blocks b
  where b.conversation_id = p_conversation_id
    and b.blocker_user_id = v_actor and b.blocked_user_id = v_target;
  if v_id is null then
    insert into public.user_blocks (
      blocker_user_id, blocked_user_id, conversation_id, reason
    ) values (v_actor, v_target, p_conversation_id, v_reason)
    returning id into v_id;
  end if;
  update public.conversations set status = 'blocked', updated_at = now()
  where id = p_conversation_id and status is distinct from 'blocked';
  perform public.rawaj_insert_audit_log(
    'conversation.blocked', 'conversations', p_conversation_id::text,
    jsonb_build_object('target_user_id', v_target)
  );
  return v_id;
end;
$$;

-- Snapshot review evidence and bound report volume without copying it into audit logs.
create or replace function public.rawaj_prepare_seller_review_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or new.reporter_user_id is distinct from auth.uid()
  then raise exception 'seller_review_report_auth_required'; end if;
  if (select count(*) from public.seller_review_reports r
      where r.reporter_user_id = auth.uid() and r.created_at >= now() - interval '1 hour') >= 20
  then raise exception 'seller_review_report_rate_limit'; end if;
  select sr.comment into new.review_body_snapshot
  from public.seller_reviews sr where sr.id = new.review_id and sr.status = 'approved';
  if new.review_body_snapshot is null then raise exception 'seller_review_report_review_unavailable'; end if;
  return new;
end;
$$;

drop trigger if exists seller_review_reports_prepare on public.seller_review_reports;
create trigger seller_review_reports_prepare
before insert on public.seller_review_reports
for each row execute function public.rawaj_prepare_seller_review_report();

create or replace function public.rawaj_fetch_seller_review_reports_for_admin(p_limit integer default 100)
returns table (
  id uuid, review_id uuid, reporter_user_id uuid, reported_reviewer_user_id uuid,
  reason text, details text, status text, admin_note text,
  created_at timestamptz, updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select r.id, r.review_id, r.reporter_user_id, r.reported_reviewer_user_id,
    r.reason, r.details, r.status, r.admin_note, r.created_at, r.updated_at
  from public.seller_review_reports r
  where auth.uid() is not null and public.current_user_can_moderate()
  order by r.created_at desc, r.id desc
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
$$;

create or replace function public.rawaj_admin_moderate_seller_review_report(
  p_report_id uuid, p_status text, p_admin_note text, p_expected_updated_at timestamptz
)
returns table (report_id uuid, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_row public.seller_review_reports%rowtype;
  v_note text := nullif(btrim(coalesce(p_admin_note, '')), '');
begin
  if v_actor is null or not public.current_user_can_moderate()
  then raise exception 'seller_review_report_moderation_permission_required'; end if;
  if p_status not in ('new', 'under_review', 'resolved', 'rejected')
  then raise exception 'seller_review_report_invalid_status'; end if;
  if p_expected_updated_at is null then raise exception 'seller_review_report_expected_timestamp_required'; end if;
  if char_length(coalesce(v_note, '')) > 1000 then raise exception 'seller_review_report_note_too_long'; end if;
  select * into v_row from public.seller_review_reports where id = p_report_id for update;
  if v_row.id is null then raise exception 'seller_review_report_not_found'; end if;
  if v_row.status = p_status and v_row.admin_note is not distinct from v_note
  then return query select v_row.id, v_row.updated_at; return; end if;
  if v_row.updated_at is distinct from p_expected_updated_at
  then raise exception 'stale_seller_review_report'; end if;
  if not (
    (v_row.status = 'new' and p_status in ('under_review', 'resolved', 'rejected'))
    or (v_row.status = 'under_review' and p_status in ('resolved', 'rejected'))
  ) then raise exception 'seller_review_report_invalid_transition'; end if;
  update public.seller_review_reports set status = p_status, admin_note = v_note
  where id = p_report_id returning * into v_row;
  perform public.rawaj_insert_audit_log(
    'seller_review_report.moderated', 'seller_review_reports', v_row.id::text,
    jsonb_build_object('status', p_status)
  );
  if p_status in ('resolved', 'rejected') then
    perform public.rawaj_create_notification(
      v_row.reporter_user_id, 'report.status_changed', 'تحديث على البلاغ',
      'تمت مراجعة البلاغ الذي أرسلته.', null, null,
      jsonb_build_object('status', p_status)
    );
  end if;
  return query select v_row.id, v_row.updated_at;
end;
$$;

-- Private tables are RPC-only for browser roles, preventing column-level leaks.
revoke all on table public.support_requests from anon;
revoke select, insert, update on table public.support_requests from authenticated;
revoke all on table public.listing_reports from anon;
revoke select, insert, update on table public.listing_reports from authenticated;
revoke all on table public.message_reports from anon;
revoke select, insert, update on table public.message_reports from authenticated;
revoke all on table public.seller_review_reports from anon;
revoke select, insert, update on table public.seller_review_reports from authenticated;
revoke all on table public.user_blocks from anon;
revoke insert, update on table public.user_blocks from authenticated;

revoke all on function public.rawaj_create_my_support_request(text, text, text, uuid, uuid) from public, anon;
revoke all on function public.rawaj_fetch_my_support_requests(integer) from public, anon;
revoke all on function public.rawaj_fetch_support_requests_for_admin(integer) from public, anon;
revoke all on function public.rawaj_admin_moderate_support_request(uuid, text, text, text, timestamptz) from public, anon;
revoke all on function public.rawaj_create_listing_report_v2(uuid, text, text) from public, anon;
revoke all on function public.rawaj_fetch_listing_reports_for_admin(integer) from public, anon;
revoke all on function public.rawaj_admin_moderate_listing_report_v2(uuid, text, text, timestamptz) from public, anon;
revoke all on function public.rawaj_create_message_report(uuid, uuid, text, text) from public, anon;
revoke all on function public.rawaj_fetch_message_reports_for_admin() from public, anon;
revoke all on function public.rawaj_admin_moderate_message_report(uuid, text, text, timestamptz) from public, anon;
revoke all on function public.rawaj_block_conversation_participant(uuid, text) from public, anon;
revoke all on function public.rawaj_fetch_seller_review_reports_for_admin(integer) from public, anon;
revoke all on function public.rawaj_admin_moderate_seller_review_report(uuid, text, text, timestamptz) from public, anon;

grant execute on function public.rawaj_create_my_support_request(text, text, text, uuid, uuid) to authenticated;
grant execute on function public.rawaj_fetch_my_support_requests(integer) to authenticated;
grant execute on function public.rawaj_fetch_support_requests_for_admin(integer) to authenticated;
grant execute on function public.rawaj_admin_moderate_support_request(uuid, text, text, text, timestamptz) to authenticated;
grant execute on function public.rawaj_create_listing_report_v2(uuid, text, text) to authenticated;
grant execute on function public.rawaj_fetch_listing_reports_for_admin(integer) to authenticated;
grant execute on function public.rawaj_admin_moderate_listing_report_v2(uuid, text, text, timestamptz) to authenticated;
grant execute on function public.rawaj_create_message_report(uuid, uuid, text, text) to authenticated;
grant execute on function public.rawaj_fetch_message_reports_for_admin() to authenticated;
grant execute on function public.rawaj_admin_moderate_message_report(uuid, text, text, timestamptz) to authenticated;
grant execute on function public.rawaj_block_conversation_participant(uuid, text) to authenticated;
grant execute on function public.rawaj_fetch_seller_review_reports_for_admin(integer) to authenticated;
grant execute on function public.rawaj_admin_moderate_seller_review_report(uuid, text, text, timestamptz) to authenticated;

-- Retire browser-callable legacy paths that accepted moderation-owned fields.
revoke all on function public.rawaj_admin_moderate_listing_report(
  uuid, text, uuid, text, timestamptz, timestamptz
) from authenticated;

comment on function public.rawaj_create_my_support_request(text, text, text, uuid, uuid) is
  'Creates or reuses a bounded support request for auth.uid(), returning an owner-safe DTO.';
comment on function public.rawaj_create_listing_report_v2(uuid, text, text) is
  'Creates or reuses a bounded report for an accessible public listing, deriving reporter and target owner server-side.';
comment on function public.rawaj_block_conversation_participant(uuid, text) is
  'Idempotently blocks the other participant in an authenticated participant conversation.';
