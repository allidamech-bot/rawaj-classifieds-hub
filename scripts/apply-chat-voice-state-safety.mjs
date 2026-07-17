import { readFile, writeFile } from "node:fs/promises";

const path = "src/routes/chats.tsx";
let source = await readFile(path, "utf8");

function replaceOnce(before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing anchor: ${label}`);
  source = source.replace(before, after);
}

const clearVoice = `    setSelectedVoice((current) => {\n      if (current) URL.revokeObjectURL(current.previewUrl);\n      return null;\n    });`;

replaceOnce(
  `    setSelectedImage((current) => {\n      if (current) URL.revokeObjectURL(current.previewUrl);\n      return null;\n    });\n    setConversationQuery("");`,
  `    setSelectedImage((current) => {\n      if (current) URL.revokeObjectURL(current.previewUrl);\n      return null;\n    });\n${clearVoice}\n    setConversationQuery("");`,
  "account voice reset",
);

replaceOnce(
  `    setSelectedImage((current) => {\n      if (current) URL.revokeObjectURL(current.previewUrl);\n      return null;\n    });\n  }, [selectedConversation?.id]);`,
  `    setSelectedImage((current) => {\n      if (current) URL.revokeObjectURL(current.previewUrl);\n      return null;\n    });\n${clearVoice}\n  }, [selectedConversation?.id]);`,
  "conversation voice reset",
);

replaceOnce(
  `    setMessageError(null);\n    setSelectedImage((current) => {`,
  `    clearSelectedVoice();\n    setMessageError(null);\n    setSelectedImage((current) => {`,
  "image selection clears voice",
);

await writeFile(path, source);
