#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const options = parseArgs(process.argv.slice(2));
const workerRoot = resolve(import.meta.dirname, "..");
const configPath = resolve(workerRoot, "wrangler.generated.jsonc");

const objectsQuery = `
  SELECT type, name, tbl_name, sql
    FROM sqlite_master
   WHERE name NOT LIKE 'sqlite_%'
   ORDER BY type, name`;

const expected = await inspect("local");
const actual = await inspect("remote");
const comparison = compareSchemas(expected, actual);
const backup = await backupOrdinaryTables(actual);

const report = {
  generatedAt: new Date().toISOString(),
  database: options.database,
  expectedState: "post-0003",
  compatible: comparison.materialMismatches.length === 0,
  expectedSummary: summarize(expected),
  actualSummary: summarize(actual),
  materialMismatches: comparison.materialMismatches,
  additiveObjects: comparison.additiveObjects,
  backup: {
    directory: options.backupDir,
    ordinaryTables: backup.tables,
    excludedVirtualTables: backup.excludedVirtualTables,
    aggregateCounts: backup.aggregateCounts,
    manifestSha256: backup.manifestSha256,
  },
};

await mkdir(resolve(options.report).replace(/[\\/][^\\/]+$/, ""), { recursive: true });
await writeFile(resolve(options.report), `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      report: resolve(options.report),
      compatible: report.compatible,
      materialMismatchCount: report.materialMismatches.length,
      additiveObjectCount: report.additiveObjects.length,
      backedUpOrdinaryTables: backup.tables.length,
      excludedVirtualTables: backup.excludedVirtualTables,
      aggregateCounts: backup.aggregateCounts,
      manifestSha256: backup.manifestSha256,
    },
    null,
    2,
  ),
);

if (!report.compatible) process.exitCode = 2;

async function inspect(mode) {
  const objects = wranglerQuery(mode, objectsQuery).filter(
    (object) => !object.name.startsWith("_cf_"),
  );
  const columns = [];
  const foreignKeys = [];
  const indexes = [];
  const indexColumns = [];
  const tables = objects.filter((object) => object.type === "table");
  for (const table of tables) {
    if (!isSafeIdentifier(table.name)) {
      throw new Error(`Unsafe table identifier returned by D1: ${table.name}`);
    }
  }

  const columnResults = wranglerStatements(
    mode,
    tables.map((table) => `PRAGMA table_xinfo("${table.name}")`),
  );
  const foreignKeyResults = wranglerStatements(
    mode,
    tables.map((table) => `PRAGMA foreign_key_list("${table.name}")`),
  );
  const indexResults = wranglerStatements(
    mode,
    tables.map((table) => `PRAGMA index_list("${table.name}")`),
  );

  for (let tableIndex = 0; tableIndex < tables.length; tableIndex += 1) {
    const table = tables[tableIndex];
    for (const row of columnResults[tableIndex]) {
      columns.push({
        table_name: table.name,
        cid: row.cid,
        column_name: row.name,
        type: row.type,
        not_null: row.notnull,
        dflt_value: row.dflt_value,
        pk: row.pk,
        hidden: row.hidden,
      });
    }
    for (const row of foreignKeyResults[tableIndex]) {
      foreignKeys.push({
        table_name: table.name,
        id: row.id,
        seq: row.seq,
        target_table: row.table,
        from_column: row.from,
        to_column: row.to,
        on_update: row.on_update,
        on_delete: row.on_delete,
        match: row.match,
      });
    }
    for (const row of indexResults[tableIndex]) {
      if (!isSafeIdentifier(row.name)) {
        throw new Error(`Unsafe index identifier returned by D1: ${row.name}`);
      }
      indexes.push({
        table_name: table.name,
        seq: row.seq,
        index_name: row.name,
        is_unique: row.unique,
        origin: row.origin,
        partial: row.partial,
      });
    }
  }

  const indexColumnResults = wranglerStatements(
    mode,
    indexes.map((index) => `PRAGMA index_xinfo("${index.index_name}")`),
  );
  for (let index = 0; index < indexes.length; index += 1) {
    const metadata = indexes[index];
    for (const row of indexColumnResults[index]) {
      indexColumns.push({
        table_name: metadata.table_name,
        index_name: metadata.index_name,
        seqno: row.seqno,
        cid: row.cid,
        column_name: row.name,
        is_desc: row.desc,
        coll: row.coll,
        is_key: row.key,
      });
    }
  }
  return { objects, columns, foreignKeys, indexes, indexColumns };
}

async function backupOrdinaryTables(schema) {
  const backupDir = resolve(options.backupDir);
  await mkdir(backupDir, { recursive: true });
  const ordinaryTables = schema.objects
    .filter((object) => object.type === "table" && !isFtsObject(object))
    .map((object) => object.name)
    .filter((name) => !name.startsWith("_cf_"))
    .filter(isSafeIdentifier)
    .sort();
  const virtualTables = schema.objects
    .filter((object) => object.type === "table" && isFtsObject(object))
    .map((object) => object.name)
    .sort();
  const manifest = [];
  const aggregateCounts = {};

  await writePrivateJson(resolve(backupDir, "schema.json"), schema);

  for (const table of ordinaryTables) {
    const rows = wranglerQuery("remote", `SELECT * FROM "${table}"`);
    aggregateCounts[table] = rows.length;
    const target = resolve(backupDir, `${table}.json`);
    const contents = `${JSON.stringify(rows)}\n`;
    await writeFile(target, contents, { encoding: "utf8", mode: 0o600 });
    manifest.push({
      table,
      rowCount: rows.length,
      sha256: createHash("sha256").update(contents).digest("hex"),
    });
  }

  const manifestContents = `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      database: options.database,
      tables: manifest,
      excludedVirtualTables: virtualTables,
    },
    null,
    2,
  )}\n`;
  await writeFile(resolve(backupDir, "manifest.json"), manifestContents, {
    encoding: "utf8",
    mode: 0o600,
  });

  return {
    tables: ordinaryTables,
    excludedVirtualTables: virtualTables,
    aggregateCounts,
    manifestSha256: createHash("sha256").update(manifestContents).digest("hex"),
  };
}

async function writePrivateJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}

function wranglerQuery(mode, sql) {
  return wranglerStatements(mode, [sql])[0];
}

function wranglerStatements(mode, statements) {
  if (statements.length === 0) return [];
  const args = [
    "wrangler",
    "d1",
    "execute",
    options.database,
    mode === "remote" ? "--remote" : "--local",
    "--config",
    configPath,
    "--json",
    "--command",
    statements.map((statement) => `${compactSql(statement)};`).join(" "),
  ];
  if (mode === "local") args.splice(5, 0, "--persist-to", options.expectedPersist);

  const wranglerBin = resolve(workerRoot, "node_modules/wrangler/bin/wrangler.js");
  const result = spawnSync(process.execPath, [wranglerBin, ...args.slice(1)], {
    cwd: workerRoot,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 128 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(
      `Wrangler ${mode} query failed: ${sanitizeError(
        result.stderr || result.stdout || result.error?.message,
      )}`,
    );
  }
  const payload = JSON.parse(result.stdout);
  const results = Array.isArray(payload) ? payload : [payload];
  if (
    results.length !== statements.length ||
    results.some((statement) => !statement?.success || !Array.isArray(statement.results))
  ) {
    throw new Error(`Wrangler ${mode} query returned an invalid payload.`);
  }
  return results.map((statement) => statement.results);
}

function compareSchemas(expectedSchema, actualSchema) {
  const materialMismatches = [];
  for (const category of ["columns", "foreignKeys", "indexes", "indexColumns"]) {
    const actualKeys = new Map(actualSchema[category].map((row) => [rowKey(category, row), row]));
    for (const expectedRow of expectedSchema[category]) {
      const key = rowKey(category, expectedRow);
      const actualRow = actualKeys.get(key);
      if (!actualRow) {
        materialMismatches.push({ category, key, issue: "missing", expected: expectedRow });
      } else if (stableJson(expectedRow) !== stableJson(actualRow)) {
        materialMismatches.push({
          category,
          key,
          issue: "different",
          expected: expectedRow,
          actual: actualRow,
        });
      }
    }
  }

  const expectedNamedObjects = expectedSchema.objects.filter(
    (object) =>
      object.type === "trigger" ||
      object.type === "view" ||
      (object.type === "table" && isVirtualTable(object)) ||
      (object.type === "index" && object.sql),
  );
  const actualObjects = new Map(actualSchema.objects.map((object) => [objectKey(object), object]));
  for (const expectedObject of expectedNamedObjects) {
    const key = objectKey(expectedObject);
    const actualObject = actualObjects.get(key);
    if (!actualObject) {
      materialMismatches.push({ category: "objects", key, issue: "missing" });
    } else if (normalizeSql(expectedObject.sql) !== normalizeSql(actualObject.sql)) {
      materialMismatches.push({
        category: "objects",
        key,
        issue: "different_sql",
        expectedSql: normalizeSql(expectedObject.sql),
        actualSql: normalizeSql(actualObject.sql),
      });
    }
  }

  const expectedObjectKeys = new Set(expectedSchema.objects.map(objectKey));
  const additiveObjects = actualSchema.objects
    .filter((object) => !expectedObjectKeys.has(objectKey(object)))
    .map((object) => ({ type: object.type, name: object.name, table: object.tbl_name }));
  return { materialMismatches, additiveObjects };
}

function summarize(schema) {
  const byType = {};
  for (const object of schema.objects) byType[object.type] = (byType[object.type] ?? 0) + 1;
  return {
    objectsByType: byType,
    columns: schema.columns.length,
    foreignKeys: schema.foreignKeys.length,
    indexes: schema.indexes.length,
    indexColumns: schema.indexColumns.length,
    virtualTables: schema.objects
      .filter((object) => object.type === "table" && isVirtualTable(object))
      .map((object) => object.name),
  };
}

function rowKey(category, row) {
  if (category === "columns") return `${row.table_name}:${row.column_name}`;
  if (category === "foreignKeys")
    return `${row.table_name}:${row.id}:${row.seq}:${row.from_column}:${row.target_table}`;
  if (category === "indexes") return `${row.table_name}:${row.index_name}`;
  return `${row.table_name}:${row.index_name}:${row.seqno}`;
}

function objectKey(object) {
  return `${object.type}:${object.name}`;
}

function isVirtualTable(object) {
  return /^CREATE\s+VIRTUAL\s+TABLE\b/i.test(object.sql ?? "");
}

function isFtsObject(object) {
  return isVirtualTable(object) || /^listings_fts(?:_|$)/i.test(object.name);
}

function isSafeIdentifier(value) {
  return /^[a-z_][a-z0-9_]*$/i.test(value);
}

function compactSql(value) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeSql(value) {
  return String(value ?? "")
    .replace(/["'`[\]]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([(),=])\s*/g, "$1")
    .trim()
    .toLowerCase();
}

function stableJson(value) {
  return JSON.stringify(
    Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))),
  );
}

function sanitizeError(value) {
  return String(value ?? "")
    .replace(/(token|authorization|password|secret)\s*[:=]\s*\S+/gi, "$1=[redacted]")
    .slice(0, 1200);
}

function parseArgs(args) {
  const parsed = {
    database: "rawaj-staging",
    expectedPersist: ".wrangler/schema-expected-post0003-20260724",
    backupDir: "",
    report: "",
  };
  for (const arg of args) {
    if (arg.startsWith("--database=")) parsed.database = arg.slice(11);
    else if (arg.startsWith("--expected-persist=")) parsed.expectedPersist = arg.slice(19);
    else if (arg.startsWith("--backup-dir=")) parsed.backupDir = arg.slice(13);
    else if (arg.startsWith("--report=")) parsed.report = arg.slice(9);
    else throw new Error(`Unsupported argument: ${arg}`);
  }
  if (!parsed.backupDir || !parsed.report) {
    throw new Error("--backup-dir and --report are required.");
  }
  return parsed;
}
