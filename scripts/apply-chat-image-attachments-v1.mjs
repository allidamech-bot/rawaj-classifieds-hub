import { readFile, writeFile } from "node:fs/promises";

async function patch(path, transform) {
  const before = await readFile(path, "utf8");
  const after = transform(before);
  if (after === before) throw new Error(`No change produced for ${path}`);
  await writeFile(path, after);
}

function replaceOnce(source, from, to, label) {
  const index = source.indexOf(from);
  if (index < 0) throw new Error(`Missing ${label}`);
  if (source.indexOf(from, index + from.length) >= 0) throw new Error(`Duplicate ${label}`);
  return source.slice(0, index) + to + source.slice(index + from.length);
}

await patch("src/lib/classifieds-types.ts", (source) =>
  replaceOnce(
    source,
    `export interface ConversationMessage {\n  id: string;\n  conversationId: string;\n  isMine: boolean;\n  body: string;\n  createdAt: string;\n  editedAt: string | null;\n  deletedAt: string | null;\n}`,
    `export interface ConversationMessage {\n  id: string;\n  conversationId: string;\n  isMine: boolean;\n  body: string;\n  attachmentPath: string | null;\n  attachmentMimeType: string | null;\n  attachmentSizeBytes: number | null;\n  attachmentUrl: string | null;\n  createdAt: string;\n  editedAt: string | null;\n  deletedAt: string | null;\n}`,
    "ConversationMessage interface",
  ),
);

