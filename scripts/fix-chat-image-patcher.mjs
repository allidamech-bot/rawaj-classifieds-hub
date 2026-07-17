import { readFile, writeFile } from "node:fs/promises";

const path = "scripts/apply-chat-image-ui-v1.mjs";
let source = await readFile(path, "utf8");
for (const token of [
  "${cleanBody}",
  "${image.file.name}",
  "${image.file.size}",
  "${image.file.lastModified}",
]) {
  source = source.replaceAll(token, `\\${token}`);
}
await writeFile(path, source, "utf8");
