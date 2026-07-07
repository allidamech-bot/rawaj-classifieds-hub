import fs from "node:fs";

const path = "src/routes/listings.index.tsx";
let source = fs.readFileSync(path, "utf8");

function replaceOnce(search, replacement) {
  if (!source.includes(search)) throw new Error("Expected listings location block not found");
  source = source.replace(search, replacement);
}

replaceOnce(
  `import { PageHeader } from "@/components/PageHeader";\n`,
  `import { PageHeader } from "@/components/PageHeader";\nimport { CanonicalLocationSelector } from "@/features/locations/CanonicalLocationSelector";\n`,
);
replaceOnce(
  `import { createSeo } from "@/lib/seo";\n`,
  `import { fetchLocationPath, type CanonicalLocationNode } from "@/lib/api/location-taxonomy";\nimport { createSeo } from "@/lib/seo";\n`,
);
replaceOnce(
  `  const [districtAr, setDistrictAr] = useState(search.district ?? "");\n`,
  `  const [districtAr, setDistrictAr] = useState(search.district ?? "");\n  const [locationLabel, setLocationLabel] = useState("");\n`,
);
replaceOnce(
  `  const govId = references.govId;\n`,
  `  const govId = references.govId;\n  const canonicalLocationNodeId = districtAr.startsWith("@") ? districtAr.slice(1) : "";\n`,
);
replaceOnce(
  `  useEffect(() => {\n    if (filtersOpen) {\n`,
  `  useEffect(() => {\n    if (!canonicalLocationNodeId) {\n      setLocationLabel("");\n      return;\n    }\n\n    let cancelled = false;\n    void fetchLocationPath(canonicalLocationNodeId).then((result) => {\n      if (cancelled) return;\n      if (!result.ok) {\n        setLocationLabel("");\n        return;\n      }\n      setLocationLabel(\n        result.data\n          .filter((node) => node.nodeType !== "country")\n          .map((node) => (language === "en" ? node.nameEn || node.nameAr : node.nameAr))\n          .join(" › "),\n      );\n    });\n\n    return () => {\n      cancelled = true;\n    };\n  }, [canonicalLocationNodeId, language]);\n\n  useEffect(() => {\n    if (filtersOpen) {\n`,
);
replaceOnce(
  `    if (districtAr && selectedGovernorate && !availableDistricts.includes(districtAr)) {\n`,
  `    if (\n      districtAr &&\n      !canonicalLocationNodeId &&\n      selectedGovernorate &&\n      !availableDistricts.includes(districtAr)\n    ) {\n`,
);
replaceOnce(
  `  }, [availableDistricts, districtAr, selectedGovernorate]);\n`,
  `  }, [availableDistricts, canonicalLocationNodeId, districtAr, selectedGovernorate]);\n`,
);
replaceOnce(
  `    selectedGovernorate\n      ? {\n`,
  `    selectedGovernorate && !canonicalLocationNodeId\n      ? {\n`,
);
replaceOnce(
  `    districtAr ? { key: "district", label: districtAr, clear: () => setDistrictAr("") } : null,\n`,
  `    districtAr\n      ? {\n          key: "district",\n          label:\n            canonicalLocationNodeId\n              ? locationLabel || text("موقع محدد", "Selected location")\n              : districtAr,\n          clear: () => {\n            setDistrictAr("");\n            if (canonicalLocationNodeId) setGovId("");\n          },\n        }\n      : null,\n`,
);
replaceOnce(
  `  function resetFilters() {\n`,
  `  function handleCanonicalLocationChange(\n    id: string | null,\n    node: CanonicalLocationNode | null,\n  ) {\n    setDistrictAr(id ? \`@\${id}\` : "");\n    setLocationLabel(\n      node ? (language === "en" ? node.nameEn || node.nameAr : node.nameAr) : "",\n    );\n    if (node?.legacyGovernorateId) {\n      setGovId(node.legacyGovernorateId);\n    } else if (!id) {\n      setGovId("");\n    }\n  }\n\n  function resetFilters() {\n`,
);

