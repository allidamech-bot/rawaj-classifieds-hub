import { readFile, writeFile } from "node:fs/promises";

const path = "src/lib/api/references.ts";
const source = await readFile(path, "utf8");
const before = `export async function fetchPublicGovernorates(): Promise<
  ClassifiedsResult<ClassifiedGovernorate[]>
> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const references = await readReferences(clientResult.data);
  if (!references.ok) return references;
  return { ok: true, data: references.governorates };
}
`;
const after = `export async function fetchPublicGovernorates(): Promise<
  ClassifiedsResult<ClassifiedGovernorate[]>
> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  return readPublicGovernorates(clientResult.data);
}
`;

if (!source.includes(before)) {
  throw new Error("Legacy governorate reader was not found.");
}

await writeFile(path, source.replace(before, after));
console.log("Updated the public governorate reader to use its dedicated cache.");
