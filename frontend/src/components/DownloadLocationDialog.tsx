import { useState } from 'react';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { FolderDown, Loader2, XIcon } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { DialogTitle, DialogDescription } from './ui/dialog';
import { cn } from '@/lib/utils';

interface DownloadLocationDialogProps {
  open: boolean;
  /** Hide the close button so the dialog cannot be dismissed (first-run setup). */
  dismissible?: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (path: string) => Promise<void>;
}

export function DownloadLocationDialog({
  open,
  dismissible = false,
  onOpenChange,
  onSave,
}: DownloadLocationDialogProps) {
  const [path, setPath] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (value: string) => {
    setPath(value);
    setError(null);
  };

  const handleSave = async () => {
    const trimmed = path.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(trimmed);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save the download location.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className={cn(
            'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 transition-opacity'
          )}
        />
        <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border border-border bg-card p-6 shadow-xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 rounded-2xl">
          {dismissible && (
            <DialogPrimitive.Close className="absolute right-4 top-4 rounded-xl opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
              <XIcon className="size-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          )}

          <div className="flex flex-col gap-5 pt-1">
            <div className="flex flex-col gap-1.5">
              <DialogTitle className="text-xl">
                {dismissible ? 'Change download location' : 'Choose your download location'}
              </DialogTitle>
              <DialogDescription className="text-sm">
                Select where YT Video Downloader should save downloaded files.
              </DialogDescription>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-left">
                Download folder path
              </label>
              <Input
                value={path}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && path.trim()) handleSave();
                }}
                placeholder="C:\Users\YourName\Downloads"
                autoFocus
                className="h-10 rounded-xl px-3 font-mono text-sm"
              />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                A browser cannot browse your computer&apos;s file system, so paste the full path of
                the folder where downloads should be saved, e.g.{' '}
                <code className="font-mono bg-muted/60 border border-border/40 px-1 py-0.5 rounded">
                  C:\Users\YourName\Downloads
                </code>
                . Existing files are never moved or deleted.
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs leading-relaxed">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-border/40">
              {dismissible && (
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={saving}
                  className="rounded-xl text-xs font-semibold px-4"
                >
                  Cancel
                </Button>
              )}
              <Button
                onClick={handleSave}
                disabled={saving || !path.trim()}
                className="rounded-xl text-xs font-semibold px-4 gap-1.5 shadow-sm bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {saving ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <FolderDown className="size-3.5" />
                )}
                {saving ? 'Saving…' : dismissible ? 'Save location' : 'Choose Folder'}
              </Button>
            </div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}