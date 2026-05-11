import Groq from 'groq-sdk';
import { executeTool, ToolContext } from '../tools/index.js';
import type { PendingAction, ChatStreamEvent } from '@tenex/shared';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'groq-sdk/resources/chat/completions';

// Lazy initialization to ensure env vars are loaded
let groq: Groq | null = null;

function getGroqClient(): Groq {
  if (!groq) {
    groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
  }
  return groq;
}

const TODAY = new Date().toISOString().split('T')[0];
const NOW = new Date().toISOString();

const SYSTEM_PROMPT = `You are a concise calendar assistant. Today is ${TODAY}. Current time: ${NOW}.

RULES:
- Use tools immediately without asking for confirmation (except create_event/create_events)
- Give brief, direct responses
- Assume ALL times are in the user's local timezone unless they specify otherwise
- For "this week": use ${TODAY} to end of week
- For "last month": go back 30 days from today

DATE FORMAT (CRITICAL):
- ALL dates MUST be ISO 8601: YYYY-MM-DDTHH:MM:SS
- "tomorrow at 3pm" → "${new Date(Date.now() + 86400000).toISOString().split('T')[0]}T15:00:00"
- "next Monday at 10am" → calculate the actual date
- NEVER use "10:30 AM" or relative times - always full ISO datetime

RECURRING EVENTS:
- When user wants a recurring event (daily standup, weekly sync, etc.), use the recurrence field
- Only call create_event ONCE with recurrence parameters - do NOT create multiple events
- Example: "daily standup at 10am until end of month" → ONE create_event with:
  - start: first occurrence date/time
  - end: first occurrence end time
  - recurrence: { frequency: "DAILY", until: "2026-05-31" }
- Example: "weekly meeting on Mon/Wed/Fri at 2pm for the next 4 weeks" → ONE create_event with:
  - recurrence: { frequency: "WEEKLY", until: "end date", daysOfWeek: ["MO", "WE", "FR"] }

MULTIPLE MEETINGS (DIFFERENT PEOPLE):
- When user needs separate meetings with different people, use create_events (plural) with an array
- Example: "Schedule meetings with Joe, Dan, and Sally" → ONE create_events call with 3 events
- First, use find_free_slots to get available times, then create_events with different slots for each person

EMAIL DRAFTS:
- When user asks to write/draft an email for scheduling, use draft_email tool
- Include relevant context like "block mornings for workout" in the context field
- If you found free slots, include them in suggestedTimes

When user asks about their schedule/meetings/calendar, call list_events or analyze_calendar immediately.
When user asks about free time, call find_free_slots immediately.`;

// Convert to OpenAI/Groq tool format
const tools: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'list_events',
      description: 'List calendar events in a date range',
      parameters: {
        type: 'object',
        properties: {
          start_date: { type: 'string', description: 'ISO 8601 start date' },
          end_date: { type: 'string', description: 'ISO 8601 end date' },
        },
        required: ['start_date', 'end_date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_free_slots',
      description: 'Find available meeting slots',
      parameters: {
        type: 'object',
        properties: {
          start_date: { type: 'string', description: 'ISO 8601 start' },
          end_date: { type: 'string', description: 'ISO 8601 end' },
          duration_minutes: { type: 'number', description: 'Meeting length in minutes' },
        },
        required: ['start_date', 'end_date', 'duration_minutes'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_event',
      description: 'Create a calendar event (requires user confirmation). For recurring events, set recurrence fields.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          start: { type: 'string', description: 'ISO 8601 start time for first occurrence (e.g., 2026-05-12T10:00:00)' },
          end: { type: 'string', description: 'ISO 8601 end time for first occurrence (e.g., 2026-05-12T10:30:00)' },
          description: { type: 'string' },
          location: { type: 'string' },
          recurrence: {
            type: 'object',
            description: 'For recurring events only',
            properties: {
              frequency: { type: 'string', enum: ['DAILY', 'WEEKLY', 'MONTHLY'], description: 'How often the event repeats' },
              until: { type: 'string', description: 'ISO 8601 date when recurrence ends (e.g., 2026-06-12)' },
              daysOfWeek: {
                type: 'array',
                items: { type: 'string', enum: ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] },
                description: 'For WEEKLY: which days (e.g., ["MO", "WE", "FR"] for Mon/Wed/Fri)'
              },
            },
            required: ['frequency', 'until'],
          },
        },
        required: ['title', 'start', 'end'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analyze_calendar',
      description: 'Analyze meeting load and patterns',
      parameters: {
        type: 'object',
        properties: {
          start_date: { type: 'string', description: 'ISO 8601 start' },
          end_date: { type: 'string', description: 'ISO 8601 end' },
        },
        required: ['start_date', 'end_date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'draft_email',
      description: 'Generate an email draft for scheduling meetings, follow-ups, or calendar-related communication. Use when user asks to write/draft an email.',
      parameters: {
        type: 'object',
        properties: {
          recipients: {
            type: 'array',
            items: { type: 'string' },
            description: 'Names or emails of recipients (e.g., ["Joe", "Dan", "Sally"])',
          },
          purpose: {
            type: 'string',
            enum: ['schedule_meeting', 'reschedule', 'cancel', 'follow_up', 'availability_request', 'other'],
            description: 'The purpose of the email',
          },
          context: {
            type: 'string',
            description: 'Additional context (e.g., "block mornings for workout", "prefer afternoons")',
          },
          suggestedTimes: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional suggested meeting times to include',
          },
          tone: {
            type: 'string',
            enum: ['formal', 'casual', 'friendly'],
            description: 'Tone of the email',
          },
        },
        required: ['recipients', 'purpose'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_events',
      description: 'Create MULTIPLE calendar events at once (requires user confirmation). Use this when scheduling meetings with multiple different people.',
      parameters: {
        type: 'object',
        properties: {
          events: {
            type: 'array',
            description: 'Array of events to create',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                start: { type: 'string', description: 'ISO 8601 start time' },
                end: { type: 'string', description: 'ISO 8601 end time' },
                description: { type: 'string' },
                attendees: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Attendee email addresses',
                },
              },
              required: ['title', 'start', 'end'],
            },
          },
        },
        required: ['events'],
      },
    },
  },
];