await patch("src/lib/api/messaging.ts", (source) => {
  source = replaceOnce(
    source,
    `import { emitUnreadActivityChanged } from "@/lib/unread-activity-events";`,
    `import { emitUnreadActivityChanged } from "@/lib/unread-activity-events";\nimport { createChatImageSignedUrl, type UploadedChatImage } from "@/lib/api/chat-image-attachments";`,
    "chat attachment import",
  );
  source = replaceOnce(
    source,
    `.select("id,conversation_id,sender_user_id,body,created_at,edited_at,deleted_at")`,
    `.select("id,conversation_id,sender_user_id,body,attachment_path,attachment_mime_type,attachment_size_bytes,created_at,edited_at,deleted_at")`,
    "message select",
  );
  source = replaceOnce(
    source,
    `  return {\n    ok: true,\n    data: sortAndDedupeMessages(\n      rows.map((row) => mapMessage(row, actorResult.data)),\n      cleanConversationId,\n    ),\n  };`,
    `  const mapped = sortAndDedupeMessages(\n    rows.map((row) => mapMessage(row, actorResult.data)),\n    cleanConversationId,\n  );\n  return {\n    ok: true,\n    data: await Promise.all(mapped.map(hydrateMessageAttachment)),\n  };`,
    "message hydration return",
  );
  source = replaceOnce(
    source,
    `export async function sendConversationMessage(payload: {\n  conversationId: string;\n  body: string;\n  requestId: string;\n}): Promise<ClassifiedsResult<ConversationMessage>> {`,
    `export async function sendConversationMessage(payload: {\n  conversationId: string;\n  body: string;\n  requestId: string;\n  attachment?: UploadedChatImage | null;\n}): Promise<ClassifiedsResult<ConversationMessage>> {`,
    "send payload",
  );
  source = replaceOnce(
    source,
    `  if (!cleanConversationId || cleanBody.length < 1 || cleanBody.length > CHAT_MESSAGE_MAX_LENGTH) {\n    return {\n      ok: false,\n      error: { code: "validation_error", message: "اكتب رسالة بين 1 و2000 حرف." },\n    };\n  }`,
    `  if (\n    !cleanConversationId ||\n    cleanBody.length > CHAT_MESSAGE_MAX_LENGTH ||\n    (cleanBody.length < 1 && !payload.attachment)\n  ) {\n    return {\n      ok: false,\n      error: { code: "validation_error", message: "اكتب رسالة أو أرفق صورة، وبحد أقصى 2000 حرف." },\n    };\n  }`,
    "send validation",
  );
  source = replaceOnce(
    source,
    `    cleanBody,\n    cleanRequestId,\n  );`,
    `    cleanBody,\n    cleanRequestId,\n    payload.attachment ?? null,\n  );`,
    "perform send invocation",
  );
  source = replaceOnce(
    source,
    `  cleanBody: string,\n  clientRequestId: string,\n): Promise<ClassifiedsResult<ConversationMessage>> {\n  const response = await client.rpc("rawaj_send_conversation_message_v2", {\n    p_conversation_id: conversationId,\n    p_client_request_id: clientRequestId,\n    p_body: cleanBody,\n  });`,
    `  cleanBody: string,\n  clientRequestId: string,\n  attachment: UploadedChatImage | null,\n): Promise<ClassifiedsResult<ConversationMessage>> {\n  const response = await client.rpc("rawaj_send_conversation_message_v3", {\n    p_conversation_id: conversationId,\n    p_client_request_id: clientRequestId,\n    p_body: cleanBody,\n    p_attachment_path: attachment?.path ?? null,\n    p_attachment_mime_type: attachment?.mimeType ?? null,\n    p_attachment_size_bytes: attachment?.sizeBytes ?? null,\n  });`,
    "v3 send call",
  );
  source = replaceOnce(
    source,
    `    if (row) return { ok: true, data: mapMessage(row, actorUserId) };`,
    `    if (row) return { ok: true, data: await hydrateMessageAttachment(mapMessage(row, actorUserId)) };`,
    "sent message hydration",
  );
  source = replaceOnce(
    source,
    `  if (!isMissingMessageSendV2(response.error)) {`,
    `  if (!isMissingMessageSendV3(response.error)) {`,
    "missing v3 check",
  );
  source = replaceOnce(
    source,
    `  return {\n    ok: false,\n    error: {\n      code: "setup_required",\n      message: "إرسال الرسائل الآمن غير متاح حالياً. حاول لاحقاً.",\n      operation: "conversation_message_send",\n    },\n  };\n}\n\nfunction isMissingMessageSendV2`,
    `  if (attachment) {\n    return {\n      ok: false,\n      error: {\n        code: "setup_required",\n        message: "إرسال الصور يحتاج تفعيل تحديث المحادثات أولاً.",\n        operation: "conversation_message_send",\n      },\n    };\n  }\n\n  const fallback = await client.rpc("rawaj_send_conversation_message_v2", {\n    p_conversation_id: conversationId,\n    p_client_request_id: clientRequestId,\n    p_body: cleanBody,\n  });\n  if (!fallback.error) {\n    const row = ((fallback.data ?? []) as Record<string, unknown>[])[0];\n    return row\n      ? { ok: true, data: mapMessage(row, actorUserId) }\n      : { ok: false, error: { code: "unknown", message: "تعذر التحقق من الرسالة المرسلة." } };\n  }\n  return { ok: false, error: mapError(fallback.error, "conversation_message_send") };\n}\n\nfunction isMissingMessageSendV3`,
    "v2 fallback",
  );
  source = source.replaceAll("rawaj_send_conversation_message_v2\") ||", "rawaj_send_conversation_message_v3\") ||");
  source = source.replaceAll("rawaj_send_conversation_message_v2\")", "rawaj_send_conversation_message_v3\")");
  source = replaceOnce(
    source,
    `    body: rowString(row, "body"),\n    createdAt: rowString(row, "created_at"),`,
    `    body: rowString(row, "body"),\n    attachmentPath: rowNullableString(row, "attachment_path"),\n    attachmentMimeType: rowNullableString(row, "attachment_mime_type"),\n    attachmentSizeBytes: row["attachment_size_bytes"] == null ? null : rowNumber(row, "attachment_size_bytes"),\n    attachmentUrl: null,\n    createdAt: rowString(row, "created_at"),`,
    "message attachment mapping",
  );
  source = replaceOnce(
    source,
    `export function fromDbMessageReportStatus`,
    `async function hydrateMessageAttachment(message: ConversationMessage): Promise<ConversationMessage> {\n  if (!message.attachmentPath) return message;\n  return { ...message, attachmentUrl: await createChatImageSignedUrl(message.attachmentPath) };\n}\n\nexport function fromDbMessageReportStatus`,
    "attachment hydration helper",
  );
  return source;
});