const desktopLegacy = `                <div className="mt-2 flex flex-wrap gap-2">\n                  <GovernorateChip\n                    active={!govId}\n                    label={text("كل سوريا", "All Syria")}\n                    onClick={() => {\n                      setGovId("");\n                      setOpen(false);\n                    }}\n                  />\n                  {governorates.map((governorate) => (\n                    <GovernorateChip\n                      key={governorate.id}\n                      active={govId === governorate.id}\n                      label={governorateName(governorate.id, governorate.nameAr, language)}\n                      onClick={() => {\n                        setGovId(governorate.id);\n                        setOpen(false);\n                      }}\n                    />\n                  ))}\n                </div>\n                <div className="mt-3 grid gap-3 sm:grid-cols-3">\n                  <label className="block">\n                    <span className="mb-1 block text-[11px] font-bold text-muted-foreground">\n                      {text("المنطقة", "District")}\n                    </span>\n                    <select\n                      value={districtAr}\n                      onChange={(event) => setDistrictAr(event.target.value)}\n                      disabled={!selectedGovernorate}\n                      className="input text-xs disabled:opacity-60"\n                    >\n                      <option value="">{text("كل المناطق", "All districts")}</option>\n                      {availableDistricts.map((district) => (\n                        <option key={district} value={district}>\n                          {district}\n                        </option>\n                      ))}\n                    </select>\n                  </label>\n`;
const desktopCanonical = `                <div className="flex items-center justify-between gap-2">\n                  <span className="text-[11px] font-bold text-muted-foreground">\n                    {text("الموقع", "Location")}\n                  </span>\n                  {(districtAr || govId) && (\n                    <button\n                      type="button"\n                      onClick={() => {\n                        setGovId("");\n                        setDistrictAr("");\n                      }}\n                      className="text-[11px] font-bold text-primary"\n                    >\n                      {text("كل سوريا", "All Syria")}\n                    </button>\n                  )}\n                </div>\n                <div className="mt-2">\n                  <CanonicalLocationSelector\n                    value={canonicalLocationNodeId || null}\n                    onChange={handleCanonicalLocationChange}\n                  />\n                  {districtAr && !canonicalLocationNodeId ? (\n                    <p className="mt-2 text-[11px] text-muted-foreground">\n                      {text("الموقع القديم المحفوظ: ", "Saved legacy location: ")}\n                      {districtAr}\n                    </p>\n                  ) : null}\n                </div>\n                <div className="mt-3 grid gap-3 sm:grid-cols-2">\n`;
replaceOnce(desktopLegacy, desktopCanonical);

const mobileLegacy = `                <div>\n                  <h3 className="mb-2 text-xs font-extrabold text-muted-foreground">\n                    {text("الموقع", "Location")}\n                  </h3>\n                  <div className="grid grid-cols-2 gap-2">\n                    <button\n                      type="button"\n                      onClick={() => {\n                        setGovId("");\n                        setDistrictAr("");\n                      }}\n                      aria-pressed={!govId}\n                      className={\`rounded-xl px-3 py-2 text-start text-xs font-bold \${\n                        !govId ? "bg-primary text-primary-foreground" : "bg-muted-surface"\n                      }\`}\n                    >\n                      {text("كل سوريا", "All Syria")}\n                    </button>\n                    {governorates.map((governorate) => (\n                      <button\n                        key={governorate.id}\n                        type="button"\n                        onClick={() => {\n                          setGovId(governorate.id);\n                          setDistrictAr("");\n                        }}\n                        aria-pressed={govId === governorate.id}\n                        className={\`rounded-xl px-3 py-2 text-start text-xs font-bold \${\n                          govId === governorate.id\n                            ? "bg-primary text-primary-foreground"\n                            : "bg-muted-surface"\n                        }\`}\n                      >\n                        {governorateName(governorate.id, governorate.nameAr, language)}\n                      </button>\n                    ))}\n                  </div>\n                  <select\n                    value={districtAr}\n                    onChange={(event) => setDistrictAr(event.target.value)}\n                    disabled={!selectedGovernorate}\n                    className="input mt-3 text-xs disabled:opacity-60"\n                  >\n                    <option value="">{text("كل المناطق", "All districts")}</option>\n                    {availableDistricts.map((district) => (\n                      <option key={district} value={district}>\n                        {district}\n                      </option>\n                    ))}\n                  </select>\n                </div>\n`;
const mobileCanonical = `                <div>\n                  <div className="mb-2 flex items-center justify-between gap-2">\n                    <h3 className="text-xs font-extrabold text-muted-foreground">\n                      {text("الموقع", "Location")}\n                    </h3>\n                    {(districtAr || govId) && (\n                      <button\n                        type="button"\n                        onClick={() => {\n                          setGovId("");\n                          setDistrictAr("");\n                        }}\n                        className="text-xs font-bold text-primary"\n                      >\n                        {text("كل سوريا", "All Syria")}\n                      </button>\n                    )}\n                  </div>\n                  <CanonicalLocationSelector\n                    value={canonicalLocationNodeId || null}\n                    onChange={handleCanonicalLocationChange}\n                  />\n                  {districtAr && !canonicalLocationNodeId ? (\n                    <p className="mt-2 text-xs text-muted-foreground">\n                      {text("الموقع القديم المحفوظ: ", "Saved legacy location: ")}\n                      {districtAr}\n                    </p>\n                  ) : null}\n                </div>\n`;
replaceOnce(mobileLegacy, mobileCanonical);

fs.writeFileSync(path, source);
console.log("Listings canonical filter UI patch applied.");
