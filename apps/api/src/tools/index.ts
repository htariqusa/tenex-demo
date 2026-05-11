import { Tool } from '@anthropic-ai/sdk/resources/messages';
import { listEventsDefinition, executeListEvents } from './list-events.js';
import { findFreeSlotsDefinition, executeFindFreeSlots } from './find-free-slots.js';
import { createEventDefinition, executeCreateEvent, CreateEventInput } from './create-event.js';
import { executeCreateEvents, CreateEventsInput } from './create-events.js';
import { analyzeCalendarDefinition, executeAnalyzeCalendar } from './analyze-calendar.js';
import { draftEmailDefinition, executeDraftEmail, DraftEmailInput } from './draft-email.js';
import { executeDeleteEvent, DeleteEventInput } from './delete-event.js';
import { storePendingAction } from '../services/pending-actions.js';
import type { PendingAction } from '@tenex/shared';

export const tools: Tool[] = [
  listEventsDefinition,
  findFreeSlotsDefinition,
  createEventDefinition,
  analyzeCalendarDefinition,
  draftEmailDefinition,
];

export interface ToolContext {
  accessToken: string;
  refreshToken: string;
}

export interface ToolExecutionResult {
  result: unknown;
  pendingAction?: PendingAction;
}

export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  context: ToolContext
): Promise<ToolExecutionResult> {
  switch (toolName) {
    case 'list_events': {
      const result = await executeListEvents(
        input as { start_date: string; end_date: string },
        context.accessToken,
        context.refreshToken
      );
      return { result };
    }

    case 'find_free_slots': {
      const result = await executeFindFreeSlots(
        input as { start_date: string; end_date: string; duration_minutes: number },
        context.accessToken,
        context.refreshToken
      );
      return { result };
    }

    case 'create_event': {
      const { pendingAction } = executeCreateEvent(
        input as {
          title: string;
          start: string;
          end: string;
          description?: string;
          location?: string;
          attendees?: string[];
        }
      );
      // Store the pending action with tokens for later execution
      storePendingAction(pendingAction, context.accessToken, context.refreshToken);
      return {
        result: { status: 'pending_confirmation', action_id: pendingAction.id },
        pendingAction,
      };
    }

    case 'analyze_calendar': {
      const result = await executeAnalyzeCalendar(
        input as { start_date: string; end_date: string },
        context.accessToken,
        context.refreshToken
      );
      return { result };
    }

    case 'draft_email': {
      const result = await executeDraftEmail(input as unknown as DraftEmailInput);
      return { result };
    }

    case 'delete_event': {
      const { pendingAction } = executeDeleteEvent(input as unknown as DeleteEventInput);
      storePendingAction(pendingAction, context.accessToken, context.refreshToken);
      return {
        result: { status: 'pending_confirmation', action_id: pendingAction.id },
        pendingAction,
      };
    }

    case 'create_events': {
      const eventsInput = input as unknown as CreateEventsInput;
      const { pendingAction } = executeCreateEvents(eventsInput);
      storePendingAction(pendingAction, context.accessToken, context.refreshToken);
      return {
        result: { status: 'pending_confirmation', action_id: pendingAction.id, event_count: eventsInput.events.length },
        pendingAction,
      };
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
