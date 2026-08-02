import fs from "node:fs";
import { fileURLToPath } from "node:url";

const target = "scripts/apply-saudi-region-fix.mjs";
const source = fs.readFileSync(target, "utf8");
const search = String.raw`  assert.match(worker, /governorates: \(results\[2\]\.results/);`;
const replacement = '  assert.ok(worker.includes("governorates: (results[2].results"));';

if (!source.includes(search)) {
  throw new Error("Saudi contract assertion target was not found");
}

fs.writeFileSync(target, source.replace(search, replacement));
fs.unlinkSync(fileURLToPath(import.meta.url));
