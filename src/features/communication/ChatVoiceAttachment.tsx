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
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(!initialUrl);
  const refreshedRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setUrl(initialUrl);
    setFailed(!initialUrl);
    refreshedRef.current = false;
  }, [attachmentPath, initialUrl]);

  const refresh = useCallback(async () => {
    if (!attachmentPath || loading) return;
    setLoading(true);
    const next = await createChatAudioSignedUrl(attachmentPath);
    if (!mountedRef.current) return;
    setUrl(next);
    setFailed(!next);
    setLoading(false);
  }, [attachmentPath, loading]);

  async function handleError() {
    if (refreshedRef.current) {
      setFailed(true);
      return;
    }
    refreshedRef.current = true;
    await refresh();
  }

  if (failed || !url) {
    return (
      <div className="mb-2 rounded-xl bg-black/5 p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Volume2 className="h-4 w-4" aria-hidden="true" />
          <span>{unavailableLabel}</span>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading} className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-lg bg-muted-surface px-3 text-xs font-bold text-primary hairline">
          <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
          {retryLabel}
        </button>
      </div>
    );
  }

  return (
    <div className="mb-2 rounded-xl bg-black/5 p-2">
      <audio controls preload="metadata" src={url} onError={() => void handleError()} className="w-full" />
      {durationMs ? <p className="mt-1 text-[10px] text-muted-foreground">{Math.ceil(durationMs / 1000)}s</p> : null}
    </div>
  );
}
