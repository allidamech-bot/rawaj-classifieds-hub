-- RAWAJ owner-only delete for funded ad placements.
-- Supports stale-safe optimistic concurrency, audit logging, and best-effort
-- storage cleanup of the ad image after the row is removed.
--
-- Apply manually to Supabase Production after review.
-- Owner/admin access must come from Supabase role tables and RLS, not frontend checks.

create or replace function public.rawaj_owner_delete_ad_placement(
  p_id uuid,
  p_expected_version bigint,
  p_reason text
)
returns table (id uuid, image_url text, storage_path text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
  v_image_url text;
  v_storage_path text;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if v_actor is null or not public.current_user_has_role('owner') then
    raise exception 'Owner permission required.';
  end if;

  if p_id is null then
    raise exception 'Ad placement id is required.';
  end if;

  if p_expected_version is null then
    raise exception 'Expected version is required for deletion.';
  end if;

  if char_length(v_reason) < 3 then
    raise exception 'A clear deletion reason is required for audit.';
  end if;

  select a.id, a.image_url
    into v_id, v_image_url
  from public.ad_placements a
  where a.id = p_id
    and a.version = p_expected_version;

  if v_id is null then
    if exists (select 1 from public.ad_placements a where a.id = p_id) then
      raise exception 'stale_ad_placement';
    end if;
    raise exception 'Ad placement does not exist.';
  end if;

  v_storage_path := public.rawaj_ad_placement_storage_path(v_image_url);

  delete from public.ad_placements a
  where a.id = p_id
    and a.version = p_expected_version;

  if not found then
    raise exception 'stale_ad_placement';
  end if;

  perform public.rawaj_insert_audit_log(
    'ad_placement.deleted',
    'ad_placements',
    p_id::text,
    jsonb_build_object(
      'name', v_image_url,
      'image_url', v_image_url,
      'storage_path', v_storage_path,
      'reason', v_reason
    )
  );

  return query select p_id, v_image_url, v_storage_path;
end;
$$;

create or replace function public.rawaj_ad_placement_storage_path(p_image_url text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_image_url is null or btrim(p_image_url) = '' then null
    when strpos(p_image_url, '/object/public/ad-placement-media/') > 0
      then substring(p_image_url from (strpos(p_image_url, '/object/public/ad-placement-media/') + length('/object/public/ad-placement-media/')))
    when strpos(p_image_url, '/object/ad-placement-media/') > 0
      then substring(p_image_url from (strpos(p_image_url, '/object/ad-placement-media/') + length('/object/ad-placement-media/')))
    when strpos(p_image_url, '/ad-placement-media/') > 0
      then substring(p_image_url from (strpos(p_image_url, '/ad-placement-media/') + length('/ad-placement-media/')))
    else null
  end;
$$;

revoke all on function public.rawaj_owner_delete_ad_placement(uuid, bigint, text) from public;
revoke all on function public.rawaj_owner_delete_ad_placement(uuid, bigint, text) from anon;
grant execute on function public.rawaj_owner_delete_ad_placement(uuid, bigint, text) to authenticated;

revoke all on function public.rawaj_ad_placement_storage_path(text) from public;
revoke all on function public.rawaj_ad_placement_storage_path(text) from anon;
revoke all on function public.rawaj_ad_placement_storage_path(text) from authenticated;
