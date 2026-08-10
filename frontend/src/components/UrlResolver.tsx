import React from 'react';
import { Link as LinkIcon, Loader2, AlertCircle } from 'lucide-react';
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
  return (
    <div className="w-full">
      <form
        onSubmit={onResolve}
        className="pill-input-container w-full bg-card border-2 border-primary focus-within:ring-4 focus-within:ring-neutral-200 dark:focus-within:ring-neutral-800 transition-all"
      >
        <div className="flex items-center flex-1 pl-4">
          <LinkIcon className="size-5 text-muted-foreground shrink-0" />
          <input
            type="url"
            placeholder="Paste YouTube video or playlist link..."
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            disabled={isResolving || isDisabled}
            className="w-full bg-transparent border-0 outline-none px-3 py-3 text-sm md:text-base text-foreground placeholder:text-muted-foreground"
            required
          />
        </div>
        <Button
          type="submit"
          disabled={isResolving || !url.trim() || isDisabled}
          className="rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity px-6 h-11 text-sm font-semibold shrink-0"
        >
          {isResolving ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="size-4 animate-spin" />
              Resolving
            </span>
          ) : (
            "Resolve"
          )}
        </Button>
      </form>

      {resolveError && (
        <div className="mt-4 flex gap-2.5 p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-sm leading-relaxed items-start">
          <AlertCircle className="size-5 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Unable to resolve URL: </span>
            {resolveError}
          </div>
        </div>
      )}
    </div>
  );
}
