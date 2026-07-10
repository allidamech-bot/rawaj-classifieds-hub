-- RAWAJ Verification Documents V2.
--
-- Adds a private, owner-scoped evidence bucket and a governed verification-request
-- creation RPC. A request is created only after the database verifies that the exact
-- uploaded object belongs to auth.uid() and to the client-generated request UUID.
-- Existing verification rows are preserved. Legacy rows may still have null document_path.

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

-- Owners may upload only below: <auth.uid()>/<request_uuid>/<file>.
drop policy if exists "RAWAJ verification document owner upload" on storage.objects;
create policy "RAWAJ verification document owner upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'verification-documents'
  and auth.uid()::text = (storage.foldername(name))[1]
  and public.rawaj_safe_uuid((storage.foldername(name))[2]) is not null
);

-- Owners may read only their own private evidence objects.
drop policy if exists "RAWAJ verification document owner read" on storage.objects;
create policy "RAWAJ verification document owner read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'verification-documents'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- Verification evidence is reviewable only by active owner/admin authority and only
-- when the object is actually referenced by a verification request.
drop policy if exists "RAWAJ verification document reviewer read" on storage.objects;
create policy "RAWAJ verification document reviewer read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'verification-documents'
  and public.current_user_is_admin_like()
  and exists (
    select 1
    from public.seller_verification_requests r
    where r.document_path = storage.objects.name
  )
);

-- Owners may clean up failed, unattached uploads. Once evidence is linked to a request
-- it becomes immutable from the client side and cannot be removed by the owner.
drop policy if exists "RAWAJ verification document owner cleanup" on storage.objects;
create policy "RAWAJ verification document owner cleanup"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'verification-documents'
  and auth.uid()::text = (storage.foldername(name))[1]
  and not exists (
    select 1
    from public.seller_verification_requests r
    where r.document_path = storage.objects.name
  )
);

create or replace function public.rawaj_create_verification_request_v2(
  p_request_id uuid,
  p_request_type text,
  p_legal_name text,
  p_business_name text,
  p_document_type text,
  p_document_path text
)
returns public.seller_verification_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_legal_name text := btrim(coalesce(p_legal_name, ''));
  v_business_name text := nullif(btrim(coalesce(p_business_name, '')), '');
  v_document_type text := btrim(coalesce(p_document_type, ''));
  v_document_path text := btrim(coalesce(p_document_path, ''));
  v_request public.seller_verification_requests%rowtype;
begin
  if v_actor is null then
    raise exception 'verification_auth_required';
  end if;

  if p_request_id is null then
    raise exception 'verification_invalid_request_id';
  end if;

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

    if v_document_type not in (
      'commercial_registration',
      'business_license',
      'tax_document'
    ) then
      raise exception 'verification_invalid_document_type';
    end if;
  else
    v_business_name := null;

    if v_document_type not in (
      'national_id',
      'passport',
      'other_government_id'
    ) then
      raise exception 'verification_invalid_document_type';
    end if;
  end if;

  if v_document_path = '' then
    raise exception 'verification_document_required';
  end if;

  if exists (
    select 1
    from public.seller_verification_requests r
    where r.user_id = v_actor
      and r.status = 'pending_review'
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
  ) then
    raise exception 'verification_document_not_owned';
  end if;

  insert into public.seller_verification_requests (
    id,
    user_id,
    status,
    request_type,
    legal_name,
    business_name,
    document_type,
    document_path,
    admin_note,
    reviewed_by,
    reviewed_at
  )
  values (
    p_request_id,
    v_actor,
    'pending_review',
    p_request_type,
    v_legal_name,
    v_business_name,
    v_document_type,
    v_document_path,
    null,
    null,
    null
  )
  returning * into v_request;

  begin
    perform public.rawaj_insert_audit_log(
      'seller_verification.requested',
      'seller_verification_requests',
      v_request.id::text,
      jsonb_build_object(
        'request_type', p_request_type,
        'document_type', v_document_type,
        'has_document', true
      )
    );
  exception when others then null;
  end;

  return v_request;
exception
  when unique_violation then
    raise exception 'verification_request_already_pending';
end;
$$;

revoke all on function public.rawaj_create_verification_request_v2(
  uuid,
  text,
  text,
  text,
  text,
  text
) from public;
revoke all on function public.rawaj_create_verification_request_v2(
  uuid,
  text,
  text,
  text,
  text,
  text
) from anon;
grant execute on function public.rawaj_create_verification_request_v2(
  uuid,
  text,
  text,
  text,
  text,
  text
) to authenticated;

comment on function public.rawaj_create_verification_request_v2(uuid, text, text, text, text, text) is
  'Creates an authenticated verification request only after validating a private owner-scoped evidence object.';

-- V2 creation is RPC-only. Remove the legacy direct insert path.
drop policy if exists "seller_verification_user_insert"
  on public.seller_verification_requests;

-- Align server-side verification review authority with the product permission matrix:
-- active owner/admin accounts can manage verifications; generic moderators cannot.
drop policy if exists "seller_verification_admin_select"
  on public.seller_verification_requests;
create policy "seller_verification_admin_select"
on public.seller_verification_requests for select
to authenticated
using (public.current_user_is_admin_like());

create or replace function public.rawaj_admin_moderate_verification_request(
  p_request_id uuid,
  p_status text,
  p_admin_note text,
  p_expected_updated_at timestamptz
)
returns table (
  request_id uuid,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_request_id uuid;
  v_updated_at timestamptz;
begin
  if v_actor is null
     or not public.current_user_is_admin_like() then
    raise exception 'Verification moderation permission required.';
  end if;

  if p_status not in ('approved', 'rejected') then
    raise exception 'Unsupported verification status.';
  end if;

  if p_expected_updated_at is null then
    raise exception 'Expected verification timestamp is required.';
  end if;

  update public.seller_verification_requests
  set
    status = p_status,
    admin_note = nullif(btrim(coalesce(p_admin_note, '')), '')
  where seller_verification_requests.id = p_request_id
    and seller_verification_requests.status = 'pending_review'
    and seller_verification_requests.updated_at = p_expected_updated_at
  returning
    seller_verification_requests.id,
    seller_verification_requests.updated_at
  into
    v_request_id,
    v_updated_at;

  if v_request_id is null then
    if exists (
      select 1
      from public.seller_verification_requests r
      where r.id = p_request_id
    ) then
      raise exception 'stale_verification_request';
    end if;

    raise exception 'Verification request does not exist.';
  end if;

  perform public.rawaj_insert_audit_log(
    'seller_verification.moderated',
    'seller_verification_requests',
    v_request_id::text,
    jsonb_build_object(
      'status', p_status,
      'has_admin_note', nullif(btrim(coalesce(p_admin_note, '')), '') is not null
    )
  );

  return query
  select
    v_request_id,
    v_updated_at;
end;
$$;

revoke all on function public.rawaj_admin_moderate_verification_request(
  uuid,
  text,
  text,
  timestamptz
) from public;
revoke all on function public.rawaj_admin_moderate_verification_request(
  uuid,
  text,
  text,
  timestamptz
) from anon;
grant execute on function public.rawaj_admin_moderate_verification_request(
  uuid,
  text,
  text,
  timestamptz
) to authenticated;
