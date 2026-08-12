import { Menu, Sun, Moon } from 'lucide-react';
import { Button } from './ui/button';
import type { NavTab } from './Sidebar';

interface HeaderProps {
  activeTab: NavTab;
  onMobileMenuOpen: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  serverStatus: 'connected' | 'disconnected' | 'checking';
}

export function Header({
  activeTab,
  onMobileMenuOpen,
  isDarkMode,
  onToggleTheme,
  serverStatus,
}: HeaderProps) {
  const getTabTitle = () => {
    switch (activeTab) {
      case 'download':
        return { title: 'Download from YouTube', sub: 'Videos, playlists & audio — downloaded locally' };
      case 'downloads':
        return { title: 'Downloads Manager', sub: 'Track active downloads and batch progress' };
      case 'history':
        return { title: 'Download History', sub: 'Review previous download sessions and redownload files' };
      case 'settings':
        return { title: 'Application Settings', sub: 'Configure download location, themes, and server' };
      default:
        return { title: 'YT Downloader', sub: 'Local Desktop Download Manager' };
    }
  };

  const { title, sub } = getTabTitle();

  return (
    <header className="flex items-center justify-between py-4 px-4 sm:px-8 border-b border-border/60 bg-card/50 backdrop-blur-xs sticky top-0 z-10 select-none">
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onMobileMenuOpen}
          className="md:hidden size-9 rounded-xl hover:bg-muted"
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </Button>

        <div className="flex flex-col">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground leading-tight">
            {title}
          </h1>
          <p className="text-xs text-muted-foreground hidden sm:block">
            {sub}
          </p>
        </div>
      </div>

      {/* Top Action Items */}
      <div className="flex items-center gap-2">
        {/* Server status pill (mobile visible icon) */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/60 border border-border/50 text-xs">
          <span
            className={`size-2 rounded-full ${
              serverStatus === 'connected'
                ? 'bg-emerald-500 animate-pulse'
                : serverStatus === 'checking'
                ? 'bg-amber-500 animate-pulse'
                : 'bg-red-500'
            }`}
          />
          <span className="text-[11px] font-medium hidden sm:inline text-muted-foreground">
            {serverStatus === 'connected' ? 'Connected' : 'Offline'}
          </span>
        </div>

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleTheme}
          className="size-9 rounded-xl hover:bg-muted"
          title="Toggle theme"
          aria-label="Toggle theme"
        >
          {isDarkMode ? (
            <Sun className="size-4.5 text-amber-400" />
          ) : (
            <Moon className="size-4.5 text-slate-700 dark:text-slate-300" />
          )}
        </Button>
      </div>
    </header>
  );
}
