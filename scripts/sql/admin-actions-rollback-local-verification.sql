\set ON_ERROR_STOP on

begin;

create temp table admin_action_test_results (
  action_name text primary key,
  entity_id uuid,
  version bigint,
  payload jsonb not null default '{}'::jsonb
) on commit drop;
grant all on table admin_action_test_results to authenticated;

set local session_replication_role = replica;

insert into public.profiles (
  id,
  email,
  display_name,
  account_status,
  verification_status
) values
  ('a1100000-0000-4000-8000-000000000001', 'owner.rollback@rawaj.test', 'Rollback Owner', 'active', 'unverified'),
  ('a1100000-0000-4000-8000-000000000002', 'seller.rollback@rawaj.test', 'Rollback Seller', 'active', 'unverified'),
  ('a1100000-0000-4000-8000-000000000003', 'reporter.rollback@rawaj.test', 'Rollback Reporter', 'active', 'unverified'),
  ('a1100000-0000-4000-8000-000000000004', 'third.rollback@rawaj.test', 'Rollback Third User', 'active', 'unverified');

insert into public.user_roles (user_id, role, assigned_by, note) values
  ('a1100000-0000-4000-8000-000000000001', 'owner', 'a1100000-0000-4000-8000-000000000001', 'Rollback owner fixture'),
  ('a1100000-0000-4000-8000-000000000002', 'user', 'a1100000-0000-4000-8000-000000000001', 'Rollback user fixture'),
  ('a1100000-0000-4000-8000-000000000003', 'user', 'a1100000-0000-4000-8000-000000000001', 'Rollback user fixture'),
  ('a1100000-0000-4000-8000-000000000004', 'user', 'a1100000-0000-4000-8000-000000000001', 'Rollback user fixture');

insert into public.owner_system_controls (
  key,
  enabled,
  reason,
  version,
  updated_by,
  updated_at
) values (
  'freeze_promotions',
  false,
  'Rollback fixture baseline',
  1,
  'a1100000-0000-4000-8000-000000000001',
  timestamptz '2026-07-20 14:20:00+00'
) on conflict (key) do update set
  enabled = excluded.enabled,
  reason = excluded.reason,
  version = excluded.version,
  updated_by = excluded.updated_by,
  updated_at = excluded.updated_at;

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
) values (
  'a1100000-0000-4000-8000-000000000010',
  'a1100000-0000-4000-8000-000000000002',
  'misc',
  'homs',
  'RAWAJ admin rollback integration listing',
  'Temporary fixture used only inside a transaction that is rolled back.',
  100,
  'SYP',
  'fixed',
  'used',
  'pending_review',
  '{}'::jsonb,
  '{}'::jsonb,
  timestamptz '2026-07-20 14:20:10+00'
);

insert into public.listing_reports (
  id,
  listing_id,
  reporter_id,
  report_type,
  reason,
  status,
  updated_at
) values (
  'a1100000-0000-4000-8000-000000000011',
  'a1100000-0000-4000-8000-000000000010',
  'a1100000-0000-4000-8000-000000000003',
  'wrong_info',
  'Rollback integration report reason',
  'new',
  timestamptz '2026-07-20 14:20:11+00'
);

insert into public.message_reports (
  id,
  reporter_user_id,
  reported_user_id,
  reason,
  details,
  status,
  updated_at
) values (
  'a1100000-0000-4000-8000-000000000012',
  'a1100000-0000-4000-8000-000000000003',
  'a1100000-0000-4000-8000-000000000002',
  'spam',
  'Rollback integration message report',
  'new',
  timestamptz '2026-07-20 14:20:12+00'
);

insert into public.listing_promotion_requests (
  id,
  listing_id,
  requester_user_id,
  promotion_type,
  status,
  requested_days,
  updated_at
) values (
  'a1100000-0000-4000-8000-000000000013',
  'a1100000-0000-4000-8000-000000000010',
  'a1100000-0000-4000-8000-000000000002',
  'featured_home',
  'pending_review',
  7,
  timestamptz '2026-07-20 14:20:13+00'
);

insert into public.seller_verification_requests (
  id,
  user_id,
  status,
  request_type,
  legal_name,
  updated_at
) values (
  'a1100000-0000-4000-8000-000000000014',
  'a1100000-0000-4000-8000-000000000002',
  'pending_review',
  'personal',
  'Rollback Verification User',
  timestamptz '2026-07-20 14:20:14+00'
);

