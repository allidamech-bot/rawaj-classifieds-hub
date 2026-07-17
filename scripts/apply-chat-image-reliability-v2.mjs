import { readFile, writeFile } from "node:fs/promises";

const path = "src/routes/chats.tsx";
let source = await readFile(path, "utf8");

const importAnchor = 'import { PageHeader } from "@/components/PageHeader";\n';
if (!source.includes(importAnchor)) throw new Error("Missing PageHeader import anchor");
source = source.replace(
  importAnchor,
  `${importAnchor}import { ChatAttachmentImage } from "@/features/communication/ChatAttachmentImage";\n`,
);

const before = `                          {message.attachmentUrl && (\n                            <a\n                              href={message.attachmentUrl}\n                              target="_blank"\n                              rel="noreferrer"\n                              className="mb-2 block overflow-hidden rounded-xl bg-black/5"\n                            >\n                              <img\n                                src={message.attachmentUrl}\n                                alt={text("صورة مرفقة بالمحادثة", "Chat attachment")}\n                                loading="lazy"\n                                decoding="async"\n                                className="max-h-80 w-full object-contain"\n                              />\n                            </a>\n                          )}`;
const after = `                          {message.attachmentPath && (\n                            <ChatAttachmentImage\n                              attachmentPath={message.attachmentPath}\n                              initialUrl={message.attachmentUrl}\n                              alt={text("صورة مرفقة بالمحادثة", "Chat attachment")}\n                              retryLabel={text("إعادة تحميل الصورة", "Reload image")}\n                              unavailableLabel={text(\n                                "تعذر تحميل الصورة الخاصة. حاول مجددًا.",\n                                "The private image could not be loaded. Try again.",\n                              )}\n                            />\n                          )}`;
if (!source.includes(before)) throw new Error("Missing attachment render anchor");
source = source.replace(before, after);

await writeFile(path, source, "utf8");
