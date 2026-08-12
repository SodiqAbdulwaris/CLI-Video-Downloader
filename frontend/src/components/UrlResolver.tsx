import React, { useState } from 'react';
import { Link as LinkIcon, Loader2, AlertCircle, Clipboard, ArrowRight, RefreshCw, Check } from 'lucide-react';
import { Button } from './ui/button';

interface UrlResolverProps {
  url: string;
  onUrlChange: (url: string) => void;
  onResolve: (e: React.FormEvent) => void;
  isResolving: boolean;
  resolveError: string | null;
  isDisabled?: boolean;
}

export function UrlResolver({
  url,
  onUrlChange,
  onResolve,
  isResolving,
  resolveError,
  isDisabled = false
}: UrlResolverProps) {
  const [copied, setCopied] = useState(false);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        onUrlChange(text.trim());
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      // Clipboard read fallback if permission denied
    }
  };

  return (
    <div className="w-full flex flex-col gap-3">
      {/* URL Input Form Container */}
      <form
        onSubmit={onResolve}
        className="pill-input-container w-full bg-card border border-border shadow-xs hover:border-primary/50 focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/15 transition-all duration-200"
      >
        <div className="flex items-center flex-1 pl-3.5 pr-2 gap-2">
          <LinkIcon className="size-4.5 text-muted-foreground shrink-0" />
          <input
            type="url"
            placeholder="Paste a YouTube video, playlist, or Shorts URL..."
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            disabled={isResolving || isDisabled}
            className="w-full bg-transparent border-0 outline-none py-3 text-sm sm:text-base text-foreground placeholder:text-muted-foreground/70"
            required
          />
          {/* Quick Paste Button when empty */}
          {!url && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handlePaste}
              className="h-8 px-2.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/80 gap-1.5 shrink-0"
              title="Paste URL from clipboard"
            >
              {copied ? <Check className="size-3.5 text-emerald-500" /> : <Clipboard className="size-3.5" />}
              <span className="hidden sm:inline">Paste</span>
            </Button>
          )}
        </div>

        <Button
          type="submit"
          disabled={isResolving || !url.trim() || isDisabled}
          className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all px-5 h-10 text-sm font-semibold shrink-0 gap-1.5 shadow-2xs"
        >
          {isResolving ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              <span>Resolving...</span>
            </>
          ) : (
            <>
              <span>Resolve</span>
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </form>

      {/* Inline Resolving Progress Banner (Does not block application) */}
      {isResolving && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-primary/5 border border-primary/15 text-xs text-foreground animate-in fade-in slide-in-from-top-1 duration-200">
          <Loader2 className="size-4 text-primary animate-spin shrink-0" />
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-primary">Resolving URL...</span>
            <span className="text-muted-foreground">Fetching video details and available resolutions</span>
          </div>
        </div>
      )}

      {/* Helper text */}
      {!isResolving && !resolveError && (
        <p className="text-xs text-muted-foreground/80 px-1">
          Supports YouTube videos, playlists, Shorts & audio downloads.
        </p>
      )}

      {/* Error state with retry */}
      {resolveError && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs leading-relaxed animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Unable to resolve URL: </span>
              <span>{resolveError}</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onResolve}
            className="h-8 px-3 rounded-lg text-xs font-semibold gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 shrink-0 self-end sm:self-auto"
          >
            <RefreshCw className="size-3" />
            <span>Retry</span>
          </Button>
        </div>
      )}
    </div>
  );
}
