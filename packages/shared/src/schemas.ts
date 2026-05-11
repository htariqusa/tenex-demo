import { z } from 'zod';

// Calendar Event
export const CalendarEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  start: z.string(), // ISO 8601
  end: z.string(),   // ISO 8601
  location: z.string().optional(),
  attendees: z.array(z.object({
    email: z.string().email(),
    name: z.string().optional(),
    responseStatus: z.enum(['accepted', 'declined', 'tentative', 'needsAction']).optional(),
  })).optional(),
  isAllDay: z.boolean().default(false),
  recurringEventId: z.string().optional(),
  htmlLink: z.string().url().optional(),
});

// Chat Message
export const ChatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  timestamp: z.string(),
  toolCalls: z.array(z.object({
    id: z.string(),
    name: z.string(),
    input: z.record(z.unknown()),
    result: z.unknown().optional(),
  })).optional(),
});

// Tool Definitions
export const ToolCallSchema = z.object({
  id: z.string(),
  name: z.string(),
  input: z.record(z.unknown()),
});

export const ToolResultSchema = z.object({
  toolUseId: z.string(),
  result: z.unknown(),
  isError: z.boolean().default(false),
});

// API Request/Response
export const ChatRequestSchema = z.object({
  message: z.string().min(1).max(10000),
  conversationId: z.string().optional(),
});

export const CalendarQuerySchema = z.object({
  start: z.string(), // ISO 8601
  end: z.string(),   // ISO 8601
});

// Event mutations - require confirmation
export const CreateEventSchema = z.object({
  title: z.string().min(1),
  start: z.string(),
  end: z.string(),
  description: z.string().optional(),
  location: z.string().optional(),
  attendees: z.array(z.string().email()).optional(),
});

export const UpdateEventSchema = z.object({
  eventId: z.string(),
  title: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
});

export const DeleteEventSchema = z.object({
  eventId: z.string(),
});

// Pending action for confirmation
export const PendingActionSchema = z.object({
  id: z.string(),
  type: z.enum(['create_event', 'create_events', 'update_event', 'delete_event', 'send_email']),
  payload: z.record(z.unknown()),
  description: z.string(),
  createdAt: z.string(),
});

// User session
export const UserSessionSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  picture: z.string().url().optional(),
});
