import { RefreshCw, Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createChatAudioSignedUrl, downloadChatAudioObjectUrl } from "@/lib/classifieds-api";

interface ChatVoiceAttachmentProps {
  attachmentPath: string;
  initialUrl: string | null;
  durationMs: number | null;
  retryLabel: string;
  unavailableLabel: string;
}

export function ChatVoiceAttachment({
  attachmentPath,
  initialUrl,
  durationMs,
  retryLabel,
  unavailableLabel,
}: ChatVoiceAttachmentProps) {
  const [url, setUrl] = useState(initialUrl);
  const [loading, setLoading] = useState(!initialUrl);
  const [failed, setFailed] = useState(false);
  const mountedRef = useRef(true);
  const loadingRef = useRef(false);
  const ownedObjectUrlRef = useRef<string | null>(null);

  const releaseOwnedUrl = useCallback(() => {
    if (ownedObjectUrlRef.current) URL.revokeObjectURL(ownedObjectUrlRef.current);
    ownedObjectUrlRef.current = null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      releaseOwnedUrl();
    };
  }, [releaseOwnedUrl]);

  const resolveUrl = useCallback(
    async (preferDownload = false) => {
      if (!attachmentPath || loadingRef.current) return;
      loadingRef.current = true;
      if (mountedRef.current) {
        setLoading(true);
        setFailed(false);
      }

      let next = preferDownload ? null : await createChatAudioSignedUrl(attachmentPath);
      let ownsNext = false;
      if (!next) {
        next = await downloadChatAudioObjectUrl(attachmentPath);
        ownsNext = Boolean(next);
      }

      if (!mountedRef.current) {
        if (ownsNext && next) URL.revokeObjectURL(next);
        loadingRef.current = false;
        return;
      }

      releaseOwnedUrl();
      if (ownsNext && next) ownedObjectUrlRef.current = next;
      setUrl(next);
      setFailed(!next);
      setLoading(false);
      loadingRef.current = false;
    },
    [attachmentPath, releaseOwnedUrl],
  );

  useEffect(() => {
    releaseOwnedUrl();
    setUrl(initialUrl);
    setFailed(false);
    setLoading(!initialUrl);
    loadingRef.current = false;
    if (!initialUrl) void resolveUrl();
  }, [attachmentPath, initialUrl, releaseOwnedUrl, resolveUrl]);

  async function handleError() {
    await resolveUrl(true);
  }

  if (!url) {
    return (
      <div className="mb-2 rounded-xl bg-black/5 p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Volume2 className="h-4 w-4" aria-hidden="true" />
          <span>{loading ? retryLabel : unavailableLabel}</span>
        </div>
        <button
          type="button"
          onClick={() => void resolveUrl()}
          disabled={loading}
          className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-lg bg-muted-surface px-3 text-xs font-bold text-primary hairline"
        >
          <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
          {retryLabel}
        </button>
      </div>
    );
  }

  return (
    <div
      className="mb-2 rounded-xl bg-black/5 p-2"
      data-audio-source={ownedObjectUrlRef.current ? "private-download" : "signed-url"}
    >
      <audio
        controls
        preload="metadata"
        src={url}
        onError={() => void handleError()}
        className="w-full"
      />
      {durationMs ? (
        <p className="mt-1 text-[10px] text-muted-foreground">{Math.ceil(durationMs / 1000)}s</p>
      ) : null}
      {failed ? <span className="sr-only">{unavailableLabel}</span> : null}
    </div>
  );
}
