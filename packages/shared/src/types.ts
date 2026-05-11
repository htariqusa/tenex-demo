import { z } from 'zod';
import {
  CalendarEventSchema,
  ChatMessageSchema,
  ToolCallSchema,
  ToolResultSchema,
  ChatRequestSchema,
  CalendarQuerySchema,
  CreateEventSchema,
  UpdateEventSchema,
  DeleteEventSchema,
  PendingActionSchema,
  UserSessionSchema,
} from './schemas.js';

export type CalendarEvent = z.infer<typeof CalendarEventSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ToolCall = z.infer<typeof ToolCallSchema>;
export type ToolResult = z.infer<typeof ToolResultSchema>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type CalendarQuery = z.infer<typeof CalendarQuerySchema>;
export type CreateEvent = z.infer<typeof CreateEventSchema>;
export type UpdateEvent = z.infer<typeof UpdateEventSchema>;
export type DeleteEvent = z.infer<typeof DeleteEventSchema>;
export type PendingAction = z.infer<typeof PendingActionSchema>;
export type UserSession = z.infer<typeof UserSessionSchema>;

// SSE event types
export type ChatStreamEvent =
  | { type: 'text'; content: string }
  | { type: 'tool_start'; toolName: string; toolId: string }
  | { type: 'tool_end'; toolId: string; result: unknown }
  | { type: 'pending_action'; action: PendingAction }
  | { type: 'done'; messageId: string }
  | { type: 'error'; message: string };