const MAX_TOOL_ITERATIONS = 4;

export interface AgentStreamOptions {
  message: string;
  conversationHistory: ChatCompletionMessageParam[];
  toolContext: ToolContext;
  onEvent: (event: ChatStreamEvent) => void;
}

export async function runAgentStream({
  message,
  conversationHistory,
  toolContext,
  onEvent,
}: AgentStreamOptions): Promise<{
  response: string;
  pendingActions: PendingAction[];
}> {
  const pendingActions: PendingAction[] = [];
  let fullResponse = '';
  let iterations = 0;

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...conversationHistory,
    { role: 'user', content: message },
  ];

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;

    const stream = await getGroqClient().chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      max_tokens: 1024,
      tools,
      tool_choice: 'auto',
      messages,
      stream: true,
    });

    let currentToolCall: { id: string; name: string; arguments: string } | null = null;
    let assistantContent = '';
    const toolCalls: Array<{ id: string; name: string; arguments: string }> = [];
    const emittedToolStarts = new Set<string>();

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      if (delta?.content) {
        fullResponse += delta.content;
        assistantContent += delta.content;
        onEvent({ type: 'text', content: delta.content });
      }

      if (delta?.tool_calls) {
        for (const toolCall of delta.tool_calls) {
          if (toolCall.id) {
            // New tool call starting
            if (currentToolCall && currentToolCall.name) {
              toolCalls.push(currentToolCall);
            }
            currentToolCall = {
              id: toolCall.id,
              name: toolCall.function?.name || '',
              arguments: toolCall.function?.arguments || '',
            };
          } else if (currentToolCall) {
            // Continuing existing tool call
            if (toolCall.function?.name) {
              currentToolCall.name = toolCall.function.name;
            }
            if (toolCall.function?.arguments) {
              currentToolCall.arguments += toolCall.function.arguments;
            }
          }

          // Emit tool_start only once per tool
          if (currentToolCall?.name && !emittedToolStarts.has(currentToolCall.id)) {
            emittedToolStarts.add(currentToolCall.id);
            onEvent({ type: 'tool_start', toolName: currentToolCall.name, toolId: currentToolCall.id });
          }
        }
      }
    }

    // Push final tool call if exists
    if (currentToolCall && currentToolCall.name) {
      toolCalls.push(currentToolCall);
    }

    // If no tool calls, we're done
    if (toolCalls.length === 0) {
      break;
    }

    // Add assistant message with tool calls
    messages.push({
      role: 'assistant',
      content: assistantContent || null,
      tool_calls: toolCalls.map(tc => ({
        id: tc.id,
        type: 'function' as const,
        function: {
          name: tc.name,
          arguments: tc.arguments,
        },
      })),
    });

    // Execute tools
    for (const toolCall of toolCalls) {
      try {
        const input = JSON.parse(toolCall.arguments || '{}');
        const { result, pendingAction } = await executeTool(
          toolCall.name,
          input,
          toolContext
        );

        if (pendingAction) {
          pendingActions.push(pendingAction);
          onEvent({ type: 'pending_action', action: pendingAction });
        }

        onEvent({ type: 'tool_end', toolId: toolCall.id, result });

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      } catch (error) {
        console.error('[Tool Error]', toolCall.name, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        onEvent({ type: 'tool_end', toolId: toolCall.id, result: { error: errorMessage } });

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify({ error: errorMessage }),
        });
      }
    }
  }

  return { response: fullResponse, pendingActions };
}
