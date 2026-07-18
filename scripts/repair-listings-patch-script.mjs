import { readFile, writeFile } from "node:fs/promises";

const path = "scripts/apply-listings-filter-actions-and-depth.mjs";
let source = await readFile(path, "utf8");
source = source.replace(
  '        `[data-filter-section="${focusTarget}"]`,',
  `        '[data-filter-section="' + focusTarget + '"]',`,
);
source = source.replace(
  '                ? text(`${activeCount} فلاتر نشطة`, `${activeCount} active filters`)',
  '                ? text(activeCount + " فلاتر نشطة", activeCount + " active filters")',
);
source = source.replace(
  '    assert.match(rail, new RegExp(`onOpenFilter\\(\\"${target}\\"\\)`));',
  `    assert.ok(rail.includes('onOpenFilter("' + target + '")'));`,
);
source = source.replace(
  '    assert.match(route, new RegExp(`data-filter-section=.*${target}`));',
  '    assert.match(route, new RegExp("data-filter-section=.*" + target));',
);
await writeFile(path, source);
