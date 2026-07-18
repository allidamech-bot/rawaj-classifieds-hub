import { RefreshCw, Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createChatAudioSignedUrl } from "@/lib/classifieds-api";

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
  const refreshedRef = useRef(false);
  const mountedRef = useRef(true);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!attachmentPath) return null;
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    setLoading(true);
    setFailed(false);
    const request = createChatAudioSignedUrl(attachmentPath)
      .then((next) => {
        if (!mountedRef.current) return next;
        setUrl(next);
        setFailed(!next);
        return next;
      })
      .catch(() => {
        if (mountedRef.current) {
          setUrl(null);
          setFailed(true);
        }
        return null;
      })
      .finally(() => {
        refreshPromiseRef.current = null;
        if (mountedRef.current) setLoading(false);
      });

    refreshPromiseRef.current = request;
    return request;
  }, [attachmentPath]);

  useEffect(() => {
    setUrl(initialUrl);
    setFailed(false);
    setLoading(!initialUrl);
    refreshedRef.current = false;

    if (!initialUrl) void refresh();
  }, [attachmentPath, initialUrl, refresh]);

  async function handleError() {
    if (refreshedRef.current) {
      setFailed(true);
      return;
    }
    refreshedRef.current = true;
    await refresh();
  }

  if (loading && !url) {
    return (
      <div className="mb-2 flex min-h-14 items-center gap-2 rounded-xl bg-black/5 p-3 text-xs text-muted-foreground">
        <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
        <span>{retryLabel}</span>
      </div>
    );
  }

  if (failed || !url) {
    return (
      <div className="mb-2 rounded-xl bg-black/5 p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Volume2 className="h-4 w-4" aria-hidden="true" />
          <span>{unavailableLabel}</span>
        </div>
        <button
          type="button"
          onClick={() => {
            refreshedRef.current = false;
            void refresh();
          }}
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
    <div className="mb-2 rounded-xl bg-black/5 p-2">
      <audio
        key={url}
        controls
        playsInline
        preload="metadata"
        src={url}
        onCanPlay={() => setFailed(false)}
        onError={() => void handleError()}
        className="w-full"
      />
      {durationMs ? (
        <p className="mt-1 text-[10px] text-muted-foreground">{Math.ceil(durationMs / 1000)}s</p>
      ) : null}
    </div>
  );
}
