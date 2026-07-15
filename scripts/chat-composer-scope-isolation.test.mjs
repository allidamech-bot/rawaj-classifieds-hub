import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [routeSource, packageSource] = await Promise.all([
  readFile(new URL("../src/routes/chats.tsx", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
]);

test("composer drafts are keyed by both account and conversation", () => {
  assert.match(routeSource, /const \[composerDrafts, setComposerDrafts\]/);
  assert.match(routeSource, /auth\.profile\?\.id && selectedConversation\?\.id/);
  assert.match(routeSource, /\[auth\.profile\.id, selectedConversation\.id\]\.join\(":"\)/);
  assert.match(routeSource, /composerDrafts\[composerScopeKey\]/);
  assert.doesNotMatch(routeSource, /const \[body, setBody\] = useState/);
});

test("conversation switches cannot carry risk confirmations or block reasons", () => {
  assert.match(routeSource, /setConfirmedRisk\(null\)/);
  assert.match(routeSource, /setBlockReason\(""\)/);
  assert.match(routeSource, /\[selectedConversation\?\.id\]/);
  assert.match(routeSource, /confirmedRisk\?\.scopeKey === composerScopeKey/);
  assert.match(routeSource, /confirmedRisk\.body === body\.trim\(\)/);
});

test("quick replies and typing update only the active composer scope", () => {
  assert.match(routeSource, /function setCurrentComposerBody/);
  assert.match(routeSource, /updateComposerDraft\(composerScopeKey, value\)/);
  assert.match(routeSource, /setCurrentComposerBody\(language === "ar" \? reply\.ar : reply\.en\)/);
  assert.match(routeSource, /setCurrentComposerBody\(event\.target\.value\)/);
});

test("message sends are deduplicated per scoped composer", () => {
  assert.match(routeSource, /sendInFlightScopesRef = useRef<Set<string>>/);
  assert.match(routeSource, /sendInFlightScopesRef\.current\.has\(scopeKey\)/);
  assert.match(routeSource, /sendInFlightScopesRef\.current\.add\(scopeKey\)/);
  assert.match(routeSource, /sendInFlightScopesRef\.current\.delete\(scopeKey\)/);
  assert.match(routeSource, /sendingScopes\.has\(composerScopeKey\)/);
});

test("successful sends clear only the submitted unchanged draft", () => {
  assert.match(routeSource, /function clearComposerDraftIfUnchanged/);
  assert.match(routeSource, /\(current\[scopeKey\] \?\? ""\)\.trim\(\) !== submittedBody/);
  assert.match(routeSource, /clearComposerDraftIfUnchanged\(scopeKey, cleanBody\)/);
  assert.ok(
    routeSource.indexOf("completeMessageSendRequest(profileId, conversationId, requestId)") <
      routeSource.indexOf("clearComposerDraftIfUnchanged(scopeKey, cleanBody)"),
  );
});

test("async chat reads and mutations reject stale account or conversation results", () => {
  assert.match(routeSource, /profileIdRef = useRef<string \| null>/);
  assert.match(routeSource, /profileId !== profileIdRef\.current/);
  assert.match(routeSource, /conversationId !== selectedConversationIdRef\.current/);
  assert.match(routeSource, /profileIdRef\.current === profileId/);
  assert.match(routeSource, /selectedConversationIdRef\.current === conversationId/);
});

test("scope isolation stays in the permanent chat workspace contract", () => {
  const packageJson = JSON.parse(packageSource);
  assert.match(
    packageJson.scripts["test:chat-workspace"],
    /chat-composer-scope-isolation\.test\.mjs/,
  );
  assert.match(packageJson.scripts.check, /npm run test:chat-workspace/);
});
