/** Explicit authenticated-account read boundary. Never use this select publicly. */
export const privateAccountProfileSelect =
  "id,email,first_name,last_name,display_name,account_status,verification_status,governorate,city_area,bio,business_name,phone,whatsapp,preferred_contact_method,avatar_path,avatar_url,cover_path,cover_url,created_at,updated_at";

/** Explicit storefront boundary. Storage paths and private contact fields are excluded. */
export const publicSellerProfileSelect =
  "id,display_name,governorate,bio,business_name,avatar_url,cover_url,verified,created_at";

export const forbiddenSelfProfileUpdateFields = Object.freeze([
  "id",
  "email",
  "account_status",
  "verification_status",
  "role",
  "roles",
  "created_at",
  "updated_at",
  "avatar_path",
  "cover_path",
] as const);
