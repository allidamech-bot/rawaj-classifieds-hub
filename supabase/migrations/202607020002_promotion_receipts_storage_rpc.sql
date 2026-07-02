-- RAWAJ private promotion receipt storage and safe attach RPC.
-- Manual review required. Do not apply automatically from frontend tooling.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'promotion-receipts',
  'promotion-receipts',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "RAWAJ promotion receipt owner upload" on storage.objects;
create policy "RAWAJ promotion receipt owner upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'promotion-receipts'
  and auth.uid()::text = (storage.foldername(name))[1]
  and exists (
    select 1
    from public.listing_promotion_requests pr
    where pr.id::text = (storage.foldername(name))[2]
      and pr.requester_user_id = auth.uid()
      and pr.status = 'pending_review'
  )
);

drop policy if exists "RAWAJ promotion receipt owner read" on storage.objects;
create policy "RAWAJ promotion receipt owner read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'promotion-receipts'
  and auth.uid()::text = (storage.foldername(name))[1]
  and exists (
    select 1
    from public.listing_promotion_requests pr
    where pr.id::text = (storage.foldername(name))[2]
      and pr.requester_user_id = auth.uid()
      and pr.proof_path = storage.objects.name
  )
);

drop policy if exists "RAWAJ promotion receipt moderators read" on storage.objects;
create policy "RAWAJ promotion receipt moderators read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'promotion-receipts'
  and public.current_user_can_moderate()
  and exists (
    select 1
    from public.listing_promotion_requests pr
    where pr.proof_path = storage.objects.name
  )
);

drop policy if exists "RAWAJ promotion receipt owner delete pending" on storage.objects;
create policy "RAWAJ promotion receipt owner delete pending"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'promotion-receipts'
  and auth.uid()::text = (storage.foldername(name))[1]
  and exists (
    select 1
    from public.listing_promotion_requests pr
    where pr.id::text = (storage.foldername(name))[2]
      and pr.requester_user_id = auth.uid()
      and pr.status = 'pending_review'
      and pr.proof_path = storage.objects.name
  )
);

create or replace function public.rawaj_apply_promotion_moderation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  receipt_only_change boolean;
begin
  receipt_only_change :=
    new.listing_id is not distinct from old.listing_id
    and new.requester_user_id is not distinct from old.requester_user_id
    and new.promotion_type is not distinct from old.promotion_type
    and new.requested_days is not distinct from old.requested_days
    and new.payment_method is not distinct from old.payment_method
    and new.payment_reference is not distinct from old.payment_reference
    and new.created_at is not distinct from old.created_at
    and new.status is not distinct from old.status
    and new.admin_note is not distinct from old.admin_note
    and new.reviewed_by is not distinct from old.reviewed_by
    and new.reviewed_at is not distinct from old.reviewed_at
    and new.starts_at is not distinct from old.starts_at
    and new.ends_at is not distinct from old.ends_at
    and new.proof_path is distinct from old.proof_path;

  if receipt_only_change then
    if old.status <> 'pending_review' then
      raise exception 'Receipts can only be attached while the promotion request is pending review.';
    end if;

    if old.requester_user_id is distinct from auth.uid() then
      raise exception 'Only the promotion request owner can attach a receipt.';
    end if;

    return new;
  end if;

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

      perform set_config('rawaj.promotion_moderation', 'on', true);
      update public.listings
      set is_featured = true,
          featured_until = new.ends_at,
          updated_at = now()
      where id = new.listing_id
        and owner_id = new.requester_user_id
        and status = 'approved';
      perform set_config('rawaj.promotion_moderation', 'off', true);
    elsif new.status in ('cancelled', 'expired')
      and old.status = 'approved'
      and old.ends_at is not null
      and (new.status = 'cancelled' or old.ends_at <= now())
    then
      perform set_config('rawaj.promotion_moderation', 'on', true);
      update public.listings
      set is_featured = false,
          featured_until = null,
          updated_at = now()
      where id = new.listing_id
        and owner_id = new.requester_user_id
        and status = 'approved'
        and featured_until is not distinct from old.ends_at;
      perform set_config('rawaj.promotion_moderation', 'off', true);
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.rawaj_attach_promotion_receipt(
  request_id uuid,
  receipt_path text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if receipt_path is null or btrim(receipt_path) = '' then
    raise exception 'Receipt path is required.';
  end if;

  if not exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'promotion-receipts'
      and o.name = btrim(receipt_path)
      and (storage.foldername(o.name))[1] = auth.uid()::text
      and (storage.foldername(o.name))[2] = request_id::text
  ) then
    raise exception 'Receipt object does not exist or path does not belong to this request/user.';
  end if;

  if not exists (
    select 1
    from public.listing_promotion_requests pr
    where pr.id = request_id
      and pr.requester_user_id = auth.uid()
      and pr.status = 'pending_review'
  ) then
    raise exception 'Promotion request was not found or cannot accept a receipt.';
  end if;

  update public.listing_promotion_requests
  set proof_path = btrim(receipt_path)
  where id = request_id
    and requester_user_id = auth.uid()
    and status = 'pending_review';

  if not found then
    raise exception 'Promotion request was not found or cannot accept a receipt.';
  end if;
end;
$$;

revoke execute on function public.rawaj_attach_promotion_receipt(uuid, text) from public;
grant execute on function public.rawaj_attach_promotion_receipt(uuid, text) to authenticated;

comment on function public.rawaj_attach_promotion_receipt(uuid, text) is
  'Attaches a private promotion receipt path to a pending request owned by the current authenticated user.';
