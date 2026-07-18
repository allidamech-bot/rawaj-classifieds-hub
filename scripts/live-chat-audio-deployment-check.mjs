import { writeFile } from "node:fs/promises";

const expectedCommit = process.env.EXPECTED_AUDIO_FIX_COMMIT?.trim() ?? "";
if (!expectedCommit) throw new Error("EXPECTED_AUDIO_FIX_COMMIT is required.");

const startedAt = Date.now();
const response = await fetch("https://rawa-j.com/", {
  redirect: "follow",
  headers: {
    "user-agent": "RAWAJ-release-audit/1.0",
    "cache-control": "no-cache",
  },
});
const deployedCommit = response.headers.get("x-rawaj-build-commit")?.trim() ?? "";
const deployedEnvironment = response.headers.get("x-rawaj-build-environment")?.trim() ?? "";
const body = await response.text();

const result = {
  checkedAt: new Date().toISOString(),
  status: response.status,
  durationMs: Date.now() - startedAt,
  expectedCommit,
  deployedCommit: deployedCommit || "missing",
  deployedEnvironment: deployedEnvironment || "missing",
  exactMatch: deployedCommit === expectedCommit,
  containsExpectedCommit: Boolean(deployedCommit && expectedCommit.startsWith(deployedCommit)),
  htmlBytes: Buffer.byteLength(body),
};

await writeFile("live-chat-audio-deployment-check.json", `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));

if (!response.ok || !result.exactMatch) process.exitCode = 1;
