import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

export async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

export async function write(relativePath, content) {
  const absolutePath = path.join(root, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, "utf8");
}

export async function replaceOnce(relativePath, pattern, replacement, label = relativePath) {
  const source = await read(relativePath);
  const next = source.replace(pattern, replacement);
  if (next === source) {
    throw new Error(`Expected patch target was not found: ${label}`);
  }
  await write(relativePath, next);
}
