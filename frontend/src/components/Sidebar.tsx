import {
  Download,
  ListVideo,
  History,
  Settings,
  Sun,
  Moon,
  Server,
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

export type NavTab = 'download' | 'downloads' | 'history' | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  serverStatus: 'connected' | 'disconnected' | 'checking';
  activeJobsCount?: number;
}

// Desktop-persistent sidebar. Below the md breakpoint it hides entirely —
// BottomNav.tsx is the mobile nav counterpart (matches the design's
// sidebar/bottom-nav split, reconciled onto the existing md:768px breakpoint
// rather than the design's 900px).
export function Sidebar({
  activeTab,
  onTabChange,
  isDarkMode,
  onToggleTheme,
  serverStatus,
  activeJobsCount = 0,
}: SidebarProps) {
  const navItems = [
    {
      id: 'download' as NavTab,
      label: 'Download',
      icon: Download,
      description: 'Paste & resolve URLs'
    },
    {
      id: 'downloads' as NavTab,
      label: 'Downloads',
      icon: ListVideo,
      description: 'Manager & Queue',
      badge: activeJobsCount > 0 ? activeJobsCount : undefined
    },
    {
      id: 'history' as NavTab,
      label: 'History',
      icon: History,
      description: 'Past sessions & files'
    }
  ];

  const content = (
    <div className="flex flex-col h-full bg-card border-r border-border/80 w-64 select-none p-4 justify-between">
      {/* Brand Header */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between px-2 pt-1">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
              <svg className="size-5 fill-current" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base tracking-tight text-foreground leading-tight">
                YT Downloader
              </span>
              <span className="text-[11px] text-muted-foreground font-medium">
                Desktop Download Manager
              </span>
            </div>
          </div>
        </div>

        {/* Primary Navigation */}
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-primary/10 text-primary font-semibold border border-primary/20 shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`size-4.5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <Badge variant={isActive ? 'default' : 'secondary'} className="px-1.5 py-0.2 text-[10px] font-bold">
                    {item.badge}
                  </Badge>
                )}
              </button>
            );
          })}
        </nav>

        <div className="h-px bg-border/60 my-1" />

        {/* Settings Tab */}
        <nav className="flex flex-col gap-1">
          <button
            onClick={() => onTabChange('settings')}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
              activeTab === 'settings'
                ? 'bg-primary/10 text-primary font-semibold border border-primary/20 shadow-2xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
            }`}
          >
            <Settings className={`size-4.5 ${activeTab === 'settings' ? 'text-primary' : 'text-muted-foreground'}`} />
            <span>Settings</span>
          </button>
        </nav>
      </div>

      {/* Footer Info & Server Status */}
      <div className="flex flex-col gap-3 pt-3 border-t border-border/60">
        {/* Local Server Connection Card */}
        <div className="p-3 rounded-xl bg-muted/40 border border-border/50 flex flex-col gap-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Server className="size-3 text-muted-foreground" /> Local server
            </span>
            <div className="flex items-center gap-1">
              <span
                className={`size-2 rounded-full ${
                  serverStatus === 'connected'
                    ? 'bg-emerald-500 animate-pulse'
                    : serverStatus === 'checking'
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-red-500'
                }`}
              />
              <span className={`text-[11px] font-medium ${
                serverStatus === 'connected' ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
              }`}>
                {serverStatus === 'connected' ? 'Connected' : serverStatus === 'checking' ? 'Connecting...' : 'Offline'}
              </span>
            </div>
          </div>
          <span className="text-[11px] font-mono text-muted-foreground truncate">
            ytdownloader.local
          </span>
        </div>

        {/* Theme Toggle Button */}
        <div className="flex items-center justify-between px-1 text-xs">
          <span className="text-muted-foreground font-medium">Appearance</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleTheme}
            className="h-8 px-2.5 rounded-lg text-xs gap-1.5 hover:bg-muted font-medium"
            title="Toggle theme"
          >
            {isDarkMode ? (
              <>
                <Sun className="size-3.5 text-amber-400" />
                <span>Light</span>
              </>
            ) : (
              <>
                <Moon className="size-3.5 text-indigo-400" />
                <span>Dark</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <aside className="hidden md:block shrink-0 h-screen sticky top-0">
      {content}
    </aside>
  );
}
