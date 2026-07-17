-- RAWAJ Phase 13: account, profile, verification, and private-media integrity.
--
-- Repository-only, additive/manual migration. It must be reviewed and applied from
-- the Supabase Dashboard SQL Editor by the project owner. No agent applies it.

-- Keep public profile media intentionally public and bounded, while disallowing
-- client-side object replacement. New objects use INSERT-only UUID paths.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-media',
  'profile-media',
  true,
  3145728,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "RAWAJ users update own profile media" on storage.objects;

drop policy if exists "RAWAJ users upload own profile media" on storage.objects;
create policy "RAWAJ users upload own profile media"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-media'
  and auth.uid()::text = (storage.foldername(name))[1]
  and (storage.foldername(name))[2] in ('avatar', 'cover')
);

drop policy if exists "RAWAJ users delete own profile media" on storage.objects;
create policy "RAWAJ users delete own profile media"
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-media'
  and auth.uid()::text = (storage.foldername(name))[1]
  and (storage.foldername(name))[2] in ('avatar', 'cover')
);

-- Verification evidence remains private, bounded, and MIME-limited at storage.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'verification-documents',
  'verification-documents',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "RAWAJ verification document owner upload" on storage.objects;
create policy "RAWAJ verification document owner upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'verification-documents'
  and auth.uid()::text = (storage.foldername(name))[1]
  and public.rawaj_safe_uuid((storage.foldername(name))[2]) is not null
);

