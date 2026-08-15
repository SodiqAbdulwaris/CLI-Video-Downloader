import { Download, ListVideo, History, Settings } from 'lucide-react';
import type { NavTab } from './Sidebar';

interface BottomNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  hasActiveDownloads: boolean;
}

const items: { id: NavTab; label: string; icon: typeof Download }[] = [
  { id: 'download', label: 'Download', icon: Download },
  { id: 'downloads', label: 'Downloads', icon: ListVideo },
  { id: 'history', label: 'History', icon: History },
  { id: 'settings', label: 'Settings', icon: Settings },
];

// Mobile-only bottom tab bar — replaces the sidebar below the md breakpoint.
export function BottomNav({ activeTab, onTabChange, hasActiveDownloads }: BottomNavProps) {
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 flex items-stretch justify-around bg-card/95 backdrop-blur-xs border-t border-border/70 pb-[env(safe-area-inset-bottom)]">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${
              isActive ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <span className="relative">
              <Icon className={`size-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
              {item.id === 'downloads' && hasActiveDownloads && (
                <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-primary" />
              )}
            </span>
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
