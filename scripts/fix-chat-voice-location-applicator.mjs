import { readFile, writeFile } from "node:fs/promises";

const path = "scripts/apply-chat-voice-location-ui-v1.mjs";
const source = await readFile(path, "utf8");
const startMarker = "setCurrentComposerBody(text(`موقعي الحالي:";
const endMarker = "));\\n        setLocating(false);";
const start = source.indexOf(startMarker);
const end = start < 0 ? -1 : source.indexOf(endMarker, start);
if (start < 0 || end < 0) throw new Error("Location template segment was not found");
const replacement =
  'setCurrentComposerBody(text("موقعي الحالي: https://www.google.com/maps?q=" + latitude + "," + longitude, "My current location: https://www.google.com/maps?q=" + latitude + "," + longitude))';
const next = source.slice(0, start) + replacement + source.slice(end);
await writeFile(path, next);
