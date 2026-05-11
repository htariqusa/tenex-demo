import { useEffect, useState } from 'react';
import { format, isToday, parseISO, differenceInMinutes } from 'date-fns';
import { X, Sun, Moon, Coffee, Calendar, Clock, AlertTriangle, Zap } from 'lucide-react';
import { api } from '@/lib/api';
import type { CalendarEvent } from '@tenex/shared';

interface DailyBriefingProps {
  userName?: string;
  onClose: () => void;
}

interface BriefingData {
  greeting: string;
  icon: React.ReactNode;
  totalMeetings: number;
  totalHours: number;
  focusHours: number;
  firstMeeting: CalendarEvent | null;
  backToBackCount: number;
  bestFocusWindow: string | null;
  warnings: string[];
  tip: string;
}

export function DailyBriefing({ userName, onClose }: DailyBriefingProps) {
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadBriefing();
  }, []);

  async function loadBriefing() {
    try {
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      const { events } = await api.getEvents(
        startOfDay.toISOString(),
        endOfDay.toISOString()
      );

      // Filter to only today's non-all-day events
      const todayMeetings = events.filter(e => !e.isAllDay);

      // Calculate metrics
      let totalMinutes = 0;
      let backToBackCount = 0;
      const sortedMeetings = [...todayMeetings].sort(
        (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
      );

      for (let i = 0; i < sortedMeetings.length; i++) {
        const meeting = sortedMeetings[i];
        if (!meeting) continue;
        const start = new Date(meeting.start);
        const end = new Date(meeting.end);
        totalMinutes += differenceInMinutes(end, start);

        // Check for back-to-back (within 15 min of previous meeting end)
        if (i > 0) {
          const prevMeeting = sortedMeetings[i - 1];
          if (prevMeeting) {
            const prevEnd = new Date(prevMeeting.end);
            if (differenceInMinutes(start, prevEnd) <= 15) {
              backToBackCount++;
            }
          }
        }
      }

      const totalHours = Math.round(totalMinutes / 60 * 10) / 10;
      const workHours = 8;
      const focusHours = Math.max(0, workHours - totalHours);

      // Determine greeting based on time
      const hour = now.getHours();
      let greeting: string;
      let icon: React.ReactNode;

      if (hour < 12) {
        greeting = 'Good morning';
        icon = <Sun className="h-6 w-6 text-yellow-500" />;
      } else if (hour < 17) {
        greeting = 'Good afternoon';
        icon = <Coffee className="h-6 w-6 text-orange-500" />;
      } else {
        greeting = 'Good evening';
        icon = <Moon className="h-6 w-6 text-indigo-500" />;
      }

      // Find best focus window (longest gap between meetings)
      let bestFocusWindow: string | null = null;
      let longestGap = 0;

      for (let i = 0; i < sortedMeetings.length; i++) {
        const currentMeeting = sortedMeetings[i];
        const prevMeeting = sortedMeetings[i - 1];
        if (!currentMeeting) continue;

        const currentEnd = i === 0
          ? new Date(now.setHours(9, 0, 0, 0))
          : prevMeeting ? new Date(prevMeeting.end) : new Date(now.setHours(9, 0, 0, 0));
        const nextStart = new Date(currentMeeting.start);
        const gap = differenceInMinutes(nextStart, currentEnd);

        if (gap > longestGap && gap >= 60) {
          longestGap = gap;
          bestFocusWindow = `${format(currentEnd, 'h:mm a')} - ${format(nextStart, 'h:mm a')}`;
        }
      }

      // Check gap after last meeting
      const lastMeeting = sortedMeetings[sortedMeetings.length - 1];
      if (sortedMeetings.length > 0 && lastMeeting) {
        const lastEnd = new Date(lastMeeting.end);
        const dayEnd = new Date(now);
        dayEnd.setHours(18, 0, 0, 0);
        const gap = differenceInMinutes(dayEnd, lastEnd);
        if (gap > longestGap && gap >= 60) {
          bestFocusWindow = `${format(lastEnd, 'h:mm a')} - ${format(dayEnd, 'h:mm a')}`;
        }
      }

      // Generate warnings
      const warnings: string[] = [];
      if (backToBackCount >= 2) {
        warnings.push(`${backToBackCount} back-to-back meetings - schedule buffer time`);
      }
      if (totalHours > 5) {
        warnings.push('Heavy meeting day - protect your energy');
      }
      if (focusHours < 2) {
        warnings.push('Limited focus time available today');
      }

      // Generate tip
      const tips = [
        'Start your day with the hardest task while energy is high.',
        'Block 15 min before important meetings to prep.',
        'Take a short walk between long meetings.',
        'Review tomorrow\'s calendar before end of day.',
        'Batch similar meetings together when possible.',
      ];
      const tip = tips[Math.floor(Math.random() * tips.length)] ?? 'Have a productive day!';

      // First upcoming meeting
      const upcomingMeetings = sortedMeetings.filter(m => new Date(m.start) > now);
      const firstMeeting = upcomingMeetings[0] || null;

      setBriefing({
        greeting,
        icon,
        totalMeetings: todayMeetings.length,
        totalHours,
        focusHours,
        firstMeeting,
        backToBackCount,
        bestFocusWindow,
        warnings,
        tip,
      });
    } catch (error) {
      console.error('Failed to load briefing:', error);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
          <div className="flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        </div>
      </div>
    );
  }

  if (!briefing) {
    onClose();
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-violet-600 px-6 py-8 text-white">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full p-1 text-white/70 hover:bg-white/20 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            {briefing.icon}
            <h2 className="text-2xl font-bold">
              {briefing.greeting}, {userName?.split(' ')[0] || 'there'}!
            </h2>
          </div>
          <p className="text-blue-100">
            Here's your day at a glance
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 rounded-xl bg-slate-50">
              <Calendar className="h-5 w-5 mx-auto mb-1 text-blue-500" />
              <p className="text-2xl font-bold text-slate-900">{briefing.totalMeetings}</p>
              <p className="text-xs text-slate-500">Meetings</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-slate-50">
              <Clock className="h-5 w-5 mx-auto mb-1 text-purple-500" />
              <p className="text-2xl font-bold text-slate-900">{briefing.totalHours}h</p>
              <p className="text-xs text-slate-500">In meetings</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-slate-50">
              <Zap className="h-5 w-5 mx-auto mb-1 text-green-500" />
              <p className="text-2xl font-bold text-slate-900">{briefing.focusHours}h</p>
              <p className="text-xs text-slate-500">Focus time</p>
            </div>
          </div>

          {/* Best Focus Window */}
          {briefing.bestFocusWindow && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-200">
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <Zap className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-green-900">Best focus window</p>
                <p className="text-sm text-green-700">{briefing.bestFocusWindow}</p>
              </div>
            </div>
          )}

          {/* First Meeting */}
          {briefing.firstMeeting && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200">
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-blue-900">Up first</p>
                <p className="text-sm text-blue-700 truncate">{briefing.firstMeeting.title}</p>
                <p className="text-xs text-blue-600">
                  {format(parseISO(briefing.firstMeeting.start), 'h:mm a')}
                </p>
              </div>
            </div>
          )}

          {/* Warnings */}
          {briefing.warnings.length > 0 && (
            <div className="space-y-2">
              {briefing.warnings.map((warning, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-amber-700">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-500" />
                  {warning}
                </div>
              ))}
            </div>
          )}

          {/* Tip */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200">
            <p className="text-xs font-medium text-slate-500 mb-1">💡 Pro tip</p>
            <p className="text-sm text-slate-700">{briefing.tip}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 py-3 text-sm font-semibold text-white hover:from-blue-700 hover:to-violet-700 transition"
          >
            Let's get started
          </button>
        </div>
      </div>
    </div>
  );
}
