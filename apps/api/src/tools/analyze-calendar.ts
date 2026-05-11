import { Tool } from '@anthropic-ai/sdk/resources/messages';
import { listEvents } from '../services/google-calendar.js';

export const analyzeCalendarDefinition: Tool = {
  name: 'analyze_calendar',
  description: 'Analyze calendar for meeting load, patterns, and potential optimizations. Use when user asks about their schedule, workload, or meeting habits.',
  input_schema: {
    type: 'object' as const,
    properties: {
      start_date: {
        type: 'string',
        description: 'Start of analysis period in ISO 8601 format',
      },
      end_date: {
        type: 'string',
        description: 'End of analysis period in ISO 8601 format',
      },
    },
    required: ['start_date', 'end_date'],
  },
};

// Ensure date is in ISO 8601 format with time component
function normalizeDate(date: string, isEndDate: boolean = false): string {
  if (date.includes('T')) return date;
  return isEndDate ? `${date}T23:59:59Z` : `${date}T00:00:00Z`;
}

export async function executeAnalyzeCalendar(
  input: { start_date: string; end_date: string },
  accessToken: string,
  refreshToken: string
) {
  const startDate = normalizeDate(input.start_date, false);
  const endDate = normalizeDate(input.end_date, true);
  const events = await listEvents(accessToken, refreshToken, startDate, endDate);

  // Calculate metrics
  let totalMeetingMinutes = 0;
  const eventsByDay: Record<string, number> = {};
  const recurringCount = events.filter(e => e.recurringEventId).length;
  const oneOnOnes: string[] = [];
  const largeGroups: string[] = [];

  for (const event of events) {
    if (event.isAllDay) continue;

    const start = new Date(event.start);
    const end = new Date(event.end);
    const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);

    totalMeetingMinutes += durationMinutes;

    const dayKey = start.toISOString().split('T')[0] ?? '';
    if (dayKey) {
      eventsByDay[dayKey] = (eventsByDay[dayKey] || 0) + 1;
    }

    const attendeeCount = event.attendees?.length || 0;
    if (attendeeCount === 2) {
      oneOnOnes.push(event.title);
    } else if (attendeeCount > 5) {
      largeGroups.push(event.title);
    }
  }

  const days = Object.keys(eventsByDay).length || 1;
  const avgMeetingsPerDay = events.length / days;
  const totalMeetingHours = Math.round(totalMeetingMinutes / 60 * 10) / 10;
  const avgHoursPerDay = Math.round(totalMeetingHours / days * 10) / 10;

  const busiestDay = Object.entries(eventsByDay).sort((a, b) => b[1] - a[1])[0];

  return {
    summary: {
      total_events: events.length,
      total_meeting_hours: totalMeetingHours,
      avg_meetings_per_day: Math.round(avgMeetingsPerDay * 10) / 10,
      avg_hours_per_day: avgHoursPerDay,
      recurring_meetings: recurringCount,
      one_on_ones: oneOnOnes.length,
      large_group_meetings: largeGroups.length,
    },
    busiest_day: busiestDay ? { date: busiestDay[0], meeting_count: busiestDay[1] } : null,
    insights: generateInsights(totalMeetingHours, avgMeetingsPerDay, events.length, recurringCount),
    large_meetings_to_review: largeGroups.slice(0, 5),
  };
}

function generateInsights(
  totalHours: number,
  avgPerDay: number,
  totalEvents: number,
  recurring: number
): string[] {
  const insights: string[] = [];

  if (avgPerDay > 6) {
    insights.push('High meeting density - consider blocking focus time');
  }

  if (totalHours > 30) {
    insights.push('Spending 30+ hours in meetings this period - may impact deep work');
  }

  const recurringPercent = (recurring / totalEvents) * 100;
  if (recurringPercent > 60) {
    insights.push(`${Math.round(recurringPercent)}% of meetings are recurring - review if all are still needed`);
  }

  if (insights.length === 0) {
    insights.push('Meeting load appears manageable');
  }

  return insights;
}
