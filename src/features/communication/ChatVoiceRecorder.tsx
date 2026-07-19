import { Mic, Square, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  canonicalBaseMime,
  createCompatibleMediaRecorder,
  createUploadableFromBlob,
  extensionForMime,
  isAppleMobileWebKit,
  normalizeRecordedMimeType,
  recorderMimeCandidates,
  resolveFinalMimeType,
  shouldUseRecorderTimeslice,
} from "@/lib/chat-audio-recorder-strategy";
import { logRecorderDiagnostics } from "@/lib/chat-audio-diagnostics";

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
    const appleMobile = isAppleMobileWebKit();
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      logRecorderDiagnostics({
        stage: "IOS_PERMISSION",
        selectedMimeType: null,
        recorderMimeType: "",
        chunkMimeType: null,
        chunkCount: 0,
        totalBytes: 0,
        recorderState: "n/a",
        errorName: error instanceof Error ? error.name : undefined,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      onError(labels.permission);
      return;
    }
    let recorder: MediaRecorder;
    let selectedMimeType: string | null;
    try {
      const result = createCompatibleMediaRecorder(stream);
      recorder = result.recorder;
      selectedMimeType = result.selectedMimeType;
    } catch (error) {
      stopMicrophone();
      logRecorderDiagnostics({
        stage: "IOS_RECORDER_CREATE",
        selectedMimeType: null,
        recorderMimeType: "",
        chunkMimeType: null,
        chunkCount: 0,
        totalBytes: 0,
        recorderState: "n/a",
        errorName: error instanceof Error ? error.name : undefined,
        errorMessage: error instanceof Error ? error.message : String(error),
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
      const chunkCount = chunksRef.current.length;
      const totalBytes = chunksRef.current.reduce((total, blob) => total + blob.size, 0);
      logRecorderDiagnostics({
        stage: "IOS_RECORDER_RUNTIME",
        selectedMimeType,
        recorderMimeType: recorder.mimeType,
        chunkMimeType: recordedChunkMimeRef.current,
        chunkCount,
        totalBytes,
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
      const type = resolveFinalMimeType(storedChunkMime, recorderMime, selectedMimeType);
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
        logRecorderDiagnostics({
          stage: "IOS_EMPTY_BLOB",
          selectedMimeType,
          recorderMimeType: recorderMime,
          chunkMimeType: storedChunkMime,
          chunkCount,
          totalBytes,
          recorderState: finalState,
        });
        onError(labels.noAudio);
        return;
      }
      if (completedRef.current) return;
      completedRef.current = true;
      const durationMs = Math.min(
        MAX_DURATION_MS,
        Math.max(1_000, Date.now() - startedAtRef.current),
      );
      const extension = extensionForMime(type);
      const file = createUploadableFromBlob(blob, type, extension);
      logRecorderDiagnostics({
        stage: "IOS_RECORDER_STOP",
        selectedMimeType,
        recorderMimeType: recorderMime,
        chunkMimeType: storedChunkMime,
        chunkCount,
        totalBytes,
        recorderState: finalState,
        fileMimeType: type,
        fileSize: blob.size,
        durationMs,
      });
      onRecorded({ file, previewUrl: URL.createObjectURL(blob), durationMs });
    };
    try {
      if (shouldUseRecorderTimeslice(appleMobile, recorder.mimeType, selectedMimeType)) {
        recorder.start(500);
      } else {
        recorder.start();
      }
    } catch (error) {
      logRecorderDiagnostics({
        stage: "IOS_RECORDER_START",
        selectedMimeType,
        recorderMimeType: recorder.mimeType,
        chunkMimeType: null,
        chunkCount: 0,
        totalBytes: 0,
        recorderState: recorder.state,
        errorName: error instanceof Error ? error.name : undefined,
        errorMessage: error instanceof Error ? error.message : String(error),
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
        recorderRef.current.stop();
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
