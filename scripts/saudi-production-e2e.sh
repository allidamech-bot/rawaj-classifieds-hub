#!/usr/bin/env bash
set -Eeuo pipefail

: "${SITE_URL:?SITE_URL is required}"
: "${API_URL:?API_URL is required}"
: "${FIREBASE_API_KEY:?FIREBASE_API_KEY is required}"
: "${D1_NAME:?D1_NAME is required}"
: "${WRANGLER_CONFIG:?WRANGLER_CONFIG is required}"

id_token=""
listing_id=""
app_user_id=""
current_stage="initialization"

stage() {
  current_stage="$1"
  echo "[Saudi E2E] $current_stage"
}

on_error() {
  local line="$1"
  echo "[Saudi E2E] FAILED at line $line during: $current_stage" >&2
}
trap 'on_error "$LINENO"' ERR

api() {
  local path="$1"
  shift
  curl --silent --show-error "$@" "${API_URL}${path}"
}

print_safe_error() {
  local file="$1"
  local status="$2"
  RESPONSE_FILE="$file" RESPONSE_STATUS="$status" node <<'NODE' >&2
const fs = require("node:fs");
const file = process.env.RESPONSE_FILE;
let payload = null;
try {
  payload = JSON.parse(fs.readFileSync(file, "utf8"));
} catch {
  const text = fs.existsSync(file) ? fs.readFileSync(file, "utf8").slice(0, 500) : "";
  console.error(JSON.stringify({ httpStatus: process.env.RESPONSE_STATUS, bodyPrefix: text }));
  process.exit(0);
}
const error = payload?.error;
console.error(JSON.stringify({
  httpStatus: process.env.RESPONSE_STATUS,
  error: typeof error === "string" ? error : error?.message,
  code: typeof error === "object" ? error?.code : undefined,
}, null, 2));
NODE
}

cleanup() {
  local exit_code=$?
  trap - EXIT ERR
  set +e
  echo "[Saudi E2E] cleanup started"

  if [[ -n "$listing_id" && -n "$id_token" ]]; then
    api "/v1/listings/$listing_id" \
      -X DELETE \
      -H "Authorization: Bearer $id_token" \
      -H "Accept: application/json" >/tmp/rawaj-e2e-delete-listing-cleanup.json
  fi

  if [[ -n "$id_token" ]]; then
    ID_TOKEN="$id_token" node <<'NODE' >/tmp/rawaj-e2e-delete-account-payload.json
process.stdout.write(JSON.stringify({ idToken: process.env.ID_TOKEN }));
NODE
    curl --silent --show-error \
      -X POST "https://identitytoolkit.googleapis.com/v1/accounts:delete?key=$FIREBASE_API_KEY" \
      -H "Content-Type: application/json" \
      --data-binary @/tmp/rawaj-e2e-delete-account-payload.json \
      >/tmp/rawaj-e2e-delete-account.json
  fi

  if [[ "$app_user_id" =~ ^[0-9a-fA-F-]{36}$ ]]; then
    npx --yes wrangler@4.118.0 d1 execute "$D1_NAME" --remote --config "$WRANGLER_CONFIG" \
      --command "PRAGMA foreign_keys=OFF; DELETE FROM user_roles WHERE user_id='$app_user_id'; DELETE FROM auth_users WHERE id='$app_user_id'; DELETE FROM public_profiles WHERE id='$app_user_id'; PRAGMA foreign_keys=ON;" \
      >/tmp/rawaj-e2e-d1-cleanup.txt 2>&1
  fi

  echo "[Saudi E2E] cleanup completed"
  exit "$exit_code"
}
trap cleanup EXIT

suffix="${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}-$(date +%s)"
email="rawaj-saudi-e2e-${suffix}@example.com"
password="Rwj!$(openssl rand -hex 16)Aa9"

stage "create disposable Firebase account"
SIGNUP_EMAIL="$email" SIGNUP_PASSWORD="$password" node <<'NODE' >/tmp/rawaj-e2e-signup-payload.json
process.stdout.write(JSON.stringify({
  email: process.env.SIGNUP_EMAIL,
  password: process.env.SIGNUP_PASSWORD,
  returnSecureToken: true,
}));
NODE

signup_status="$(curl --silent --show-error \
  --output /tmp/rawaj-e2e-signup.json --write-out '%{http_code}' \
  -X POST "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=$FIREBASE_API_KEY" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/rawaj-e2e-signup-payload.json)"