drop policy if exists "RAWAJ verification document owner read" on storage.objects;
create policy "RAWAJ verification document owner read"
on storage.objects for select to authenticated
using (
  bucket_id = 'verification-documents'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "RAWAJ verification document reviewer read" on storage.objects;
create policy "RAWAJ verification document reviewer read"
on storage.objects for select to authenticated
using (
  bucket_id = 'verification-documents'
  and public.current_user_is_admin_like()
  and exists (
    select 1
    from public.seller_verification_requests r
    where r.document_path = storage.objects.name
  )
);

drop policy if exists "RAWAJ verification document owner cleanup" on storage.objects;
create policy "RAWAJ verification document owner cleanup"
on storage.objects for delete to authenticated
using (
  bucket_id = 'verification-documents'
  and auth.uid()::text = (storage.foldername(name))[1]
  and not exists (
    select 1
    from public.seller_verification_requests r
    where r.document_path = storage.objects.name
  )
);

-- Public seller RPCs return public presentation only. They no longer expose
-- first/last names or object storage keys to an anonymous browser.
drop function if exists public.get_public_seller_profile(uuid);
create function public.get_public_seller_profile(p_seller_id uuid)
returns table (
  id uuid,
  display_name text,
  governorate text,
  bio text,
  business_name text,
  avatar_url text,
  cover_url text,
  verified boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.display_name,
    p.governorate,
    p.bio,
    p.business_name,
    p.avatar_url,
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
        and l.archived_at is null
        and (l.expires_at is null or l.expires_at > now())
    );
$$;

revoke all on function public.get_public_seller_profile(uuid) from public;
grant execute on function public.get_public_seller_profile(uuid) to anon, authenticated;

drop function if exists public.search_public_sellers(text, integer);
create function public.search_public_sellers(
  p_query text,
  p_limit integer default 8
)
returns table (
  id uuid,
  display_name text,
  business_name text,
  governorate text,
  bio text,
  avatar_url text,
  approved_listing_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  with public_sellers as (
    select l.owner_id, count(*)::integer as approved_listing_count
    from public.listings l
    where l.status = 'approved'
      and l.archived_at is null
      and (l.expires_at is null or l.expires_at > now())
    group by l.owner_id
  )
  select
    p.id,
    p.display_name,
    p.business_name,
    p.governorate,
    p.bio,
    p.avatar_url,
    s.approved_listing_count
  from public_sellers s
  join public.profiles p on p.id = s.owner_id
  where length(btrim(coalesce(p_query, ''))) >= 2
    and (
      p.display_name ilike '%' || btrim(p_query) || '%'
      or p.business_name ilike '%' || btrim(p_query) || '%'
      or p.governorate ilike '%' || btrim(p_query) || '%'
      or p.bio ilike '%' || btrim(p_query) || '%'
    )
  order by s.approved_listing_count desc, p.display_name nulls last, p.created_at desc
  limit least(greatest(coalesce(p_limit, 8), 1), 20);
$$;

revoke all on function public.search_public_sellers(text, integer) from public;
grant execute on function public.search_public_sellers(text, integer) to anon, authenticated;

-- Normal browsers cannot update arbitrary profile columns. All supported edits
-- below go through narrow SECURITY DEFINER functions deriving auth.uid().
revoke update on table public.profiles from anon, authenticated;

create or replace function public.rawaj_update_my_profile(
  p_first_name text,
  p_last_name text,
  p_display_name text,
  p_governorate text,
  p_city_area text,
  p_bio text,
  p_business_name text,
  p_phone text,
  p_whatsapp text,
  p_preferred_contact_method text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_first_name text := btrim(regexp_replace(coalesce(p_first_name, ''), '[[:cntrl:]]', ' ', 'g'));
  v_last_name text := nullif(btrim(regexp_replace(coalesce(p_last_name, ''), '[[:cntrl:]]', ' ', 'g')), '');
  v_display_name text := btrim(regexp_replace(coalesce(p_display_name, ''), '[[:cntrl:]]', ' ', 'g'));
  v_governorate text := nullif(btrim(regexp_replace(coalesce(p_governorate, ''), '[[:cntrl:]]', ' ', 'g')), '');
  v_city_area text := nullif(btrim(regexp_replace(coalesce(p_city_area, ''), '[[:cntrl:]]', ' ', 'g')), '');
  v_bio text := nullif(btrim(regexp_replace(coalesce(p_bio, ''), '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g')), '');
  v_business_name text := nullif(btrim(regexp_replace(coalesce(p_business_name, ''), '[[:cntrl:]]', ' ', 'g')), '');
  v_phone text := nullif(btrim(regexp_replace(coalesce(p_phone, ''), '[[:cntrl:]]', '', 'g')), '');
  v_whatsapp text := nullif(btrim(regexp_replace(coalesce(p_whatsapp, ''), '[[:cntrl:]]', '', 'g')), '');
  v_preferred_contact text := nullif(btrim(coalesce(p_preferred_contact_method, '')), '');
begin
  if v_actor is null then
    raise exception 'account_auth_required';
  end if;

  if char_length(v_first_name) not between 2 and 40
    or char_length(coalesce(v_last_name, '')) > 40
    or char_length(v_display_name) not between 2 and 120
    or char_length(coalesce(v_governorate, '')) > 120
    or char_length(coalesce(v_city_area, '')) > 80
    or char_length(coalesce(v_bio, '')) > 600
    or char_length(coalesce(v_business_name, '')) > 120
    or char_length(coalesce(v_phone, '')) > 40
    or char_length(coalesce(v_whatsapp, '')) > 40
  then
    raise exception 'account_profile_validation_failed';
  end if;

  if v_preferred_contact is not null
     and v_preferred_contact not in ('phone', 'whatsapp', 'chat') then
    raise exception 'account_contact_preference_invalid';
  end if;

  update public.profiles
  set
    first_name = v_first_name,
    last_name = v_last_name,
    display_name = v_display_name,
    governorate = v_governorate,
    city_area = v_city_area,
    bio = v_bio,
    business_name = v_business_name,
    phone = v_phone,
    whatsapp = v_whatsapp,
    preferred_contact_method = v_preferred_contact
  where id = v_actor;

  if not found then
    raise exception 'account_profile_not_found';
  end if;
  return v_actor;
end;
$$;

revoke all on function public.rawaj_update_my_profile(
  text, text, text, text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.rawaj_update_my_profile(
  text, text, text, text, text, text, text, text, text, text
) to authenticated;

create or replace function public.rawaj_set_my_profile_media(
  p_kind text,
  p_storage_path text,
  p_public_url text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_path text := btrim(coalesce(p_storage_path, ''));
  v_old_path text;
begin
  if v_actor is null then raise exception 'account_auth_required'; end if;
  if p_kind not in ('avatar', 'cover') then raise exception 'profile_media_kind_invalid'; end if;
  if (storage.foldername(v_path))[1] is distinct from v_actor::text
     or (storage.foldername(v_path))[2] is distinct from p_kind then
    raise exception 'profile_media_not_owned';
  end if;
  if p_public_url is null
     or p_public_url !~ '^https://[^[:space:]]+/storage/v1/object/public/profile-media/' then
    raise exception 'profile_media_url_invalid';
  end if;
  if not exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'profile-media'
      and o.name = v_path
      and coalesce(o.metadata ->> 'mimetype', '') in ('image/jpeg', 'image/png', 'image/webp')
  ) then
    raise exception 'profile_media_object_invalid';
  end if;

  select case when p_kind = 'avatar' then p.avatar_path else p.cover_path end
  into v_old_path
  from public.profiles p
  where p.id = v_actor
  for update;

  if not found then raise exception 'account_profile_not_found'; end if;
  if p_kind = 'avatar' then
    update public.profiles set avatar_path = v_path, avatar_url = p_public_url where id = v_actor;
  else
    update public.profiles set cover_path = v_path, cover_url = p_public_url where id = v_actor;
  end if;
  return v_old_path;
end;
$$;

revoke all on function public.rawaj_set_my_profile_media(text, text, text) from public, anon;
grant execute on function public.rawaj_set_my_profile_media(text, text, text) to authenticated;

create or replace function public.rawaj_clear_my_profile_media(p_kind text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_old_path text;
begin
  if v_actor is null then raise exception 'account_auth_required'; end if;
  if p_kind not in ('avatar', 'cover') then raise exception 'profile_media_kind_invalid'; end if;

  select case when p_kind = 'avatar' then p.avatar_path else p.cover_path end
  into v_old_path
  from public.profiles p
  where p.id = v_actor
  for update;

  if not found then raise exception 'account_profile_not_found'; end if;
  if p_kind = 'avatar' then
    update public.profiles set avatar_path = null, avatar_url = null where id = v_actor;
  else
    update public.profiles set cover_path = null, cover_url = null where id = v_actor;
  end if;
  return v_old_path;
end;
$$;

revoke all on function public.rawaj_clear_my_profile_media(text) from public, anon;
grant execute on function public.rawaj_clear_my_profile_media(text) to authenticated;

-- Owner request history is exposed only through a minimum DTO. Direct owner SELECT
-- is removed because row-level RLS cannot hide admin notes and document paths.
drop policy if exists "seller_verification_user_select_own"
  on public.seller_verification_requests;

create or replace function public.rawaj_fetch_my_verification_requests()
returns table (
  id uuid,
  status text,
  request_type text,
  legal_name text,
  business_name text,
  document_type text,
  reviewed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.status,
    r.request_type,
    r.legal_name,
    r.business_name,
    r.document_type,
    r.reviewed_at,
    r.created_at,
    r.updated_at
  from public.seller_verification_requests r
  where auth.uid() is not null
    and r.user_id = auth.uid()
  order by r.created_at desc, r.id desc;
$$;

revoke all on function public.rawaj_fetch_my_verification_requests() from public, anon;
grant execute on function public.rawaj_fetch_my_verification_requests() to authenticated;

create unique index if not exists idx_seller_verification_open_unique
  on public.seller_verification_requests (user_id)
  where status = 'pending_review';

drop function if exists public.rawaj_create_verification_request_v2(
  uuid, text, text, text, text, text
);
create function public.rawaj_create_verification_request_v2(
  p_request_id uuid,
  p_request_type text,
  p_legal_name text,
  p_business_name text,
  p_document_type text,
  p_document_path text
)
returns table (
  id uuid,
  status text,
  request_type text,
  legal_name text,
  business_name text,
  document_type text,
  reviewed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_legal_name text := btrim(regexp_replace(coalesce(p_legal_name, ''), '[[:cntrl:]]', ' ', 'g'));
  v_business_name text := nullif(btrim(regexp_replace(coalesce(p_business_name, ''), '[[:cntrl:]]', ' ', 'g')), '');
  v_document_type text := btrim(coalesce(p_document_type, ''));
  v_document_path text := btrim(coalesce(p_document_path, ''));
begin
  if v_actor is null then raise exception 'verification_auth_required'; end if;
  if p_request_id is null then raise exception 'verification_invalid_request_id'; end if;
  if p_request_type not in ('personal', 'business') then
    raise exception 'verification_invalid_request_type';
  end if;
  if char_length(v_legal_name) not between 3 and 120 then
    raise exception 'verification_invalid_legal_name';
  end if;

  if p_request_type = 'business' then
    if v_business_name is null or char_length(v_business_name) not between 3 and 120 then
      raise exception 'verification_invalid_business_name';
    end if;
    if v_document_type not in ('commercial_registration', 'business_license', 'tax_document') then
      raise exception 'verification_invalid_document_type';
    end if;
  else
    v_business_name := null;
    if v_document_type not in ('national_id', 'passport', 'other_government_id') then
      raise exception 'verification_invalid_document_type';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtext('rawaj-verification:' || v_actor::text));
  if exists (
    select 1 from public.seller_verification_requests r
    where r.user_id = v_actor and r.status = 'pending_review'
  ) then
    raise exception 'verification_request_already_pending';
  end if;

  if not exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'verification-documents'
      and o.name = v_document_path
      and (storage.foldername(o.name))[1] = v_actor::text
      and (storage.foldername(o.name))[2] = p_request_id::text
      and coalesce(o.metadata ->> 'mimetype', '') in (
        'image/jpeg', 'image/png', 'image/webp', 'application/pdf'
      )
  ) then
    raise exception 'verification_document_not_owned';
  end if;

  insert into public.seller_verification_requests (
    id, user_id, status, request_type, legal_name, business_name,
    document_type, document_path, admin_note, reviewed_by, reviewed_at
  ) values (
    p_request_id, v_actor, 'pending_review', p_request_type, v_legal_name,
    v_business_name, v_document_type, v_document_path, null, null, null
  );

  begin
    perform public.rawaj_insert_audit_log(
      'seller_verification.requested',
      'seller_verification_requests',
      p_request_id::text,
      jsonb_build_object(
        'request_type', p_request_type,
        'document_type', v_document_type,
        'has_document', true
      )
    );
  exception when others then null;
  end;

  return query
  select
    r.id, r.status, r.request_type, r.legal_name, r.business_name,
    r.document_type, r.reviewed_at, r.created_at, r.updated_at
  from public.seller_verification_requests r
  where r.id = p_request_id and r.user_id = v_actor;
exception when unique_violation then
  raise exception 'verification_request_already_pending';
end;
$$;

revoke all on function public.rawaj_create_verification_request_v2(
  uuid, text, text, text, text, text
) from public, anon;
grant execute on function public.rawaj_create_verification_request_v2(
  uuid, text, text, text, text, text
) to authenticated;

-- Repeated delivery of the same review decision is idempotent. Conflicting or
-- stale decisions still fail, and the existing moderation trigger remains the
-- sole writer of the authoritative profile verification status.
create or replace function public.rawaj_admin_moderate_verification_request(
  p_request_id uuid,
  p_status text,
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
  v_current_status text;
  v_current_updated_at timestamptz;
  v_updated_at timestamptz;
begin
  if v_actor is null or not public.current_user_is_admin_like() then
    raise exception 'Verification moderation permission required.';
  end if;
  if p_status not in ('approved', 'rejected') then
    raise exception 'Unsupported verification status.';
  end if;
  if p_expected_updated_at is null then
    raise exception 'Expected verification timestamp is required.';
  end if;

  select r.status, r.updated_at
  into v_current_status, v_current_updated_at
  from public.seller_verification_requests r
  where r.id = p_request_id
  for update;

  if not found then raise exception 'Verification request does not exist.'; end if;
  if v_current_status = p_status then
    return query select p_request_id, v_current_updated_at;
    return;
  end if;
  if v_current_status <> 'pending_review'
     or v_current_updated_at is distinct from p_expected_updated_at then
    raise exception 'stale_verification_request';
  end if;

  update public.seller_verification_requests
  set status = p_status, admin_note = nullif(btrim(coalesce(p_admin_note, '')), '')
  where id = p_request_id
  returning seller_verification_requests.updated_at into v_updated_at;

  perform public.rawaj_insert_audit_log(
    'seller_verification.moderated',
    'seller_verification_requests',
    p_request_id::text,
    jsonb_build_object(
      'status', p_status,
      'has_admin_note', nullif(btrim(coalesce(p_admin_note, '')), '') is not null
    )
  );

  return query select p_request_id, v_updated_at;
end;
$$;

revoke all on function public.rawaj_admin_moderate_verification_request(
  uuid, text, text, timestamptz
) from public, anon;
grant execute on function public.rawaj_admin_moderate_verification_request(
  uuid, text, text, timestamptz
) to authenticated;

create or replace function public.rawaj_notify_verification_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is not distinct from old.status
     or new.status not in ('approved', 'rejected') then
    return new;
  end if;

  begin
    perform public.rawaj_create_notification(
      new.user_id,
      'verification_status',
      case when new.status = 'approved' then 'تم توثيق حسابك' else 'تمت مراجعة طلب التوثيق' end,
      case
        when new.status = 'approved' then 'أصبح حسابك موثقاً على رواج.'
        else 'يمكنك مراجعة حالة الطلب من صفحة التوثيق.'
      end,
      'verification',
      new.id::text,
      jsonb_build_object('request_id', new.id, 'status', new.status)
    );
  exception when others then
    -- Moderation authority must not be rolled back by optional notification delivery.
    null;
  end;
  return new;
end;
$$;

drop trigger if exists seller_verification_status_notification
  on public.seller_verification_requests;
create trigger seller_verification_status_notification
after update of status on public.seller_verification_requests
for each row execute function public.rawaj_notify_verification_status_change();

-- Existing account deletion remains a reviewed request, not client-side deletion.
-- The partial unique index and advisory lock make duplicate clicks/tabs converge.
create unique index if not exists idx_support_account_deletion_open_unique
  on public.support_requests (user_id)
  where subject = 'طلب حذف حساب رواج' and status in ('new', 'under_review');

create or replace function public.rawaj_request_my_account_deletion()
returns table (
  id uuid,
  user_id uuid,
  type text,
  status text,
  subject text,
  message text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_request public.support_requests%rowtype;
begin
  if v_actor is null then raise exception 'account_auth_required'; end if;
  perform pg_advisory_xact_lock(hashtext('rawaj-account-deletion:' || v_actor::text));

  select * into v_request
  from public.support_requests r
  where r.user_id = v_actor
    and r.subject = 'طلب حذف حساب رواج'
    and r.status in ('new', 'under_review')
  order by r.created_at desc
  limit 1;

  if v_request.id is not null then
    return query select
      v_request.id, v_request.user_id, v_request.type, v_request.status,
      v_request.subject, v_request.message, v_request.created_at, v_request.updated_at;
    return;
  end if;

  insert into public.support_requests (
    user_id, type, subject, message, status,
    admin_note, reviewed_by, reviewed_at
  ) values (
    v_actor,
    'other',
    'طلب حذف حساب رواج',
    'أطلب حذف حسابي وبياناته الشخصية من منصة رواج. أفهم أن الإدارة ستراجع الطلب وتتحقق من الالتزامات والعمليات المفتوحة قبل تنفيذ الحذف الآمن.',
    'new',
    null,
    null,
    null
  ) returning * into v_request;
  return query select
    v_request.id, v_request.user_id, v_request.type, v_request.status,
    v_request.subject, v_request.message, v_request.created_at, v_request.updated_at;
  return;
exception when unique_violation then
  select * into v_request
  from public.support_requests r
  where r.user_id = v_actor
    and r.subject = 'طلب حذف حساب رواج'
    and r.status in ('new', 'under_review')
  order by r.created_at desc
  limit 1;
  return query select
    v_request.id, v_request.user_id, v_request.type, v_request.status,
    v_request.subject, v_request.message, v_request.created_at, v_request.updated_at;
end;
$$;

revoke all on function public.rawaj_request_my_account_deletion() from public, anon;
grant execute on function public.rawaj_request_my_account_deletion() to authenticated;

comment on function public.rawaj_update_my_profile(
  text, text, text, text, text, text, text, text, text, text
) is 'Updates allowlisted fields for auth.uid() only; status, roles, dates, and media keys are excluded.';
comment on function public.rawaj_fetch_my_verification_requests() is
  'Returns the current account verification history without admin notes, reviewer identity, or document paths.';
comment on function public.rawaj_request_my_account_deletion() is
  'Creates at most one active reviewed deletion request for auth.uid(); it does not delete data directly.';
