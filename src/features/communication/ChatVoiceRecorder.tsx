import { Mic, Square, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface RecordedVoiceClip {
  file: File;
  previewUrl: string;
  durationMs: number;
}

interface ChatVoiceRecorderProps {
  disabled?: boolean;
  onRecorded: (clip: RecordedVoiceClip) => void;
  onError: (message: string) => void;
  labels: {
    start: string;
    stop: string;
    cancel: string;
    permission: string;
    unsupported: string;
    noAudio: string;
  };
}

const MAX_DURATION_MS = 120_000;

const RECORDER_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "video/mp4;codecs=mp4a.40.2",
  "video/mp4",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
];

const RECORDER_FALLBACK_MIME_TYPES = ["audio/webm", "audio/mp4", "audio/ogg", "audio/mpeg"];

function isDevelopmentOrPreview(): boolean {
  if (typeof process === "undefined" || !process.env) return false;
  return (
    process.env.NODE_ENV === "development" ||
    process.env.VERCEL_ENV === "preview" ||
    process.env.RAWAJ_ENVIRONMENT === "preview"
  );
}

function preferredMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const type of RECORDER_MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return null;
}

function canonicalBaseMime(mime: string | null | undefined): string {
  const base = (mime ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  return base;
}

function normalizeRecordedMimeType(mime: string): string | null {
  const base = canonicalBaseMime(mime);
  if (base === "video/mp4") return "audio/mp4";
  if (base === "video/webm") return "audio/webm";
  if (["audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg"].includes(base)) return base;
  if (base === "audio/m4a" || base === "audio/x-m4a") return "audio/mp4";
  if (base === "audio/mp3") return "audio/mpeg";
  return null;
}

function extensionForMime(mime: string): string {
  if (mime === "audio/mp4") return "m4a";
  if (mime === "audio/mpeg") return "mp3";
  if (mime === "audio/ogg") return "ogg";
  return "webm";
}

function shouldUseRecorderTimeslice(mimeType: string): boolean {
  const base = canonicalBaseMime(mimeType);
  if (base === "video/mp4" || base === "audio/mp4") return false;
  return true;
}

function logRecorderDiagnostics(context: {
  stage: string;
  selectedMimeType: string | null;
  recorderMimeType: string;
  chunkMimeType: string | null;
  chunkCount: number;
  totalBytes: number;
  recorderState: string;
  errorName?: string;
  errorMessage?: string;
}): void {
  if (!isDevelopmentOrPreview()) return;
  if (typeof console === "undefined" || typeof console.error !== "function") return;
  console.error("[chat_audio_recorder]", {
    stage: context.stage,
    selectedMimeType: context.selectedMimeType,
    recorderMimeType: context.recorderMimeType,
    chunkMimeType: context.chunkMimeType,
    chunkCount: context.chunkCount,
    totalBytes: context.totalBytes,
    recorderState: context.recorderState,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    errorName: context.errorName ?? null,
    errorMessage: context.errorMessage ?? null,
  });
}

export function ChatVoiceRecorder({
  disabled,
  onRecorded,
  onError,
  labels,
}: ChatVoiceRecorderProps) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const recordedChunkMimeRef = useRef<string | null>(null);
  const completedRef = useRef(false);
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  function stopMicrophone() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function cleanup() {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
    stopMicrophone();
    recorderRef.current = null;
    chunksRef.current = [];
    recordedChunkMimeRef.current = null;
    setRecording(false);
    setElapsedMs(0);
  }

  useEffect(() => cleanup, []);

  async function start() {
    if (disabled || recording) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      onError(labels.unsupported);
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      logRecorderDiagnostics({
        stage: "permission",
        selectedMimeType: null,
        recorderMimeType: "",
        chunkMimeType: null,
        chunkCount: 0,
        totalBytes: 0,
        recorderState: "n/a",
      });
      onError(labels.permission);
      return;
    }
    const selectedMimeType = preferredMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = selectedMimeType
        ? new MediaRecorder(stream, { mimeType: selectedMimeType })
        : new MediaRecorder(stream);
    } catch {
      stopMicrophone();
      logRecorderDiagnostics({
        stage: "recorder_create",
        selectedMimeType,
        recorderMimeType: "",
        chunkMimeType: null,
        chunkCount: 0,
        totalBytes: 0,
        recorderState: "n/a",
      });
      onError(labels.unsupported);
      return;
    }
    if (typeof recorder.start !== "function") {
      stopMicrophone();
      onError(labels.unsupported);
      return;
    }
    streamRef.current = stream;
    recorderRef.current = recorder;
    chunksRef.current = [];
    recordedChunkMimeRef.current = null;
    completedRef.current = false;
    startedAtRef.current = Date.now();
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
        if (!recordedChunkMimeRef.current && event.data.type) {
          const canonical = normalizeRecordedMimeType(event.data.type);
          if (canonical) recordedChunkMimeRef.current = event.data.type;
        }
      }
    };
    recorder.onerror = () => {
      logRecorderDiagnostics({
        stage: "recorder_runtime",
        selectedMimeType,
        recorderMimeType: recorder.mimeType,
        chunkMimeType: recordedChunkMimeRef.current,
        chunkCount: chunksRef.current.length,
        totalBytes: chunksRef.current.reduce((total, blob) => total + blob.size, 0),
        recorderState: recorder.state,
      });
      stopMicrophone();
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      timerRef.current = null;
      recorderRef.current = null;
      chunksRef.current = [];
      recordedChunkMimeRef.current = null;
      setRecording(false);
      setElapsedMs(0);
      onError(labels.permission);
    };
    recorder.onstop = () => {
      const finalState = recorder.state;
      const chunkCount = chunksRef.current.length;
      const totalBytes = chunksRef.current.reduce((total, blob) => total + blob.size, 0);
      const storedChunkMime = recordedChunkMimeRef.current;
      const recorderMime = recorder.mimeType;
      const resolvedRaw =
        (storedChunkMime && normalizeRecordedMimeType(storedChunkMime) ? storedChunkMime : "") ||
        recorderMime ||
        selectedMimeType ||
        "audio/webm";
      const type = normalizeRecordedMimeType(resolvedRaw);
      if (!type) {
        logRecorderDiagnostics({
          stage: "blob_prepare",
          selectedMimeType,
          recorderMimeType: recorderMime,
          chunkMimeType: storedChunkMime,
          chunkCount,
          totalBytes,
          recorderState: finalState,
        });
        cleanup();
        onError(labels.unsupported);
        return;
      }
      const snapshotChunks = chunksRef.current.slice();
      const blob = new Blob(snapshotChunks, { type });
      stopMicrophone();
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      timerRef.current = null;
      recorderRef.current = null;
      chunksRef.current = [];
      recordedChunkMimeRef.current = null;
      setRecording(false);
      setElapsedMs(0);
      if (blob.size <= 0) {
        onError(labels.noAudio);
        return;
      }
      if (completedRef.current) return;
      completedRef.current = true;
      const durationMs = Math.min(
        MAX_DURATION_MS,
        Math.max(1_000, Date.now() - startedAtRef.current),
      );
      const file = new File([blob], `voice-${Date.now()}.${extensionForMime(type)}`, { type });
      logRecorderDiagnostics({
        stage: "recorder_stop",
        selectedMimeType,
        recorderMimeType: recorderMime,
        chunkMimeType: storedChunkMime,
        chunkCount,
        totalBytes,
        recorderState: finalState,
      });
      onRecorded({ file, previewUrl: URL.createObjectURL(blob), durationMs });
    };
    try {
      if (shouldUseRecorderTimeslice(selectedMimeType ?? "audio/webm")) {
        recorder.start(500);
      } else {
        recorder.start();
      }
    } catch {
      logRecorderDiagnostics({
        stage: "recorder_start",
        selectedMimeType,
        recorderMimeType: recorder.mimeType,
        chunkMimeType: null,
        chunkCount: 0,
        totalBytes: 0,
        recorderState: recorder.state,
      });
      cleanup();
      onError(labels.permission);
      return;
    }
    setRecording(true);
    timerRef.current = window.setInterval(() => {
      const next = Date.now() - startedAtRef.current;
      setElapsedMs(next);
      if (next >= MAX_DURATION_MS && recorderRef.current?.state === "recording") {
        recorder.stop();
      }
    }, 250);
  }

  function stop() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") recorder.stop();
  }

  function cancel() {
    const recorder = recorderRef.current;
    if (recorder) {
      recorder.onstop = cleanup;
      if (recorder.state !== "inactive") recorder.stop();
    } else cleanup();
  }

  const seconds = Math.floor(elapsedMs / 1000);

  if (recording) {
    return (
      <div className="flex items-center gap-2">
        <span className="min-w-12 text-center text-xs font-bold tabular-nums">{seconds}s</span>
        <button
          type="button"
          onClick={stop}
          className="grid min-h-12 place-items-center rounded-xl bg-destructive px-4 text-white"
          aria-label={labels.stop}
        >
          <Square className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={cancel}
          className="grid min-h-12 place-items-center rounded-xl bg-muted-surface px-4 text-destructive hairline"
          aria-label={labels.cancel}
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => void start()}
      className="grid min-h-12 place-items-center rounded-xl bg-muted-surface px-4 text-primary hairline"
      aria-label={labels.start}
    >
      <Mic className="h-5 w-5" />
    </button>
  );
}
