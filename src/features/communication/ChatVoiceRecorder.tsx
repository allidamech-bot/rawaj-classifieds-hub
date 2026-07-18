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
  };
}

const MAX_DURATION_MS = 120_000;

const RECORDER_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
];

const RECORDER_FALLBACK_MIME_TYPES = ["audio/webm", "audio/mp4", "audio/ogg", "audio/mpeg"];

function preferredMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const type of RECORDER_MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return null;
}

function normalizeRecordedMimeType(mime: string): string | null {
  const base = mime.split(";")[0]?.trim().toLowerCase() ?? "";
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
      onError(labels.permission);
      return;
    }
    const mimeType = preferredMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch {
      stopMicrophone();
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
    startedAtRef.current = Date.now();
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onerror = () => {
      cleanup();
      onError(labels.permission);
    };
    recorder.onstop = () => {
      const durationMs = Math.min(
        MAX_DURATION_MS,
        Math.max(1_000, Date.now() - startedAtRef.current),
      );
      const type = normalizeRecordedMimeType(recorder.mimeType || mimeType || "audio/webm");
      if (!type) {
        cleanup();
        onError(labels.unsupported);
        return;
      }
      const blob = new Blob(chunksRef.current, { type });
      if (blob.size > 0) {
        const file = new File([blob], `voice-${Date.now()}.${extensionForMime(type)}`, { type });
        onRecorded({ file, previewUrl: URL.createObjectURL(blob), durationMs });
      } else {
        cleanup();
        onError(labels.unsupported);
      }
    };
    try {
      recorder.start(500);
    } catch {
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
