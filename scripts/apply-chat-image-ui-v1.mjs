import { readFile, writeFile, unlink } from "node:fs/promises";

async function replaceIn(path, before, after) {
  const source = await readFile(path, "utf8");
  if (!source.includes(before)) {
    throw new Error(`Missing patch anchor in ${path}: ${before.slice(0, 80)}`);
  }
  await writeFile(path, source.replace(before, after), "utf8");
}

await replaceIn(
  "src/lib/classifieds-types.ts",
  `export interface ConversationMessage {\n  id: string;\n  conversationId: string;\n  isMine: boolean;\n  body: string;\n  createdAt: string;\n  editedAt: string | null;\n  deletedAt: string | null;\n}`,
  `export interface ConversationMessage {\n  id: string;\n  conversationId: string;\n  isMine: boolean;\n  body: string;\n  attachmentPath: string | null;\n  attachmentMimeType: string | null;\n  attachmentSizeBytes: number | null;\n  attachmentUrl: string | null;\n  createdAt: string;\n  editedAt: string | null;\n  deletedAt: string | null;\n}`,
);

await replaceIn(
  "src/lib/api/messaging.ts",
  `import { emitUnreadActivityChanged } from "@/lib/unread-activity-events";`,
  `import { emitUnreadActivityChanged } from "@/lib/unread-activity-events";\nimport { createChatImageSignedUrl } from "@/lib/api/chat-image-attachments";`,
);

await replaceIn(
  "src/lib/api/messaging.ts",
  `.select("id,conversation_id,sender_user_id,body,created_at,edited_at,deleted_at")`,
  `.select(\n      "id,conversation_id,sender_user_id,body,attachment_path,attachment_mime_type,attachment_size_bytes,created_at,edited_at,deleted_at",\n    )`,
);

await replaceIn(
  "src/lib/api/messaging.ts",
  `  const rows = (data ?? []) as Record<string, unknown>[];\n  return {\n    ok: true,\n    data: sortAndDedupeMessages(\n      rows.map((row) => mapMessage(row, actorResult.data)),\n      cleanConversationId,\n    ),\n  };`,
  `  const rows = (data ?? []) as Record<string, unknown>[];\n  const mapped = await Promise.all(\n    rows.map(async (row) => {\n      const message = mapMessage(row, actorResult.data);\n      if (!message.attachmentPath) return message;\n      return {\n        ...message,\n        attachmentUrl: await createChatImageSignedUrl(message.attachmentPath),\n      };\n    }),\n  );\n  return {\n    ok: true,\n    data: sortAndDedupeMessages(mapped, cleanConversationId),\n  };`,
);

await replaceIn(
  "src/lib/api/messaging.ts",
  `export async function sendConversationMessage(payload: {\n  conversationId: string;\n  body: string;\n  requestId: string;\n}): Promise<ClassifiedsResult<ConversationMessage>> {\n  const cleanConversationId = normalizeChatResourceId(payload.conversationId);\n  const cleanBody = payload.body.trim();\n  const cleanRequestId = payload.requestId.trim();\n  if (!cleanConversationId || cleanBody.length < 1 || cleanBody.length > CHAT_MESSAGE_MAX_LENGTH) {`,
  `export async function sendConversationMessage(payload: {\n  conversationId: string;\n  body: string;\n  requestId: string;\n  attachment?: { path: string; mimeType: string; sizeBytes: number } | null;\n}): Promise<ClassifiedsResult<ConversationMessage>> {\n  const cleanConversationId = normalizeChatResourceId(payload.conversationId);\n  const cleanBody = payload.body.trim();\n  const cleanRequestId = payload.requestId.trim();\n  const attachment = payload.attachment ?? null;\n  if (\n    !cleanConversationId ||\n    (cleanBody.length < 1 && !attachment) ||\n    cleanBody.length > CHAT_MESSAGE_MAX_LENGTH\n  ) {`,
);

await replaceIn(
  "src/lib/api/messaging.ts",
  `    cleanBody,\n    cleanRequestId,\n  );`,
  `    cleanBody,\n    cleanRequestId,\n    attachment,\n  );`,
);

