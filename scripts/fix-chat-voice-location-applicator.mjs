import { readFile, writeFile } from "node:fs/promises";

const path = "scripts/apply-chat-voice-location-ui-v1.mjs";
const source = await readFile(path, "utf8");
const lines = source.split("\n");
let replaced = false;
const next = lines.map((line) => {
  if (line.includes("setCurrentComposerBody(text(`موقعي الحالي:")) {
    replaced = true;
    return '        setCurrentComposerBody(text("موقعي الحالي: https://www.google.com/maps?q=" + latitude + "," + longitude, "My current location: https://www.google.com/maps?q=" + latitude + "," + longitude));';
  }
  return line;
});
if (!replaced) throw new Error("Location template line was not found");
await writeFile(path, next.join("\n"));
