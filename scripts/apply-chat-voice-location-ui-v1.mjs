import { readFile, writeFile } from "node:fs/promises";

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing anchor: ${label}`);
  return source.replace(before, after);
}

const typesPath = "src/lib/classifieds-types.ts";
let types = await readFile(typesPath, "utf8");
types = replaceOnce(types,
  `  attachmentSizeBytes: number | null;\n  attachmentUrl: string | null;`,
  `  attachmentSizeBytes: number | null;\n  attachmentKind: "image" | "audio" | null;\n  attachmentDurationMs: number | null;\n  attachmentUrl: string | null;`,
  "message attachment metadata");
await writeFile(typesPath, types);

const messagingPath = "src/lib/api/messaging.ts";
let messaging = await readFile(messagingPath, "utf8");
messaging = replaceOnce(messaging,
  `export const CHAT_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;`,
  `export const CHAT_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;\nexport const CHAT_AUDIO_MAX_BYTES = 10 * 1024 * 1024;\nexport const CHAT_AUDIO_MAX_DURATION_MS = 120_000;\nexport const CHAT_AUDIO_MIME_TYPES = ["audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg"] as const;`,
  "audio constants");
messaging = replaceOnce(messaging,
  `export interface UploadedChatImage {\n  path: string;\n  mimeType: (typeof CHAT_IMAGE_MIME_TYPES)[number];\n  sizeBytes: number;\n}`,
  `export interface UploadedChatImage {\n  path: string;\n  mimeType: (typeof CHAT_IMAGE_MIME_TYPES)[number];\n  sizeBytes: number;\n  kind: "image";\n  durationMs: null;\n}\n\nexport interface UploadedChatAudio {\n  path: string;\n  mimeType: (typeof CHAT_AUDIO_MIME_TYPES)[number];\n  sizeBytes: number;\n  kind: "audio";\n  durationMs: number;\n}`,
  "media interfaces");
messaging = replaceOnce(messaging,
  `      sizeBytes: payload.file.size,\n    },`,
  `      sizeBytes: payload.file.size,\n      kind: "image",\n      durationMs: null,\n    },`,
  "image metadata");
messaging = replaceOnce(messaging,
  `function extensionForChatImageMime(mimeType: string) {\n  if (mimeType === "image/png") return "png";\n  if (mimeType === "image/webp") return "webp";\n  return "jpg";\n}`,
  `function extensionForChatImageMime(mimeType: string) {\n  if (mimeType === "image/png") return "png";\n  if (mimeType === "image/webp") return "webp";\n  return "jpg";\n}\n\nexport function validateChatAudio(file: File, durationMs: number): ClassifiedsResult<null> {\n  const mimeType = file.type.split(";")[0];\n  if (!CHAT_AUDIO_MIME_TYPES.includes(mimeType as UploadedChatAudio["mimeType"])) return { ok: false, error: { code: "validation_error", message: "صيغة التسجيل الصوتي غير مدعومة." } };\n  if (file.size < 1 || file.size > CHAT_AUDIO_MAX_BYTES) return { ok: false, error: { code: "validation_error", message: "يجب ألا يتجاوز التسجيل 10 ميغابايت." } };\n  if (durationMs < 1_000 || durationMs > CHAT_AUDIO_MAX_DURATION_MS) return { ok: false, error: { code: "validation_error", message: "يجب أن يكون التسجيل بين ثانية واحدة و120 ثانية." } };\n  return { ok: true, data: null };\n}\n\nexport async function uploadChatAudio(payload: { conversationId: string; requestId: string; file: File; durationMs: number }): Promise<ClassifiedsResult<UploadedChatAudio>> {\n  const conversationId = normalizeChatResourceId(payload.conversationId);\n  const requestId = normalizeChatResourceId(payload.requestId);\n  const mimeType = payload.file.type.split(";")[0];\n  const validation = validateChatAudio(payload.file, payload.durationMs);\n  if (!conversationId || !requestId || !validation.ok) return validation.ok ? { ok: false, error: { code: "validation_error", message: "تعذر تحديد التسجيل الصوتي." } } : validation;\n  const clientResult = getClient();\n  if (!clientResult.ok) return clientResult;\n  const userResult = await clientResult.data.auth.getUser();\n  const userId = userResult.data.user?.id;\n  if (userResult.error || !userId) return { ok: false, error: { code: "auth_required", message: "يجب تسجيل الدخول لإرسال تسجيل صوتي." } };\n  const extension = mimeType === "audio/mp4" ? "m4a" : mimeType === "audio/mpeg" ? "mp3" : mimeType === "audio/ogg" ? "ogg" : "webm";\n  const path = [conversationId, userId, requestId].join("/") + "." + extension;\n  const { error } = await clientResult.data.storage.from("conversation-audio").upload(path, payload.file, { upsert: false, contentType: mimeType, cacheControl: "3600" });\n  if (error) return { ok: false, error: mapError(error, "chat_audio_upload") };\n  return { ok: true, data: { path, mimeType: mimeType as UploadedChatAudio["mimeType"], sizeBytes: payload.file.size, kind: "audio", durationMs: payload.durationMs } };\n}\n\nexport async function removeChatAudio(path: string): Promise<void> {\n  if (!path) return;\n  const clientResult = getClient();\n  if (!clientResult.ok) return;\n  await clientResult.data.storage.from("conversation-audio").remove([path]);\n}\n\nexport async function createChatAudioSignedUrl(path: string): Promise<string | null> {\n  if (!path) return null;\n  const clientResult = getClient();\n  if (!clientResult.ok) return null;\n  const { data, error } = await clientResult.data.storage.from("conversation-audio").createSignedUrl(path, 15 * 60);\n  return error ? null : data.signedUrl;\n}`,
  "audio helpers");
messaging = replaceOnce(messaging,
  `"id,conversation_id,sender_user_id,body,attachment_path,attachment_mime_type,attachment_size_bytes,created_at,edited_at,deleted_at",`,
  `"id,conversation_id,sender_user_id,body,attachment_path,attachment_mime_type,attachment_size_bytes,attachment_kind,attachment_duration_ms,created_at,edited_at,deleted_at",`,
  "message select");
messaging = replaceOnce(messaging,
  `        attachmentUrl: await createChatImageSignedUrl(message.attachmentPath),`,
  `        attachmentUrl: message.attachmentKind === "audio" ? await createChatAudioSignedUrl(message.attachmentPath) : await createChatImageSignedUrl(message.attachmentPath),`,
  "history signed url");
messaging = messaging.replaceAll(
  `{ path: string; mimeType: string; sizeBytes: number } | null`,
  `{ path: string; mimeType: string; sizeBytes: number; kind: "image" | "audio"; durationMs: number | null } | null`);
messaging = replaceOnce(messaging,
  `  const response = await client.rpc("rawaj_send_conversation_message_v3", {\n    p_conversation_id: conversationId,\n    p_client_request_id: clientRequestId,\n    p_body: cleanBody,\n    p_attachment_path: attachment?.path ?? null,\n    p_attachment_mime_type: attachment?.mimeType ?? null,\n    p_attachment_size_bytes: attachment?.sizeBytes ?? null,\n  });`,
  `  let response = await client.rpc("rawaj_send_conversation_message_v4", {\n    p_conversation_id: conversationId,\n    p_client_request_id: clientRequestId,\n    p_body: cleanBody,\n    p_attachment_path: attachment?.path ?? null,\n    p_attachment_mime_type: attachment?.mimeType ?? null,\n    p_attachment_size_bytes: attachment?.sizeBytes ?? null,\n    p_attachment_kind: attachment?.kind ?? null,\n    p_attachment_duration_ms: attachment?.durationMs ?? null,\n  });\n  if (response.error && isMissingMessageSendV4(response.error) && attachment?.kind !== "audio") {\n    response = await client.rpc("rawaj_send_conversation_message_v3", {\n      p_conversation_id: conversationId, p_client_request_id: clientRequestId, p_body: cleanBody,\n      p_attachment_path: attachment?.path ?? null, p_attachment_mime_type: attachment?.mimeType ?? null,\n      p_attachment_size_bytes: attachment?.sizeBytes ?? null,\n    });\n  }`,
  "v4 rpc");
messaging = replaceOnce(messaging,
  `        message.attachmentUrl = await createChatImageSignedUrl(message.attachmentPath);`,
  `        message.attachmentUrl = message.attachmentKind === "audio" ? await createChatAudioSignedUrl(message.attachmentPath) : await createChatImageSignedUrl(message.attachmentPath);`,
  "sent signed url");
messaging = replaceOnce(messaging,
  `function isMissingMessageSendV3(error: {`,
  `function isMissingMessageSendV4(error: { code?: string; message?: string; details?: string }): boolean {\n  const value = \`${"${error.message ?? \"\"} ${error.details ?? \"\"}"}\`;\n  return error.code === "PGRST202" || error.code === "42883" || value.includes("rawaj_send_conversation_message_v4");\n}\n\nfunction isMissingMessageSendV3(error: {`,
  "v4 missing detector");
messaging = replaceOnce(messaging,
  `    attachmentUrl: null,\n    createdAt: rowString(row, "created_at"),`,
  `    attachmentKind: (() => { const value = rowNullableString(row, "attachment_kind"); return value === "audio" || value === "image" ? value : rowNullableString(row, "attachment_path") ? "image" : null; })(),\n    attachmentDurationMs: rowNullableString(row, "attachment_kind") === "audio" ? rowNumber(row, "attachment_duration_ms") : null,\n    attachmentUrl: null,\n    createdAt: rowString(row, "created_at"),`,
  "map audio metadata");
await writeFile(messagingPath, messaging);

const chatsPath = "src/routes/chats.tsx";
let chats = await readFile(chatsPath, "utf8");
chats = replaceOnce(chats,
  `import { Ban, Flag, ImagePlus, MessageCircle, Send, TriangleAlert, X } from "lucide-react";`,
  `import { Ban, Flag, ImagePlus, MapPin, MessageCircle, Send, TriangleAlert, X } from "lucide-react";`,
  "map pin import");
chats = replaceOnce(chats,
  `import { ChatAttachmentImage } from "@/features/communication/ChatAttachmentImage";`,
  `import { ChatAttachmentImage } from "@/features/communication/ChatAttachmentImage";\nimport { ChatVoiceAttachment } from "@/features/communication/ChatVoiceAttachment";\nimport { ChatVoiceRecorder, type RecordedVoiceClip } from "@/features/communication/ChatVoiceRecorder";`,
  "voice components");
chats = replaceOnce(chats,
  `  removeChatImage,\n  sendConversationMessage,\n  uploadChatImage,\n  validateChatImage,`,
  `  removeChatAudio,\n  removeChatImage,\n  sendConversationMessage,\n  uploadChatAudio,\n  uploadChatImage,\n  validateChatAudio,\n  validateChatImage,`,
  "voice api imports");
chats = replaceOnce(chats,
  `  } | null>(null);\n  const [conversationQuery, setConversationQuery] = useState("");`,
  `  } | null>(null);\n  const [selectedVoice, setSelectedVoice] = useState<(RecordedVoiceClip & { scopeKey: string }) | null>(null);\n  const [locating, setLocating] = useState(false);\n  const [conversationQuery, setConversationQuery] = useState("");`,
  "voice state");
chats = replaceOnce(chats,
  `  const currentImage =\n    composerScopeKey && selectedImage?.scopeKey === composerScopeKey ? selectedImage : null;`,
  `  const currentImage =\n    composerScopeKey && selectedImage?.scopeKey === composerScopeKey ? selectedImage : null;\n  const currentVoice = composerScopeKey && selectedVoice?.scopeKey === composerScopeKey ? selectedVoice : null;`,
  "current voice");
chats = replaceOnce(chats,
  `  function handleImageSelection(file: File | null) {`,
  `  function clearSelectedVoice() {\n    setSelectedVoice((current) => { if (current) URL.revokeObjectURL(current.previewUrl); return null; });\n  }\n\n  function handleVoiceRecorded(clip: RecordedVoiceClip) {\n    if (!composerScopeKey) return;\n    const validation = validateChatAudio(clip.file, clip.durationMs);\n    if (!validation.ok) { URL.revokeObjectURL(clip.previewUrl); setMessageError(validation.error); return; }\n    clearSelectedImage();\n    setMessageError(null);\n    setSelectedVoice((current) => { if (current) URL.revokeObjectURL(current.previewUrl); return { ...clip, scopeKey: composerScopeKey }; });\n  }\n\n  function shareCurrentLocation() {\n    if (!composerScopeKey || locating || !navigator.geolocation) {\n      setNotice(text("تعذر الوصول إلى الموقع على هذا الجهاز.", "Location is unavailable on this device."));\n      return;\n    }\n    setLocating(true);\n    navigator.geolocation.getCurrentPosition(\n      ({ coords }) => {\n        const latitude = coords.latitude.toFixed(5);\n        const longitude = coords.longitude.toFixed(5);\n        setCurrentComposerBody(text(`موقعي الحالي: https://www.google.com/maps?q=${"${latitude}"},${"${longitude}"}`, `My current location: https://www.google.com/maps?q=${"${latitude}"},${"${longitude}"}`));\n        setLocating(false);\n      },\n      () => { setNotice(text("لم نتمكن من تحديد موقعك. تحقق من الإذن ثم حاول مجددًا.", "We could not access your location. Check permission and try again.")); setLocating(false); },\n      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 60_000 },\n    );\n  }\n\n  function handleImageSelection(file: File | null) {`,
  "voice and location handlers");
chats = replaceOnce(chats,
  `    const image = currentImage;\n    if (!cleanBody && !image) return;`,
  `    const image = currentImage;\n    const voice = currentVoice;\n    if (!cleanBody && !image && !voice) return;`,
  "send voice selection");
chats = replaceOnce(chats,
  `    const requestSignature = image\n      ? \`${"${cleanBody}\\n[image:${image.file.name}:${image.file.size}:${image.file.lastModified}]"}\`\n      : cleanBody;`,
  `    const requestSignature = image ? \`${"${cleanBody}\\n[image:${image.file.name}:${image.file.size}:${image.file.lastModified}]"}\` : voice ? \`${"${cleanBody}\\n[audio:${voice.file.name}:${voice.file.size}:${voice.durationMs}]"}\` : cleanBody;`,
  "voice signature");
chats = replaceOnce(chats,
  `      const uploadResult = image\n        ? await uploadChatImage({ conversationId, requestId, file: image.file })\n        : null;`,
  `      const uploadResult = image ? await uploadChatImage({ conversationId, requestId, file: image.file }) : voice ? await uploadChatAudio({ conversationId, requestId, file: voice.file, durationMs: voice.durationMs }) : null;`,
  "voice upload");
chats = replaceOnce(chats,
  `        if (uploadedPath) await removeChatImage(uploadedPath);`,
  `        if (uploadedPath) { if (voice) await removeChatAudio(uploadedPath); else await removeChatImage(uploadedPath); }`,
  "orphan cleanup");
chats = replaceOnce(chats,
  `        clearSelectedImage();\n        setConfirmedRisk`,
  `        clearSelectedImage();\n        clearSelectedVoice();\n        setConfirmedRisk`,
  "clear voice after send");
chats = replaceOnce(chats,
  `                          {message.attachmentPath && (\n                            <ChatAttachmentImage`,
  `                          {message.attachmentPath && message.attachmentKind === "audio" ? (\n                            <ChatVoiceAttachment attachmentPath={message.attachmentPath} initialUrl={message.attachmentUrl} durationMs={message.attachmentDurationMs} retryLabel={text("إعادة تحميل التسجيل", "Reload voice message")} unavailableLabel={text("تعذر تحميل التسجيل الصوتي الخاص.", "The private voice message could not be loaded.")} />\n                          ) : message.attachmentPath ? (\n                            <ChatAttachmentImage`,
  "voice player branch");
chats = replaceOnce(chats,
  `                            />\n                          )}\n                          {message.body`,
  `                            />\n                          ) : null}\n                          {message.body`,
  "voice player close");
chats = replaceOnce(chats,
  `                  <div className="grid gap-2 sm:grid-cols-[auto_1fr_auto]">`,
  `                  {currentVoice && (\n                    <div className="mb-2 flex items-center gap-3 rounded-xl bg-muted-surface p-2 hairline">\n                      <audio controls src={currentVoice.previewUrl} className="min-w-0 flex-1" />\n                      <button type="button" onClick={clearSelectedVoice} className="grid h-9 w-9 place-items-center rounded-full bg-destructive/10 text-destructive" aria-label={text("إزالة التسجيل", "Remove voice message")}><X className="h-4 w-4" /></button>\n                    </div>\n                  )}\n                  <div className="grid gap-2 sm:grid-cols-[auto_auto_auto_1fr_auto]">`,
  "voice preview and composer grid");
chats = replaceOnce(chats,
  `                    <textarea`,
  `                    <ChatVoiceRecorder disabled={sending || selectedConversation.status !== "active" || Boolean(currentImage)} onRecorded={handleVoiceRecorded} onError={(message) => setNotice(message)} labels={{ start: text("تسجيل رسالة صوتية", "Record voice message"), stop: text("إيقاف التسجيل", "Stop recording"), cancel: text("إلغاء التسجيل", "Cancel recording"), permission: text("تعذر استخدام الميكروفون. تحقق من الإذن.", "Microphone access failed. Check permission."), unsupported: text("التسجيل الصوتي غير مدعوم على هذا الجهاز.", "Voice recording is unsupported on this device.") }} />\n                    <button type="button" disabled={sending || locating || selectedConversation.status !== "active"} onClick={shareCurrentLocation} className="grid min-h-12 place-items-center rounded-xl bg-muted-surface px-4 text-primary hairline" aria-label={text("مشاركة الموقع", "Share location")}><MapPin className="h-5 w-5" /></button>\n                    <textarea`,
  "voice and location controls");
chats = replaceOnce(chats,
  `(body.trim().length === 0 && !currentImage) ||`,
  `(body.trim().length === 0 && !currentImage && !currentVoice) ||`,
  "send disabled voice");
await writeFile(chatsPath, chats);
