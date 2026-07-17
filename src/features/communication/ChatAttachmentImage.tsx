import { ImageOff, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createChatImageSignedUrl } from "@/lib/classifieds-api";

interface ChatAttachmentImageProps {
  attachmentPath: string;
  initialUrl: string | null;
  alt: string;
  retryLabel: string;
  unavailableLabel: string;
}

export function ChatAttachmentImage({
  attachmentPath,
  initialUrl,
  alt,
  retryLabel,
  unavailableLabel,
}: ChatAttachmentImageProps) {
  const [url, setUrl] = useState(initialUrl);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(!initialUrl);
  const refreshAttemptRef = useRef(0);
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
    refreshAttemptRef.current = 0;
  }, [attachmentPath, initialUrl]);

  const refreshUrl = useCallback(async () => {
    if (!attachmentPath || refreshing) return null;
    setRefreshing(true);
    const signedUrl = await createChatImageSignedUrl(attachmentPath);
    if (!mountedRef.current) return signedUrl;
    setRefreshing(false);
    setUrl(signedUrl);
    setFailed(!signedUrl);
    return signedUrl;
  }, [attachmentPath, refreshing]);

  async function handleImageError() {
    if (refreshAttemptRef.current >= 1) {
      setFailed(true);
      return;
    }
    refreshAttemptRef.current += 1;
    await refreshUrl();
  }

  async function handleOpen() {
    const freshUrl = await refreshUrl();
    const target = freshUrl ?? url;
    if (target) window.open(target, "_blank", "noopener,noreferrer");
  }

  if (failed || !url) {
    return (
      <div className="mb-2 grid min-h-28 place-items-center rounded-xl bg-black/5 p-3 text-center">
        <ImageOff className="mb-2 h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <p className="text-xs text-muted-foreground">{unavailableLabel}</p>
        <button
          type="button"
          onClick={() => void refreshUrl()}
          disabled={refreshing}
          className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-lg bg-muted-surface px-3 text-xs font-bold text-primary hairline"
        >
          <RefreshCw className={refreshing ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
          {retryLabel}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void handleOpen()}
      disabled={refreshing}
      className="relative mb-2 block w-full overflow-hidden rounded-xl bg-black/5 text-start"
      aria-label={alt}
    >
      <img
        key={url}
        src={url}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => void handleImageError()}
        className="max-h-80 w-full object-contain"
      />
      {refreshing && (
        <span className="absolute inset-0 grid place-items-center bg-black/35 text-white">
          <RefreshCw className="h-5 w-5 animate-spin" aria-hidden="true" />
        </span>
      )}
    </button>
  );
}
