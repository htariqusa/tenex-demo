import { useState, useEffect } from 'react';
import { format, isSameDay, parseISO, eachDayOfInterval, isToday, formatDistanceToNow } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, RefreshCw } from 'lucide-react';
import { useCalendar } from './useCalendar';
import { cn } from '@/lib/utils';
import type { CalendarEvent } from '@tenex/shared';

interface CalendarViewProps {
  onSelectMeeting?: (meeting: CalendarEvent) => void;
}

export function CalendarView({ onSelectMeeting }: CalendarViewProps) {
  const {
    events,
    isLoading,
    isFetching,
    currentDate,
    rangeStart,
    rangeEnd,
    viewMode,
    setViewMode,
    goToNext,
    goToPrev,
    goToToday,
    goToDate,
    refetch,
    lastUpdated,
  } = useCalendar();

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [lastUpdatedText, setLastUpdatedText] = useState('');

  // Update the "last updated" text every 10 seconds
  useEffect(() => {
    const updateText = () => {
      setLastUpdatedText(formatDistanceToNow(lastUpdated, { addSuffix: true }));
    };
    updateText();
    const interval = setInterval(updateText, 10000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  const days = viewMode === 'day'
    ? [currentDate]
    : eachDayOfInterval({ start: rangeStart, end: rangeEnd });

  // Format header based on view mode
  const headerText = viewMode === 'day'
    ? format(currentDate, 'EEEE, MMMM d, yyyy')
    : `${format(rangeStart, 'MMM d')} - ${format(rangeEnd, 'MMM d, yyyy')}`;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-4">
          {/* Date display with picker */}
          <div className="relative">
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="flex items-center gap-2 text-lg font-semibold hover:text-primary transition"
            >
              {headerText}
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            </button>

            {/* Date Picker Dropdown */}
            {showDatePicker && (
              <DatePickerDropdown
                currentDate={currentDate}
                onSelectDate={(date) => {
                  goToDate(date);
                  setShowDatePicker(false);
                }}
                onClose={() => setShowDatePicker(false)}
              />
            )}
          </div>

          <button
            onClick={goToToday}
            className="rounded-md px-3 py-1 text-sm font-medium text-primary hover:bg-primary/10"
          >
            Today
          </button>

          {/* Refresh button and status */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition',
                isFetching
                  ? 'text-violet-600'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
              )}
              title="Refresh calendar"
            >
              <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
              {isFetching ? 'Syncing...' : 'Refresh'}
            </button>
            <span className="text-xs text-slate-400">
              Updated {lastUpdatedText}
            </span>
            {/* Live indicator */}
            <div className="flex items-center gap-1" title="Auto-refreshing every 30s">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
              </span>
              <span className="text-xs text-green-600 font-medium">Live</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* View Mode Toggle */}
          <div className="flex rounded-lg bg-slate-100 p-1">
            <button
              onClick={() => setViewMode('day')}
              className={cn(
                'rounded-md px-3 py-1 text-sm font-medium transition',
                viewMode === 'day'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              Day
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={cn(
                'rounded-md px-3 py-1 text-sm font-medium transition',
                viewMode === 'week'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              Week
            </button>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={goToPrev}
              className="rounded-md p-1.5 hover:bg-muted"
              title={viewMode === 'day' ? 'Previous day' : 'Previous week'}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={goToNext}
              className="rounded-md p-1.5 hover:bg-muted"
              title={viewMode === 'day' ? 'Next day' : 'Next week'}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div
            className={cn(
              'grid min-h-full divide-x',
              viewMode === 'day' ? 'grid-cols-1' : 'grid-cols-7'
            )}
          >
            {days.map((day) => (
              <DayColumn
                key={day.toISOString()}
                day={day}
                events={events}
                onSelectMeeting={onSelectMeeting}
                isExpanded={viewMode === 'day'}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DatePickerDropdown({
  currentDate,
  onSelectDate,
  onClose,
}: {
  currentDate: Date;
  onSelectDate: (date: Date) => void;
  onClose: () => void;
}) {
  const [viewingMonth, setViewingMonth] = useState(currentDate);

  // Get days for the month grid
  const monthStart = new Date(viewingMonth.getFullYear(), viewingMonth.getMonth(), 1);
  const monthEnd = new Date(viewingMonth.getFullYear(), viewingMonth.getMonth() + 1, 0);

  // Get the starting day of the week for the first day of the month
  const startDay = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();

  // Create array of day numbers
  const days: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const prevMonth = () => {
    setViewingMonth(new Date(viewingMonth.getFullYear(), viewingMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setViewingMonth(new Date(viewingMonth.getFullYear(), viewingMonth.getMonth() + 1, 1));
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Dropdown */}
      <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-xl bg-white p-4 shadow-xl border">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={prevMonth}
            className="p-1 rounded hover:bg-slate-100"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="font-semibold">
            {format(viewingMonth, 'MMMM yyyy')}
          </span>
          <button
            onClick={nextMonth}
            className="p-1 rounded hover:bg-slate-100"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Day Headers */}
        <div className="grid grid-cols-7 mb-2">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
            <div
              key={day}
              className="text-center text-xs font-medium text-slate-500 py-1"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, index) => {
            if (day === null) {
              return <div key={`empty-${index}`} />;
            }

            const date = new Date(viewingMonth.getFullYear(), viewingMonth.getMonth(), day);
            const isSelected = isSameDay(date, currentDate);
            const isTodayDate = isToday(date);

            return (
              <button
                key={day}
                onClick={() => onSelectDate(date)}
                className={cn(
                  'h-8 w-8 rounded-full text-sm font-medium transition mx-auto',
                  isSelected
                    ? 'bg-violet-600 text-white'
                    : isTodayDate
                    ? 'bg-violet-100 text-violet-600 hover:bg-violet-200'
                    : 'hover:bg-slate-100'
                )}
              >
                {day}
              </button>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="mt-4 pt-4 border-t flex gap-2">
          <button
            onClick={() => onSelectDate(new Date())}
            className="flex-1 py-2 text-sm font-medium text-violet-600 hover:bg-violet-50 rounded-lg transition"
          >
            Today
          </button>
        </div>
      </div>
    </>
  );
}

function DayColumn({
  day,
  events,
  onSelectMeeting,
  isExpanded,
}: {
  day: Date;
  events: CalendarEvent[];
  onSelectMeeting?: (meeting: CalendarEvent) => void;
  isExpanded?: boolean;
}) {
  const dayEvents = events.filter((event) => {
    const eventStart = parseISO(event.start);
    return isSameDay(eventStart, day);
  });

  // Sort events by start time
  const sortedEvents = [...dayEvents].sort((a, b) =>
    new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  return (
    <div className="flex flex-col">
      {/* Day header */}
      <div
        className={cn(
          'sticky top-0 z-10 border-b bg-white px-2 py-2 text-center',
          isToday(day) && 'bg-primary/5'
        )}
      >
        <div className="text-xs font-medium text-muted-foreground">
          {format(day, 'EEE')}
        </div>
        <div
          className={cn(
            'mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold',
            isToday(day) && 'bg-primary text-primary-foreground'
          )}
        >
          {format(day, 'd')}
        </div>
      </div>

      {/* Events */}
      <div className={cn(
        'flex-1 p-2',
        isExpanded ? 'space-y-2' : 'space-y-1'
      )}>
        {sortedEvents.length === 0 ? (
          <div className={cn(
            'text-center text-muted-foreground',
            isExpanded ? 'py-8 text-sm' : 'py-4 text-xs'
          )}>
            No events
          </div>
        ) : (
          sortedEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onClick={() => onSelectMeeting?.(event)}
              isExpanded={isExpanded}
            />
          ))
        )}
      </div>
    </div>
  );
}

function EventCard({
  event,
  onClick,
  isExpanded,
}: {
  event: CalendarEvent;
  onClick?: () => void;
  isExpanded?: boolean;
}) {
  const startTime = event.isAllDay
    ? 'All day'
    : format(parseISO(event.start), 'h:mm a');
  const endTime = event.isAllDay
    ? ''
    : format(parseISO(event.end), 'h:mm a');

  if (isExpanded) {
    return (
      <button
        onClick={onClick}
        className="w-full text-left rounded-lg bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-100 p-4 hover:from-violet-100 hover:to-purple-100 transition cursor-pointer"
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="font-semibold text-slate-900">{event.title}</div>
            <div className="mt-1 text-sm text-violet-600 font-medium">
              {startTime}{endTime && ` - ${endTime}`}
            </div>
          </div>
          {event.attendees && event.attendees.length > 0 && (
            <div className="text-xs text-slate-500">
              {event.attendees.length} attendee{event.attendees.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
        {event.location && (
          <div className="mt-2 text-sm text-slate-500 truncate">
            📍 {event.location.includes('http') ? 'Video Call' : event.location}
          </div>
        )}
        {event.description && (
          <div className="mt-2 text-sm text-slate-600 line-clamp-2">
            {event.description}
          </div>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-md bg-primary/10 p-2 text-xs hover:bg-primary/20 transition cursor-pointer"
    >
      <div className="font-medium text-primary">{startTime}</div>
      <div className="mt-0.5 truncate font-medium">{event.title}</div>
      {event.location && (
        <div className="mt-0.5 truncate text-muted-foreground">
          {event.location}
        </div>
      )}
    </button>
  );
}
