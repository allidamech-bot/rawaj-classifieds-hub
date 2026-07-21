\set ON_ERROR_STOP on
\pset pager off

\echo 'SYP Phase A local rehearsal: verify pre-migration baseline'

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'listings'
      and column_name in ('price_denomination', 'price_new_syp_normalized')
  ) then
    raise exception 'syp_phase_a_pre_migration_columns_present';
  end if;
end;
$$;

create temp table syp_phase_a_price_snapshot (
  id uuid primary key,
  price numeric,
  currency text,
  updated_at timestamptz
) on commit preserve rows;

set session_replication_role = replica;

insert into public.profiles (
  id,
  email,
  display_name,
  account_status,
  verification_status
) values (
  'a2100000-0000-4000-8000-000000000001',
  'syp.phase.a.owner@rawaj.test',
  'SYP Phase A Owner',
  'active',
  'unverified'
);

insert into public.listings (
  id,
  owner_id,
  category_id,
  governorate_id,
  title,
  description,
  price,
  currency,
  price_type,
  listing_condition,
  status,
  contact_options,
  details,
  updated_at
) values
  (
    'a2100000-0000-4000-8000-000000000010',
    'a2100000-0000-4000-8000-000000000001',
    'misc',
    'homs',
    'SYP old denomination rehearsal listing',
    'Disposable local fixture for old SYP classification.',
    125000,
    'SYP',
    'fixed',
    'used',
    'draft',
    '{}'::jsonb,
    '{}'::jsonb,
    timestamptz '2026-07-21 01:10:00+00'
  ),
  (
    'a2100000-0000-4000-8000-000000000011',
    'a2100000-0000-4000-8000-000000000001',
    'misc',
    'homs',
    'SYP new denomination rehearsal listing',
    'Disposable local fixture for new SYP classification.',
    1250,
    'SYP',
    'negotiable',
    'used',
    'draft',
    '{}'::jsonb,
    '{}'::jsonb,
    timestamptz '2026-07-21 01:11:00+00'
  ),
  (
    'a2100000-0000-4000-8000-000000000012',
    'a2100000-0000-4000-8000-000000000001',
    'misc',
    'homs',
    'SYP unclassified submission guard listing',
    'Disposable local fixture for the submission guard.',
    5000,
    'SYP',
    'fixed',
    'used',
    'draft',
    '{}'::jsonb,
    '{}'::jsonb,
    timestamptz '2026-07-21 01:12:00+00'
  );

set session_replication_role = origin;

insert into syp_phase_a_price_snapshot (id, price, currency, updated_at)
select id, price, currency, updated_at
from public.listings
where id in (
  'a2100000-0000-4000-8000-000000000010',
  'a2100000-0000-4000-8000-000000000011',
  'a2100000-0000-4000-8000-000000000012'
);

\echo 'SYP Phase A local rehearsal: apply migration'
\ir ../../supabase/migrations/202607210001_syp_denomination_phase_a.sql

\echo 'SYP Phase A local rehearsal: verify additive apply and unchanged prices'

do $$
declare
  v_changed_count bigint;
  v_unclassified_count bigint;
begin
  select count(*)
    into v_changed_count
  from syp_phase_a_price_snapshot snapshot
  join public.listings listing_row using (id)
  where listing_row.price is distinct from snapshot.price
     or listing_row.currency is distinct from snapshot.currency;

  if v_changed_count <> 0 then
    raise exception 'syp_phase_a_price_mutation_detected:%', v_changed_count;
  end if;

  select count(*)
    into v_unclassified_count
  from public.listings
  where id in (
    'a2100000-0000-4000-8000-000000000010',
    'a2100000-0000-4000-8000-000000000011',
    'a2100000-0000-4000-8000-000000000012'
  )
    and price_denomination = 'unclassified'
    and price_new_syp_normalized is null;

  if v_unclassified_count <> 3 then
    raise exception 'syp_phase_a_existing_rows_not_unclassified:%', v_unclassified_count;
  end if;
end;
$$;

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'a2100000-0000-4000-8000-000000000001',
    'role', 'authenticated'
  )::text,
  false
);

\echo 'SYP Phase A local rehearsal: verify owner queue and explicit classification'

do $$
declare
  v_queue_count bigint;
  v_old_updated_at timestamptz;
  v_new_updated_at timestamptz;
begin
  select count(*) into v_queue_count
  from public.rawaj_list_unclassified_syp_prices();

  if v_queue_count < 3 then
    raise exception 'syp_phase_a_owner_queue_incomplete:%', v_queue_count;
  end if;

  select updated_at into v_old_updated_at
  from public.listings
  where id = 'a2100000-0000-4000-8000-000000000010';

  perform *
  from public.rawaj_classify_syp_listing_price(
    'a2100000-0000-4000-8000-000000000010',
    'old',
    v_old_updated_at
  );

  select updated_at into v_new_updated_at
  from public.listings
  where id = 'a2100000-0000-4000-8000-000000000011';

  perform *
  from public.rawaj_classify_syp_listing_price(
    'a2100000-0000-4000-8000-000000000011',
    'new',
    v_new_updated_at
  );

  begin
    perform *
    from public.rawaj_classify_syp_listing_price(
      'a2100000-0000-4000-8000-000000000011',
      'old',
      v_new_updated_at
    );
    raise exception 'syp_phase_a_stale_write_was_accepted';
  exception
    when others then
      if sqlerrm = 'syp_phase_a_stale_write_was_accepted' then
        raise;
      end if;
      if position('syp_denomination_stale_write' in sqlerrm) = 0 then
        raise;
      end if;
  end;
