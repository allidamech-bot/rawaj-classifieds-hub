import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const sourceRoot = resolve("src");
const supportedExtensions = /\.(?:ts|tsx)$/;
const ignoredFiles = new Set(["routeTree.gen.ts"]);
const placeholderCopy = /Lorem ipsum|TODO_COPY|FIXME_COPY|TRANSLATION_MISSING|placeholder copy/i;
const emptyArabicLabel = /text\(\s*["'`]\s*["'`]\s*,/;
const emptyEnglishLabel =
  /text\(\s*(?:["'`](?:\\.|[^"'`\\])*["'`]\s*|`(?:\\.|[^`\\])*`\s*),\s*["'`]\s*["'`]\s*\)/gs;

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectSourceFiles(path)));
    else if (supportedExtensions.test(entry.name) && !ignoredFiles.has(entry.name)) files.push(path);
  }

  return files;
}

function lineNumber(source, index) {
  return source.slice(0, index).split("\n").length;
}

const files = await collectSourceFiles(sourceRoot);
const violations = [];

for (const file of files) {
  const source = await readFile(file, "utf8");
  const placeholderMatch = placeholderCopy.exec(source);
  if (placeholderMatch) {
    violations.push(`${file}:${lineNumber(source, placeholderMatch.index)} placeholder copy`);
  }

  const emptyArabicMatch = emptyArabicLabel.exec(source);
  if (emptyArabicMatch) {
    violations.push(
      `${file}:${lineNumber(source, emptyArabicMatch.index)} empty bilingual Arabic label`,
    );
  }

  const emptyEnglishMatch = emptyEnglishLabel.exec(source);
  if (emptyEnglishMatch) {
    violations.push(
      `${file}:${lineNumber(source, emptyEnglishMatch.index)} empty bilingual English label`,
    );
  }
}

assert.deepEqual(violations, [], `Copy quality violations:\n${violations.join("\n")}`);
console.log(`Copy quality passed for ${files.length} TypeScript source files.`);
