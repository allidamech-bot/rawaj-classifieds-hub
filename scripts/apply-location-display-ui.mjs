import fs from "node:fs";

function patch(path, search, replacement) {
  const source = fs.readFileSync(path, "utf8");
  if (!source.includes(search)) throw new Error(`Expected block not found in ${path}`);
  fs.writeFileSync(path, source.replace(search, replacement));
}

patch(
  "src/features/listings/listings-components.tsx",
  `export function RealListingCard({ listing }: { listing: ClassifiedListing }) {\n  const { language, text } = useUiPreferences();\n\n  return (\n`,
  `export function RealListingCard({ listing }: { listing: ClassifiedListing }) {\n  const { language, text } = useUiPreferences();\n  const governorateLabel = governorateName(\n    listing.governorateId,\n    listing.governorateNameAr ?? undefined,\n    language,\n  );\n  const canonicalLocationName =\n    language === "en"\n      ? listing.locationNameEn || listing.locationNameAr\n      : listing.locationNameAr;\n  const locationLabel = canonicalLocationName\n    ? canonicalLocationName === governorateLabel\n      ? canonicalLocationName\n      : \`\${governorateLabel} · \${canonicalLocationName}\`\n    : listing.districtAr\n      ? \`\${governorateLabel} · \${listing.districtAr}\`\n      : governorateLabel;\n\n  return (\n`,
);
patch(
  "src/features/listings/listings-components.tsx",
  `            <span className="truncate">\n              {governorateName(\n                listing.governorateId,\n                listing.governorateNameAr ?? undefined,\n                language,\n              )}\n              {listing.districtAr ? \` · \${listing.districtAr}\` : ""}\n            </span>\n`,
  `            <span className="truncate">{locationLabel}</span>\n`,
);

patch(
  "src/routes/listings.$id.tsx",
  `import { categoryName, formatPriceLocalized, governorateName } from "@/lib/i18n";\n`,
  `import { categoryName, formatPriceLocalized, governorateName } from "@/lib/i18n";\nimport { fetchLocationPath } from "@/lib/api/location-taxonomy";\n`,
);
patch(
  "src/routes/listings.$id.tsx",
  `  const [actionMessage, setActionMessage] = useState<string | null>(null);\n`,
  `  const [actionMessage, setActionMessage] = useState<string | null>(null);\n  const [canonicalLocationPath, setCanonicalLocationPath] = useState("");\n`,
);
patch(
  "src/routes/listings.$id.tsx",
  `  useEffect(() => {\n    let cancelled = false;\n    const requestId = ++favoriteRequestIdRef.current;\n`,
  `  useEffect(() => {\n    const nodeId = listing?.locationNodeId;\n    if (!nodeId) {\n      setCanonicalLocationPath("");\n      return;\n    }\n\n    let cancelled = false;\n    void fetchLocationPath(nodeId).then((result) => {\n      if (cancelled) return;\n      if (!result.ok) {\n        setCanonicalLocationPath("");\n        return;\n      }\n      setCanonicalLocationPath(\n        result.data\n          .filter((node) => node.nodeType !== "country")\n          .map((node) => (language === "en" ? node.nameEn || node.nameAr : node.nameAr))\n          .join(" › "),\n      );\n    });\n\n    return () => {\n      cancelled = true;\n    };\n  }, [listing?.locationNodeId, language]);\n\n  useEffect(() => {\n    let cancelled = false;\n    const requestId = ++favoriteRequestIdRef.current;\n`,
);
patch(
  "src/routes/listings.$id.tsx",
  `  const locationLabel = governorateName(\n    listing.governorateId,\n    listing.governorateNameAr ?? undefined,\n    language,\n  );\n`,
  `  const governorateLabel = governorateName(\n    listing.governorateId,\n    listing.governorateNameAr ?? undefined,\n    language,\n  );\n  const locationLabel =\n    canonicalLocationPath ||\n    (listing.districtAr\n      ? \`\${governorateLabel} › \${listing.districtAr}\`\n      : governorateLabel);\n`,
);
patch(
  "src/routes/listings.$id.tsx",
  `            <span className="font-semibold">{locationLabel}</span>\n            {listing.districtAr && (\n              <span className="text-muted-foreground">· {listing.districtAr}</span>\n            )}\n`,
  `            <span className="font-semibold">{locationLabel}</span>\n`,
);

console.log("Canonical location display UI patch applied.");
