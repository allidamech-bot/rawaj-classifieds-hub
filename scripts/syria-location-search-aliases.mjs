function text(value) {
  return String(value ?? "").trim();
}

export function normalizeSyriaLocationAlias(value) {
  return text(value)
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ");
}

export function buildSyriaSourceAliases(nodes) {
  const aliases = [];

  for (const node of nodes) {
    const source = text(node.external_source);
    const externalId = text(node.external_id);
    if (!source || !externalId || !Array.isArray(node.search_aliases)) continue;

    const seen = new Set();
    for (const rawAlias of node.search_aliases) {
      const alias = text(rawAlias);
      const normalized = normalizeSyriaLocationAlias(alias);
      if (!alias || !normalized || seen.has(normalized)) continue;
      seen.add(normalized);

      aliases.push({
        targetExternalSource: source,
        targetExternalId: externalId,
        alias,
        languageCode: /[\u0600-\u06ff]/.test(alias) ? "ar" : "en",
        aliasType: "alternate_name",
        sourceName: "OCHA/HDX COD-AB Syria",
        sourceUrl: text(node.source_url) || null,
        sourceNote: `Source-provided alternate name for ${externalId}`,
        confidence: "high",
        reviewStatus: "reviewed",
      });
    }
  }

  return aliases;
}