await replaceIn(
  "src/lib/api/messaging.ts",
  `  cleanBody: string,\n  clientRequestId: string,\n): Promise<ClassifiedsResult<ConversationMessage>> {\n  const response = await client.rpc("rawaj_send_conversation_message_v2", {\n    p_conversation_id: conversationId,\n    p_client_request_id: clientRequestId,\n    p_body: cleanBody,\n  });`,
  `  cleanBody: string,\n  clientRequestId: string,\n  attachment: { path: string; mimeType: string; sizeBytes: number } | null,\n): Promise<ClassifiedsResult<ConversationMessage>> {\n  const response = await client.rpc("rawaj_send_conversation_message_v3", {\n    p_conversation_id: conversationId,\n    p_client_request_id: clientRequestId,\n    p_body: cleanBody,\n    p_attachment_path: attachment?.path ?? null,\n    p_attachment_mime_type: attachment?.mimeType ?? null,\n    p_attachment_size_bytes: attachment?.sizeBytes ?? null,\n  });`,
);

await replaceIn(
  "src/lib/api/messaging.ts",
  `  if (!isMissingMessageSendV2(response.error)) {`,
  `  if (!isMissingMessageSendV3(response.error)) {`,
);

await replaceIn(
  "src/lib/api/messaging.ts",
  `function isMissingMessageSendV2(error: {`,
  `function isMissingMessageSendV3(error: {`,
);

await replaceIn(
  "src/lib/api/messaging.ts",
  `message.includes("rawaj_send_conversation_message_v2") ||\n    details.includes("rawaj_send_conversation_message_v2")`,
  `message.includes("rawaj_send_conversation_message_v3") ||\n    details.includes("rawaj_send_conversation_message_v3")`,
);

await replaceIn(
  "src/lib/api/messaging.ts",
  `    body: rowString(row, "body"),\n    createdAt: rowString(row, "created_at"),`,
  `    body: rowString(row, "body"),\n    attachmentPath: rowNullableString(row, "attachment_path"),\n    attachmentMimeType: rowNullableString(row, "attachment_mime_type"),\n    attachmentSizeBytes:\n      rowNullableString(row, "attachment_path") === null\n        ? null\n        : rowNumber(row, "attachment_size_bytes"),\n    attachmentUrl: null,\n    createdAt: rowString(row, "created_at"),`,
);

await replaceIn(
  "src/lib/api/messaging-guarded.ts",
  `} from "@/lib/api/messaging";`,
  `} from "@/lib/api/messaging";\nexport {\n  createChatImageSignedUrl,\n  removeChatImage,\n  uploadChatImage,\n  validateChatImage,\n} from "@/lib/api/chat-image-attachments";`,
);

await replaceIn(
  "src/routes/chats.tsx",
  `import { Ban, Flag, MessageCircle, Send, TriangleAlert } from "lucide-react";`,
  `import { Ban, Flag, ImagePlus, MessageCircle, Send, TriangleAlert, X } from "lucide-react";`,
);

await replaceIn(
  "src/routes/chats.tsx",
  `  sendConversationMessage,\n} from "@/lib/classifieds-api";`,
  `  removeChatImage,\n  sendConversationMessage,\n  uploadChatImage,\n  validateChatImage,\n} from "@/lib/classifieds-api";`,
);

await replaceIn(
  "src/routes/chats.tsx",
  `  const [composerDrafts, setComposerDrafts] = useState<Record<string, string>>({});`,
  `  const [composerDrafts, setComposerDrafts] = useState<Record<string, string>>({});\n  const [selectedImage, setSelectedImage] = useState<{\n    scopeKey: string;\n    file: File;\n    previewUrl: string;\n  } | null>(null);`,
);

await replaceIn(
  "src/routes/chats.tsx",
  `  const blockInFlightRef = useRef<Set<string>>(new Set());`,
  `  const blockInFlightRef = useRef<Set<string>>(new Set());\n  const imageInputRef = useRef<HTMLInputElement | null>(null);`,
);

await replaceIn(
  "src/routes/chats.tsx",
  `  const sending = composerScopeKey ? sendingScopes.has(composerScopeKey) : false;`,
  `  const sending = composerScopeKey ? sendingScopes.has(composerScopeKey) : false;\n  const currentImage =\n    composerScopeKey && selectedImage?.scopeKey === composerScopeKey ? selectedImage : null;`,
);

