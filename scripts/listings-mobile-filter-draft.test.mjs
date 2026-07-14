import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [sheetSource, sessionSource, resultsSource, paginationSource, packageSource] =
  await Promise.all([
    readFile(new URL("../src/features/search/FilterBottomSheet.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/features/search/filter-draft-session.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/features/listings/use-listings-results.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../src/features/listings/use-listings-pagination.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

test("the mobile filter sheet owns an explicit draft session", () => {
  assert.match(sheetSource, /beginFilterDraftSession/);
  assert.match(sheetSource, /useEffect\(\(\) => \{/);
  assert.match(sheetSource, /if \(!open\) return;/);
  assert.match(sheetSource, /return beginFilterDraftSession\(\);/);
  assert.match(sheetSource, /data-filter-state="draft"/);

  assert.match(sessionSource, /const activeSessions = new Set<symbol>\(\)/);
  assert.match(sessionSource, /activeSessions\.add\(token\)/);
  assert.match(sessionSource, /activeSessions\.delete\(token\)/);
  assert.match(sessionSource, /useSyncExternalStore/);
});

test("draft edits cannot clear or refetch the visible listing results", () => {
  assert.match(resultsSource, /const filterDraftActive = useFilterDraftSessionActive\(\)/);

  const suspensionGuard = resultsSource.indexOf("if (filterDraftActive) return;");
  const resultClear = resultsSource.indexOf("setItems([]);");
  const listingFetch = resultsSource.indexOf("fetchPublicListings(filters, null, 30)");

  assert.ok(suspensionGuard >= 0);
  assert.ok(resultClear > suspensionGuard);
  assert.ok(listingFetch > suspensionGuard);
  assert.match(resultsSource, /lastCompletedFilterKeyRef/);
  assert.match(resultsSource, /if \(lastCompletedFilterKeyRef\.current === filterKey\) return;/);
});

test("only successful listing loads suppress an identical repeat request", () => {
  const failureBranch = resultsSource.indexOf("if (!result.ok)");
  const successBranch = resultsSource.indexOf("} else {", failureBranch);
  const completedKeyWrite = resultsSource.indexOf(
    "lastCompletedFilterKeyRef.current = filterKey;",
    failureBranch,
  );

  assert.ok(failureBranch >= 0);
  assert.ok(successBranch > failureBranch);
  assert.ok(completedKeyWrite > successBranch);
});

test("draft edits cannot start or complete pagination requests", () => {
  assert.match(paginationSource, /useFilterDraftSessionActive/);
  assert.match(paginationSource, /isFilterDraftSessionActive/);
  assert.match(
    paginationSource,
    /if \(filterDraftActive \|\| isFilterDraftSessionActive\(\)\) return;/,
  );
  assert.match(
    paginationSource,
    /if \(isFilterDraftSessionActive\(\) \|\| activeVersion !== filterVersionRef\.current\)/,
  );
});

test("transactional mobile filter coverage is part of the listings Quality Gate", () => {
  const packageJson = JSON.parse(packageSource);
  assert.match(
    packageJson.scripts["test:listings-filters"],
    /listings-mobile-filter-draft\.test\.mjs/,
  );
  assert.match(packageJson.scripts.check, /npm run test:listings-filters/);
});
