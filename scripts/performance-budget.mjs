import assert from "node:assert/strict";
import { readdir, stat, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

const KIB = 1024;
const MIB = 1024 * KIB;
const REPORT_PATH = resolve("performance-budget-report.json");

// Calibrated from the 2026-07-16 production build baseline:
// 155 JS chunks, 556.3 KiB largest JS, 1660.9 KiB total JS,
// 37 CSS assets, 124.7 KiB largest CSS, and 433.3 KiB total CSS.
// Chat media attachments add route-scoped chunks while keeping total and
// largest asset sizes below the existing limits. The size budgets remain unchanged.
const budgets = {
  minimumJavaScriptChunks: 8,
  maximumJavaScriptChunks: 182,
  maximumSingleJavaScriptBytes: 640 * KIB,
  maximumTotalJavaScriptBytes: 1_900 * KIB,
  maximumCssAssets: 40,
  maximumSingleCssBytes: 150 * KIB,
  maximumTotalCssBytes: 500 * KIB,
  maximumSingleFontBytes: 320 * KIB,
  maximumTotalFontBytes: 1.25 * MIB,
  maximumImageAssets: 8,
  maximumSingleImageBytes: 400 * KIB,
  maximumTotalImageBytes: 1.25 * MIB,
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
    if (entry.isDirectory()) {
      assets.push(...(await collectAssets(path)));
      continue;
    }
    if (entry.name.endsWith(".map")) continue;
    assets.push({ path, bytes: (await stat(path)).size });
  }

  return assets;
}

const buildRoot = (
  await Promise.all(candidateRoots.map(async (path) => ((await isDirectory(path)) ? path : null)))
).find(Boolean);

assert.ok(buildRoot, `No client build output found in: ${candidateRoots.join(", ")}`);

const assets = await collectAssets(buildRoot);
const javascript = assets.filter((asset) => /\.(?:js|mjs)$/.test(asset.path));
const css = assets.filter((asset) => asset.path.endsWith(".css"));
const fonts = assets.filter((asset) => /\.(?:woff2?|ttf|otf)$/.test(asset.path));
const images = assets.filter((asset) => /\.(?:avif|gif|jpe?g|png|svg|webp)$/.test(asset.path));

const total = (items) => items.reduce((sum, item) => sum + item.bytes, 0);
const largest = (items) => Math.max(0, ...items.map((item) => item.bytes));
const formatKib = (bytes) => `${(bytes / KIB).toFixed(1)} KiB`;
const summarizeLargest = (items, limit = 12) =>
  [...items]
    .sort((left, right) => right.bytes - left.bytes)
    .slice(0, limit)
    .map((asset) => ({
      path: relative(resolve(buildRoot), asset.path).replaceAll("\\", "/"),
      bytes: asset.bytes,
      kib: Number((asset.bytes / KIB).toFixed(1)),
    }));

const report = {
  generatedAt: new Date().toISOString(),
  buildRoot,
  summary: {
    totalAssets: assets.length,
    javascriptChunks: javascript.length,
    cssAssets: css.length,
    fontAssets: fonts.length,
    imageAssets: images.length,
    largestJavaScriptBytes: largest(javascript),
    totalJavaScriptBytes: total(javascript),
    largestCssBytes: largest(css),
    totalCssBytes: total(css),
    largestFontBytes: largest(fonts),
    totalFontBytes: total(fonts),
    largestImageBytes: largest(images),
    totalImageBytes: total(images),
  },
  formatted: {
    largestJavaScript: formatKib(largest(javascript)),
    totalJavaScript: formatKib(total(javascript)),
    largestCss: formatKib(largest(css)),
    totalCss: formatKib(total(css)),
    largestFont: formatKib(largest(fonts)),
    totalFonts: formatKib(total(fonts)),
    largestImage: formatKib(largest(images)),
    totalImages: formatKib(total(images)),
  },
  largestAssets: {
    javascript: summarizeLargest(javascript),
    css: summarizeLargest(css),
    fonts: summarizeLargest(fonts),
    images: summarizeLargest(images),
  },
  budgets,
};

await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`RAWAJ_PERFORMANCE_REPORT=${JSON.stringify(report)}`);

assert.ok(
  javascript.length >= budgets.minimumJavaScriptChunks,
  [
    `Expected at least ${budgets.minimumJavaScriptChunks} JavaScript chunks to preserve route/vendor splitting.`,
    `Found ${javascript.length} in ${buildRoot}.`,
  ].join(" "),
);
assert.ok(
  javascript.length <= budgets.maximumJavaScriptChunks,
  `JavaScript chunk count ${javascript.length} exceeds ${budgets.maximumJavaScriptChunks}.`,
);
assert.ok(
  largest(javascript) <= budgets.maximumSingleJavaScriptBytes,
  `Largest JavaScript asset ${formatKib(largest(javascript))} exceeds ${formatKib(budgets.maximumSingleJavaScriptBytes)}.`,
);
assert.ok(
  total(javascript) <= budgets.maximumTotalJavaScriptBytes,
  `Total JavaScript ${formatKib(total(javascript))} exceeds ${formatKib(budgets.maximumTotalJavaScriptBytes)}.`,
);
assert.ok(
  css.length <= budgets.maximumCssAssets,
  `CSS asset count ${css.length} exceeds ${budgets.maximumCssAssets}.`,
);
assert.ok(
  largest(css) <= budgets.maximumSingleCssBytes,
  `Largest CSS asset ${formatKib(largest(css))} exceeds ${formatKib(budgets.maximumSingleCssBytes)}.`,
);
assert.ok(
  total(css) <= budgets.maximumTotalCssBytes,
  `Total CSS ${formatKib(total(css))} exceeds ${formatKib(budgets.maximumTotalCssBytes)}.`,
);
assert.ok(
  largest(fonts) <= budgets.maximumSingleFontBytes,
  `Largest font asset ${formatKib(largest(fonts))} exceeds ${formatKib(budgets.maximumSingleFontBytes)}.`,
);
assert.ok(
  total(fonts) <= budgets.maximumTotalFontBytes,
  `Total fonts ${formatKib(total(fonts))} exceeds ${formatKib(budgets.maximumTotalFontBytes)}.`,
);
assert.ok(
  images.length <= budgets.maximumImageAssets,
  `Image asset count ${images.length} exceeds ${budgets.maximumImageAssets}.`,
);
assert.ok(
  largest(images) <= budgets.maximumSingleImageBytes,
  `Largest image asset ${formatKib(largest(images))} exceeds ${formatKib(budgets.maximumSingleImageBytes)}.`,
);
assert.ok(
  total(images) <= budgets.maximumTotalImageBytes,
  `Total images ${formatKib(total(images))} exceeds ${formatKib(budgets.maximumTotalImageBytes)}.`,
);

console.log(JSON.stringify(report, null, 2));