insert into public.seller_reviews (
  id,
  seller_user_id,
  reviewer_user_id,
  related_listing_id,
  rating,
  comment,
  status,
  updated_at
) values (
  'a1100000-0000-4000-8000-000000000015',
  'a1100000-0000-4000-8000-000000000002',
  'a1100000-0000-4000-8000-000000000003',
  'a1100000-0000-4000-8000-000000000010',
  5,
  'Rollback seller review fixture with sufficient length.',
  'pending_review',
  timestamptz '2026-07-20 14:20:15+00'
);

insert into public.seller_review_reports (
  id,
  review_id,
  reporter_user_id,
  reported_reviewer_user_id,
  reason,
  details,
  status,
  updated_at
) values (
  'a1100000-0000-4000-8000-000000000016',
  'a1100000-0000-4000-8000-000000000015',
  'a1100000-0000-4000-8000-000000000004',
  'a1100000-0000-4000-8000-000000000003',
  'other',
  'Rollback seller review report fixture',
  'new',
  timestamptz '2026-07-20 14:20:16+00'
);

insert into public.support_requests (
  id,
  user_id,
  type,
  status,
  subject,
  message,
  updated_at
) values (
  'a1100000-0000-4000-8000-000000000017',
  'a1100000-0000-4000-8000-000000000002',
  'technical_issue',
  'new',
  'Rollback support fixture',
  'This is an isolated support request created only for rollback integration testing.',
  timestamptz '2026-07-20 14:20:17+00'
);

insert into public.listing_data_quality_issues (
  id,
  issue_key,
  listing_id,
  taxonomy_version_id,
  category_id,
  issue_type,
  issue_code,
  severity,
  status,
  evidence,
  updated_at
) values (
  'a1100000-0000-4000-8000-000000000018',
  'rollback:admin-action-integrity:a1100000',
  'a1100000-0000-4000-8000-000000000010',
  'a1100000-0000-4000-8000-000000000099',
  'misc',
  'required_field',
  'missing_test_field',
  'warning',
  'open',
  '{}'::jsonb,
  timestamptz '2026-07-20 14:20:18+00'
);

set local session_replication_role = origin;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a1100000-0000-4000-8000-000000000001', true);

DO $verification$
DECLARE
  v_record record;
  v_campaign record;
  v_creative record;
  v_safety record;
  v_placement record;
  v_control record;
  v_json jsonb;
  v_uuid uuid;
  v_count bigint;
