import { Sun, Moon } from 'lucide-react';
import { Button } from './ui/button';

interface HeaderProps {
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

export function Header({ isDarkMode, onToggleTheme }: HeaderProps) {
  return (
    <header className="flex items-center justify-between py-6 border-b border-border/40">
      <div className="flex items-center gap-2">
        <span className="font-bold text-lg tracking-tight select-none">YT Video Downloader</span>
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleTheme}
        className="rounded-xl hover:bg-muted/80"
        aria-label="Toggle Theme"
      >
        {isDarkMode ? (
          <Sun className="size-5 text-yellow-400" />
        ) : (
          <Moon className="size-5 text-neutral-800 dark:text-neutral-200" />
        )}
      </Button>
    </header>
  );
}
