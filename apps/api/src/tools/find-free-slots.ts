import { Tool } from '@anthropic-ai/sdk/resources/messages';
import { findFreeSlots } from '../services/google-calendar.js';

export const findFreeSlotsDefinition: Tool = {
  name: 'find_free_slots',
  description: 'Find available time slots in the calendar. Use this when scheduling meetings or finding free time.',
  input_schema: {
    type: 'object' as const,
    properties: {
      start_date: {
        type: 'string',
        description: 'Start of search range in ISO 8601 format',
      },
      end_date: {
        type: 'string',
        description: 'End of search range in ISO 8601 format',
      },
      duration_minutes: {
        type: 'number',
        description: 'Required meeting duration in minutes',
      },
    },
    required: ['start_date', 'end_date', 'duration_minutes'],
  },
};

// Ensure date is in ISO 8601 format with time component
function normalizeDate(date: string, isEndDate: boolean = false): string {
  if (date.includes('T')) return date;
  return isEndDate ? `${date}T23:59:59Z` : `${date}T00:00:00Z`;
}

export async function executeFindFreeSlots(
  input: { start_date: string; end_date: string; duration_minutes: number },
  accessToken: string,
  refreshToken: string
) {
  const startDate = normalizeDate(input.start_date, false);
  const endDate = normalizeDate(input.end_date, true);
  const slots = await findFreeSlots(
    accessToken,
    refreshToken,
    startDate,
    endDate,
    input.duration_minutes
  );

  return {
    available_slots: slots.map(s => ({
      start: s.start,
      end: s.end,
    })),
    message: slots.length > 0
      ? `Found ${slots.length} available slot(s)`
      : 'No available slots found in the given range',
  };
}
