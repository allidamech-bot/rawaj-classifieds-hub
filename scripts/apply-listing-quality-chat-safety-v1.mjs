import { readFileSync, writeFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function write(path, content) {
  writeFileSync(path, content);
}

function replaceOnce(source, from, to, label) {
  if (source.includes(to)) return source;
  const first = source.indexOf(from);
  const last = source.lastIndexOf(from);
  if (first === -1 || first !== last) {
    throw new Error(`${label}: expected exactly one source match`);
  }
  return source.slice(0, first) + to + source.slice(first + from.length);
}

function replacePattern(source, pattern, to, label) {
  if (source.includes(to)) return source;
  const matches = [...source.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`))];
  if (matches.length !== 1) {
    throw new Error(`${label}: expected exactly one regex match, found ${matches.length}`);
  }
  return source.replace(pattern, to);
}

function updateAddListing() {
  const path = "src/routes/add-listing.tsx";
  let source = read(path);
  source = replaceOnce(
    source,
    `} from "@/lib/content-safety";\nimport { runBoundedTasks } from "@/lib/bounded-task-queue";`,
    `} from "@/lib/content-safety";\nimport {\n  calculateListingQuality,\n  listingQualityCheckLabel,\n} from "@/lib/listing-quality";\nimport { runBoundedTasks } from "@/lib/bounded-task-queue";`,
    "add-listing quality import",
  );
  source = replacePattern(
    source,
    /  const score = useMemo\([\s\S]*?\n  \);\n  const steps =/,
    `  const quality = useMemo(\n    () =>\n      calculateListingQuality({\n        categoryReady:\n          taxonomyNodes.length > 0 ? Boolean(selectedTaxonomyNode?.isLeaf) : Boolean(categoryId),\n        title,\n        description,\n        imageCount: selectedImages.filter((entry) => entry.state !== "failed").length,\n        priceReady: priceType !== "fixed" || Number(normalizedPrice) > 0,\n        locationReady: Boolean(locationNodeId) || Boolean(governorateId && district),\n        categoryFieldKind,\n        categoryDetails,\n        condition,\n      }),\n    [\n      categoryDetails,\n      categoryFieldKind,\n      categoryId,\n      condition,\n      description,\n      district,\n      governorateId,\n      locationNodeId,\n      normalizedPrice,\n      priceType,\n      selectedImages,\n      selectedTaxonomyNode?.isLeaf,\n      taxonomyNodes.length,\n      title,\n    ],\n  );\n  const score = quality.score;\n  const steps =`,
    "add-listing quality score",
  );
  source = replacePattern(
    source,
    /                checks=\{\[[\s\S]*?\n                \]\}/,
    `                checks={quality.checks.map((check) => ({\n                  label: listingQualityCheckLabel(check.key, text),\n                  done: check.done,\n                }))}`,
    "add-listing quality checks",
  );
  source = source.replaceAll("score === 100", "quality.ready");
  write(path, source);
}

function updateManageListing() {
  const path = "src/routes/profile/listings.$id.tsx";
  let source = read(path);
  source = replaceOnce(
    source,
    `} from "@/lib/content-safety";\nimport {`,
    `} from "@/lib/content-safety";\nimport {\n  calculateListingQuality,\n  listingQualityCheckLabel,\n} from "@/lib/listing-quality";\nimport {`,
    "manage-listing quality import",
  );
  source = replacePattern(
    source,
    /  const studioScore =\n[\s\S]*?\.filter\(Boolean\)\.length \* 20;/,
    `  const quality = useMemo(\n    () =>\n      calculateListingQuality({\n        categoryReady:\n          taxonomyNodes.length > 0 ? Boolean(selectedTaxonomyNode?.isLeaf) : Boolean(categoryId),\n        title,\n        description,\n        imageCount:\n          images.length + selectedImages.filter((entry) => entry.state !== "failed").length,\n        priceReady: priceType !== "fixed" || Number(price) > 0,\n        locationReady: Boolean(locationNodeId) || Boolean(governorateId && district),\n        categoryFieldKind,\n        categoryDetails,\n        condition,\n      }),\n    [\n      categoryDetails,\n      categoryFieldKind,\n      categoryId,\n      condition,\n      description,\n      district,\n      governorateId,\n      images.length,\n      locationNodeId,\n      price,\n      priceType,\n      selectedImages,\n      selectedTaxonomyNode?.isLeaf,\n      taxonomyNodes.length,\n      title,\n    ],\n  );\n  const studioScore = quality.score;`,
    "manage-listing quality score",
  );
  source = replacePattern(
    source,
    /              checks=\{\[[\s\S]*?\n              \]\}/,
    `              checks={quality.checks.map((check) => ({\n                label: listingQualityCheckLabel(check.key, text),\n                done: check.done,\n              }))}`,
    "manage-listing quality checks",
  );
  source = source.replace("ready={studioScore === 100}", "ready={quality.ready}");
  write(path, source);
}

function updateChats() {
  const path = "src/routes/chats.tsx";
  let source = read(path);
  source = replaceOnce(
    source,
    `import { Ban, Flag, MessageCircle, Send } from "lucide-react";`,
    `import { Ban, Flag, MessageCircle, Send, TriangleAlert } from "lucide-react";`,
    "chat warning icon import",
  );
  source = replaceOnce(
    source,
    `import { resolveConversationTarget } from "@/lib/journey-target-resolution";`,
    `import { resolveConversationTarget } from "@/lib/journey-target-resolution";\nimport { analyzeMessageSafety } from "@/lib/message-safety";`,
    "chat safety import",
  );
  source = replaceOnce(
    source,
    `  const [notice, setNotice] = useState("");`,
    `  const [notice, setNotice] = useState("");\n  const [confirmedRiskBody, setConfirmedRiskBody] = useState<string | null>(null);`,
    "chat confirmation state",
  );
  source = replaceOnce(
    source,
    `  const filteredConversations = useMemo(() => {`,
    `  const messageSafety = useMemo(() => analyzeMessageSafety(body), [body]);\n  const filteredConversations = useMemo(() => {`,
    "chat live analysis",
  );
  source = replaceOnce(
    source,
    `    const cleanBody = body.trim();\n    if (!cleanBody) return;\n    const requestId = readOrCreateMessageSendRequestId(profileId, conversationId, cleanBody);`,
    `    const cleanBody = body.trim();\n    if (!cleanBody) return;\n    const safety = analyzeMessageSafety(cleanBody);\n    if (safety.requiresConfirmation && confirmedRiskBody !== cleanBody) {\n      setConfirmedRiskBody(cleanBody);\n      setNotice(\n        text(\n          "تتضمن الرسالة طلب دفع أو بيانات حساسة. راجع التحذير ثم اضغط إرسال مرة ثانية للتأكيد.",\n          "This message mentions payment or sensitive credentials. Review the warning, then press send again to confirm.",\n        ),\n      );\n      return;\n    }\n    const requestId = readOrCreateMessageSendRequestId(profileId, conversationId, cleanBody);`,
    "chat confirmation gate",
  );
  source = replaceOnce(
    source,
    `      setBody("");\n      setMessages((current) =>`,
    `      setBody("");\n      setConfirmedRiskBody(null);\n      setMessages((current) =>`,
    "chat reset confirmation",
  );
  source = replaceOnce(
    source,
    `                            onClick={() => setBody(language === "ar" ? reply.ar : reply.en)}`,
    `                            onClick={() => {\n                              setBody(language === "ar" ? reply.ar : reply.en);\n                              setConfirmedRiskBody(null);\n                            }}`,
    "chat quick reply reset",
  );
  source = replaceOnce(
    source,
    `                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">`,
    `                  {messageSafety.level !== "safe" ? (\n                    <aside\n                      className={[\n                        "mb-2 flex items-start gap-2 rounded-xl border p-3 text-xs leading-5",\n                        messageSafety.level === "danger"\n                          ? "border-destructive/25 bg-destructive/10 text-destructive"\n                          : "border-warning/25 bg-warning/10 text-foreground",\n                      ].join(" ")}\n                      role="status"\n                    >\n                      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />\n                      <div>\n                        <strong>\n                          {messageSafety.level === "danger"\n                            ? text("راجع الرسالة قبل الإرسال", "Review before sending")\n                            : text("انتبه للرابط أو التواصل الخارجي", "Check links and off-platform contact")}\n                        </strong>\n                        <p>\n                          {messageSafety.level === "danger"\n                            ? text(\n                                "لا تشارك كلمة مرور أو رمز تحقق، ولا تحول مبلغاً قبل المعاينة والتحقق من الطرف الآخر.",\n                                "Never share passwords or verification codes, and do not transfer money before inspection and verification.",\n                              )\n                            : text(\n                                "افتح الروابط بحذر واحتفظ بتفاصيل الاتفاق داخل رواج قدر الإمكان.",\n                                "Open links carefully and keep agreement details inside RAWAJ whenever possible.",\n                              )}\n                        </p>\n                      </div>\n                    </aside>\n                  ) : null}\n                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">`,
    "chat inline warning",
  );
  source = replaceOnce(
    source,
    `                      onChange={(event) => setBody(event.target.value)}`,
    `                      onChange={(event) => {\n                        setBody(event.target.value);\n                        setConfirmedRiskBody(null);\n                      }}`,
    "chat input confirmation reset",
  );
  source = replaceOnce(
    source,
    `{sending ? text("جاري الإرسال", "Sending") : text("إرسال", "Send")}`,
    `{sending\n                        ? text("جاري الإرسال", "Sending")\n                        : messageSafety.requiresConfirmation && confirmedRiskBody === body.trim()\n                          ? text("تأكيد وإرسال", "Confirm and send")\n                          : text("إرسال", "Send")}`,
    "chat confirm send label",
  );
  write(path, source);
}

function updatePackage() {
  const path = "package.json";
  const packageJson = JSON.parse(read(path));
  packageJson.scripts["test:listing-quality-chat-safety"] =
    "node --test scripts/listing-quality-chat-safety-v1.test.mjs";
  const comparisonCommand = "npm run test:listing-comparison";
  const qualityCommand = "npm run test:listing-quality-chat-safety";
  if (!packageJson.scripts.check.includes(qualityCommand)) {
    packageJson.scripts.check = packageJson.scripts.check.replace(
      comparisonCommand,
      `${comparisonCommand} && ${qualityCommand}`,
    );
  }
  write(path, `${JSON.stringify(packageJson, null, 2)}\n`);
}

function updateQualityGate() {
  const path = ".github/workflows/quality-gate.yml";
  let source = read(path);
  source = replaceOnce(
    source,
    `      - name: Listing Comparison V1 contract\n        run: npm run test:listing-comparison\n`,
    `      - name: Listing Comparison V1 contract\n        run: npm run test:listing-comparison\n\n      - name: Listing Quality and Chat Safety V1 contract\n        run: npm run test:listing-quality-chat-safety\n`,
    "quality gate insertion",
  );
  write(path, source);
}

updateAddListing();
updateManageListing();
updateChats();
updatePackage();
updateQualityGate();
console.log("Listing quality and chat safety integration applied.");
