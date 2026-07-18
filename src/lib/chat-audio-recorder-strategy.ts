export function isAppleMobileWebKit(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const platform = navigator.platform;
  const isIPadDesktop =
    platform === "MacIntel" &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1;
  return /iPhone|iPod/.test(ua) || platform === "iPad" || /iPad/.test(ua) || isIPadDesktop;
}

export function recorderMimeCandidates(): string[] {
  if (isAppleMobileWebKit()) {
    return ["audio/mp4;codecs=mp4a.40.2", "audio/mp4", "video/mp4;codecs=mp4a.40.2", "video/mp4"];
  }
  return [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/mp4",
    "video/mp4;codecs=mp4a.40.2",
    "video/mp4",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
}

export function canonicalBaseMime(mime: string | null | undefined): string {
  const base = (mime ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  return base;
}

export function normalizeRecordedMimeType(mime: string): string | null {
  const base = canonicalBaseMime(mime);
  if (base === "video/mp4") return "audio/mp4";
  if (base === "video/webm") return "audio/webm";
  if (["audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg"].includes(base)) return base;
  if (base === "audio/m4a" || base === "audio/x-m4a") return "audio/mp4";
  if (base === "audio/mp3") return "audio/mpeg";
  return null;
}

export function extensionForMime(mime: string): string {
  if (mime === "audio/mp4") return "m4a";
  if (mime === "audio/mpeg") return "mp3";
  if (mime === "audio/ogg") return "ogg";
  return "webm";
}

export function shouldUseRecorderTimeslice(
  appleMobile: boolean,
  recorderMimeType: string | undefined,
  selectedMimeType: string | null,
): boolean {
  if (appleMobile) return false;
  const mime = recorderMimeType || selectedMimeType || "audio/webm";
  const base = canonicalBaseMime(mime);
  return base !== "video/mp4" && base !== "audio/mp4";
}

export function resolveFinalMimeType(
  chunkMime: string | null,
  recorderMime: string | undefined,
  selectedMime: string | null,
): string {
  const resolvedRaw =
    (chunkMime && normalizeRecordedMimeType(chunkMime) ? chunkMime : "") ||
    recorderMime ||
    selectedMime ||
    "audio/webm";
  return normalizeRecordedMimeType(resolvedRaw) ?? "audio/webm";
}

export interface MediaRecorderResult {
  recorder: MediaRecorder;
  selectedMimeType: string | null;
}

export function createCompatibleMediaRecorder(stream: MediaStream): MediaRecorderResult {
  const candidates = recorderMimeCandidates();
  const errors: Array<{ mimeType: string; error: unknown }> = [];
  let lastError: unknown = null;

  for (const mimeType of candidates) {
    if (
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported &&
      !MediaRecorder.isTypeSupported(mimeType)
    ) {
      continue;
    }
    try {
      const recorder = new MediaRecorder(stream, { mimeType });
      return { recorder, selectedMimeType: mimeType };
    } catch (error) {
      lastError = error;
      errors.push({ mimeType, error });
    }
  }

  try {
    const recorder = new MediaRecorder(stream);
    return { recorder, selectedMimeType: null };
  } catch (error) {
    lastError = error;
  }

  throw new Error(
    `No compatible MediaRecorder found. Candidates attempted: ${candidates.join(", ")}. Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

export function createUploadableFromBlob(blob: Blob, type: string, extension: string): File {
  if (typeof File === "function") {
    return new File([blob], `voice-${Date.now()}.${extension}`, { type });
  }
  const safeName = `voice-${Date.now()}.${extension}`;
  const fileLike = blob as FileLike;
  fileLike.name = safeName;
  fileLike.lastModified = Date.now();
  return fileLike as File;
}

interface FileLike extends Blob {
  name: string;
  lastModified: number;
}
