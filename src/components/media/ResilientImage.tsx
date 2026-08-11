import { useEffect, useState, type ImgHTMLAttributes, type ReactNode } from "react";
import { resolveAuthenticatedMediaUrl } from "@/lib/authenticated-media-url";

interface ResilientImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "onError"> {
  fallback: ReactNode;
}

export function ResilientImage({
  src,
  alt,
  fallback,
  loading = "lazy",
  decoding = "async",
  draggable = false,
  ...props
}: ResilientImageProps) {
  const [resolvedSource, setResolvedSource] = useState<string | null>(
    typeof src === "string" ? src : null,
  );
  const [failedSource, setFailedSource] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const source = typeof src === "string" ? src : null;
    setResolvedSource(source);
    setFailedSource(null);
    if (!source) return () => { active = false; };

    void resolveAuthenticatedMediaUrl(source).then((resolved) => {
      if (active) setResolvedSource(resolved ?? source);
    });
    return () => {
      active = false;
    };
  }, [src]);

  if (!resolvedSource || failedSource === resolvedSource) return <>{fallback}</>;

  return (
    <img
      {...props}
      src={resolvedSource}
      alt={alt}
      loading={loading}
      decoding={decoding}
      draggable={draggable}
      onError={() => setFailedSource(resolvedSource)}
    />
  );
}
