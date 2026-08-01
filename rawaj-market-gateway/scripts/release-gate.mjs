import { readFile } from "node:fs/promises";

const readinessUrl = new URL("../config/launch-readiness.json", import.meta.url);
const readiness = JSON.parse(await readFile(readinessUrl, "utf8"));
const blockers = Object.entries(readiness)
  .filter(([, ready]) => ready !== true)
  .map(([name]) => name);

if (blockers.length > 0) {
  console.error(
    JSON.stringify(
      {
        ready: false,
        message: "Production release remains blocked.",
        blockers,
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} else {
  console.log(
    JSON.stringify(
      {
        ready: true,
        message: "All documented release checks are approved.",
      },
      null,
      2,
    ),
  );
}