await patch("src/routes/chats.tsx", (source) => {
  source = replaceOnce(
    source,
    `import { Ban, Flag, MessageCircle, Send, TriangleAlert } from "lucide-react";`,
    `import { Ban, Flag, ImagePlus, MessageCircle, Send, TriangleAlert, X } from "lucide-react";`,
    "chat icons",
  );
  source = replaceOnce(
    source,
    `import { analyzeMessageSafety } from "@/lib/message-safety";`,
    `import { analyzeMessageSafety } from "@/lib/message-safety";\nimport { removeChatImage, uploadChatImage, validateChatImage } from "@/lib/api/chat-image-attachments";`,
    "chat image api import",
  );
  source = replaceOnce(
    source,
    `  const [notice, setNotice] = useState("");`,
    `  const [notice, setNotice] = useState("");\n  const [selectedImage, setSelectedImage] = useState<File | null>(null);`,
    "selected image state",
  );
  source = source.replace(
    `    setNotice("");\n    sendInFlightScopesRef.current.clear();`,
    `    setNotice("");\n    setSelectedImage(null);\n    sendInFlightScopesRef.current.clear();`,
  );
  source = source.replace(
    `    setReportingMessageId(null);\n  }, [selectedConversation?.id]);`,
    `    setReportingMessageId(null);\n    setSelectedImage(null);\n  }, [selectedConversation?.id]);`,
  );
  source = replaceOnce(
    source,
    `    const cleanBody = body.trim();\n    if (!cleanBody) return;`,
    `    const cleanBody = body.trim();\n    const image = selectedImage;\n    if (!cleanBody && !image) return;`,
    "image-aware send requirement",
  );
  source = replaceOnce(
    source,
    `    const requestId = readOrCreateMessageSendRequestId(profileId, conversationId, cleanBody);`,
    `    const requestPayloadKey = image\n      ? `${cleanBody}::image:${image.name}:${image.size}:${image.lastModified}`\n      : cleanBody;\n    const requestId = readOrCreateMessageSendRequestId(profileId, conversationId, requestPayloadKey);`,
    "image request id",
  );
  source = replaceOnce(
    source,
    `    try {\n      const result = await sendConversationMessage({\n        conversationId,\n        body: cleanBody,\n        requestId,\n      });`,
    `    let uploadedPath: string | null = null;\n    try {\n      const uploaded = image\n        ? await uploadChatImage({ conversationId, requestId, file: image })\n        : null;\n      if (uploaded && !uploaded.ok) {\n        setMessageError(uploaded.error);\n        return;\n      }\n      uploadedPath = uploaded?.data.path ?? null;\n      const result = await sendConversationMessage({\n        conversationId,\n        body: cleanBody,\n        requestId,\n        attachment: uploaded?.data ?? null,\n      });`,
    "upload before send",
  );
  source = replaceOnce(
    source,
    `      if (!result.ok) {\n        if (stillCurrent) setMessageError(result.error);\n        return;\n      }`,
    `      if (!result.ok) {\n        if (uploadedPath) await removeChatImage(uploadedPath);\n        if (stillCurrent) setMessageError(result.error);\n        return;\n      }`,
    "orphan cleanup",
  );
  source = source.replace(
    `        clearComposerDraftIfUnchanged(scopeKey, cleanBody);\n        setConfirmedRisk`,
    `        clearComposerDraftIfUnchanged(scopeKey, cleanBody);\n        setSelectedImage(null);\n        setConfirmedRisk`,
  );
  source = replaceOnce(
    source,
    `                          <p className="whitespace-pre-line break-words">{message.body}</p>`,
    `                          {message.attachmentUrl ? (\n                            <a href={message.attachmentUrl} target="_blank" rel="noreferrer" className="mb-2 block overflow-hidden rounded-xl">\n                              <img src={message.attachmentUrl} alt={text("صورة مرفقة بالمحادثة", "Chat attachment")} loading="lazy" decoding="async" className="max-h-80 w-full object-cover" />\n                            </a>\n                          ) : null}\n                          {message.body ? <p className="whitespace-pre-line break-words">{message.body}</p> : null}`,
    "message image rendering",
  );
  source = replaceOnce(
    source,
    `                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">`,
    `                  {selectedImage ? <PendingChatImage file={selectedImage} onClear={() => setSelectedImage(null)} text={text} /> : null}\n                  <div className="grid gap-2 sm:grid-cols-[auto_1fr_auto]">\n                    <label className="grid h-11 w-11 cursor-pointer place-items-center rounded-xl bg-muted-surface text-primary hairline" aria-label={text("إرفاق صورة", "Attach image")}>\n                      <ImagePlus className="h-5 w-5" />\n                      <input\n                        type="file"\n                        accept="image/jpeg,image/png,image/webp"\n                        className="sr-only"\n                        disabled={sending || selectedConversation.status !== "active"}\n                        onChange={(event) => {\n                          const file = event.target.files?.[0] ?? null;\n                          event.currentTarget.value = "";\n                          if (!file) return;\n                          const validation = validateChatImage(file);\n                          if (!validation.ok) { setMessageError(validation.error); return; }\n                          setMessageError(null);\n                          setSelectedImage(file);\n                        }}\n                      />\n                    </label>`,
    "image picker",
  );
  source = source.replace(
    `                        body.trim().length === 0 ||`,
    `                        (body.trim().length === 0 && !selectedImage) ||`,
  );
  source = replaceOnce(
    source,
    `function Avatar({ name, url }: { name: string; url: string | null }) {`,
    `function PendingChatImage({ file, onClear, text }: { file: File; onClear: () => void; text: (ar: string, en: string) => string }) {\n  const [url, setUrl] = useState("");\n  useEffect(() => {\n    const next = URL.createObjectURL(file);\n    setUrl(next);\n    return () => URL.revokeObjectURL(next);\n  }, [file]);\n  return (\n    <div className="mb-2 flex items-center gap-3 rounded-xl bg-muted-surface p-2 hairline">\n      {url ? <img src={url} alt="" className="h-16 w-16 rounded-lg object-cover" /> : null}\n      <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{file.name}</p><p className="text-[11px] text-muted-foreground">{Math.ceil(file.size / 1024)} KB</p></div>\n      <button type="button" onClick={onClear} className="grid h-9 w-9 place-items-center rounded-lg bg-card" aria-label={text("إزالة الصورة", "Remove image")}><X className="h-4 w-4" /></button>\n    </div>\n  );\n}\n\nfunction Avatar({ name, url }: { name: string; url: string | null }) {`,
    "pending image component",
  );
  return source;
});

await patch("docs/production-schema/migration-ledger.json", (source) => {
  const marker = `      "202607170006_server_account_bootstrap_integrity.sql"`;
  if (!source.includes(marker)) throw new Error("Missing latest canonical migration marker");
  return source.replace(marker, `${marker},\n      "202607170007_chat_image_attachments_v1.sql"`);
});

await patch(".github/workflows/quality-gate.yml", (source) => {
  const marker = `      - name: Conversations, Messaging & Realtime Integrity contract\n        run: npm run test:conversations-messaging-realtime\n`;
  if (!source.includes(marker)) throw new Error("Missing messaging quality gate marker");
  return source.replace(marker, `${marker}\n      - name: Chat Image Attachments V1 contract\n        run: node --test scripts/chat-image-attachments-v1.test.mjs\n`);
});

// Triggered intentionally through the one-shot workflow on this feature branch.
