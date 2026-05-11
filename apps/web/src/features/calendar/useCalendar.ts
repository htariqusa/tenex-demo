import { useQuery } from '@tanstack/react-query';
import { startOfWeek, endOfWeek, startOfDay, endOfDay, addWeeks, subWeeks, addDays, subDays, format } from 'date-fns';
import { useState, useCallback } from 'react';
import { api } from '@/lib/api';

export type ViewMode = 'day' | 'week';

// Poll every 30 seconds for live updates
const POLL_INTERVAL = 30 * 1000;

export function useCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Calculate range based on view mode
  const rangeStart = viewMode === 'day'
    ? startOfDay(currentDate)
    : startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday

  const rangeEnd = viewMode === 'day'
    ? endOfDay(currentDate)
    : endOfWeek(currentDate, { weekStartsOn: 1 });

  const { data, isLoading, error, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['calendar', 'events', viewMode, format(rangeStart, 'yyyy-MM-dd')],
    queryFn: async () => {
      const result = await api.getEvents(rangeStart.toISOString(), rangeEnd.toISOString());
      setLastUpdated(new Date());
      return result;
    },
    refetchInterval: POLL_INTERVAL,
    refetchIntervalInBackground: false, // Only poll when tab is active
    staleTime: 10 * 1000, // Consider data stale after 10 seconds
  });

  const goToNext = () => {
    if (viewMode === 'day') {
      setCurrentDate(addDays(currentDate, 1));
    } else {
      setCurrentDate(addWeeks(currentDate, 1));
    }
  };

  const goToPrev = () => {
    if (viewMode === 'day') {
      setCurrentDate(subDays(currentDate, 1));
    } else {
      setCurrentDate(subWeeks(currentDate, 1));
    }
  };

  const goToToday = () => setCurrentDate(new Date());

  const goToDate = (date: Date) => setCurrentDate(date);

  const manualRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  return {
    events: data?.events || [],
    isLoading,
    isFetching, // True when refetching in background
    error,
    refetch: manualRefresh,
    currentDate,
    rangeStart,
    rangeEnd,
    viewMode,
    setViewMode,
    goToNext,
    goToPrev,
    goToToday,
    goToDate,
    lastUpdated,
    dataUpdatedAt,
  };
}
