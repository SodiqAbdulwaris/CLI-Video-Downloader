import { useState } from 'react';
import { Video } from 'lucide-react';

interface MediaThumbnailProps {
  src?: string | null;
  alt: string;
  className?: string;
}

export function MediaThumbnail({ src, alt, className }: MediaThumbnailProps) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div className={`bg-neutral-100 dark:bg-neutral-800 flex flex-col items-center justify-center text-muted-foreground/60 gap-1 select-none ${className || ''}`}>
        <Video className="size-5 opacity-40" />
        <span className="text-[9px] font-bold tracking-wider uppercase opacity-40">No Preview</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`object-cover ${className || ''}`}
      onError={() => setHasError(true)}
    />
  );
}
