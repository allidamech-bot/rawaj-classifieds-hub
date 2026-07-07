import fs from "node:fs";

const path = "src/lib/classifieds-types.ts";
const source = fs.readFileSync(path, "utf8");
const search = "  locationNodeId: string | null;\n";
if (!source.includes(search)) throw new Error("locationNodeId field not found");
fs.writeFileSync(path, source.replace(search, "  locationNodeId?: string | null;\n"));