await replaceIn(
  "src/routes/chats.tsx",
  `    setComposerDrafts({});\n    setConversationQuery("");`,
  `    setComposerDrafts({});\n    setSelectedImage((current) => {\n      if (current) URL.revokeObjectURL(current.previewUrl);\n      return null;\n    });\n    setConversationQuery("");`,
);

await replaceIn(
  "src/routes/chats.tsx",
  `    setReportingMessageId(null);\n  }, [selectedConversation?.id]);`,
  `    setReportingMessageId(null);\n    setSelectedImage((current) => {\n      if (current) URL.revokeObjectURL(current.previewUrl);\n      return null;\n    });\n  }, [selectedConversation?.id]);`,
);

await replaceIn(
  "src/routes/chats.tsx",
  `  async function handleSend(event: FormEvent<HTMLFormElement>) {`,
  `  function clearSelectedImage() {\n    setSelectedImage((current) => {\n      if (current) URL.revokeObjectURL(current.previewUrl);\n      return null;\n    });\n    if (imageInputRef.current) imageInputRef.current.value = "";\n  }\n\n  function handleImageSelection(file: File | null) {\n    if (!composerScopeKey || !file) return;\n    const validation = validateChatImage(file);\n    if (!validation.ok) {\n      setMessageError(validation.error);\n      return;\n    }\n    setMessageError(null);\n    setSelectedImage((current) => {\n      if (current) URL.revokeObjectURL(current.previewUrl);\n      return { scopeKey: composerScopeKey, file, previewUrl: URL.createObjectURL(file) };\n    });\n  }\n\n  async function handleSend(event: FormEvent<HTMLFormElement>) {`,
);

await replaceIn(
  "src/routes/chats.tsx",
  `    const cleanBody = body.trim();\n    if (!cleanBody) return;`,
  `    const cleanBody = body.trim();\n    const image = currentImage;\n    if (!cleanBody && !image) return;`,
);

await replaceIn(
  "src/routes/chats.tsx",
  `    const requestId = readOrCreateMessageSendRequestId(profileId, conversationId, cleanBody);`,
  `    const requestSignature = image\n      ? \`${cleanBody}\\n[image:${image.file.name}:${image.file.size}:${image.file.lastModified}]\`\n      : cleanBody;\n    const requestId = readOrCreateMessageSendRequestId(\n      profileId,\n      conversationId,\n      requestSignature,\n    );`,
);

await replaceIn(
  "src/routes/chats.tsx",
  `    try {\n      const result = await sendConversationMessage({\n        conversationId,\n        body: cleanBody,\n        requestId,\n      });`,
  `    let uploadedPath: string | null = null;\n    try {\n      const uploadResult = image\n        ? await uploadChatImage({ conversationId, requestId, file: image.file })\n        : null;\n      if (uploadResult && !uploadResult.ok) {\n        if (accountGenerationRef.current === accountGeneration) setMessageError(uploadResult.error);\n        return;\n      }\n      uploadedPath = uploadResult?.data.path ?? null;\n      const result = await sendConversationMessage({\n        conversationId,\n        body: cleanBody,\n        requestId,\n        attachment: uploadResult?.data ?? null,\n      });`,
);

await replaceIn(
  "src/routes/chats.tsx",
  `      if (!result.ok) {\n        if (stillCurrent) setMessageError(result.error);\n        return;\n      }`,
  `      if (!result.ok) {\n        if (uploadedPath) await removeChatImage(uploadedPath);\n        if (stillCurrent) setMessageError(result.error);\n        return;\n      }`,
);

await replaceIn(
  "src/routes/chats.tsx",
  `        clearComposerDraftIfUnchanged(scopeKey, cleanBody);\n        setConfirmedRisk`,
  `        clearComposerDraftIfUnchanged(scopeKey, cleanBody);\n        clearSelectedImage();\n        setConfirmedRisk`,
);