if [[ "$signup_status" != "200" ]]; then
  print_safe_error /tmp/rawaj-e2e-signup.json "$signup_status"
  exit 1
fi
node <<'NODE'
const fs = require("node:fs");
const payload = JSON.parse(fs.readFileSync("/tmp/rawaj-e2e-signup.json", "utf8"));
if (!payload.idToken || !payload.localId) throw new Error("Firebase signup response is missing identity fields");
NODE
id_token="$(node -e 'const p=require("/tmp/rawaj-e2e-signup.json"); process.stdout.write(p.idToken)')"
echo "[Saudi E2E] Firebase account created"

stage "bootstrap Saudi D1 profile from Firebase token"
profile_status="$(api "/v1/profile" \
  --output /tmp/rawaj-e2e-profile.json --write-out '%{http_code}' \
  -H "Authorization: Bearer $id_token" \
  -H "Accept: application/json")"
if [[ "$profile_status" != "200" ]]; then
  print_safe_error /tmp/rawaj-e2e-profile.json "$profile_status"
  exit 1
fi
app_user_id="$(node - <<'NODE'
const fs = require("node:fs");
const payload = JSON.parse(fs.readFileSync("/tmp/rawaj-e2e-profile.json", "utf8"));
if (!payload?.data?.id) throw new Error("Saudi D1 profile bootstrap response is missing the application user id");
process.stdout.write(payload.data.id);
NODE
)"
echo "[Saudi E2E] D1 profile bootstrapped"

stage "load Saudi categories and regions"
references_status="$(api "/v1/references" \
  --output /tmp/rawaj-e2e-references.json --write-out '%{http_code}')"
if [[ "$references_status" != "200" ]]; then
  print_safe_error /tmp/rawaj-e2e-references.json "$references_status"
  exit 1
fi
read -r category_id governorate_id < <(node <<'NODE'
const fs = require("node:fs");
const payload = JSON.parse(fs.readFileSync("/tmp/rawaj-e2e-references.json", "utf8"));
const category = payload?.data?.categories?.find((item) => item?.id);
const governorate = payload?.data?.governorates?.find((item) => item?.id);
if (!category || !governorate) throw new Error("Saudi listing references are unavailable");
console.log(`${category.id} ${governorate.id}`);
NODE
)
echo "[Saudi E2E] categories and regions loaded"

stage "create SAR draft listing in D1"
CATEGORY_ID="$category_id" GOVERNORATE_ID="$governorate_id" node <<'NODE' >/tmp/rawaj-e2e-listing-payload.json
process.stdout.write(JSON.stringify({
  categoryId: process.env.CATEGORY_ID,
  subcategoryId: null,
  governorateId: process.env.GOVERNORATE_ID,
  title: "اختبار رواج السعودية المؤقت",
  description: "إعلان مؤقت للتحقق من تسجيل الدخول وإنشاء الإعلان ورفع الصورة ثم الحذف التلقائي.",
  price: 100,
  priceType: "fixed",
  condition: "used",
  districtAr: null,
  contactName: "اختبار آلي",
  contactOptions: { chat: true },
  details: {},
  submit: false,
}));
NODE

listing_status="$(api "/v1/listings" \
  --output /tmp/rawaj-e2e-listing.json --write-out '%{http_code}' \
  -X POST \
  -H "Authorization: Bearer $id_token" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  --data-binary @/tmp/rawaj-e2e-listing-payload.json)"
if [[ "$listing_status" != "200" && "$listing_status" != "201" ]]; then
  print_safe_error /tmp/rawaj-e2e-listing.json "$listing_status"
  exit 1
fi
node <<'NODE'
const fs = require("node:fs");
const payload = JSON.parse(fs.readFileSync("/tmp/rawaj-e2e-listing.json", "utf8"));
if (!payload?.data?.id || payload.data.status !== "draft") throw new Error("Saudi listing draft response is incomplete");
if (payload.data.currency && payload.data.currency !== "SAR") throw new Error(`Saudi listing creation currency mismatch: ${payload.data.currency}`);
NODE
listing_id="$(node -e 'const p=require("/tmp/rawaj-e2e-listing.json"); process.stdout.write(p.data.id)')"
echo "[Saudi E2E] SAR draft listing created"

stage "upload and read image through Saudi R2"
printf '%s' 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z3l8AAAAASUVORK5CYII=' \
  | base64 --decode >/tmp/rawaj-e2e-image.png

