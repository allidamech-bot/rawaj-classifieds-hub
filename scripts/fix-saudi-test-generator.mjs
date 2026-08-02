import fs from "node:fs";
import { fileURLToPath } from "node:url";

const target = "scripts/apply-saudi-region-fix.mjs";
let source = fs.readFileSync(target, "utf8");

const replacements = [
  [
    String.raw`  assert.match(component, /governorate\.districtsAr/);`,
    '  assert.ok(component.includes("selectedGovernorate?.districtsAr"));',
  ],
  [
    String.raw`  assert.match(levels, /fetchLocationRoots\("SA"\)/);`,
    '  assert.ok(levels.includes(\'fetchLocationRoots("SA")\'));',
  ],
  [
    String.raw`  assert.doesNotMatch(levels, /ocha-hdx-cod-ab-syr|fetchLocationRoots\("SY"\)/);`,
    '  assert.ok(!levels.includes("ocha-hdx-cod-ab-syr"));\n  assert.ok(!levels.includes(\'fetchLocationRoots("SY")\'));',
  ],
  [
    String.raw`  assert.match(worker, /governorates: \(results\[2\]\.results/);`,
    '  assert.ok(worker.includes("governorates: (results[2].results"));',
  ],
];

for (const [search, replacement] of replacements) {
  if (!source.includes(search)) {
    throw new Error(`Saudi contract assertion target was not found: ${search}`);
  }
  source = source.replace(search, replacement);
}

fs.writeFileSync(target, source);
fs.unlinkSync(fileURLToPath(import.meta.url));