await replaceIn(
  "src/routes/chats.tsx",
  `<p className="whitespace-pre-line break-words">{message.body}</p>`,
  `{message.attachmentUrl && (\n                            <a\n                              href={message.attachmentUrl}\n                              target="_blank"\n                              rel="noreferrer"\n                              className="mb-2 block overflow-hidden rounded-xl bg-black/5"\n                            >\n                              <img\n                                src={message.attachmentUrl}\n                                alt={text("صورة مرفقة بالمحادثة", "Chat attachment")}\n                                loading="lazy"\n                                decoding="async"\n                                className="max-h-80 w-full object-contain"\n                              />\n                            </a>\n                          )}\n                          {message.body && (\n                            <p className="whitespace-pre-line break-words">{message.body}</p>\n                          )}`,
);

await replaceIn(
  "src/routes/chats.tsx",
  `                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">`,
  `                  {currentImage && (\n                    <div className="mb-2 flex items-center gap-3 rounded-xl bg-muted-surface p-2 hairline">\n                      <img\n                        src={currentImage.previewUrl}\n                        alt={text("معاينة الصورة", "Image preview")}\n                        className="h-16 w-16 rounded-lg object-cover"\n                      />\n                      <div className="min-w-0 flex-1">\n                        <p className="truncate text-xs font-bold">{currentImage.file.name}</p>\n                        <p className="text-[10px] text-muted-foreground">\n                          {(currentImage.file.size / 1024 / 1024).toFixed(1)} MB\n                        </p>\n                      </div>\n                      <button\n                        type="button"\n                        onClick={clearSelectedImage}\n                        className="grid h-9 w-9 place-items-center rounded-full bg-destructive/10 text-destructive"\n                        aria-label={text("إزالة الصورة", "Remove image")}\n                      >\n                        <X className="h-4 w-4" />\n                      </button>\n                    </div>\n                  )}\n                  <div className="grid gap-2 sm:grid-cols-[auto_1fr_auto]">\n                    <input\n                      ref={imageInputRef}\n                      type="file"\n                      accept="image/jpeg,image/png,image/webp"\n                      className="sr-only"\n                      onChange={(event) => handleImageSelection(event.target.files?.[0] ?? null)}\n                    />\n                    <button\n                      type="button"\n                      disabled={sending || selectedConversation.status !== "active"}\n                      onClick={() => imageInputRef.current?.click()}\n                      className="grid min-h-12 place-items-center rounded-xl bg-muted-surface px-4 text-primary hairline"\n                      aria-label={text("إرفاق صورة", "Attach image")}\n                    >\n                      <ImagePlus className="h-5 w-5" />\n                    </button>`,
);

await replaceIn(
  "src/routes/chats.tsx",
  `                        body.trim().length === 0 ||`,
  `                        (body.trim().length === 0 && !currentImage) ||`,
);

await replaceIn(
  "scripts/conversations-messaging-realtime-integrity.test.mjs",
  `assert.match(messaging, /rawaj_send_conversation_message_v2/);`,
  `assert.match(messaging, /rawaj_send_conversation_message_v3/);`,
);

const contract = `import assert from "node:assert/strict";\nimport { readFile } from "node:fs/promises";\nimport test from "node:test";\n\nconst [route, messaging, types] = await Promise.all([\n  readFile(new URL("../src/routes/chats.tsx", import.meta.url), "utf8"),\n  readFile(new URL("../src/lib/api/messaging.ts", import.meta.url), "utf8"),\n  readFile(new URL("../src/lib/classifieds-types.ts", import.meta.url), "utf8"),\n]);\n\ntest("chat composer supports a validated private image", () => {\n  assert.match(route, /accept="image\\/jpeg,image\\/png,image\\/webp"/);\n  assert.match(route, /validateChatImage/);\n  assert.match(route, /uploadChatImage/);\n  assert.match(route, /removeChatImage/);\n  assert.match(route, /currentImage/);\n});\n\ntest("messages use v3 and short-lived signed attachment URLs", () => {\n  assert.match(messaging, /rawaj_send_conversation_message_v3/);\n  assert.match(messaging, /attachment_path/);\n  assert.match(messaging, /createChatImageSignedUrl/);\n  assert.match(types, /attachmentUrl: string \\| null/);\n  assert.match(route, /message\\.attachmentUrl/);\n});\n`;
await writeFile("scripts/chat-image-attachments-ui-v1.test.mjs", contract, "utf8");

await unlink("scripts/apply-chat-image-ui-v1.mjs");
await unlink(".github/workflows/apply-chat-image-ui-v1.yml");
