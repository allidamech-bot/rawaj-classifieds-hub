-- RAWAJ ad-placement URL integrity hardening.
--
-- Prevent future polluted URL values without scanning, rewriting, or deleting
-- existing Production rows. NOT VALID constraints are enforced for new and
-- updated rows while intentionally skipping validation of historical data.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.ad_placements'::regclass
      and conname = 'ad_placements_image_url_https_check'
  ) then
    alter table public.ad_placements
      add constraint ad_placements_image_url_https_check
      check (
        char_length(image_url) between 1 and 2048
        and image_url ~ '^https://[^[:space:]]+$'
      ) not valid;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.ad_placements'::regclass
      and conname = 'ad_placements_destination_url_https_check'
  ) then
    alter table public.ad_placements
      add constraint ad_placements_destination_url_https_check
      check (
        char_length(destination_url) between 1 and 2048
        and destination_url ~ '^https://[^[:space:]]+$'
      ) not valid;
  end if;
end;
$$;
