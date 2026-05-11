import { randomUUID } from 'crypto';
import type { PendingAction } from '@tenex/shared';

export interface DeleteEventInput {
  eventId: string;
  title?: string;
}

export function executeDeleteEvent(input: DeleteEventInput): { pendingAction: PendingAction } {
  const description = input.title
    ? `Cancel/delete "${input.title}"`
    : `Cancel/delete event ${input.eventId}`;

  const pendingAction: PendingAction = {
    id: randomUUID(),
    type: 'delete_event',
    payload: { eventId: input.eventId, title: input.title } as unknown as Record<string, unknown>,
    description,
    createdAt: new Date().toISOString(),
  };

  return { pendingAction };
}
