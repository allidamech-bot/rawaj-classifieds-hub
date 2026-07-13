import { useEffect, useState, type ImgHTMLAttributes, type ReactNode } from "react";

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
  const [failedSource, setFailedSource] = useState<string | null>(null);

  useEffect(() => {
    if (src !== failedSource) setFailedSource(null);
  }, [failedSource, src]);

  if (!src || failedSource === src) return <>{fallback}</>;

  return (
    <img
      {...props}
      src={src}
      alt={alt}
      loading={loading}
      decoding={decoding}
      draggable={draggable}
      onError={() => setFailedSource(src)}
    />
  );
}
