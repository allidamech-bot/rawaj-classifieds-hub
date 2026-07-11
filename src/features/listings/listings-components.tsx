import { Link } from "@tanstack/react-router";
import { Clock, MapPin } from "lucide-react";
import { carMakeOptions, type CategoryFieldKind } from "@/lib/category-fields";
import type {
  ClassifiedListing,
  ClassifiedSubcategory,
  PublicSellerSearchResult,
} from "@/lib/classifieds-types";
import { categoryName, formatPriceLocalized } from "@/lib/i18n";
import { listingLocationDisplay } from "@/lib/listing-location-display";
import { useUiPreferences } from "@/lib/ui-preferences";
import { PlaceholderArt } from "@/components/PlaceholderArt";

type TextFn = (ar: string, en: string) => string;

export function CategorySpecificFilterFields({
  kind,
  text,
  values,
  setters,
  taxonomyOwnsPurpose,
  taxonomyOwnsType,
}: {
  kind: CategoryFieldKind;
  text: TextFn;
  values: {
    carMake: string;
    carModel: string;
    fuelType: string;
    transmission: string;
    propertyPurpose: string;
    propertyType: string;
    rooms: string;
    rentalDuration: string;
    electronicsBrand: string;
    detailCondition: string;
    employmentType: string;
    salaryType: string;
  };
  setters: {
    setCarMake: (value: string) => void;
    setCarModel: (value: string) => void;
    setFuelType: (value: string) => void;
    setTransmission: (value: string) => void;
    setPropertyPurpose: (value: string) => void;
    setPropertyType: (value: string) => void;
    setRooms: (value: string) => void;
    setRentalDuration: (value: string) => void;
    setElectronicsBrand: (value: string) => void;
    setDetailCondition: (value: string) => void;
    setEmploymentType: (value: string) => void;
    setSalaryType: (value: string) => void;
  };
  taxonomyOwnsPurpose?: boolean;
  taxonomyOwnsType?: boolean;
}) {
  if (kind === "vehicles") {
    return (
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <FilterSelect
          label={text("الشركة", "Make")}
          value={values.carMake}
          onChange={setters.setCarMake}
        >
          <option value="">{text("كل الشركات", "All makes")}</option>
          {carMakeOptions.map((make) => (
            <option key={make} value={make}>
              {make === "Other" ? text("أخرى", "Other") : make}
            </option>
          ))}
        </FilterSelect>
        <FilterInput
          label={text("الطراز", "Model")}
          value={values.carModel}
          onChange={setters.setCarModel}
        />
        <FilterSelect
          label={text("الوقود", "Fuel")}
          value={values.fuelType}
          onChange={setters.setFuelType}
        >
          <option value="">{text("كل الأنواع", "All fuel types")}</option>
          <option value="gasoline">{text("بنزين", "Gasoline")}</option>
          <option value="diesel">{text("ديزل", "Diesel")}</option>
          <option value="hybrid">{text("هجين", "Hybrid")}</option>
          <option value="electric">{text("كهرباء", "Electric")}</option>
          <option value="gas">{text("غاز", "Gas")}</option>
          <option value="other">{text("أخرى", "Other")}</option>
        </FilterSelect>
        <FilterSelect
          label={text("ناقل الحركة", "Transmission")}
          value={values.transmission}
          onChange={setters.setTransmission}
        >
          <option value="">{text("كل الأنواع", "All")}</option>
          <option value="automatic">{text("أوتوماتيك", "Automatic")}</option>
          <option value="manual">{text("يدوي", "Manual")}</option>
          <option value="semi_auto">{text("نصف أوتوماتيك", "Semi-auto")}</option>
        </FilterSelect>
      </div>
    );
  }

  if (kind === "real_estate") {
    return (
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <FilterSelect
          label={text("الغرض", "Purpose")}
          value={values.propertyPurpose}
          onChange={setters.setPropertyPurpose}
          disabled={taxonomyOwnsPurpose}
        >
          <option value="">{text("بيع أو إيجار", "Sale or rent")}</option>
          <option value="sale">{text("بيع", "Sale")}</option>
          <option value="rent">{text("إيجار", "Rent")}</option>
        </FilterSelect>
        <FilterSelect
          label={text("نوع العقار", "Property type")}
          value={values.propertyType}
          onChange={setters.setPropertyType}
          disabled={taxonomyOwnsType}
        >
          <option value="">{text("كل الأنواع", "All types")}</option>
          <option value="apartment">{text("شقة", "Apartment")}</option>
          <option value="house">{text("منزل", "House")}</option>
          <option value="villa">{text("فيلا", "Villa")}</option>
          <option value="land">{text("أرض", "Land")}</option>
          <option value="shop">{text("محل", "Shop")}</option>
          <option value="office">{text("مكتب", "Office")}</option>
          <option value="warehouse">{text("مستودع", "Warehouse")}</option>
        </FilterSelect>
        <FilterInput
          label={text("عدد الغرف", "Rooms")}
          value={values.rooms}
          onChange={setters.setRooms}
          inputMode="numeric"
        />
        <FilterSelect
          label={text("مدة الإيجار", "Rental duration")}
          value={values.rentalDuration}
          onChange={setters.setRentalDuration}
        >
          <option value="">{text("كل المدد", "All durations")}</option>
          <option value="daily">{text("يومي", "Daily")}</option>
          <option value="monthly">{text("شهري", "Monthly")}</option>
          <option value="yearly">{text("سنوي", "Yearly")}</option>
          <option value="negotiable">{text("قابل للاتفاق", "Negotiable")}</option>
        </FilterSelect>
      </div>
    );
  }

  if (kind === "electronics") {
    return (
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <FilterInput
          label={text("الشركة", "Brand")}
          value={values.electronicsBrand}
          onChange={setters.setElectronicsBrand}
        />
        <FilterSelect
          label={text("الحالة", "Condition")}
          value={values.detailCondition}
          onChange={setters.setDetailCondition}
        >
          <option value="">{text("كل الحالات", "All conditions")}</option>
          <option value="new">{text("جديد", "New")}</option>
          <option value="used">{text("مستعمل", "Used")}</option>
          <option value="excellent">{text("ممتاز", "Excellent")}</option>
          <option value="good">{text("جيد", "Good")}</option>
          <option value="needs_work">{text("يحتاج صيانة", "Needs work")}</option>
        </FilterSelect>
      </div>
    );
  }

  if (kind === "jobs") {
    return (
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <FilterSelect
          label={text("نمط العمل", "Employment type")}
          value={values.employmentType}
          onChange={setters.setEmploymentType}
        >
          <option value="">{text("كل الأنماط", "All types")}</option>
          <option value="full_time">{text("دوام كامل", "Full-time")}</option>
          <option value="part_time">{text("دوام جزئي", "Part-time")}</option>
          <option value="contract">{text("عقد", "Contract")}</option>
          <option value="temporary">{text("مؤقت", "Temporary")}</option>
          <option value="internship">{text("تدريب", "Internship")}</option>
        </FilterSelect>
        <FilterSelect
          label={text("نوع الراتب", "Salary type")}
          value={values.salaryType}
          onChange={setters.setSalaryType}
        >
          <option value="">{text("كل الأنواع", "All salary types")}</option>
          <option value="fixed">{text("ثابت", "Fixed")}</option>
          <option value="range">{text("نطاق", "Range")}</option>
          <option value="commission">{text("عمولة", "Commission")}</option>
          <option value="negotiable">{text("قابل للتفاوض", "Negotiable")}</option>
          <option value="not_listed">{text("غير معلن", "Not listed")}</option>
        </FilterSelect>
      </div>
    );
  }

  return null;
}

