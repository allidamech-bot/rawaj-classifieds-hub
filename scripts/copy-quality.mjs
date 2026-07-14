import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const sourceRoot = resolve("src");
const supportedExtensions = /\.(?:ts|tsx)$/;
const ignoredFiles = new Set(["routeTree.gen.ts"]);
const placeholderCopy = /Lorem ipsum|TODO_COPY|FIXME_COPY|TRANSLATION_MISSING|placeholder copy/i;
const emptyArabicLabel = /text\(\s*["'`]\s*["'`]\s*,/;
const emptyEnglishLabel = /text\([\s\S]{0,240}?,\s*["'`]\s*["'`]\s*\)/;

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectSourceFiles(path)));
    else if (supportedExtensions.test(entry.name) && !ignoredFiles.has(entry.name))
      files.push(path);
  }

  return files;
}

const files = await collectSourceFiles(sourceRoot);
const violations = [];

for (const file of files) {
  const source = await readFile(file, "utf8");
  if (placeholderCopy.test(source)) violations.push(`${file}: placeholder copy`);
  if (emptyArabicLabel.test(source)) violations.push(`${file}: empty bilingual Arabic label`);
  if (emptyEnglishLabel.test(source)) violations.push(`${file}: empty bilingual English label`);
}

assert.deepEqual(violations, [], `Copy quality violations:\n${violations.join("\n")}`);
console.log(`Copy quality passed for ${files.length} TypeScript source files.`);
