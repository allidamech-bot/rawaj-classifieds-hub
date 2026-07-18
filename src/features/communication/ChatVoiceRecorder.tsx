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
const RECORDER_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
] as const;

function preferredMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  return RECORDER_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function canonicalMimeType(value: string) {
  const baseType = value.trim().toLowerCase().split(";", 1)[0] ?? "";
  if (baseType === "video/webm") return "audio/webm";
  if (baseType === "audio/x-m4a" || baseType === "audio/m4a") return "audio/mp4";
  if (["audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg"].includes(baseType)) {
    return baseType;
  }
  return "";
}

function extensionForMime(mime: string) {
  if (mime === "audio/mp4") return "m4a";
  if (mime === "audio/mpeg") return "mp3";
  if (mime === "audio/ogg") return "ogg";
  return "webm";
}

function createRecorder(stream: MediaStream, mimeType: string) {
  try {
    return new MediaRecorder(stream, { mimeType });
  } catch {
    const baseType = canonicalMimeType(mimeType);
    if (!baseType || baseType === mimeType) throw new Error("unsupported_audio_recorder");
    return new MediaRecorder(stream, { mimeType: baseType });
  }
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

  function cleanup() {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
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

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = preferredMimeType();
      if (!mimeType) {
        stream.getTracks().forEach((track) => track.stop());
        onError(labels.unsupported);
        return;
      }

      const recorder = createRecorder(stream, mimeType);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      startedAtRef.current = Date.now();
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        cleanup();
        onError(labels.unsupported);
      };
      recorder.onstop = () => {
        const durationMs = Math.min(
          MAX_DURATION_MS,
          Math.max(1_000, Date.now() - startedAtRef.current),
        );
        const type = canonicalMimeType(recorder.mimeType || mimeType);
        const blob = type ? new Blob(chunksRef.current, { type }) : null;
        if (blob && blob.size > 0) {
          const file = new File(
            [blob],
            `voice-${Date.now()}.${extensionForMime(type)}`,
            { type },
          );
          onRecorded({ file, previewUrl: URL.createObjectURL(blob), durationMs });
        } else {
          onError(labels.unsupported);
        }
        cleanup();
      };
      recorder.start(500);
      setRecording(true);
      timerRef.current = window.setInterval(() => {
        const next = Date.now() - startedAtRef.current;
        setElapsedMs(next);
        if (next >= MAX_DURATION_MS && recorder.state === "recording") recorder.stop();
      }, 250);
    } catch {
      cleanup();
      onError(labels.permission);
    }
  }

  function stop() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
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
