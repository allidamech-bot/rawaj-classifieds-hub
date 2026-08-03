import { readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const sourceUrl = new URL("./saudi-infra-admin-production-e2e.mjs", import.meta.url);
const source = await readFile(sourceUrl, "utf8");
const lines = source.split(/\r?\n/);

const preTarget = "const syria = await request(SYRIA_SITE_URL, `/v1/listings/${listingId}`);";
const approvedTarget =
  "const syriaApproved = await request(SYRIA_SITE_URL, `/v1/listings/${approved.id}`);";
const preMatches = lines.flatMap((line, index) => (line.trim() === preTarget ? [index] : []));
const approvedMatches = lines.flatMap((line, index) =>
  line.trim() === approvedTarget ? [index] : [],
);

if (preMatches.length !== 1 || approvedMatches.length !== 1) {
  throw new Error(
    `Saudi isolation markers mismatch: pre=${preMatches.length}, approved=${approvedMatches.length}`,
  );
}

const preIndex = preMatches[0];
const preIndent = lines[preIndex].match(/^\s*/)?.[0] ?? "";
if (!lines[preIndex + 1]?.includes("syria.response.status === 200")) {
  throw new Error("Unexpected pre-approval Saudi/Syria isolation guard");
}
lines[preIndex + 1] =
  `${preIndent}expectStatus(syria, 404, \`${"${suffix}"} Syrian market isolation\`);`;

const approvedIndex = approvedMatches[0];
const approvedIndent = lines[approvedIndex].match(/^\s*/)?.[0] ?? "";
if (
  !lines[approvedIndex + 1]?.includes("syriaApproved.response.status === 200") ||
  !lines[approvedIndex + 2]?.includes("Approved Saudi listing leaked into Syria")
) {
  throw new Error("Unexpected approved Saudi/Syria isolation guard");
}
lines.splice(
  approvedIndex + 1,
  2,
  `${approvedIndent}expectStatus(syriaApproved, 404, "approved Saudi listing Syrian isolation");`,
);

const temporaryPath = join(tmpdir(), `rawaj-saudi-strict-closure-${process.pid}-${Date.now()}.mjs`);
await writeFile(temporaryPath, `${lines.join("\n")}\n`, "utf8");

try {
  await import(`${pathToFileURL(temporaryPath).href}?run=${Date.now()}`);
} finally {
  await unlink(temporaryPath).catch(() => undefined);
}
