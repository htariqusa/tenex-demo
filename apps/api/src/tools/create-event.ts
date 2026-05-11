import { Tool } from '@anthropic-ai/sdk/resources/messages';
import { randomUUID } from 'crypto';
import type { PendingAction } from '@tenex/shared';

export interface RecurrenceInput {
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  until: string;
  daysOfWeek?: ('MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU')[];
}

export interface CreateEventInput {
  title: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
  attendees?: string[];
  recurrence?: RecurrenceInput;
}

export const createEventDefinition: Tool = {
  name: 'create_event',
  description: 'Schedule a new calendar event. This will require user confirmation before the event is actually created.',
  input_schema: {
    type: 'object' as const,
    properties: {
      title: {
        type: 'string',
        description: 'Event title/summary',
      },
      start: {
        type: 'string',
        description: 'Start time in ISO 8601 format',
      },
      end: {
        type: 'string',
        description: 'End time in ISO 8601 format',
      },
      description: {
        type: 'string',
        description: 'Optional event description',
      },
      location: {
        type: 'string',
        description: 'Optional event location',
      },
      attendees: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional list of attendee email addresses',
      },
      recurrence: {
        type: 'object',
        description: 'For recurring events',
        properties: {
          frequency: { type: 'string', enum: ['DAILY', 'WEEKLY', 'MONTHLY'] },
          until: { type: 'string', description: 'End date in YYYY-MM-DD format' },
          daysOfWeek: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    required: ['title', 'start', 'end'],
  },
};

function formatRecurrenceDescription(recurrence: RecurrenceInput): string {
  const freq = recurrence.frequency.toLowerCase();
  const until = new Date(recurrence.until).toLocaleDateString();

  if (recurrence.frequency === 'WEEKLY' && recurrence.daysOfWeek?.length) {
    const dayNames: Record<string, string> = {
      MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat', SU: 'Sun'
    };
    const days = recurrence.daysOfWeek.map(d => dayNames[d] || d).join(', ');
    return `weekly on ${days} until ${until}`;
  }

  return `${freq} until ${until}`;
}

export function executeCreateEvent(input: CreateEventInput): { pendingAction: PendingAction } {
  // Format time display
  let timeDesc: string;
  try {
    const startDate = new Date(input.start);
    const endDate = new Date(input.end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      timeDesc = `${input.start} to ${input.end}`;
    } else {
      const dateStr = startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const startTime = startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      const endTime = endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      timeDesc = `${dateStr}, ${startTime} - ${endTime}`;
    }
  } catch {
    timeDesc = `${input.start} to ${input.end}`;
  }

  // Add recurrence info to description
  let description = `Create "${input.title}" on ${timeDesc}`;
  if (input.recurrence) {
    description += `, repeating ${formatRecurrenceDescription(input.recurrence)}`;
  }

  const pendingAction: PendingAction = {
    id: randomUUID(),
    type: 'create_event',
    payload: input as unknown as Record<string, unknown>,
    description,
    createdAt: new Date().toISOString(),
  };

  return { pendingAction };
}
