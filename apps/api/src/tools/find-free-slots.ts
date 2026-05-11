import { Tool } from '@anthropic-ai/sdk/resources/messages';
import { findFreeSlots } from '../services/google-calendar.js';

export const findFreeSlotsDefinition: Tool = {
  name: 'find_free_slots',
  description: 'Find available time slots in the calendar. Use this when scheduling meetings or finding free time. Supports filtering by time-of-day.',
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
      earliest_hour: {
        type: 'number',
        description: 'Earliest hour of day to consider (0-23). E.g., 12 to skip mornings. Default: 9',
      },
      latest_hour: {
        type: 'number',
        description: 'Latest hour of day to consider (0-23). E.g., 17 for no meetings after 5pm. Default: 17',
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
  input: { start_date: string; end_date: string; duration_minutes: number | string; earliest_hour?: number | string; latest_hour?: number | string },
  accessToken: string,
  refreshToken: string
) {
  const startDate = normalizeDate(input.start_date, false);
  const endDate = normalizeDate(input.end_date, true);
  const durationMinutes = Number(input.duration_minutes);
  const slots = await findFreeSlots(
    accessToken,
    refreshToken,
    startDate,
    endDate,
    durationMinutes
  );

  const earliestHour = input.earliest_hour != null ? Number(input.earliest_hour) : 9;
  const latestHour = input.latest_hour != null ? Number(input.latest_hour) : 17;

  // Filter slots by preferred hours
  const filteredSlots = slots.filter(s => {
    const startHour = new Date(s.start).getHours();
    const endHour = new Date(s.end).getHours();
    return startHour >= earliestHour && endHour <= latestHour;
  });

  return {
    available_slots: filteredSlots.map(s => ({
      start: s.start,
      end: s.end,
    })),
    filtered_by: `${earliestHour}:00 - ${latestHour}:00`,
    message: filteredSlots.length > 0
      ? `Found ${filteredSlots.length} available slot(s) between ${earliestHour}:00 and ${latestHour}:00`
      : 'No available slots found in the given range and time window',
  };
}
