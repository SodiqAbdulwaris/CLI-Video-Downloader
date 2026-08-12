import { useState, useMemo } from 'react';
import { History, Search, Trash2, Calendar } from 'lucide-react';
import { Button } from './ui/button';
import { HistoryEntry, formatDate } from './HistoryEntry';
import { HistoryDetails } from './HistoryDetails';
import { RedownloadModal } from './RedownloadModal';
import { DeleteHistoryModal } from './DeleteHistoryModal';
import type { HistorySession } from '../types/history';

interface HistoryViewProps {
  history: HistorySession[];
  onRedownloadSession: (session: HistorySession) => void;
  onDeleteSession: (id: string) => void;
  onClearHistory: () => void;
  isLoading?: boolean;
}

export function HistoryView({
  history,
  onRedownloadSession,
  onDeleteSession,
  onClearHistory,
  isLoading = false,
}: HistoryViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'partial' | 'failed'>('all');
  
  // Modals state
  const [selectedSession, setSelectedSession] = useState<HistorySession | null>(null);
  const [redownloadTarget, setRedownloadTarget] = useState<HistorySession | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    return history.filter((session) => {
      // Status filter
      if (filterStatus !== 'all' && session.status !== filterStatus) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const titleMatch = session.title?.toLowerCase().includes(query);
        const urlMatch = session.sourceUrl?.toLowerCase().includes(query);
        return titleMatch || urlMatch;
      }
      return true;
    });
  }, [history, filterStatus, searchQuery]);

  // Date Grouping
  const groupedSessions = useMemo(() => {
    const groups: { label: string; sessions: HistorySession[] }[] = [];
    
    filteredSessions.forEach((session) => {
      const dateLabel = formatDate(session.completedAt || session.createdAt) || 'Earlier';
      let group = groups.find((g) => g.label === dateLabel);
      if (!group) {
        group = { label: dateLabel, sessions: [] };
        groups.push(group);
      }
      group.sessions.push(session);
    });

    return groups;
  }, [filteredSessions]);

  const targetDeleteSession = history.find(s => s.id === deleteTargetId);

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in duration-200">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <History className="size-5 text-primary" />
            <span>Download History</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage past download sessions and redownload files with saved settings
          </p>
        </div>

        {history.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowClearConfirm(true)}
            className="text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl gap-1.5"
          >
            <Trash2 className="size-3.5" />
            <span>Clear History</span>
          </Button>
        )}
      </div>

      {/* Search & Filter Controls Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative w-full sm:w-72">
          <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by title or URL..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-card border border-border/70 rounded-xl pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all"
          />
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/60 border border-border/60 text-xs w-full sm:w-auto overflow-x-auto">
          {(['all', 'completed', 'partial', 'failed'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded-lg font-medium capitalize transition-all whitespace-nowrap ${
                filterStatus === status
                  ? 'bg-card text-foreground shadow-2xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* History Content */}
      {isLoading ? (
        <div className="p-8 text-center text-xs text-muted-foreground bg-card rounded-2xl border border-border/60">
          Loading history records...
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 rounded-2xl border border-dashed border-border/60 bg-card text-center gap-2">
          <div className="size-12 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground">
            <History className="size-6" />
          </div>
          <p className="font-semibold text-sm text-foreground">No matching history entries</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            {history.length === 0
              ? 'Your completed download sessions will automatically be stored here.'
              : 'Try clearing your search filters or status selection.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {groupedSessions.map((group) => (
            <div key={group.label} className="flex flex-col gap-3">
              {/* Date Group Label */}
              <div className="flex items-center gap-2 px-1 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <Calendar className="size-3.5 text-primary" />
                <span>{group.label}</span>
                <span className="text-[11px] font-normal text-muted-foreground/80 font-mono">
                  ({group.sessions.length})
                </span>
              </div>

              {/* Group Entries */}
              <div className="flex flex-col gap-2.5">
                {group.sessions.map((session) => (
                  <HistoryEntry
                    key={session.id}
                    session={session}
                    onViewDetails={(s) => setSelectedSession(s)}
                    onRedownload={(s) => setRedownloadTarget(s)}
                    onDelete={(id) => setDeleteTargetId(id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* History Details Modal / Drawer */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 animate-in zoom-in-95 duration-200">
            <HistoryDetails
              session={selectedSession}
              onBack={() => setSelectedSession(null)}
              onRedownload={(s) => {
                setSelectedSession(null);
                setRedownloadTarget(s);
              }}
              onDelete={(id) => {
                setSelectedSession(null);
                setDeleteTargetId(id);
              }}
            />
          </div>
        </div>
      )}

      {/* Redownload Confirmation Modal */}
      <RedownloadModal
        open={Boolean(redownloadTarget)}
        onOpenChange={(open) => !open && setRedownloadTarget(null)}
        session={redownloadTarget}
        onConfirmRedownload={onRedownloadSession}
      />

      {/* Delete Record Confirmation Modal */}
      <DeleteHistoryModal
        open={Boolean(deleteTargetId)}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
        sessionTitle={targetDeleteSession?.title}
        onConfirmDelete={() => {
          if (deleteTargetId) onDeleteSession(deleteTargetId);
          setDeleteTargetId(null);
        }}
      />

      {/* Clear All History Confirmation Modal */}
      <DeleteHistoryModal
        open={showClearConfirm}
        onOpenChange={setShowClearConfirm}
        sessionTitle="All Download History Records"
        onConfirmDelete={onClearHistory}
      />
    </div>
  );
}
