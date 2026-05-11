import { Tool } from '@anthropic-ai/sdk/resources/messages';
import Groq from 'groq-sdk';

export const draftEmailDefinition: Tool = {
  name: 'draft_email',
  description: 'Generate personalized email drafts. Can create separate drafts for each recipient. Use when the user asks to write/draft emails for scheduling, follow-ups, or calendar-related communication.',
  input_schema: {
    type: 'object' as const,
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
        description: 'Additional context about the situation (e.g., "mornings blocked for workout, only afternoons available", "30 minute check-in meetings")',
      },
      suggestedTimes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Available time slots to suggest (e.g., ["Monday 1-2pm", "Tuesday 2-3pm"])',
      },
      perRecipient: {
        type: 'boolean',
        description: 'If true, generate a separate personalized email for each recipient. Default: true when multiple recipients.',
      },
      tone: {
        type: 'string',
        enum: ['formal', 'casual', 'friendly'],
        description: 'Tone of the email. Default: friendly',
      },
    },
    required: ['recipients', 'purpose'],
  },
};

export interface DraftEmailInput {
  recipients: string[];
  purpose: 'schedule_meeting' | 'reschedule' | 'cancel' | 'follow_up' | 'availability_request' | 'other';
  context?: string;
  suggestedTimes?: string[];
  perRecipient?: boolean;
  tone?: 'formal' | 'casual' | 'friendly';
}

let groq: Groq | null = null;
function getGroqClient(): Groq {
  if (!groq) {
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groq;
}

async function generateDraft(
  recipient: string,
  purpose: string,
  context: string | undefined,
  suggestedTimes: string[] | undefined,
  tone: string
): Promise<{ draft: string; subject: string }> {
  const timesText = suggestedTimes?.length
    ? `\nAvailable times to suggest: ${suggestedTimes.join(', ')}`
    : '';

  const prompt = `Write a short, ${tone} email to ${recipient}.
Purpose: ${purpose.replace(/_/g, ' ')}
${context ? `Context: ${context}` : ''}${timesText}

Rules:
- Keep it under 120 words
- Be natural and conversational, not robotic
- Include suggested times as bullet points if provided
- Sign off with just "[Your name]"
- Do NOT include a subject line in the body`;

  const [bodyCompletion, subjectCompletion] = await Promise.all([
    getGroqClient().chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      max_tokens: 400,
      messages: [
        { role: 'system', content: 'You are a concise, professional email writer. Write natural-sounding emails.' },
        { role: 'user', content: prompt },
      ],
    }),
    getGroqClient().chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      max_tokens: 30,
      messages: [
        { role: 'system', content: 'Generate a short email subject line. Just the subject, nothing else.' },
        { role: 'user', content: `Email to ${recipient} about: ${purpose.replace(/_/g, ' ')}. ${context || ''}` },
      ],
    }),
  ]);

  return {
    draft: bodyCompletion.choices[0]?.message?.content?.trim() || '',
    subject: subjectCompletion.choices[0]?.message?.content?.trim() || `Meeting with ${recipient}`,
  };
}

export async function executeDraftEmail(input: DraftEmailInput): Promise<{ drafts: Array<{ recipient: string; subject: string; draft: string }> }> {
  const tone = input.tone || 'friendly';
  const perRecipient = String(input.perRecipient) !== 'false' && input.recipients.length > 1;

  if (perRecipient) {
    // Generate separate AI-powered drafts for each recipient in parallel
    const results = await Promise.all(
      input.recipients.map(async (recipient) => {
        const { draft, subject } = await generateDraft(
          recipient,
          input.purpose,
          input.context,
          input.suggestedTimes,
          tone
        );
        return { recipient, subject, draft };
      })
    );
    return { drafts: results };
  }

  // Single email to all recipients
  const recipientList = input.recipients.join(', ');
  const { draft, subject } = await generateDraft(
    recipientList,
    input.purpose,
    input.context,
    input.suggestedTimes,
    tone
  );
  return { drafts: [{ recipient: recipientList, subject, draft }] };
}
