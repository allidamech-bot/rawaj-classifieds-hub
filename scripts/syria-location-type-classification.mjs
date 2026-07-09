const CITY_PATTERN = /(?:^|[\s/_-])(?:city|مدينة|مدينه)(?:$|[\s/_-])/iu;
const TOWN_PATTERN = /(?:^|[\s/_-])(?:town|بلدة|بلده)(?:$|[\s/_-])/iu;
const VILLAGE_PATTERN = /(?:^|[\s/_-])(?:village|قرية|قريه)(?:$|[\s/_-])/iu;
const LOCALITY_PATTERN =
  /(?:^|[\s/_-])(?:locality|community|settlement|populated place|محلة|محله|مجتمع|تجمع سكاني)(?:$|[\s/_-])/iu;

export function classifySyriaPopulatedPlace(sourceTitle, sourceNumber) {
  const title = text(sourceTitle);
  const number = text(sourceNumber) || null;
  const normalizedTitle = normalizeSourceTitle(title);

  if (!normalizedTitle) {
    return {
      nodeType: "locality",
      mapped: false,
      reason: "missing_source_class",
      sourceTitle: null,
      sourceNumber: number,
      normalizedTitle: null,
    };
  }

  for (const [nodeType, pattern] of [
    ["city", CITY_PATTERN],
    ["town", TOWN_PATTERN],
    ["village", VILLAGE_PATTERN],
    ["locality", LOCALITY_PATTERN],
  ]) {
    if (pattern.test(normalizedTitle)) {
      return {
        nodeType,
        mapped: true,
        reason: "explicit_source_label",
        sourceTitle: title,
        sourceNumber: number,
        normalizedTitle,
      };
    }
  }

  return {
    nodeType: "locality",
    mapped: false,
    reason: "unrecognized_source_class",
    sourceTitle: title,
    sourceNumber: number,
    normalizedTitle,
  };
}

export function summarizeSyriaSourceClassifications(records) {
  const bySourceClass = new Map();
  let mappedCount = 0;
  let unmappedCount = 0;
  const unmappedExamples = [];

  for (const record of records) {
    if (record.mapped) mappedCount += 1;
    else {
      unmappedCount += 1;
      if (unmappedExamples.length < 100) {
        unmappedExamples.push({
          pcode: record.pcode,
          sourceTitle: record.sourceTitle,
          sourceNumber: record.sourceNumber,
          reason: record.reason,
        });
      }
    }

    const key = `${record.sourceTitle ?? "(missing)"}|${record.sourceNumber ?? "(missing)"}`;
    const current = bySourceClass.get(key) ?? {
      sourceTitle: record.sourceTitle,
      sourceNumber: record.sourceNumber,
      nodeType: record.nodeType,
      mapped: record.mapped,
      reason: record.reason,
      count: 0,
    };
    current.count += 1;
    bySourceClass.set(key, current);
  }

  return {
    total: records.length,
    mappedCount,
    unmappedCount,
    bySourceClass: [...bySourceClass.values()].sort(
      (a, b) => b.count - a.count || String(a.sourceTitle).localeCompare(String(b.sourceTitle)),
    ),
    unmappedExamples,
  };
}

export function buildOchaSourceNotes(version, classification) {
  const notes = [];
  const normalizedVersion = text(version);
  if (normalizedVersion) notes.push(`OCHA/HDX source version ${normalizedVersion}`);

  if (classification?.sourceTitle || classification?.sourceNumber) {
    const title = classification.sourceTitle ?? "(missing title)";
    const number = classification.sourceNumber ? ` (#${classification.sourceNumber})` : "";
    notes.push(`OCHA/HDX populated place class: ${title}${number}`);
  }

  return notes.length ? notes.join("; ") : null;
}

function normalizeSourceTitle(value) {
  return text(value).normalize("NFKC").toLocaleLowerCase("en").replace(/\s+/g, " ").trim();
}

function text(value) {
  return String(value ?? "").trim();
}
