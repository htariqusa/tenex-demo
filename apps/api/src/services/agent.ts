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

const SYSTEM_PROMPT = `You are a calendar assistant. Today is ${TODAY}. Current time: ${NOW}.

CRITICAL BEHAVIOR:
- You MUST call tools to perform actions. NEVER describe what you would do - just DO it by calling the tool.
- Do NOT output ANY text before calling tools. Call tools FIRST, respond with results AFTER.
- NEVER mention tool names to the user. Don't say "find_free_slots", "draft_email", etc.
- NEVER use "Step 1", "Step 2" or numbered steps. Just do the work silently.
- NEVER say "I'll use the X tool" or "Let me call X". Just call it.
- After getting results, respond naturally: "Here are your email drafts:" not "The draft_email tool returned:"
- Be conversational and helpful, like a human assistant.

RULES:
- Assume ALL times are in the user's local timezone.
- For "this week": ${TODAY} to end of week. For "last month": 30 days back.

DATE FORMAT:
- ALL dates MUST be ISO 8601: YYYY-MM-DDTHH:MM:SS
- "tomorrow at 3pm" → "${new Date(Date.now() + 86400000).toISOString().split('T')[0]}T15:00:00"
- NEVER use "10:30 AM" format - always full ISO datetime

RECURRING EVENTS:
- Use the recurrence field on a SINGLE create_event call. Do NOT create multiple events.
- Example: "daily standup at 10am until end of month" → ONE create_event with recurrence: { frequency: "DAILY", until: "2026-05-31" }

MULTIPLE MEETINGS (DIFFERENT PEOPLE):
- Use create_events (plural) with an array of events.
- Call find_free_slots first, then create_events with different slots for each person.

EMAIL DRAFTS:
- When user asks to write/draft emails, call draft_email tool.
- If scheduling-related, call find_free_slots FIRST to get real available times, then call draft_email with those times.
- For multiple people, set perRecipient: true for separate personalized emails.
- Convert ISO times to human-readable format in suggestedTimes (e.g., "Monday 1:00-1:30 PM").
- Include ALL relevant context (constraints like "mornings blocked", preferences, meeting duration).

CANCELING/DELETING EVENTS:
- When user says "cancel my X" or "delete my X", they want to REMOVE an existing event. Do NOT create a new event.
- FIRST call list_events for the relevant date range to find the event and get its ID.
- THEN call delete_event with the eventId and title. This requires user confirmation.
- If user says "I have a call at 3pm, cancel it" — that means the event EXISTS. Find it with list_events, then delete it.
- Search a wider date range if needed (e.g., the full week) to find the event.

CHAINING TOOLS:
- You can call tools one after another. The system will feed results back and you can call the next tool.
- Example flow: find_free_slots → use results → draft_email with suggestedTimes from results
- Example flow: list_events → find the event → delete_event with its ID
- Do NOT output text between chained tool calls. Just call the next tool.`;

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
      description: 'Find available meeting slots. Supports filtering by time-of-day (e.g., skip mornings). IMPORTANT: duration_minutes, earliest_hour, latest_hour must be numbers, not strings.',
      parameters: {
        type: 'object',
        properties: {
          start_date: { type: 'string', description: 'ISO 8601 start' },
          end_date: { type: 'string', description: 'ISO 8601 end' },
          duration_minutes: { type: 'string', description: 'Meeting length in minutes as a number string (e.g., "30")' },
          earliest_hour: { type: 'string', description: 'Earliest hour of day 0-23 as string (e.g., "12" to skip mornings). Default: "9"' },
          latest_hour: { type: 'string', description: 'Latest hour of day 0-23 as string (e.g., "17"). Default: "17"' },
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
      name: 'delete_event',
      description: 'Cancel/delete a calendar event (requires user confirmation). MUST call list_events first to get the eventId.',
      parameters: {
        type: 'object',
        properties: {
          eventId: { type: 'string', description: 'The event ID from list_events results' },
          title: { type: 'string', description: 'The event title (for confirmation display)' },
        },
        required: ['eventId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'draft_email',
      description: 'Generate personalized AI-written email drafts. Creates separate drafts for each recipient when perRecipient is true. Use when user asks to write/draft emails.',
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
            description: 'Full context about the situation (e.g., "mornings blocked for workout, looking for afternoon slots for 30-min check-ins")',
          },
          suggestedTimes: {
            type: 'array',
            items: { type: 'string' },
            description: 'Human-readable time slots to suggest (e.g., ["Monday 1:00-1:30 PM", "Tuesday 2:00-2:30 PM"])',
          },
          perRecipient: {
            type: 'string',
            description: 'Set to "true" to generate separate personalized emails for each recipient. Default: "true" for multiple recipients.',
          },
          tone: {
            type: 'string',
            enum: ['formal', 'casual', 'friendly'],
            description: 'Tone of the email. Default: friendly',
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

const MAX_TOOL_ITERATIONS = 6;

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
      max_tokens: 2048,
      tools,
      tool_choice: 'auto',
      messages,
      stream: true,
    });

    let currentToolCall: { id: string; name: string; arguments: string } | null = null;
    let assistantContent = '';
    const toolCalls: Array<{ id: string; name: string; arguments: string }> = [];
    const emittedToolStarts = new Set<string>();

    try {
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
    } catch (err: unknown) {
      // Groq throws tool_use_failed when the model generates text instead of a tool call.
      // The failed_generation field often contains a perfectly good response — use it.
      const error = err as { error?: { code?: string; failed_generation?: string } };
      if (error?.error?.code === 'tool_use_failed' && error.error.failed_generation) {
        const fallbackText = error.error.failed_generation;
        fullResponse += fallbackText;
        onEvent({ type: 'text', content: fallbackText });
        break;
      }
      throw err;
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
        const rawInput = JSON.parse(toolCall.arguments || '{}');
        // Fix malformed params: Llama sometimes generates {type: "string", value: "x"} instead of "x"
        const input: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(rawInput)) {
          if (val && typeof val === 'object' && 'value' in (val as object)) {
            input[key] = (val as { value: unknown }).value;
          } else {
            input[key] = val;
          }
        }
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
