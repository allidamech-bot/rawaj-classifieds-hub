export interface DiagnosticsPayload {
  stage: string;
  selectedMimeType: string | null;
  recorderMimeType: string;
  chunkMimeType: string | null;
  chunkCount: number;
  totalBytes: number;
  recorderState: string;
  fileMimeType?: string | null;
  fileSize?: number | null;
  arrayBufferSize?: number | null;
  durationMs?: number | null;
  backendErrorCode?: string | null;
  httpStatus?: number | null;
  operation?: string | null;
  errorName?: string;
  errorMessage?: string;
}

const DIAGNOSTICS_KEY = "rawaj:last-chat-audio-diagnostic";

export function isPreviewRuntime(): boolean {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname;
  return hostname.endsWith(".vercel.app") || hostname === "localhost";
}

export function storeDiagnostics(payload: DiagnosticsPayload): void {
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(DIAGNOSTICS_KEY, JSON.stringify(payload));
    }
  } catch {
    // ignore storage errors
  }
}

export function loadDiagnostics(): DiagnosticsPayload | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    const raw = sessionStorage.getItem(DIAGNOSTICS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DiagnosticsPayload;
  } catch {
    return null;
  }
}

export function logRecorderDiagnostics(context: DiagnosticsPayload): void {
  if (!isPreviewRuntime()) return;
  if (typeof console === "undefined" || typeof console.error !== "function") return;
  console.error("[chat_audio_recorder]", {
    stage: context.stage,
    selectedMimeType: context.selectedMimeType,
    recorderMimeType: context.recorderMimeType,
    chunkMimeType: context.chunkMimeType,
    chunkCount: context.chunkCount,
    totalBytes: context.totalBytes,
    recorderState: context.recorderState,
    fileMimeType: context.fileMimeType ?? null,
    fileSize: context.fileSize ?? null,
    arrayBufferSize: context.arrayBufferSize ?? null,
    durationMs: context.durationMs ?? null,
    backendErrorCode: context.backendErrorCode ?? null,
    httpStatus: context.httpStatus ?? null,
    operation: context.operation ?? null,
    errorName: context.errorName ?? null,
    errorMessage: context.errorMessage ?? null,
  });
  storeDiagnostics(context);
}
