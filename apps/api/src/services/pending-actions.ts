import type { PendingAction } from '@tenex/shared';
import { createEvent } from './google-calendar.js';

// In-memory store for pending actions (in production, use Redis or DB)
const pendingActions = new Map<string, { action: PendingAction; tokens: { accessToken: string; refreshToken: string } }>();

// Clean up old actions after 10 minutes
const ACTION_TTL = 10 * 60 * 1000;

export function storePendingAction(
  action: PendingAction,
  accessToken: string,
  refreshToken: string
): void {
  pendingActions.set(action.id, {
    action,
    tokens: { accessToken, refreshToken },
  });

  // Auto-cleanup after TTL
  setTimeout(() => {
    pendingActions.delete(action.id);
  }, ACTION_TTL);
}

export function getPendingAction(actionId: string) {
  return pendingActions.get(actionId);
}

export function deletePendingAction(actionId: string): boolean {
  return pendingActions.delete(actionId);
}

export async function executePendingAction(actionId: string): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const stored = pendingActions.get(actionId);

  if (!stored) {
    return { success: false, error: 'Action not found or expired' };
  }

  const { action, tokens } = stored;

  try {
    switch (action.type) {
      case 'create_event': {
        const payload = action.payload as {
          title: string;
          start: string;
          end: string;
          description?: string;
          location?: string;
          attendees?: string[];
          recurrence?: {
            frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
            until: string;
            daysOfWeek?: string[];
          };
        };

        const event = await createEvent(
          tokens.accessToken,
          tokens.refreshToken,
          {
            title: payload.title,
            start: payload.start,
            end: payload.end,
            description: payload.description,
            location: payload.location,
            attendees: payload.attendees,
            recurrence: payload.recurrence,
          }
        );

        // Clean up after successful execution
        pendingActions.delete(actionId);

        return { success: true, result: event };
      }

      case 'create_events': {
        const payload = action.payload as {
          events: Array<{
            title: string;
            start: string;
            end: string;
            description?: string;
            attendees?: string[];
          }>;
        };

        const results = [];
        const errors = [];

        for (const eventData of payload.events) {
          try {
            const event = await createEvent(
              tokens.accessToken,
              tokens.refreshToken,
              {
                title: eventData.title,
                start: eventData.start,
                end: eventData.end,
                description: eventData.description,
                attendees: eventData.attendees,
              }
            );
            results.push({ title: eventData.title, success: true, event });
          } catch (err) {
            errors.push({ title: eventData.title, error: err instanceof Error ? err.message : 'Unknown error' });
          }
        }

        // Clean up after execution
        pendingActions.delete(actionId);

        return {
          success: errors.length === 0,
          result: { created: results, errors },
        };
      }

      default:
        return { success: false, error: `Unknown action type: ${action.type}` };
    }
  } catch (error) {
    console.error('[Execute Pending Action Error]', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
