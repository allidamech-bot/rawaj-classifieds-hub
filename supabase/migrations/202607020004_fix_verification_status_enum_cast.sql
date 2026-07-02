-- Fix: CASE expression in rawaj_apply_verification_moderation() returns text
-- but profiles.verification_status is rawaj_verification_status enum.
-- Cast the CASE result to the enum type to avoid:
--   column "verification_status" is of type rawaj_verification_status
--   but expression is of type text

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
    set verification_status = (
      case
        when new.status = 'approved' then 'verified'::public.rawaj_verification_status
        when new.status = 'rejected' then 'rejected'::public.rawaj_verification_status
        else 'pending'::public.rawaj_verification_status
      end
    )
    where id = new.user_id;
  end if;

  return new;
end;
$$;