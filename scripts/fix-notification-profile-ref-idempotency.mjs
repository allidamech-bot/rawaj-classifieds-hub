import { readFileSync, writeFileSync } from "node:fs";

const path = "src/routes/notifications.tsx";
const source = readFileSync(path, "utf8");
const next = source.replaceAll("profileIdRef.currentRef.current", "profileIdRef.current");

if (next === source) {
  console.log("Notification profile ref already normalized.");
  process.exit(0);
}

writeFileSync(path, next);
console.log("Notification profile ref normalized.");
