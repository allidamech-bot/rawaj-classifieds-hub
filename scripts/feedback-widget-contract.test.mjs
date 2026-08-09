import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

test("feedback schema is isolated from emergency system controls", () => {
  const migration = read("cloudflare/d1/migrations/0020_feedback_widget.sql");
  assert.match(migration, /CREATE TABLE feature_flags/);
  assert.match(migration, /feedback_widget_enabled/);
  assert.match(migration, /CREATE TABLE user_feedback/);
  assert.match(migration, /context_json/);
  assert.doesNotMatch(migration, /ALTER TABLE system_controls/);
});

test("worker exposes public submission and protected admin feedback routes", () => {
  const feedback = read("cloudflare/worker/src/feedback.ts");
  const entry = read("cloudflare/worker/src/entry.ts");
  assert.match(feedback, /\/v1\/feedback\/config/);
  assert.match(feedback, /\/v1\/feedback/);
  assert.match(feedback, /\/v1\/admin\/feedback/);
  assert.match(feedback, /requireMutationAuth/);
  assert.match(feedback, /roles\.includes\("owner"\)/);
  assert.match(entry, /handleFeedback/);
  assert.match(entry, /isFeedbackPath/);
});

test("feedback submissions use abuse rate limiting and their own Turnstile action", () => {
  const security = read("cloudflare/worker/src/security.ts");
  const client = read("src/lib/api/feedback.ts");
  assert.match(security, /path === "\/v1\/feedback"/);
  assert.match(security, /"feedback_request"/);
  assert.match(security, /className: "abuse"/);
  assert.match(client, /getTurnstileToken\("feedback_request"\)/);
});

test("global shell mounts a keyboard-safe non-admin feedback trigger", () => {
  const shell = read("src/components/shell/AppShell.tsx");
  const widget = read("src/components/FeedbackWidget.tsx");
  assert.match(shell, /<FeedbackWidget/);
  assert.match(shell, /triggerHidden=\{keyboardOpen/);
  assert.match(shell, /pathname\.startsWith\("\/admin"\)/);
  assert.match(widget, /fixed top-\[58%\]/);
  assert.match(widget, /left-2 sm:left-3/);
  assert.match(widget, /right-2 sm:right-3/);
  assert.match(widget, /role="dialog"/);
  assert.match(widget, /aria-modal="true"/);
});

test("guest drafts survive sign-in and diagnostics are attached", () => {
  const widget = read("src/components/FeedbackWidget.tsx");
  assert.match(widget, /rawaj-feedback-draft-v1/);
  assert.match(widget, /searchParams\.set\("feedback", "1"\)/);
  assert.match(widget, /viewportWidth/);
  assert.match(widget, /clientTimestamp/);
  assert.match(widget, /userAgent/);
  assert.match(widget, /auth\.status !== "signedIn"/);
});

test("owner center contains feature toggle and triage inbox", () => {
  const owner = read("src/routes/admin.owner-controls.tsx");
  const panel = read("src/features/admin/FeedbackAdminPanel.tsx");
  assert.match(owner, /FeedbackAdminPanel/);
  assert.match(panel, /استقبال الاقتراحات والشكاوى/);
  assert.match(panel, /adminFetchFeedback/);
  assert.match(panel, /adminUpdateFeedback/);
  assert.match(panel, /publicResponse/);
  assert.match(panel, /adminNote/);
  assert.match(panel, /under_review/);
  assert.match(panel, /urgent/);
});