BEGIN
  IF auth.uid() <> 'a1100000-0000-4000-8000-000000000001'::uuid
     OR NOT public.current_user_has_role('owner')
     OR NOT public.current_user_is_admin_like()
     OR NOT public.current_user_can_moderate() THEN
    RAISE EXCEPTION 'admin_owner_authentication_context_invalid';
  END IF;

  SELECT * INTO STRICT v_record
  FROM public.rawaj_admin_moderate_listing(
    'a1100000-0000-4000-8000-000000000010',
    'approve',
    'Rollback action verification',
    timestamptz '2026-07-20 14:20:10+00',
    null
  );
  IF v_record.previous_status <> 'pending_review' OR v_record.next_status <> 'approved' THEN
    RAISE EXCEPTION 'listing_moderation_result_invalid';
  END IF;
  INSERT INTO admin_action_test_results VALUES (
    'listing_moderation', v_record.listing_id, null, to_jsonb(v_record)
  );

  SELECT * INTO STRICT v_record
  FROM public.rawaj_admin_moderate_listing_report_v2(
    'a1100000-0000-4000-8000-000000000011',
    'resolved',
    'Rollback action verification',
    timestamptz '2026-07-20 14:20:11+00'
  );
  INSERT INTO admin_action_test_results VALUES (
    'listing_report', v_record.report_id, null, to_jsonb(v_record)
  );

  SELECT * INTO STRICT v_record
  FROM public.rawaj_admin_moderate_message_report(
    'a1100000-0000-4000-8000-000000000012',
    'resolved',
    'Rollback action verification',
    timestamptz '2026-07-20 14:20:12+00'
  );
  INSERT INTO admin_action_test_results VALUES (
    'message_report', v_record.report_id, null, to_jsonb(v_record)
  );

  SELECT * INTO STRICT v_record
  FROM public.rawaj_admin_moderate_promotion_request(
    'a1100000-0000-4000-8000-000000000013',
    'approved',
    'Rollback action verification',
    timestamptz '2026-07-20 14:20:13+00'
  );
  INSERT INTO admin_action_test_results VALUES (
    'promotion_request', v_record.request_id, null, to_jsonb(v_record)
  );

  SELECT * INTO STRICT v_record
  FROM public.rawaj_admin_moderate_verification_request(
    'a1100000-0000-4000-8000-000000000014',
    'approved',
    'Rollback action verification',
    timestamptz '2026-07-20 14:20:14+00'
  );
  INSERT INTO admin_action_test_results VALUES (
    'verification_request', v_record.request_id, null, to_jsonb(v_record)
  );

  SELECT * INTO STRICT v_record
  FROM public.rawaj_admin_moderate_seller_review(
    'a1100000-0000-4000-8000-000000000015',
    'approved',
    'Rollback action verification',
    timestamptz '2026-07-20 14:20:15+00'
  );
  INSERT INTO admin_action_test_results VALUES (
    'seller_review', v_record.review_id, null, to_jsonb(v_record)
  );

  SELECT * INTO STRICT v_record
  FROM public.rawaj_admin_moderate_seller_review_report(
    'a1100000-0000-4000-8000-000000000016',
    'resolved',
    'Rollback action verification',
    timestamptz '2026-07-20 14:20:16+00'
  );
  INSERT INTO admin_action_test_results VALUES (
    'seller_review_report', v_record.report_id, null, to_jsonb(v_record)
  );

  SELECT * INTO STRICT v_record
  FROM public.rawaj_admin_moderate_support_request(
    'a1100000-0000-4000-8000-000000000017',
    'resolved',
    'تم حل طلب الاختبار المؤقت.',
    'Rollback action verification',
    timestamptz '2026-07-20 14:20:17+00'
  );
  INSERT INTO admin_action_test_results VALUES (
    'support_request', v_record.request_id, null, to_jsonb(v_record)
  );

  v_json := public.rawaj_admin_review_listing_data_quality_v1(
    'a1100000-0000-4000-8000-000000000018',
    'resolve',
    'Rollback action verification',
    timestamptz '2026-07-20 14:20:18+00'
  );
  IF v_json ->> 'status' <> 'resolved' THEN
    RAISE EXCEPTION 'data_quality_review_result_invalid_%', v_json;
  END IF;
  INSERT INTO admin_action_test_results VALUES (
    'data_quality_review',
    'a1100000-0000-4000-8000-000000000018',
    null,
    v_json
  );

  SELECT * INTO STRICT v_control
  FROM public.rawaj_owner_list_system_controls()
  WHERE key = 'freeze_promotions';

  SELECT * INTO STRICT v_record
  FROM public.rawaj_owner_set_system_control(
    v_control.key,
    NOT v_control.enabled,
    'Rollback system control verification',
    v_control.version
  );
  IF v_record.version <> v_control.version + 1 THEN
    RAISE EXCEPTION 'system_control_version_invalid';
  END IF;
  INSERT INTO admin_action_test_results VALUES (
    'system_control', null, v_record.version, to_jsonb(v_record)
  );

  BEGIN
    PERFORM public.rawaj_owner_set_system_control(
      v_control.key,
      v_control.enabled,
      'Expected stale control verification',
      v_control.version
    );
    RAISE EXCEPTION 'system_control_stale_write_not_rejected';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT ILIKE '%stale_system_control%' THEN
        RAISE;
      END IF;
  END;

  PERFORM public.rawaj_manage_user_account(
    'a1100000-0000-4000-8000-000000000002',
    'frozen',
    'Rollback account freeze verification'
  );
  PERFORM public.rawaj_manage_user_account(
    'a1100000-0000-4000-8000-000000000002',
    'active',
    'Rollback account restore verification'
  );
  INSERT INTO admin_action_test_results VALUES (
    'user_account_status',
    'a1100000-0000-4000-8000-000000000002',
    null,
    jsonb_build_object('status', 'active')
  );

  v_uuid := public.rawaj_set_user_restriction(
    'a1100000-0000-4000-8000-000000000002',
    'messaging',
    'Rollback restriction verification',
    now() + interval '1 day'
  );
  PERFORM public.rawaj_lift_user_restriction(
    'a1100000-0000-4000-8000-000000000002',
    'messaging',
    'Rollback restriction lift verification'
  );
  INSERT INTO admin_action_test_results VALUES (
    'user_restriction', v_uuid, null, jsonb_build_object('lifted', true)
  );

  PERFORM public.rawaj_owner_assign_staff_role(
    'a1100000-0000-4000-8000-000000000004',
    'moderator',
    'Rollback role assignment verification'
  );
  PERFORM public.rawaj_owner_remove_staff_role(
    'a1100000-0000-4000-8000-000000000004',
    'moderator',
    'Rollback role removal verification'
  );
  INSERT INTO admin_action_test_results VALUES (
    'staff_role',
    'a1100000-0000-4000-8000-000000000004',
    null,
    jsonb_build_object('removed', true)
  );

  SELECT * INTO STRICT v_safety
  FROM public.rawaj_safety_upsert_case(
    null,
    'account',
    'a1100000-0000-4000-8000-000000000002',
    'a1100000-0000-4000-8000-000000000002',
    'Rollback safety integration case',
    'Temporary case used to exercise create, update, note, link, status, and escalation.',
    'medium',
    'a1100000-0000-4000-8000-000000000001',
    null
  );
  IF v_safety.version <> 1 THEN
    RAISE EXCEPTION 'safety_create_version_invalid_%', v_safety.version;
  END IF;

  v_uuid := public.rawaj_safety_add_case_note(
    v_safety.id,
    'Rollback safety note verification'
  );
  PERFORM public.rawaj_safety_add_case_link(
    v_safety.id,
    'account',
    'a1100000-0000-4000-8000-000000000002'
  );

  SELECT * INTO STRICT v_safety
  FROM public.rawaj_safety_upsert_case(
    v_safety.id,
    'account',
    'a1100000-0000-4000-8000-000000000002',
    'a1100000-0000-4000-8000-000000000002',
    'Rollback safety integration case updated',
    'Updated temporary case used to verify optimistic concurrency.',
    'high',
    'a1100000-0000-4000-8000-000000000001',
    v_safety.version
  );

  SELECT * INTO STRICT v_safety
  FROM public.rawaj_safety_set_case_status(
    v_safety.id,
    'investigating',
    v_safety.version,
    'Rollback safety status verification',
    null
  );

  SELECT * INTO STRICT v_safety
  FROM public.rawaj_safety_escalate_case(
    v_safety.id,
    v_safety.version,
    'Rollback safety escalation verification'
  );

  SELECT * INTO STRICT v_safety
  FROM public.rawaj_safety_set_case_status(
    v_safety.id,
    'closed',
    v_safety.version,
    'Rollback safety closure verification',
    'Temporary case resolved successfully inside rollback transaction.'
  );
  INSERT INTO admin_action_test_results VALUES (
    'safety_case', v_safety.id, v_safety.version, to_jsonb(v_safety)
  );

  SELECT * INTO STRICT v_campaign
  FROM public.rawaj_owner_upsert_campaign(
    null,
    'Rollback campaign integration',
    'draft',
    now(),
    now() + interval '7 days',
    array['home', 'offers']::text[],
    array['misc']::text[],
    null
  );

  SELECT * INTO STRICT v_campaign
  FROM public.rawaj_owner_upsert_campaign(
    v_campaign.id,
    'Rollback campaign integration updated',
    'draft',
    now(),
    now() + interval '8 days',
    array['home', 'search_results']::text[],
    array['misc', 'cars']::text[],
    v_campaign.version
  );

  SELECT * INTO STRICT v_creative
  FROM public.rawaj_owner_upsert_campaign_creative(
    null,
    v_campaign.id,
    'Rollback campaign creative',
    'https://example.com/rawaj-admin-test-image.webp',
    'https://example.com/rawaj-admin-test-target',
    100,
    true,
    null
  );

  SELECT * INTO STRICT v_creative
  FROM public.rawaj_owner_upsert_campaign_creative(
    v_creative.id,
    v_campaign.id,
    'Rollback campaign creative updated',
    'https://example.com/rawaj-admin-test-image-v2.webp',
    'https://example.com/rawaj-admin-test-target-v2',
    150,
    true,
    v_creative.version
  );

  SELECT * INTO STRICT v_campaign
  FROM public.rawaj_owner_set_campaign_status(
    v_campaign.id,
    'active',
    v_campaign.version,
    'Rollback campaign activation verification'
  );
  INSERT INTO admin_action_test_results VALUES (
    'campaign', v_campaign.id, v_campaign.version, to_jsonb(v_campaign)
  );
  INSERT INTO admin_action_test_results VALUES (
    'campaign_creative', v_creative.id, v_creative.version, to_jsonb(v_creative)
  );

  BEGIN
    PERFORM public.rawaj_owner_set_campaign_status(
      v_campaign.id,
      'paused',
      v_campaign.version - 1,
      'Expected stale campaign verification'
    );
    RAISE EXCEPTION 'campaign_stale_write_not_rejected';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT ILIKE '%stale_campaign%' THEN
        RAISE;
      END IF;
  END;

  SELECT * INTO STRICT v_placement
  FROM public.rawaj_owner_upsert_ad_placement(
    null,
    'Rollback placement integration',
    'home',
    'https://example.com/rawaj-placement.webp',
    'https://example.com/rawaj-placement-target',
    now(),
    now() + interval '2 days',
    'draft',
    10,
    true,
    true,
    null
  );

  SELECT * INTO STRICT v_placement
  FROM public.rawaj_owner_upsert_ad_placement(
    v_placement.id,
    'Rollback placement integration updated',
    'home',
    'https://example.com/rawaj-placement-v2.webp',
    'https://example.com/rawaj-placement-target-v2',
    now(),
    now() + interval '3 days',
    'draft',
    20,
    true,
    true,
    v_placement.version
  );

  SELECT * INTO STRICT v_placement
  FROM public.rawaj_owner_set_ad_placement_status(
    v_placement.id,
    'active',
    v_placement.version,
    'Rollback placement activation verification'
  );

  SELECT * INTO STRICT v_record
  FROM public.rawaj_owner_delete_ad_placement(
    v_placement.id,
    v_placement.version,
    'Rollback placement deletion verification'
  );
  INSERT INTO admin_action_test_results VALUES (
    'ad_placement', v_record.id, v_placement.version, to_jsonb(v_record)
  );

  SELECT count(*) INTO v_count
  FROM public.rawaj_admin_fetch_users();
  IF v_count < 4 THEN
    RAISE EXCEPTION 'admin_user_fetch_missing_fixtures_%', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.rawaj_admin_fetch_audit_logs(500, 0, null)
  WHERE target_id LIKE 'a1100000-0000-4000-8000-%';
  IF v_count < 12 THEN
    RAISE EXCEPTION 'admin_audit_fetch_missing_actions_%', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.rawaj_safety_list_cases(null, 100)
  WHERE id = v_safety.id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'safety_case_read_after_write_failed';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.rawaj_owner_list_campaigns()
  WHERE id = v_campaign.id AND status = 'active';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'campaign_read_after_write_failed';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.rawaj_owner_list_campaign_creatives(v_campaign.id)
  WHERE id = v_creative.id AND version = 2;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'campaign_creative_read_after_write_failed';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.rawaj_admin_command_center_metrics();
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'admin_command_center_metrics_failed';
  END IF;

  INSERT INTO admin_action_test_results VALUES (
    'admin_read_models', null, null, jsonb_build_object('verified', true)
  );
