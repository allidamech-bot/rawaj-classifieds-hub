#!/usr/bin/env node
process.argv.push("--local");
await import("./render-config.mjs");
