-- RAWAJ Core Completion Sprint contract.
--
-- Manual-only migration: review and run from Supabase Dashboard SQL Editor.
-- Do not execute from Lovable or from the frontend.

create extension if not exists pgcrypto;

-- Verification requests
alter table public.profiles
  add column if not exists verification_status text not null default 'unverified';

alter table public.profiles drop constraint if exists profiles_verification_status_allowed;
alter table public.profiles
  add constraint profiles_verification_status_allowed
  check (verification_status in ('unverified', 'pending', 'verified', 'rejected'));

drop function if exists public.get_public_seller_profile(uuid);
create or replace function public.get_public_seller_profile(p_seller_id uuid)
returns table (
  id uuid,
  first_name text,
  last_name text,
  display_name text,
  governorate text,
  bio text,
  business_name text,
  avatar_path text,
  avatar_url text,
  cover_path text,
  cover_url text,
  verified boolean,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    p.first_name,
    p.last_name,
    p.display_name,
    p.governorate,
    p.bio,
    p.business_name,
    p.avatar_path,
    p.avatar_url,
    p.cover_path,
    p.cover_url,
    p.verification_status = 'verified' as verified,
    p.created_at
  from public.profiles p
  where p.id = p_seller_id
    and exists (
      select 1
      from public.listings l
      where l.owner_id = p.id
        and l.status = 'approved'
    );
$$;

revoke execute on function public.get_public_seller_profile(uuid) from public;
grant execute on function public.get_public_seller_profile(uuid) to anon, authenticated;

create table if not exists public.seller_verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending_review',
  request_type text not null default 'personal',
  legal_name text not null,
  business_name text,
  document_type text,
  document_path text,
  admin_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.seller_verification_requests drop constraint if exists seller_verification_status_allowed;
alter table public.seller_verification_requests
  add constraint seller_verification_status_allowed
  check (status in ('pending_review', 'approved', 'rejected'));

alter table public.seller_verification_requests drop constraint if exists seller_verification_type_allowed;
alter table public.seller_verification_requests
  add constraint seller_verification_type_allowed
  check (request_type in ('personal', 'business'));

alter table public.seller_verification_requests drop constraint if exists seller_verification_text_lengths;
alter table public.seller_verification_requests
  add constraint seller_verification_text_lengths
  check (
    char_length(btrim(legal_name)) between 3 and 120
    and (business_name is null or char_length(btrim(business_name)) <= 120)
    and (document_type is null or char_length(btrim(document_type)) <= 80)
    and (admin_note is null or char_length(btrim(admin_note)) <= 1000)
  );

create unique index if not exists idx_seller_verification_open_unique
  on public.seller_verification_requests (user_id)
  where status = 'pending_review';

create index if not exists idx_seller_verification_status_created
  on public.seller_verification_requests (status, created_at desc);

create or replace function public.rawaj_touch_verification_requests_updated_at()
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

drop trigger if exists seller_verification_touch_updated_at on public.seller_verification_requests;
create trigger seller_verification_touch_updated_at
before update on public.seller_verification_requests
for each row execute function public.rawaj_touch_verification_requests_updated_at();

create or replace function public.rawaj_protect_verification_request_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to request verification.';
  end if;

  if new.user_id is distinct from auth.uid() then
    raise exception 'Verification user cannot be spoofed.';
  end if;

  new.status := 'pending_review';
  new.admin_note := null;
  new.reviewed_by := null;
  new.reviewed_at := null;

  update public.profiles
  set verification_status = 'pending'
  where id = auth.uid()
    and verification_status <> 'verified';

  return new;
end;
$$;

drop trigger if exists seller_verification_protect_insert on public.seller_verification_requests;
create trigger seller_verification_protect_insert
before insert on public.seller_verification_requests
for each row execute function public.rawaj_protect_verification_request_insert();

create or replace function public.rawaj_apply_verification_moderation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_user_can_moderate() then
    raise exception 'Only privileged users can moderate verification requests.';
  end if;

  if new.user_id is distinct from old.user_id
    or new.request_type is distinct from old.request_type
    or new.legal_name is distinct from old.legal_name
    or new.business_name is distinct from old.business_name
    or new.document_type is distinct from old.document_type
    or new.document_path is distinct from old.document_path
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Verification request content cannot be changed during moderation.';
  end if;

  if new.status is distinct from old.status
    or new.admin_note is distinct from old.admin_note
  then
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();

    update public.profiles
    set verification_status = case
      when new.status = 'approved' then 'verified'
      when new.status = 'rejected' then 'rejected'
      else 'pending'
    end
    where id = new.user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists seller_verification_apply_moderation on public.seller_verification_requests;
create trigger seller_verification_apply_moderation
before update on public.seller_verification_requests
for each row execute function public.rawaj_apply_verification_moderation();

alter table public.seller_verification_requests enable row level security;

drop policy if exists "seller_verification_user_insert" on public.seller_verification_requests;
create policy "seller_verification_user_insert"
on public.seller_verification_requests
for insert
to authenticated
with check (
  user_id = auth.uid()
  and status = 'pending_review'
  and admin_note is null
  and reviewed_by is null
  and reviewed_at is null
);

drop policy if exists "seller_verification_user_select_own" on public.seller_verification_requests;
create policy "seller_verification_user_select_own"
on public.seller_verification_requests
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "seller_verification_admin_select" on public.seller_verification_requests;
create policy "seller_verification_admin_select"
on public.seller_verification_requests
for select
to authenticated
using (public.current_user_can_moderate());

drop policy if exists "seller_verification_admin_update" on public.seller_verification_requests;
create policy "seller_verification_admin_update"
on public.seller_verification_requests
for update
to authenticated
using (public.current_user_can_moderate())
with check (public.current_user_can_moderate());

-- Promotions / featured listings
create table if not exists public.listing_promotion_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  requester_user_id uuid not null references public.profiles(id) on delete cascade,
  promotion_type text not null default 'featured_home',
  status text not null default 'pending_review',
  requested_days integer not null default 7,
  starts_at timestamptz,
  ends_at timestamptz,
  payment_method text,
  payment_reference text,
  proof_path text,
  admin_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.listing_promotion_requests drop constraint if exists listing_promotion_status_allowed;
alter table public.listing_promotion_requests
  add constraint listing_promotion_status_allowed
  check (status in ('pending_review', 'approved', 'rejected', 'expired', 'cancelled'));

alter table public.listing_promotion_requests drop constraint if exists listing_promotion_type_allowed;
alter table public.listing_promotion_requests
  add constraint listing_promotion_type_allowed
  check (promotion_type in ('featured_home', 'highlighted', 'urgent', 'top_category'));

alter table public.listing_promotion_requests drop constraint if exists listing_promotion_days_range;
alter table public.listing_promotion_requests
  add constraint listing_promotion_days_range check (requested_days between 1 and 90);

alter table public.listing_promotion_requests drop constraint if exists listing_promotion_text_lengths;
alter table public.listing_promotion_requests
  add constraint listing_promotion_text_lengths
  check (
    (payment_method is null or char_length(btrim(payment_method)) <= 80)
    and (payment_reference is null or char_length(btrim(payment_reference)) <= 160)
    and (admin_note is null or char_length(btrim(admin_note)) <= 1000)
  );

create unique index if not exists idx_listing_promotion_open_unique
  on public.listing_promotion_requests (listing_id, requester_user_id)
  where status = 'pending_review';

create index if not exists idx_listing_promotion_status_created
  on public.listing_promotion_requests (status, created_at desc);

create or replace function public.rawaj_touch_promotion_requests_updated_at()
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

drop trigger if exists listing_promotion_touch_updated_at on public.listing_promotion_requests;
create trigger listing_promotion_touch_updated_at
before update on public.listing_promotion_requests
for each row execute function public.rawaj_touch_promotion_requests_updated_at();

create or replace function public.rawaj_protect_promotion_request_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  listing_owner uuid;
  listing_status text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to request promotion.';
  end if;

  if new.requester_user_id is distinct from auth.uid() then
    raise exception 'Promotion requester cannot be spoofed.';
  end if;

  select owner_id, status into listing_owner, listing_status
  from public.listings
  where id = new.listing_id;

  if listing_owner is null then
    raise exception 'Listing was not found.';
  end if;

  if listing_owner is distinct from auth.uid() then
    raise exception 'Only the listing owner can request promotion.';
  end if;

  if listing_status <> 'approved' then
    raise exception 'Only approved listings can be promoted.';
  end if;

  new.status := 'pending_review';
  new.starts_at := null;
  new.ends_at := null;
  new.admin_note := null;
  new.reviewed_by := null;
  new.reviewed_at := null;

  return new;
end;
$$;

drop trigger if exists listing_promotion_protect_insert on public.listing_promotion_requests;
create trigger listing_promotion_protect_insert
before insert on public.listing_promotion_requests
for each row execute function public.rawaj_protect_promotion_request_insert();

create or replace function public.rawaj_apply_promotion_moderation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_user_can_moderate() then
    raise exception 'Only privileged users can moderate promotion requests.';
  end if;

  if new.listing_id is distinct from old.listing_id
    or new.requester_user_id is distinct from old.requester_user_id
    or new.promotion_type is distinct from old.promotion_type
    or new.requested_days is distinct from old.requested_days
    or new.payment_method is distinct from old.payment_method
    or new.payment_reference is distinct from old.payment_reference
    or new.proof_path is distinct from old.proof_path
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Promotion request content cannot be changed during moderation.';
  end if;

  if new.status is distinct from old.status
    or new.admin_note is distinct from old.admin_note
  then
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();

    if new.status = 'approved' then
      new.starts_at := coalesce(new.starts_at, now());
      new.ends_at := coalesce(new.ends_at, now() + make_interval(days => new.requested_days));

      update public.listings
      set is_featured = true,
          featured_until = new.ends_at,
          updated_at = now()
      where id = new.listing_id
        and owner_id = new.requester_user_id
        and status = 'approved';
    elsif new.status in ('cancelled', 'expired')
      and old.status = 'approved'
      and old.ends_at is not null
      and (new.status = 'cancelled' or old.ends_at <= now())
    then
      update public.listings
      set is_featured = false,
          featured_until = null,
          updated_at = now()
      where id = new.listing_id
        and owner_id = new.requester_user_id
        and status = 'approved'
        and featured_until is not distinct from old.ends_at;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists listing_promotion_apply_moderation on public.listing_promotion_requests;
create trigger listing_promotion_apply_moderation
before update on public.listing_promotion_requests
for each row execute function public.rawaj_apply_promotion_moderation();

alter table public.listing_promotion_requests enable row level security;

drop policy if exists "listing_promotion_user_insert" on public.listing_promotion_requests;
create policy "listing_promotion_user_insert"
on public.listing_promotion_requests
for insert
to authenticated
with check (
  requester_user_id = auth.uid()
  and status = 'pending_review'
  and reviewed_by is null
  and reviewed_at is null
);

drop policy if exists "listing_promotion_user_select_own" on public.listing_promotion_requests;
create policy "listing_promotion_user_select_own"
on public.listing_promotion_requests
for select
to authenticated
using (requester_user_id = auth.uid());

drop policy if exists "listing_promotion_admin_select" on public.listing_promotion_requests;
create policy "listing_promotion_admin_select"
on public.listing_promotion_requests
for select
to authenticated
using (public.current_user_can_moderate());

drop policy if exists "listing_promotion_admin_update" on public.listing_promotion_requests;
create policy "listing_promotion_admin_update"
on public.listing_promotion_requests
for update
to authenticated
using (public.current_user_can_moderate())
with check (public.current_user_can_moderate());

-- Chat safety: reports and conversation-scoped blocking
create table if not exists public.message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.conversation_messages(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  reporter_user_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'new',
  admin_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.message_reports drop constraint if exists message_reports_status_allowed;
alter table public.message_reports
  add constraint message_reports_status_allowed
  check (status in ('new', 'under_review', 'resolved', 'rejected'));

alter table public.message_reports drop constraint if exists message_reports_text_lengths;
alter table public.message_reports
  add constraint message_reports_text_lengths
  check (
    char_length(btrim(reason)) between 3 and 80
    and (details is null or char_length(btrim(details)) <= 1000)
    and (admin_note is null or char_length(btrim(admin_note)) <= 1000)
  );

alter table public.message_reports drop constraint if exists message_reports_no_self_report;
alter table public.message_reports
  add constraint message_reports_no_self_report check (reporter_user_id <> reported_user_id);

create unique index if not exists idx_message_reports_unique_reporter
  on public.message_reports (message_id, reporter_user_id);

create index if not exists idx_message_reports_status_created
  on public.message_reports (status, created_at desc);

create table if not exists public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_user_id uuid not null references public.profiles(id) on delete cascade,
  blocked_user_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.user_blocks drop constraint if exists user_blocks_no_self_block;
alter table public.user_blocks
  add constraint user_blocks_no_self_block check (blocker_user_id <> blocked_user_id);

alter table public.user_blocks drop constraint if exists user_blocks_reason_length;
alter table public.user_blocks
  add constraint user_blocks_reason_length
  check (reason is null or char_length(btrim(reason)) <= 300);

create unique index if not exists idx_user_blocks_conversation_pair
  on public.user_blocks (conversation_id, blocker_user_id, blocked_user_id);

create index if not exists idx_user_blocks_blocked_lookup
  on public.user_blocks (conversation_id, blocked_user_id);

create or replace function public.rawaj_touch_message_reports_updated_at()
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

drop trigger if exists message_reports_touch_updated_at on public.message_reports;
create trigger message_reports_touch_updated_at
before update on public.message_reports
for each row execute function public.rawaj_touch_message_reports_updated_at();

create or replace function public.rawaj_protect_message_report_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  message_sender uuid;
  conversation_buyer uuid;
  conversation_seller uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to report a message.';
  end if;

  if new.reporter_user_id is distinct from auth.uid() then
    raise exception 'Message reporter cannot be spoofed.';
  end if;

  select m.sender_user_id, c.buyer_user_id, c.seller_user_id
    into message_sender, conversation_buyer, conversation_seller
  from public.conversation_messages m
  join public.conversations c on c.id = m.conversation_id
  where m.id = new.message_id
    and m.conversation_id = new.conversation_id;

  if message_sender is null then
    raise exception 'Message was not found in the selected conversation.';
  end if;

  if auth.uid() not in (conversation_buyer, conversation_seller) then
    raise exception 'Only conversation participants can report messages.';
  end if;

  if message_sender = auth.uid() then
    raise exception 'Users cannot report their own message.';
  end if;

  new.reported_user_id := message_sender;
  new.status := 'new';
  new.admin_note := null;
  new.reviewed_by := null;
  new.reviewed_at := null;

  return new;
end;
$$;

drop trigger if exists message_reports_protect_insert on public.message_reports;
create trigger message_reports_protect_insert
before insert on public.message_reports
for each row execute function public.rawaj_protect_message_report_insert();

create or replace function public.rawaj_protect_message_report_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_user_can_moderate() then
    raise exception 'Only privileged users can moderate message reports.';
  end if;

  if new.message_id is distinct from old.message_id
    or new.conversation_id is distinct from old.conversation_id
    or new.reporter_user_id is distinct from old.reporter_user_id
    or new.reported_user_id is distinct from old.reported_user_id
    or new.reason is distinct from old.reason
    or new.details is distinct from old.details
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Message report content cannot be changed during moderation.';
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

drop trigger if exists message_reports_protect_update on public.message_reports;
create trigger message_reports_protect_update
before update on public.message_reports
for each row execute function public.rawaj_protect_message_report_update();

create or replace function public.rawaj_protect_user_block_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  conversation_buyer uuid;
  conversation_seller uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to block a user.';
  end if;

  if new.blocker_user_id is distinct from auth.uid() then
    raise exception 'Blocker cannot be spoofed.';
  end if;

  select buyer_user_id, seller_user_id into conversation_buyer, conversation_seller
  from public.conversations
  where id = new.conversation_id;

  if conversation_buyer is null then
    raise exception 'Conversation was not found.';
  end if;

  if auth.uid() not in (conversation_buyer, conversation_seller) then
    raise exception 'Only conversation participants can block users here.';
  end if;

  if new.blocked_user_id not in (conversation_buyer, conversation_seller) then
    raise exception 'Blocked user must be the other conversation participant.';
  end if;

  if new.blocked_user_id = auth.uid() then
    raise exception 'Users cannot block themselves.';
  end if;

  update public.conversations
  set status = 'blocked',
      updated_at = now()
  where id = new.conversation_id;

  return new;
end;
$$;

drop trigger if exists user_blocks_protect_insert on public.user_blocks;
create trigger user_blocks_protect_insert
before insert on public.user_blocks
for each row execute function public.rawaj_protect_user_block_insert();

-- Replace message insert validation from Sprint 5A so blocks stop sending at the database.
create or replace function public.rawaj_validate_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  conversation_buyer uuid;
  conversation_seller uuid;
  conversation_status text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to send messages.';
  end if;

  if new.sender_user_id is distinct from auth.uid() then
    raise exception 'Message sender cannot be spoofed.';
  end if;

  select buyer_user_id, seller_user_id, status
    into conversation_buyer, conversation_seller, conversation_status
  from public.conversations
  where id = new.conversation_id;

  if conversation_buyer is null then
    raise exception 'Conversation was not found.';
  end if;

  if new.sender_user_id not in (conversation_buyer, conversation_seller) then
    raise exception 'Only conversation participants can send messages.';
  end if;

  if conversation_status <> 'active' then
    raise exception 'This conversation is not open for new messages.';
  end if;

  if exists (
    select 1
    from public.user_blocks b
    where b.conversation_id = new.conversation_id
      and (
        (b.blocker_user_id = conversation_buyer and b.blocked_user_id = conversation_seller)
        or (b.blocker_user_id = conversation_seller and b.blocked_user_id = conversation_buyer)
      )
  ) then
    raise exception 'This conversation has been blocked.';
  end if;

  new.body := btrim(new.body);
  return new;
end;
$$;

alter table public.message_reports enable row level security;
alter table public.user_blocks enable row level security;

drop policy if exists "message_reports_user_insert" on public.message_reports;
create policy "message_reports_user_insert"
on public.message_reports
for insert
to authenticated
with check (reporter_user_id = auth.uid());

drop policy if exists "message_reports_user_select_own" on public.message_reports;
create policy "message_reports_user_select_own"
on public.message_reports
for select
to authenticated
using (reporter_user_id = auth.uid());

drop policy if exists "message_reports_admin_select" on public.message_reports;
create policy "message_reports_admin_select"
on public.message_reports
for select
to authenticated
using (public.current_user_can_moderate());

drop policy if exists "message_reports_admin_update" on public.message_reports;
create policy "message_reports_admin_update"
on public.message_reports
for update
to authenticated
using (public.current_user_can_moderate())
with check (public.current_user_can_moderate());

drop policy if exists "user_blocks_user_insert" on public.user_blocks;
create policy "user_blocks_user_insert"
on public.user_blocks
for insert
to authenticated
with check (blocker_user_id = auth.uid());

drop policy if exists "user_blocks_user_select_own" on public.user_blocks;
create policy "user_blocks_user_select_own"
on public.user_blocks
for select
to authenticated
using (blocker_user_id = auth.uid() or blocked_user_id = auth.uid());

create or replace function public.rawaj_fetch_message_reports_for_admin()
returns table (
  id uuid,
  message_id uuid,
  conversation_id uuid,
  reporter_user_id uuid,
  reported_user_id uuid,
  reason text,
  details text,
  status text,
  admin_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  message_body text,
  listing_id uuid,
  listing_title text,
  reporter_display_name text,
  reported_display_name text
)
language sql
security definer
set search_path = public
as $$
  select
    r.id,
    r.message_id,
    r.conversation_id,
    r.reporter_user_id,
    r.reported_user_id,
    r.reason,
    r.details,
    r.status,
    r.admin_note,
    r.reviewed_by,
    r.reviewed_at,
    r.created_at,
    r.updated_at,
    m.body as message_body,
    c.listing_id,
    l.title as listing_title,
    coalesce(reporter.display_name, reporter.first_name, 'RAWAJ user') as reporter_display_name,
    coalesce(reported.display_name, reported.first_name, 'RAWAJ user') as reported_display_name
  from public.message_reports r
  join public.conversation_messages m on m.id = r.message_id
  join public.conversations c on c.id = r.conversation_id
  join public.listings l on l.id = c.listing_id
  left join public.profiles reporter on reporter.id = r.reporter_user_id
  left join public.profiles reported on reported.id = r.reported_user_id
  where public.current_user_can_moderate()
  order by r.created_at desc
  limit 100;
$$;

revoke execute on function public.rawaj_fetch_message_reports_for_admin() from public;
revoke execute on function public.rawaj_fetch_message_reports_for_admin() from anon;
grant execute on function public.rawaj_fetch_message_reports_for_admin() to authenticated;

comment on table public.seller_verification_requests is
  'Moderated seller verification requests. Public UI may show only derived verified boolean after approval.';
comment on table public.listing_promotion_requests is
  'Manual-review promotion requests. No payment processing is performed by this table.';
comment on table public.message_reports is
  'Participant-submitted reports for individual conversation messages.';
comment on table public.user_blocks is
  'Conversation-scoped user blocks that stop further sends in that conversation.';
