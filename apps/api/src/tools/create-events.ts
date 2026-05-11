import { randomUUID } from 'crypto';
import type { PendingAction } from '@tenex/shared';

export interface BatchEventInput {
  title: string;
  start: string;
  end: string;
  description?: string;
  attendees?: string[];
}

export interface CreateEventsInput {
  events: BatchEventInput[];
}

function formatEventTime(start: string, end: string): string {
  try {
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return `${start} to ${end}`;
    }
    const dateStr = startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const startTime = startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const endTime = endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `${dateStr}, ${startTime} - ${endTime}`;
  } catch {
    return `${start} to ${end}`;
  }
}

export function executeCreateEvents(input: CreateEventsInput): { pendingAction: PendingAction } {
  const eventDescriptions = input.events.map((event, idx) => {
    const timeDesc = formatEventTime(event.start, event.end);
    const attendeeInfo = event.attendees?.length ? ` with ${event.attendees.join(', ')}` : '';
    return `${idx + 1}. "${event.title}"${attendeeInfo} on ${timeDesc}`;
  });

  const description = `Create ${input.events.length} meetings:\n${eventDescriptions.join('\n')}`;

  const pendingAction: PendingAction = {
    id: randomUUID(),
    type: 'create_events',
    payload: input as unknown as Record<string, unknown>,
    description,
    createdAt: new Date().toISOString(),
  };

  return { pendingAction };
}