upload_status="$(api "/v1/listings/$listing_id/images" \
  --output /tmp/rawaj-e2e-upload.json --write-out '%{http_code}' \
  -X POST \
  -H "Authorization: Bearer $id_token" \
  -H "Accept: application/json" \
  -F "file=@/tmp/rawaj-e2e-image.png;type=image/png" \
  -F "altAr=صورة اختبار مؤقتة")"
if [[ "$upload_status" != "200" && "$upload_status" != "201" ]]; then
  print_safe_error /tmp/rawaj-e2e-upload.json "$upload_status"
  exit 1
fi
node <<'NODE'
const fs = require("node:fs");
const payload = JSON.parse(fs.readFileSync("/tmp/rawaj-e2e-upload.json", "utf8"));
if (!payload?.data?.id || !payload.data.publicUrl) throw new Error("Saudi R2 upload response is incomplete");
NODE
image_url="$(node -e 'const p=require("/tmp/rawaj-e2e-upload.json"); process.stdout.write(p.data.publicUrl)')"
image_fetch_url="$(IMAGE_URL="$image_url" API_URL="$API_URL" node -e 'process.stdout.write(new URL(process.env.IMAGE_URL, `${process.env.API_URL}/`).toString())')"

image_status="$(curl --silent --show-error \
  --output /tmp/rawaj-e2e-downloaded-image.png --write-out '%{http_code}' \
  -H "Authorization: Bearer $id_token" \
  "$image_fetch_url")"
if [[ "$image_status" != "200" ]]; then
  echo "[Saudi E2E] image read failed with HTTP $image_status" >&2
  exit 1
fi
cmp --silent /tmp/rawaj-e2e-image.png /tmp/rawaj-e2e-downloaded-image.png
echo "[Saudi E2E] R2 image uploaded and read back"

stage "read listing and owner inventory from D1"
detail_status="$(api "/api/listings/$listing_id" \
  --output /tmp/rawaj-e2e-listing-detail.json --write-out '%{http_code}' \
  -H "Authorization: Bearer $id_token" \
  -H "Accept: application/json")"
if [[ "$detail_status" != "200" ]]; then
  print_safe_error /tmp/rawaj-e2e-listing-detail.json "$detail_status"
  exit 1
fi
node <<'NODE'
const fs = require("node:fs");
const payload = JSON.parse(fs.readFileSync("/tmp/rawaj-e2e-listing-detail.json", "utf8"));
if (payload?.data?.listing?.status !== "draft") throw new Error("Saudi draft listing cannot be read back");
if (payload.data.listing.currency !== "SAR") throw new Error(`Saudi listing currency mismatch: ${payload.data.listing.currency || "missing"}`);
if (!Array.isArray(payload.data.images) || payload.data.images.length !== 1) throw new Error("Saudi listing image was not linked to the draft");
NODE

owner_status="$(api "/v1/account/listings" \
  --output /tmp/rawaj-e2e-owner-listings.json --write-out '%{http_code}' \
  -H "Authorization: Bearer $id_token" \
  -H "Accept: application/json")"
if [[ "$owner_status" != "200" ]]; then
  print_safe_error /tmp/rawaj-e2e-owner-listings.json "$owner_status"
  exit 1
fi
LISTING_ID="$listing_id" node <<'NODE'
const fs = require("node:fs");
const payload = JSON.parse(fs.readFileSync("/tmp/rawaj-e2e-owner-listings.json", "utf8"));
if (!Array.isArray(payload?.data) || !payload.data.some((item) => item.id === process.env.LISTING_ID)) throw new Error("Saudi owner listings did not return the created draft");
NODE
echo "[Saudi E2E] listing and owner inventory read back"

stage "delete temporary listing"
delete_status="$(api "/v1/listings/$listing_id" \
  --output /tmp/rawaj-e2e-delete-listing.json --write-out '%{http_code}' \
  -X DELETE \
  -H "Authorization: Bearer $id_token" \
  -H "Accept: application/json")"
if [[ "$delete_status" != "200" ]]; then
  print_safe_error /tmp/rawaj-e2e-delete-listing.json "$delete_status"
  exit 1
fi
node <<'NODE'
const payload = require("/tmp/rawaj-e2e-delete-listing.json");
if (payload?.data?.success !== true) throw new Error("Saudi test listing cleanup failed");
NODE
listing_id=""

echo "Saudi end-to-end journey passed: Firebase auth, D1 profile, listing draft, R2 image, read-back and cleanup."
