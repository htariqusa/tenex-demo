import { Tool } from '@anthropic-ai/sdk/resources/messages';
import { listEvents } from '../services/google-calendar.js';

export const listEventsDefinition: Tool = {
  name: 'list_events',
  description: 'List calendar events within a date range. Use this to see what meetings and events are scheduled.',
  input_schema: {
    type: 'object' as const,
    properties: {
      start_date: {
        type: 'string',
        description: 'Start date in ISO 8601 format (e.g., 2024-01-15T00:00:00Z)',
      },
      end_date: {
        type: 'string',
        description: 'End date in ISO 8601 format (e.g., 2024-01-22T23:59:59Z)',
      },
    },
    required: ['start_date', 'end_date'],
  },
};

// Ensure date is in ISO 8601 format with time component
function normalizeDate(date: string, isEndDate: boolean = false): string {
  // If already has time component, return as-is
  if (date.includes('T')) return date;
  // Add time component
  return isEndDate ? `${date}T23:59:59Z` : `${date}T00:00:00Z`;
}

export async function executeListEvents(
  input: { start_date: string; end_date: string },
  accessToken: string,
  refreshToken: string
) {
  const startDate = normalizeDate(input.start_date, false);
  const endDate = normalizeDate(input.end_date, true);
  const events = await listEvents(accessToken, refreshToken, startDate, endDate);

  return {
    count: events.length,
    events: events.map(e => ({
      id: e.id,
      title: e.title,
      start: e.start,
      end: e.end,
      location: e.location,
      attendees: e.attendees?.map(a => a.email).join(', '),
      isAllDay: e.isAllDay,
    })),
  };
}