export function FilterInput({
  label,
  value,
  onChange,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode={inputMode}
        className="input text-xs"
      />
    </label>
  );
}

export function FilterSelect({
  label,
  value,
  onChange,
  children,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="input text-xs disabled:opacity-60"
        disabled={disabled}
      >
        {children}
      </select>
    </label>
  );
}

export function GovernorateChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted-surface text-foreground hover:bg-secondary"
      }`}
    >
      {label}
    </button>
  );
}

export function subcategoryName(subcategory: ClassifiedSubcategory, language: "ar" | "en") {
  return language === "en" ? (subcategory.nameEn ?? subcategory.nameAr) : subcategory.nameAr;
}

export function RealListingCard({ listing }: { listing: ClassifiedListing }) {
  const { language, text } = useUiPreferences();

  return (
    <Link
      to="/listings/$id"
      params={{ id: listing.id }}
      className="group block overflow-hidden rounded-[1.15rem] border border-border/80 bg-card tap-card transition hover:-translate-y-0.5 hover:border-gold/60 hover:shadow-premium-sm"
    >
      <div className="relative overflow-hidden bg-muted-surface">
        {listing.primaryImageUrl ? (
          <img
            src={listing.primaryImageUrl}
            alt={listing.title}
            loading="lazy"
            decoding="async"
            className="aspect-[4/3] w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <PlaceholderArt type={listing.categoryPlaceholder ?? "misc"} aspect="standard" />
        )}
        {listing.reservedAt ? (
          <span className="absolute start-2 top-2 rounded-full bg-warning/92 px-2 py-1 text-[9px] font-extrabold text-warning-foreground shadow-soft backdrop-blur-sm">
            {text("محجوز", "Reserved")}
          </span>
        ) : listing.isFeatured ? (
          <span className="absolute start-2 top-2 rounded-full bg-primary/92 px-2 py-1 text-[9px] font-extrabold text-primary-foreground shadow-soft backdrop-blur-sm">
            {text("مميز", "Featured")}
          </span>
        ) : null}
      </div>

      <div className="p-2.5 sm:p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 text-[14px] font-extrabold leading-tight text-primary sm:text-base">
            {formatPriceLocalized(
              listing.price ?? 0,
              listing.priceType,
              language,
              listing.currency,
            )}
          </div>
          <span className="max-w-[45%] shrink-0 truncate rounded-full bg-background px-2 py-1 text-[9px] font-bold text-muted-foreground">
            {categoryName(listing.categoryId, listing.categoryNameAr ?? undefined, language)}
          </span>
        </div>

        <h3 className="mt-1.5 line-clamp-2 min-h-[2.35rem] text-[12.5px] font-bold leading-snug text-foreground sm:text-[13px]">
          {listing.title}
        </h3>

        <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/60 pt-2 text-[10px] text-muted-foreground sm:text-[11px]">
          <span className="inline-flex min-w-0 items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0 text-brand-orange" strokeWidth={1.9} />
            <span className="truncate">{listingLocationDisplay(listing, language)}</span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1">
            <Clock className="h-3 w-3" strokeWidth={1.8} />
            <span>{formatDate(listing.createdAt, language)}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

export function SellerSearchCard({ seller }: { seller: PublicSellerSearchResult }) {
  const { text } = useUiPreferences();
  const title = seller.businessName || seller.displayName;

  return (
    <Link
      to="/seller/$id"
      params={{ id: seller.id }}
      className="flex items-center gap-3 rounded-2xl bg-card p-3 hairline tap-card hover:bg-muted-surface"
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-muted-surface text-sm font-bold text-primary">
        {seller.avatarUrl ? (
          <img
            src={seller.avatarUrl}
            alt={title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          title.slice(0, 1)
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-extrabold">{title}</span>
        {seller.businessName && seller.displayName !== seller.businessName && (
          <span className="block truncate text-[11px] text-muted-foreground">
            {seller.displayName}
          </span>
        )}
        <span className="mt-1 block truncate text-[11px] text-muted-foreground">
          {[
            seller.governorate,
            text(`${seller.approvedListingCount} إعلان`, `${seller.approvedListingCount} listings`),
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
    </Link>
  );
}

export function StateCard({
  title,
  body,
  actionLabel,
  actionTo,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  actionTo?: string;
}) {
  return (
    <div className="mt-6 rounded-2xl bg-card p-6 text-center hairline">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
      {actionLabel && actionTo && (
        <Link
          to={actionTo}
          className="mt-4 inline-block rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

export function formatDate(value: string, language: "ar" | "en") {
  if (!value) return language === "ar" ? "تاريخ غير محدد" : "Date unavailable";
  return new Intl.DateTimeFormat(language === "ar" ? "ar-SY" : "en-US", {
    dateStyle: "medium",
    timeZone: "Asia/Damascus",
  }).format(new Date(value));
}
