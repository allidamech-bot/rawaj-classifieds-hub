-- Align existing Syria OCHA location rows with the type-aware ordering used by
-- the canonical location generator and customer-facing selector.
--
-- Safety:
-- - preserves ids, parent_id, node_type, names, aliases, and listing references
-- - only backfills legacy zero-valued sort_order rows from the OCHA Syria source
-- - preserves any non-zero curated sort_order values already present

update public.location_nodes
set sort_order = case node_type
  when 'country' then 0
  when 'governorate' then 100
  when 'district' then 200
  when 'subdistrict' then 300
  when 'city' then 400
  when 'town' then 500
  when 'village' then 600
  when 'neighborhood' then 700
  when 'locality' then 800
  else sort_order
end
where country_code = 'SY'
  and external_source = 'ocha-hdx-cod-ab-syr'
  and sort_order = 0;