end;
$$;

do $$
declare
  v_old_normalized numeric;
  v_new_normalized numeric;
begin
  select price_new_syp_normalized into v_old_normalized
  from public.listings
  where id = 'a2100000-0000-4000-8000-000000000010';

  select price_new_syp_normalized into v_new_normalized
  from public.listings
  where id = 'a2100000-0000-4000-8000-000000000011';

  if v_old_normalized is distinct from 1250 then
    raise exception 'syp_phase_a_old_normalization_wrong:%', v_old_normalized;
  end if;

  if v_new_normalized is distinct from 1250 then
    raise exception 'syp_phase_a_new_normalization_wrong:%', v_new_normalized;
  end if;
end;
$$;

\echo 'SYP Phase A local rehearsal: verify submission guard'

do $$
begin
  begin
    perform *
    from public.rawaj_submit_listing_for_review(
      'a2100000-0000-4000-8000-000000000012'
    );
    raise exception 'syp_phase_a_unclassified_submission_was_accepted';
  exception
    when others then
      if sqlerrm = 'syp_phase_a_unclassified_submission_was_accepted' then
        raise;
      end if;
      if position('syp_price_denomination_required' in sqlerrm) = 0 then
        raise;
      end if;
  end;
end;
$$;

\echo 'SYP Phase A local rehearsal: apply rollback'
\ir syp-denomination-phase-a-rollback.sql

\echo 'SYP Phase A local rehearsal: verify baseline restoration and backup evidence'

do $$
declare
  v_changed_count bigint;
  v_backup_count bigint;
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'listings'
      and column_name in ('price_denomination', 'price_new_syp_normalized')
  ) then
    raise exception 'syp_phase_a_rollback_columns_remain';
  end if;

  if to_regprocedure('public.rawaj_classify_syp_listing_price(uuid,text,timestamp with time zone)') is not null
     or to_regprocedure('public.rawaj_list_unclassified_syp_prices()') is not null
  then
    raise exception 'syp_phase_a_rollback_functions_remain';
  end if;

  select count(*)
    into v_changed_count
  from syp_phase_a_price_snapshot snapshot
  join public.listings listing_row using (id)
  where listing_row.price is distinct from snapshot.price
     or listing_row.currency is distinct from snapshot.currency;

  if v_changed_count <> 0 then
    raise exception 'syp_phase_a_rollback_price_mutation_detected:%', v_changed_count;
  end if;

  select count(*) into v_backup_count
  from public.rawaj_syp_denomination_rollback_backup
  where source_table = 'listings'
    and row_key in (
      'a2100000-0000-4000-8000-000000000010',
      'a2100000-0000-4000-8000-000000000011'
    );

  if v_backup_count <> 2 then
    raise exception 'syp_phase_a_rollback_backup_incomplete:%', v_backup_count;
  end if;
end;
$$;

\echo 'SYP Phase A local rehearsal: re-apply migration after rollback'
\ir ../../supabase/migrations/202607210001_syp_denomination_phase_a.sql

\echo 'SYP Phase A local rehearsal: verify clean re-apply'

do $$
declare
  v_changed_count bigint;
  v_unclassified_count bigint;
begin
  select count(*)
    into v_changed_count
  from syp_phase_a_price_snapshot snapshot
  join public.listings listing_row using (id)
  where listing_row.price is distinct from snapshot.price
     or listing_row.currency is distinct from snapshot.currency;

  if v_changed_count <> 0 then
    raise exception 'syp_phase_a_reapply_price_mutation_detected:%', v_changed_count;
  end if;

  select count(*)
    into v_unclassified_count
  from public.listings
  where id in (
    'a2100000-0000-4000-8000-000000000010',
    'a2100000-0000-4000-8000-000000000011',
    'a2100000-0000-4000-8000-000000000012'
  )
    and price_denomination = 'unclassified'
    and price_new_syp_normalized is null;

  if v_unclassified_count <> 3 then
    raise exception 'syp_phase_a_reapply_default_wrong:%', v_unclassified_count;
  end if;
end;
$$;

select jsonb_build_object(
  'status', 'pass',
  'fixture_count', (select count(*) from syp_phase_a_price_snapshot),
  'prices_unchanged', true,
  'initial_apply_verified', true,
  'owner_classification_verified', true,
  'stale_write_rejected', true,
  'unclassified_submission_rejected', true,
  'rollback_verified', true,
  'rollback_backup_rows', (
    select count(*)
    from public.rawaj_syp_denomination_rollback_backup
    where source_table = 'listings'
      and row_key in (
        'a2100000-0000-4000-8000-000000000010',
        'a2100000-0000-4000-8000-000000000011'
      )
  ),
  'reapply_verified', true
) as syp_phase_a_local_rehearsal_evidence;
