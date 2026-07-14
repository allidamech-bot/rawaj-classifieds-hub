import assert from "node:assert/strict";
import { readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";

const KIB = 1024;
const MIB = 1024 * KIB;
const budgets = {
  minimumJavaScriptChunks: 4,
  maximumSingleJavaScriptBytes: 1400 * KIB,
  maximumTotalJavaScriptBytes: 6 * MIB,
  maximumSingleCssBytes: 900 * KIB,
  maximumTotalCssBytes: 2 * MIB,
};

const candidateRoots = [".output/public", "dist/client", "dist", "build/client"];

async function isDirectory(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function collectAssets(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const assets = [];

  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) assets.push(...(await collectAssets(path)));
    else if (!entry.name.endsWith(".map") && /\.(?:js|css)$/.test(entry.name)) {
      assets.push({ path, bytes: (await stat(path)).size });
    }
  }

  return assets;
}

const buildRoot = (
  await Promise.all(candidateRoots.map(async (path) => ((await isDirectory(path)) ? path : null)))
).find(Boolean);

assert.ok(buildRoot, `No client build output found in: ${candidateRoots.join(", ")}`);

const assets = await collectAssets(buildRoot);
const javascript = assets.filter((asset) => asset.path.endsWith(".js"));
const css = assets.filter((asset) => asset.path.endsWith(".css"));

const total = (items) => items.reduce((sum, item) => sum + item.bytes, 0);
const largest = (items) => Math.max(0, ...items.map((item) => item.bytes));
const formatKib = (bytes) => `${(bytes / KIB).toFixed(1)} KiB`;

assert.ok(javascript.length >= budgets.minimumJavaScriptChunks, [
  `Expected at least ${budgets.minimumJavaScriptChunks} JavaScript chunks to preserve route/vendor splitting.`,
  `Found ${javascript.length} in ${buildRoot}.`,
].join(" "));
assert.ok(
  largest(javascript) <= budgets.maximumSingleJavaScriptBytes,
  `Largest JavaScript asset ${formatKib(largest(javascript))} exceeds ${formatKib(budgets.maximumSingleJavaScriptBytes)}.`,
);
assert.ok(
  total(javascript) <= budgets.maximumTotalJavaScriptBytes,
  `Total JavaScript ${formatKib(total(javascript))} exceeds ${formatKib(budgets.maximumTotalJavaScriptBytes)}.`,
);
assert.ok(
  largest(css) <= budgets.maximumSingleCssBytes,
  `Largest CSS asset ${formatKib(largest(css))} exceeds ${formatKib(budgets.maximumSingleCssBytes)}.`,
);
assert.ok(
  total(css) <= budgets.maximumTotalCssBytes,
  `Total CSS ${formatKib(total(css))} exceeds ${formatKib(budgets.maximumTotalCssBytes)}.`,
);

console.log(
  JSON.stringify(
    {
      buildRoot,
      javascriptChunks: javascript.length,
      cssAssets: css.length,
      largestJavaScript: formatKib(largest(javascript)),
      totalJavaScript: formatKib(total(javascript)),
      largestCss: formatKib(largest(css)),
      totalCss: formatKib(total(css)),
      budgets,
    },
    null,
    2,
  ),
);
