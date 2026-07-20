import { categoryDetailKeys } from "@/lib/category-fields";

export const publicListingDetailAliases = Object.fromEntries(
  categoryDetailKeys.map((key) => [key, `detail_${key}`]),
) as Record<string, string>;

const publicListingSelectBeforePrice =
  "id,owner_id,category_id,subcategory_id,governorate_id,title,description,price,currency";
const publicListingSelectAfterPrice =
  "price_type,listing_condition,status,district_ar,contact_name,contact_options,is_featured,featured_until,published_at,archived_at,reserved_at,expires_at,renewed_at,expiry_days,created_at,updated_at,detail_property_type:details->property_type,detail_listing_purpose:details->listing_purpose,detail_rental_duration:details->rental_duration,detail_area_sqm:details->area_sqm,detail_rooms:details->rooms,detail_bedrooms:details->bedrooms,detail_bathrooms:details->bathrooms,detail_floor:details->floor,detail_furnished:details->furnished,detail_parking:details->parking,detail_car_make:details->car_make,detail_car_model:details->car_model,detail_make:details->make,detail_model:details->model,detail_year:details->year,detail_mileage_km:details->mileage_km,detail_fuel_type:details->fuel_type,detail_transmission:details->transmission,detail_body_type:details->body_type,detail_vehicle_condition:details->vehicle_condition,detail_condition:details->condition,detail_color:details->color,detail_job_type:details->job_type,detail_employment_type:details->employment_type,detail_experience_level:details->experience_level,detail_salary_type:details->salary_type,detail_salary_min:details->salary_min,detail_salary_max:details->salary_max,detail_work_location:details->work_location,detail_contract_duration:details->contract_duration,detail_application_method:details->application_method,detail_service_type:details->service_type,detail_service_area:details->service_area,detail_delivery_time:details->delivery_time,detail_starting_price:details->starting_price,detail_electronics_brand:details->electronics_brand,detail_electronics_model:details->electronics_model,detail_storage:details->storage,detail_ram:details->ram,detail_warranty:details->warranty,detail_accessories:details->accessories,detail_location_neighborhood:details->location_neighborhood,detail_location_details:details->location_details,detail_taxonomy_node_id:details->_taxonomy_node_id";

export const publicListingLegacySelect = `${publicListingSelectBeforePrice},${publicListingSelectAfterPrice}`;

export const publicListingSelect = `${publicListingSelectBeforePrice},price_denomination,price_new_syp_normalized,${publicListingSelectAfterPrice}`;

export function publicListingSelectForSchema(supportsSypDenomination: boolean): string {
  return supportsSypDenomination ? publicListingSelect : publicListingLegacySelect;
}

export const publicListingWithImagesSelect = `${publicListingSelect},listing_images!inner(id)`;

export const publicSellerReviewSelect =
  "id,rating,comment,traits,seller_response,seller_response_updated_at,created_at";
