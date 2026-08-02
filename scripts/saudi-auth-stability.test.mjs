import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

// This is a release-blocking regression because every signed-in surface uses /api/*.
test("Saudi gateway proxies both public and authenticated API namespaces", async () => {
  const server = await readFile("src/server-cloudflare.ts", "utf8");
  assert.match(server, /pathname === "\/v1"/);
  assert.match(server, /pathname\.startsWith\("\/v1\/"\)/);
  assert.match(server, /pathname === "\/api"/);
  assert.match(server, /pathname\.startsWith\("\/api\/"\)/);
});

test("Saudi auth controls stay disabled until React hydration", async () => {
  const login = await readFile("src/routes/login.tsx", "utf8");
  assert.match(login, /const \[interactive, setInteractive\] = useState\(false\)/);
  assert.match(login, /useEffect\(\(\) => \{\s*setInteractive\(true\)/);
  assert.match(login, /<fieldset disabled=\{!interactive\} className="contents">/);
  assert.match(login, /disabled=\{!interactive \|\| loading \|\| auth\.status === "authUnavailable"\}/);
  assert.match(login, /<GoogleButton returnTo=\{returnTo\} interactive=\{interactive\} \/>/);
});
