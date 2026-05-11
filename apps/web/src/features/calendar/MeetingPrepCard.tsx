import { useEffect, useState } from 'react';
import { format, parseISO, differenceInMinutes, isToday } from 'date-fns';
import { Clock, Users, MapPin, Sparkles, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import type { CalendarEvent } from '@tenex/shared';

export function MeetingPrepCard() {
  const [nextMeeting, setNextMeeting] = useState<CalendarEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [prepNotes, setPrepNotes] = useState<string[]>([]);

  useEffect(() => {
    loadNextMeeting();
  }, []);

  async function loadNextMeeting() {
    try {
      const now = new Date();
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      const { events } = await api.getEvents(now.toISOString(), endOfDay.toISOString());

      // Find next upcoming meeting (not all-day, starts after now)
      const upcoming = events
        .filter(e => !e.isAllDay && new Date(e.start) > now)
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

      if (upcoming.length > 0 && upcoming[0]) {
        const next = upcoming[0];
        setNextMeeting(next);
        generatePrepNotes(next);
      }
    } catch (error) {
      console.error('Failed to load next meeting:', error);
    } finally {
      setIsLoading(false);
    }
  }

  function generatePrepNotes(meeting: CalendarEvent) {
    const notes: string[] = [];
    const attendeeCount = meeting.attendees?.length || 0;

    // Generate contextual prep notes
    if (meeting.title.toLowerCase().includes('sync') || meeting.title.toLowerCase().includes('standup')) {
      notes.push('Prepare status updates on your current tasks');
      notes.push('Note any blockers to discuss');
    } else if (meeting.title.toLowerCase().includes('1:1') || meeting.title.toLowerCase().includes('one on one')) {
      notes.push('Review action items from last meeting');
      notes.push('Prepare topics you want to discuss');
    } else if (meeting.title.toLowerCase().includes('review')) {
      notes.push('Have relevant documents ready to share');
      notes.push('Prepare questions or feedback');
    } else if (meeting.title.toLowerCase().includes('interview')) {
      notes.push('Review candidate materials');
      notes.push('Prepare your interview questions');
    } else {
      notes.push('Review the meeting agenda if available');
    }

    if (attendeeCount > 5) {
      notes.push(`Large meeting (${attendeeCount} attendees) - be concise`);
    }

    if (meeting.location && meeting.location.includes('http')) {
      notes.push('Video call - test your audio/video');
    }

    setPrepNotes(notes);
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-white p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-24 rounded bg-slate-200" />
          <div className="h-6 w-48 rounded bg-slate-200" />
          <div className="h-4 w-36 rounded bg-slate-200" />
        </div>
      </div>
    );
  }

  if (!nextMeeting) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <Sparkles className="h-6 w-6 text-green-600" />
        </div>
        <p className="font-medium text-slate-700">No more meetings today!</p>
        <p className="mt-1 text-sm text-slate-500">Enjoy your focus time</p>
      </div>
    );
  }

  const startTime = parseISO(nextMeeting.start);
  const minutesUntil = differenceInMinutes(startTime, new Date());
  const isStartingSoon = minutesUntil <= 15;

  return (
    <div className={`rounded-xl border-2 p-4 transition-all ${
      isStartingSoon
        ? 'border-orange-300 bg-orange-50'
        : 'border-slate-200 bg-white'
    }`}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
            isStartingSoon
              ? 'bg-orange-200 text-orange-800'
              : 'bg-blue-100 text-blue-800'
          }`}>
            <Clock className="h-3 w-3" />
            {minutesUntil <= 0
              ? 'Starting now'
              : minutesUntil < 60
                ? `In ${minutesUntil} min`
                : `In ${Math.round(minutesUntil / 60)}h`
            }
          </span>
          {isStartingSoon && (
            <span className="text-xs font-medium text-orange-600">Get ready!</span>
          )}
        </div>
        <span className="text-sm text-slate-500">
          {format(startTime, 'h:mm a')}
        </span>
      </div>

      {/* Title */}
      <h3 className="mb-2 font-semibold text-slate-900">{nextMeeting.title}</h3>

      {/* Meta info */}
      <div className="mb-4 flex flex-wrap gap-3 text-sm text-slate-600">
        {nextMeeting.attendees && nextMeeting.attendees.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Users className="h-4 w-4 text-slate-400" />
            <span>
              {nextMeeting.attendees.length} attendee{nextMeeting.attendees.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
        {nextMeeting.location && (
          <div className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-slate-400" />
            <span className="truncate max-w-[150px]">
              {nextMeeting.location.includes('http') ? 'Video Call' : nextMeeting.location}
            </span>
          </div>
        )}
      </div>

      {/* AI Prep Notes */}
      {prepNotes.length > 0 && (
        <div className="rounded-lg bg-gradient-to-r from-violet-50 to-purple-50 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-violet-700">
            <Sparkles className="h-3.5 w-3.5" />
            AI Prep Notes
          </div>
          <ul className="space-y-1.5">
            {prepNotes.map((note, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <ChevronRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-violet-400" />
                {note}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Join button if it's a video call */}
      {nextMeeting.location && nextMeeting.location.includes('http') && (
        <a
          href={nextMeeting.location}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block w-full rounded-lg bg-primary py-2 text-center text-sm font-medium text-white transition hover:bg-primary/90"
        >
          Join Meeting
        </a>
      )}
    </div>
  );
}
