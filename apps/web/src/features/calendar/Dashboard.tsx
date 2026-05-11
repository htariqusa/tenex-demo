import { useState, useEffect } from 'react';
import { LogOut, User as UserIcon, Calendar, BarChart3 } from 'lucide-react';
import { CalendarView } from './CalendarView';
import { MeetingPrepCard } from './MeetingPrepCard';
import { DailyBriefing } from './DailyBriefing';
import { MeetingPrepDrawer } from './MeetingPrepDrawer';
import { ChatPanel } from '../chat/ChatPanel';
import { AnalyticsView } from '../analytics/AnalyticsView';
import { useAuth, User } from '../auth/useAuth';
import type { CalendarEvent } from '@tenex/shared';

type Tab = 'calendar' | 'analytics';

export function Dashboard({ user }: { user: User }) {
  const { logout, isLoggingOut } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('calendar');
  const [showBriefing, setShowBriefing] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<CalendarEvent | null>(null);

  // Show daily briefing on first load (once per session)
  useEffect(() => {
    const briefingShown = sessionStorage.getItem('briefingShown');
    if (!briefingShown) {
      setShowBriefing(true);
      sessionStorage.setItem('briefingShown', 'true');
    }
  }, []);

  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <div className="flex items-center gap-8">
          <h1 className="text-xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
            Tempo
          </h1>

          {/* Tabs */}
          <nav className="flex gap-1">
            <button
              onClick={() => setActiveTab('calendar')}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                activeTab === 'calendar'
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <Calendar className="h-4 w-4" />
              Calendar
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                activeTab === 'analytics'
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              Analytics
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {user.picture ? (
              <img
                src={user.picture}
                alt={user.name || user.email}
                className="h-8 w-8 rounded-full"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <UserIcon className="h-4 w-4" />
              </div>
            )}
            <span className="text-sm font-medium">{user.name || user.email}</span>
          </div>

          <button
            onClick={() => logout()}
            disabled={isLoggingOut}
            className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </header>

      {/* Daily Briefing Modal */}
      {showBriefing && (
        <DailyBriefing
          userName={user.name}
          onClose={() => setShowBriefing(false)}
        />
      )}

      {/* Meeting Prep Drawer */}
      {selectedMeeting && (
        <MeetingPrepDrawer
          meeting={selectedMeeting}
          onClose={() => setSelectedMeeting(null)}
        />
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main view */}
        <main className="flex-1 overflow-hidden border-r">
          {activeTab === 'calendar' ? (
            <CalendarView onSelectMeeting={setSelectedMeeting} />
          ) : (
            <AnalyticsView />
          )}
        </main>

        {/* Right sidebar */}
        <aside className="flex w-[420px] flex-shrink-0 flex-col">
          {/* Meeting Prep Card */}
          <div className="border-b p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-500 uppercase tracking-wide">
              Up Next
            </h3>
            <MeetingPrepCard />
          </div>

          {/* Chat panel */}
          <div className="flex-1 overflow-hidden">
            <ChatPanel />
          </div>
        </aside>
      </div>
    </div>
  );
}