END;
$verification$;

reset role;

DO $assertions$
DECLARE
  v_count bigint;
BEGIN
  IF (SELECT status FROM public.listings WHERE id = 'a1100000-0000-4000-8000-000000000010') <> 'approved' THEN
    RAISE EXCEPTION 'listing_database_mutation_missing';
  END IF;
  IF (SELECT status FROM public.listing_reports WHERE id = 'a1100000-0000-4000-8000-000000000011') <> 'resolved' THEN
    RAISE EXCEPTION 'listing_report_database_mutation_missing';
  END IF;
  IF (SELECT status FROM public.message_reports WHERE id = 'a1100000-0000-4000-8000-000000000012') <> 'resolved' THEN
    RAISE EXCEPTION 'message_report_database_mutation_missing';
  END IF;
  IF (SELECT status FROM public.listing_promotion_requests WHERE id = 'a1100000-0000-4000-8000-000000000013') <> 'approved' THEN
    RAISE EXCEPTION 'promotion_database_mutation_missing';
  END IF;
  IF (SELECT status FROM public.seller_verification_requests WHERE id = 'a1100000-0000-4000-8000-000000000014') <> 'approved' THEN
    RAISE EXCEPTION 'verification_request_database_mutation_missing';
  END IF;
  IF (SELECT verification_status FROM public.profiles WHERE id = 'a1100000-0000-4000-8000-000000000002') <> 'verified' THEN
    RAISE EXCEPTION 'verification_profile_side_effect_missing';
  END IF;
  IF (SELECT status FROM public.seller_reviews WHERE id = 'a1100000-0000-4000-8000-000000000015') <> 'approved' THEN
    RAISE EXCEPTION 'seller_review_database_mutation_missing';
  END IF;
  IF (SELECT status FROM public.seller_review_reports WHERE id = 'a1100000-0000-4000-8000-000000000016') <> 'resolved' THEN
    RAISE EXCEPTION 'seller_review_report_database_mutation_missing';
  END IF;
  IF (SELECT status FROM public.support_requests WHERE id = 'a1100000-0000-4000-8000-000000000017') <> 'resolved' THEN
    RAISE EXCEPTION 'support_database_mutation_missing';
  END IF;
  IF (SELECT status FROM public.listing_data_quality_issues WHERE id = 'a1100000-0000-4000-8000-000000000018') <> 'resolved' THEN
    RAISE EXCEPTION 'data_quality_database_mutation_missing';
  END IF;
  IF (SELECT account_status FROM public.profiles WHERE id = 'a1100000-0000-4000-8000-000000000002') <> 'active' THEN
    RAISE EXCEPTION 'account_restore_database_mutation_missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.user_restrictions
    WHERE user_id = 'a1100000-0000-4000-8000-000000000002'
      AND restriction_type = 'messaging'
      AND lifted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'restriction_lift_database_mutation_missing';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = 'a1100000-0000-4000-8000-000000000004'
      AND role = 'moderator'
  ) THEN
    RAISE EXCEPTION 'staff_role_removal_database_mutation_missing';
  END IF;
  IF (SELECT enabled FROM public.owner_system_controls WHERE key = 'freeze_promotions') IS NOT TRUE
     OR (SELECT version FROM public.owner_system_controls WHERE key = 'freeze_promotions') <> 2 THEN
    RAISE EXCEPTION 'system_control_database_mutation_missing';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.ad_placements
    WHERE id = (SELECT entity_id FROM admin_action_test_results WHERE action_name = 'ad_placement')
  ) THEN
    RAISE EXCEPTION 'ad_placement_delete_database_mutation_missing';
  END IF;

  SELECT count(*) INTO v_count FROM admin_action_test_results;
  IF v_count <> 18 THEN
    RAISE EXCEPTION 'admin_action_result_count_invalid_%', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.audit_logs
  WHERE actor_id = 'a1100000-0000-4000-8000-000000000001';
  IF v_count < 20 THEN
    RAISE EXCEPTION 'admin_audit_side_effect_count_too_low_%', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.notifications
  WHERE actor_id = 'a1100000-0000-4000-8000-000000000001';
  IF v_count < 5 THEN
    RAISE EXCEPTION 'admin_notification_side_effect_count_too_low_%', v_count;
  END IF;

  RAISE NOTICE 'RAWAJ admin action rollback integration passed: 18 action groups, database mutations, read models, audit logs, notifications, authorization, stale-write rejection, and refetch contracts verified.';
END;
$assertions$;

rollback;

DO $rollback_verification$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.profiles WHERE id = 'a1100000-0000-4000-8000-000000000001'
  ) OR EXISTS (
    SELECT 1 FROM public.listings WHERE id = 'a1100000-0000-4000-8000-000000000010'
  ) OR EXISTS (
    SELECT 1 FROM public.audit_logs WHERE actor_id = 'a1100000-0000-4000-8000-000000000001'
  ) OR EXISTS (
    SELECT 1 FROM public.notifications WHERE actor_id = 'a1100000-0000-4000-8000-000000000001'
  ) THEN
    RAISE EXCEPTION 'admin_action_rollback_left_persistent_rows';
  END IF;

  RAISE NOTICE 'RAWAJ admin action rollback cleanup passed: no fixture, mutation, audit, or notification rows persisted.';
END;
$rollback_verification$;
