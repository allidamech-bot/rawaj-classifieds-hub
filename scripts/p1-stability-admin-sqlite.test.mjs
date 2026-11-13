import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require(process.env.RAWAJ_TSC_PATH || "typescript");
const source = readFileSync(
  new URL("../cloudflare/worker/src/admin-user-management.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  fileName: "admin-user-management.ts",
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

test("admin status, staff roles and restrictions enforce policy and preserve audit in isolated D1 SQL", async () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(`
      CREATE TABLE public_profiles(id TEXT PRIMARY KEY, account_status TEXT NOT NULL, updated_at TEXT);
      CREATE TABLE auth_users(id TEXT PRIMARY KEY, disabled_at TEXT, updated_at TEXT);
      CREATE TABLE user_roles(user_id TEXT,role TEXT,created_at TEXT,PRIMARY KEY(user_id,role));
      CREATE TABLE user_restrictions(
        id TEXT PRIMARY KEY,user_id TEXT,restriction_type TEXT,reason TEXT,starts_at TEXT,
        ends_at TEXT,created_by TEXT,created_at TEXT
      );
      CREATE TABLE audit_logs(
        id TEXT PRIMARY KEY,actor_id TEXT,action TEXT,entity_type TEXT,entity_id TEXT,
        metadata TEXT,created_at TEXT
      );
    `);
    for (const id of ["owner", "admin", "member"]) {
      db.prepare("INSERT INTO auth_users VALUES (?,?,?)").run(id, null, "2026-01-01T00:00:00Z");
      db.prepare("INSERT INTO public_profiles VALUES (?,?,?)").run(id, "active", "2026-01-01T00:00:00Z");
    }
    db.prepare("INSERT INTO user_roles VALUES(?,?,?)").run("owner", "owner", "2026-01-01T00:00:00Z");
    db.prepare("INSERT INTO user_roles VALUES(?,?,?)").run("admin", "admin", "2026-01-01T00:00:00Z");

    function prepare(sql) {
      let values = [];
      return {
        bind(...params) { values = params; return this; },
        async first() { return db.prepare(sql).get(...values) ?? null; },
        async run() {
          try {
            const result = db.prepare(sql).run(...values);
            return { success: true, meta: { changes: Number(result.changes) } };
          } catch (error) {
            return { success: false, error: String(error), meta: { changes: 0 } };
          }
        },
      };
    }
    const env = {
      DB: {
        prepare,
        async batch(statements) {
          db.exec("BEGIN IMMEDIATE");
          const results = [];
          try {
            for (const statement of statements) {
              const result = await statement.run();
              results.push(result);
              if (!result.success) throw new Error(result.error);
            }
            db.exec("COMMIT");
            return results;
          } catch (error) {
            db.exec("ROLLBACK");
            return results.length ? results : [{ success: false, error: String(error) }];
          }
        },
      },
    };
    const mockedAuth = {
      corsHeaders: () => new Headers(),
      json: (body, status, headers) =>
        new Response(JSON.stringify(body), { status, headers }),
      readJson: async (request) => {
        try { return { ok: true, data: await request.json() }; }
        catch { return { ok: false, status: 400, error: { code: "bad_json" } }; }
      },
      requireMutationAuth: async (request) => {
        const id = (request.headers.get("Authorization") ?? "").replace("Bearer ", "");
        const roles = db.prepare("SELECT role FROM user_roles WHERE user_id=?").all(id).map((r) => r.role);
        return roles.length
          ? { userId: id, roles, accountStatus: "active" }
          : new Response("Unauthorized", { status: 401 });
      },
    };
    const exports = {};
    vm.runInNewContext(compiled, {
      exports,
      require: (name) => {
        assert.equal(name, "./auth");
        return mockedAuth;
      },
      Response, Request, Headers, URL, Date, crypto: globalThis.crypto,
      console, JSON, Set, Number,
    });
    const handle = exports.handleAdminUserManagement;
    async function post(actor, operation, data) {
      const request = new Request(`https://test.example/v1/admin/users/${operation}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${actor}` },
        body: JSON.stringify(data),
      });
      const response = await handle(request, env);
      return { status: response.status, body: await response.json() };
    }
    assert.equal((await post("admin", "roles", {
      userId: "member", action: "assign", role: "moderator",
    })).status, 403);
    assert.equal((await post("owner", "status", {
      userId: "owner", status: "frozen", reason: "not allowed",
    })).status, 403);
    assert.equal((await post("admin", "status", {
      userId: "owner", status: "frozen", reason: "not allowed",
    })).status, 403);
    assert.equal((await post("admin", "status", {
      userId: "member", status: "disabled", reason: "owner required",
    })).status, 403);
    assert.equal((await post("owner", "roles", {
      userId: "member", action: "assign", role: "moderator",
    })).status, 200);
    assert.equal((await post("admin", "status", {
      userId: "member", status: "frozen", reason: "staff protected",
    })).status, 403);
    assert.equal((await post("owner", "roles", {
      userId: "member", action: "remove", role: "moderator",
    })).status, 200);
    assert.equal((await post("admin", "status", {
      userId: "member", status: "frozen", reason: "policy hold",
    })).status, 200);
    assert.equal(db.prepare("SELECT account_status FROM public_profiles WHERE id='member'").get().account_status, "frozen");
    assert.equal((await post("owner", "status", {
      userId: "member", status: "active", reason: "appeal approved",
    })).status, 200);
    const restricted = await post("admin", "restrictions", {
      userId: "member", action: "set", restrictionType: "posting", reason: "under review",
    });
    assert.equal(restricted.status, 201);
    assert.equal(db.prepare("SELECT count(*) AS count FROM user_restrictions WHERE ends_at IS NULL").get().count, 1);
    assert.equal((await post("admin", "restrictions", {
      userId: "member", action: "lift", restrictionType: "posting", reason: "review complete",
    })).status, 200);
    assert.equal(db.prepare("SELECT count(*) AS count FROM user_restrictions WHERE ends_at IS NULL").get().count, 0);
    assert.equal((await post("owner", "status", {
      userId: "member", status: "disabled", reason: "security review",
    })).status, 200);
    assert.ok(db.prepare("SELECT disabled_at FROM auth_users WHERE id='member'").get().disabled_at);
    assert.equal((await post("owner", "status", {
      userId: "member", status: "active", reason: "reinstated",
    })).status, 200);
    assert.equal(db.prepare("SELECT disabled_at FROM auth_users WHERE id='member'").get().disabled_at, null);
    const actions = db.prepare("SELECT action FROM audit_logs").all().map((x) => x.action);
    for (const action of [
      "user.status_changed", "user.role_assigned", "user.role_removed",
      "user.restriction_set", "user.restriction_lifted",
    ]) assert.ok(actions.includes(action), action);
  } finally {
    db.close();
  }
});
