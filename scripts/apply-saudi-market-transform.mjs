import fs from "node:fs";

function update(file, transform) {
  const before = fs.readFileSync(file, "utf8");
  const after = transform(before);
  if (after === before) {
    console.log(`No change: ${file}`);
    return;
  }
  fs.writeFileSync(file, after);
  console.log(`Updated: ${file}`);
}

function replaceMarketCopy(value) {
  return value
    .replaceAll("سوق إعلانات مبوبة في سوريا", "سوق إعلانات مبوبة في السعودية")
    .replaceAll("السوق السوري", "السوق السعودي")
    .replaceAll("سوق سوري", "سوق سعودي")
    .replaceAll("سوق سوريا", "سوق السعودية")
    .replaceAll("كل سوريا", "كل السعودية")
    .replaceAll("جميع المحافظات", "جميع المناطق")
    .replaceAll("سوريا فقط", "السعودية فقط")
    .replaceAll("سوريا", "السعودية")
    .replaceAll("Syrian marketplace", "Saudi marketplace")
    .replaceAll("Syrian classifieds marketplace", "Saudi classifieds marketplace")
    .replaceAll("Syrian classifieds", "Saudi classifieds")
    .replaceAll("Syrian", "Saudi")
    .replaceAll("All Syria", "All Saudi Arabia")
    .replaceAll("across Syria", "across Saudi Arabia")
    .replaceAll("Syria only", "Saudi Arabia only")
    .replaceAll("Syria", "Saudi Arabia");
}

const marketCopyFiles = [
  "src/routes/index.tsx",
  "src/routes/__root.tsx",
  "src/routes/category.$slug.tsx",
  "src/routes/listings.index.tsx",
  "src/routes/safety.tsx",
  "src/routes/terms.tsx",
  "src/components/shell/FloatingHeader.tsx",
  "src/components/SiteFooter.tsx",
  "src/features/search/QuickFilterRail.tsx",
  "src/features/home/DiscoveryHero.tsx",
  "src/features/storefront/OwnerStoreWorkspaceSummary.tsx",
  "src/features/storefront/StorefrontIdentityHero.tsx",
].filter((file) => fs.existsSync(file));

for (const file of marketCopyFiles) update(file, replaceMarketCopy);

update("src/lib/i18n.ts", (value) =>
  replaceMarketCopy(value)
    .replaceAll('new Intl.NumberFormat("ar-SY"', 'new Intl.NumberFormat("ar-SA"')
    .replace(
      'currency: "SYP" | "USD" = "SYP",',
      'currency: "SAR" | "SYP" | "USD" = "SAR",',
    )
    .replace(
      'const currencyLabel = currency === "SYP" ? localized(language, "ل.س", "SYP") : "$";',
      'const currencyLabel =\n    currency === "SAR"\n      ? localized(language, "ر.س", "SAR")\n      : currency === "SYP"\n        ? localized(language, "ل.س", "SYP")\n        : "$";',
    ),
);

update("src/types/index.ts", (value) =>
  value.replace(
    'export type Currency = "SYP" | "USD";',
    'export type Currency = "SAR" | "SYP" | "USD";',
  ),
);

update(
  "src/utils/format.ts",
  () => `// Consistent Saudi Arabic price formatting (Arabic-Indic digits + ٬ thousands separator).
const nf = new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 0 });

type SupportedCurrency = "SAR" | "SYP" | "USD";

export function formatPrice(price: number, currency: SupportedCurrency = "SAR") {
  if (!price && price !== 0) return "";
  const formatted = nf.format(price);
  const currencyLabel = currency === "SAR" ? "ر.س" : currency === "SYP" ? "ل.س" : "$";
  return \`${"${formatted}"} ${"${currencyLabel}"}\`;
}

export function priceLabel(price: number, type: string, currency: SupportedCurrency = "SAR") {
  switch (type) {
    case "free":
      return "مجاناً";
    case "contact":
      return "السعر عند التواصل";
    case "exchange":
      return "للمبادلة";
    case "negotiable":
      return price ? \`${"${formatPrice(price, currency)}"} · قابل للتفاوض\` : "السعر قابل للتفاوض";
    default:
      return price ? formatPrice(price, currency) : "السعر غير محدد";
  }
}

export function priceTypeLabel(type: string) {
  switch (type) {
    case "fixed":
      return "ثابت";
    case "negotiable":
      return "قابل للتفاوض";
    case "contact":
      return "عند التواصل";
    case "free":
      return "مجاناً";
    case "exchange":
      return "للمبادلة";
    default:
      return type;
  }
}
`,
);

update(".env", (value) =>
  value
    .replaceAll(
      "https://rawaj-classifieds-hub.allidamech.workers.dev",
      "https://rawaj-saudi-classifieds.allidamech.workers.dev",
    )
    .replace(/^VITE_SITE_URL=.*$/m, "VITE_SITE_URL=https://sa.rawa-j.com"),
);

update(".env.example", (value) =>
  value
    .replaceAll(
      "https://rawaj-classifieds-hub.allidamech.workers.dev",
      "https://rawaj-saudi-classifieds.allidamech.workers.dev",
    )
    .replaceAll("https://rawa-j.com", "https://sa.rawa-j.com"),
);

if (fs.existsSync("public/manifest.webmanifest")) {
  update("public/manifest.webmanifest", (value) => {
    const manifest = JSON.parse(value);
    manifest.name = "RAWAJ Saudi Arabia | رواج السعودية";
    manifest.short_name = "رواج السعودية";
    manifest.description = "سوق رواج السعودية للإعلانات المبوبة";
    manifest.lang = "ar-SA";
    return `${JSON.stringify(manifest, null, 2)}\n`;
  });
}
