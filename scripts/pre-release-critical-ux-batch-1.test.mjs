import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [quickFilters, voicePlayer, communicationExperience, chatCss, currencyTypes, format] =
  await Promise.all([
    readFile(new URL("../src/features/search/QuickFilterRail.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../src/features/communication/ChatVoiceAttachment.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/features/communication/CommunicationExperience.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../src/chat-release-fixes.css", import.meta.url), "utf8"),
    readFile(new URL("../src/types/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/utils/format.ts", import.meta.url), "utf8"),
  ]);

test("quick filter controls open their intended filter sections", () => {
  assert.match(quickFilters, /type QuickFilterSection = "location" \| "price" \| "category" \| "condition"/);
  assert.match(quickFilters, /onClick=\{\(\) => openSection\("location"\)\}/);
  assert.match(quickFilters, /onClick=\{\(\) => openSection\("price"\)\}/);
  assert.match(quickFilters, /onClick=\{\(\) => openSection\("category"\)\}/);
  assert.match(quickFilters, /onClick=\{\(\) => openSection\("condition"\)\}/);
  assert.match(quickFilters, /target\.scrollIntoView/);
  assert.match(quickFilters, /\.focus\(\{ preventScroll: true \}\)/);
});

test("private voice messages recover missing or expired signed URLs", () => {
  assert.match(voicePlayer, /if \(!initialUrl\) void refresh\(\)/);
  assert.match(voicePlayer, /refreshPromiseRef/);
  assert.match(voicePlayer, /key=\{url\}/);
  assert.match(voicePlayer, /playsInline/);
  assert.match(voicePlayer, /onError=\{\(\) => void handleError\(\)\}/);
  assert.doesNotMatch(voicePlayer, /const \[failed, setFailed\] = useState\(!initialUrl\)/);
});

test("messages route removes the oversized pre-chat area on mobile", () => {
  assert.match(communicationExperience, /import "\.\.\/\.\.\/chat-release-fixes\.css"/);
  assert.match(chatCss, /\.rawaj-communication-v2--messages \.rawaj-communication-hero/);
  assert.match(
    chatCss,
    /@media \(max-width: 1023px\)[\s\S]*\.rawaj-communication-v2--messages \.rawaj-communication-hero,[\s\S]*\.rawaj-communication-v2--messages \.rawaj-communication-safety \{[\s\S]*display: none/,
  );
  assert.match(chatCss, /min-height: calc\(100dvh - 9\.25rem\)/);
});

test("currency presentation includes new SYP, USD, EUR, and SAR", () => {
  assert.match(currencyTypes, /export type Currency = "SYP" \| "USD" \| "EUR" \| "SAR"/);
  assert.match(format, /SYP: "ل\.س جديدة"/);
  assert.match(format, /USD: "\$"/);
  assert.match(format, /EUR: "€"/);
  assert.match(format, /SAR: "ر\.س"/);
});
