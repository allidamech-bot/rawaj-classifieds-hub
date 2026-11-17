import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/android-push-delivery.ts", import.meta.url), "utf8");
const migration = await readFile(
  new URL("../../d1/migrations/0026_android_push_delivery.sql", import.meta.url),
  "utf8",
);
const webMigration = await readFile(
  new URL("../../d1/migrations/0027_web_push_delivery.sql", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const { deliverAndroidPush } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);

const stamp = "2026-11-17T00:00:00.000Z";
const secret = "local-fixture-secret-not-used-in-production";
const pair = await crypto.subtle.generateKey(
  {
    name: "RSASSA-PKCS1-v1_5",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-256",
  },
  true,
  ["sign", "verify"],
);
const key = Buffer.from(await crypto.subtle.exportKey("pkcs8", pair.privateKey)).toString("base64");
const account = JSON.stringify({
  project_id: "rawaj-test-project",
  client_email: "push@rawaj-test-project.iam.gserviceaccount.com",
  private_key: `-----BEGIN PRIVATE KEY-----\n${key}\n-----END PRIVATE KEY-----`,
});
const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
const aes = await crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt"]);
const iv = crypto.getRandomValues(new Uint8Array(12));
const ciphertext = await crypto.subtle.encrypt(
  { name: "AES-GCM", iv },
  aes,
  new TextEncoder().encode("fixture-android-device-token"),
);
const encrypted = Buffer.concat([Buffer.from(iv), Buffer.from(ciphertext)]).toString("base64url");

function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE auth_users (id TEXT PRIMARY KEY);
    CREATE TABLE public_profiles (id TEXT PRIMARY KEY, account_status TEXT);
    CREATE TABLE push_devices (
      id TEXT PRIMARY KEY, user_id TEXT, token_hash TEXT, platform TEXT, active INTEGER,
      permission_status TEXT, encrypted_token TEXT, locale TEXT
    );
    CREATE TABLE notification_preferences (
      user_id TEXT PRIMARY KEY, push_enabled INTEGER, messages_enabled INTEGER,
      price_changes_enabled INTEGER, saved_search_matches_enabled INTEGER,
      listing_status_enabled INTEGER, reviews_enabled INTEGER, promotions_enabled INTEGER
    );
    CREATE TABLE notifications (
      id TEXT PRIMARY KEY, user_id TEXT, type TEXT, created_at TEXT, read_at TEXT
    );
    CREATE TABLE conversations (id TEXT PRIMARY KEY, buyer_id TEXT, seller_id TEXT, status TEXT);
    CREATE TABLE conversation_messages (
      id TEXT PRIMARY KEY, conversation_id TEXT, sender_id TEXT, message_type TEXT,
      created_at TEXT, deleted_at TEXT, read_at TEXT
    );
    INSERT INTO auth_users VALUES ('buyer'), ('seller');
    INSERT INTO public_profiles VALUES ('buyer','active'), ('seller','active');
    INSERT INTO notification_preferences VALUES
      ('buyer',1,1,1,1,1,1,1), ('seller',1,1,1,1,1,1,1);
    INSERT INTO conversations VALUES ('conversation','buyer','seller','active');
  `);
  db.exec(migration);
  db.exec(webMigration);
  const insert = db.prepare("INSERT INTO push_devices VALUES (?, ?, ?, ?, 1, 'granted', ?, 'ar')");
  insert.run("android", "buyer", "hash-1", "android", encrypted);
  insert.run("ios", "buyer", "hash-2", "ios", encrypted);
  insert.run("sender", "seller", "hash-3", "android", encrypted);
  const wrapped = {
    prepare(sql) {
      const statement = db.prepare(sql);
      return {
        bind(...args) {
          return {
            async all() {
              return { success: true, results: statement.all(...args) };
            },
            async first() {
              return statement.get(...args) ?? null;
            },
            async run() {
              return { success: true, meta: { changes: Number(statement.run(...args).changes) } };
            },
          };
        },
      };
    },
  };
  const env = {
    DB: wrapped,
    FIREBASE_PROJECT_ID: "rawaj-test-project",
    FCM_SERVICE_ACCOUNT_JSON: account,
    PUSH_TOKEN_ENCRYPTION_KEY: secret,
  };
  function message(id = "message") {
    db.prepare(
      "INSERT INTO conversation_messages VALUES (?, 'conversation', 'seller', 'text', ?, NULL, NULL)",
    ).run(id, stamp);
  }
  function notification(id = "notice") {
    db.prepare("INSERT INTO notifications VALUES (?, 'buyer', 'saved_search.match', ?, NULL)").run(
      id,
      stamp,
    );
  }
  return { db, env, message, notification };
}

function transport({ status = 200, unregistered = false } = {}) {
  const sent = [];
  const request = async (url, init) => {
    if (url === "https://oauth2.googleapis.com/token") {
      assert.match(String(init.body), /assertion=/);
      return Response.json({ access_token: "fixture-token" });
    }
    assert.equal(url, "https://fcm.googleapis.com/v1/projects/rawaj-test-project/messages:send");
    assert.equal(init.headers.Authorization, "Bearer fixture-token");
    sent.push(JSON.parse(init.body).message);
    return Response.json(
      unregistered ? { error: { details: [{ errorCode: "UNREGISTERED" }] } } : {},
      { status },
    );
  };
  return { request, sent };
}

test("outbox routes Android messages and in-app notices once to recipient, not sender or iOS", async () => {
  const { db, env, message, notification } = fixture();
  message();
  notification();
  const { request, sent } = transport();
  assert.equal(db.prepare("SELECT count(*) AS n FROM push_delivery_jobs").get().n, 2);
  await deliverAndroidPush(env, stamp, request);
  await deliverAndroidPush(env, stamp, request);
  assert.equal(sent.length, 2);
  assert.ok(sent.every((item) => item.token === "fixture-android-device-token"));
  assert.ok(sent.some((item) => item.data.conversation_id === "conversation"));
  assert.ok(sent.some((item) => item.data.notification_id === "notice"));
  assert.ok(sent.every((item) => item.notification.body === "لديك تحديث جديد."));
  assert.equal(
    db.prepare("SELECT count(*) AS n FROM push_delivery_jobs WHERE status='sent'").get().n,
    2,
  );
  db.close();
});

test("delivery respects preference changes, read state and device reassignment", async () => {
  const { db, env, message, notification } = fixture();
  message();
  notification();
  db.exec("UPDATE notification_preferences SET messages_enabled=0 WHERE user_id='buyer'");
  db.exec("UPDATE notifications SET read_at='2026-11-17T00:00:00.000Z'");
  const { request, sent } = transport();
  await deliverAndroidPush(env, stamp, request);
  assert.equal(sent.length, 0);
  assert.equal(
    db.prepare("SELECT count(*) AS n FROM push_delivery_jobs WHERE status='cancelled'").get().n,
    2,
  );
  db.exec("UPDATE notification_preferences SET messages_enabled=1 WHERE user_id='buyer'");
  message("second");
  db.exec("UPDATE push_devices SET user_id='seller' WHERE id='android'");
  await deliverAndroidPush(env, stamp, request);
  assert.equal(sent.length, 0);
  db.close();
});

test("FCM retry has a due time; invalidated tokens are disabled", async () => {
  const { db, env, message } = fixture();
  message();
  const failed = transport({ status: 503 });
  await deliverAndroidPush(env, stamp, failed.request);
  await deliverAndroidPush(env, stamp, failed.request);
  assert.equal(failed.sent.length, 1);
  assert.equal(db.prepare("SELECT status FROM push_delivery_jobs").get().status, "pending");
  const invalid = transport({ status: 404, unregistered: true });
  await deliverAndroidPush(env, "2026-11-17T00:15:00.000Z", invalid.request);
  assert.equal(invalid.sent.length, 1);
  assert.equal(db.prepare("SELECT active FROM push_devices WHERE id='android'").get().active, 0);
  assert.equal(db.prepare("SELECT status FROM push_delivery_jobs").get().status, "cancelled");
  db.close();
});

test("unconfigured production does not contact an external provider", async () => {
  const { db, env, message } = fixture();
  message();
  await deliverAndroidPush({ ...env, FCM_SERVICE_ACCOUNT_JSON: "" }, stamp, async () => {
    throw new Error("unexpected network");
  });
  assert.equal(db.prepare("SELECT attempts FROM push_delivery_jobs").get().attempts, 0);
  db.close();
});

test("message fast path sends only the committed message; cron drains other jobs", async () => {
  const { db, env, message, notification } = fixture();
  message("older");
  message("new");
  notification();
  const { request, sent } = transport();
  await deliverAndroidPush(env, stamp, request, "new");
  assert.equal(sent.length, 1);
  assert.equal(
    db.prepare("SELECT status FROM push_delivery_jobs WHERE event_id='new'").get().status,
    "sent",
  );
  assert.equal(
    db.prepare("SELECT status FROM push_delivery_jobs WHERE event_id='older'").get().status,
    "pending",
  );
  assert.equal(
    db.prepare("SELECT status FROM push_delivery_jobs WHERE event_id='notice'").get().status,
    "pending",
  );
  await deliverAndroidPush(env, stamp, request, "new");
  assert.equal(sent.length, 1);
  await deliverAndroidPush(env, stamp, request);
  assert.equal(sent.length, 3);
  db.close();
});

test("PWA and Android receive the same new event with distinct platform payloads", async () => {
  const { db, env, message } = fixture();
  db.prepare("INSERT INTO push_devices VALUES (?, ?, ?, ?, 1, 'granted', ?, 'ar')").run(
    "pwa",
    "buyer",
    "hash-web",
    "web",
    encrypted,
  );
  message("new");
  const { request, sent } = transport();
  await deliverAndroidPush(env, stamp, request, "new");
  assert.equal(sent.length, 2);
  const web = sent.find((item) => item.webpush);
  assert.equal(web.data.event_id, "new");
  assert.equal(web.data.conversation_id, "conversation");
  assert.equal(web.notification, undefined);
  assert.equal(web.android, undefined);
  assert.ok(sent.some((item) => item.android && item.notification));
  await deliverAndroidPush(env, stamp, request);
  assert.equal(sent.length, 2);
  db.close();
});
