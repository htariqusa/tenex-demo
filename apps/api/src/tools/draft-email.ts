import { Tool } from '@anthropic-ai/sdk/resources/messages';

export const draftEmailDefinition: Tool = {
  name: 'draft_email',
  description: 'Generate an email draft. Use this when the user asks you to write/draft an email for scheduling meetings, follow-ups, or any calendar-related communication.',
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
        description: 'Additional context (e.g., "block mornings for workout", "prefer afternoons", "30 minute meetings")',
      },
      suggestedTimes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional suggested meeting times to include in the email',
      },
      tone: {
        type: 'string',
        enum: ['formal', 'casual', 'friendly'],
        description: 'Tone of the email',
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
  tone?: 'formal' | 'casual' | 'friendly';
}

export function executeDraftEmail(input: DraftEmailInput): { draft: string; subject: string } {
  const recipientNames = input.recipients.join(', ');
  const lastRecipient = input.recipients[input.recipients.length - 1];
  const otherRecipients = input.recipients.slice(0, -1).join(', ');
  const recipientList = input.recipients.length > 1
    ? `${otherRecipients} and ${lastRecipient}`
    : recipientNames;

  let subject = '';
  let body = '';
  const tone = input.tone || 'friendly';
  const greeting = tone === 'formal' ? 'Dear' : 'Hi';
  const signoff = tone === 'formal' ? 'Best regards' : 'Best';

  switch (input.purpose) {
    case 'schedule_meeting':
      subject = `Meeting Request: Let's Connect`;
      body = `${greeting} ${recipientList},

I hope this email finds you well. I'd like to schedule a meeting with ${input.recipients.length > 1 ? 'each of you' : 'you'} to connect and discuss.

${input.context ? `Note: ${input.context}\n\n` : ''}${input.suggestedTimes?.length ? `Here are some times that work for me:\n${input.suggestedTimes.map(t => `• ${t}`).join('\n')}\n\n` : ''}Please let me know what times work best for your schedule, and I'll send over a calendar invite.

${signoff},
[Your name]`;
      break;

    case 'availability_request':
      subject = `Checking Your Availability`;
      body = `${greeting} ${recipientList},

I'm looking to set up ${input.recipients.length > 1 ? 'meetings with each of you' : 'a meeting'} and wanted to check your availability.

${input.context ? `${input.context}\n\n` : ''}${input.suggestedTimes?.length ? `I have the following times open:\n${input.suggestedTimes.map(t => `• ${t}`).join('\n')}\n\n` : ''}Could you please share a few times that work for you? Once I hear back, I'll send calendar invites.

${signoff},
[Your name]`;
      break;

    case 'reschedule':
      subject = `Request to Reschedule Our Meeting`;
      body = `${greeting} ${recipientList},

I apologize, but I need to reschedule our upcoming meeting. ${input.context ? input.context : ''}

${input.suggestedTimes?.length ? `Would any of these alternative times work?\n${input.suggestedTimes.map(t => `• ${t}`).join('\n')}\n\n` : 'Could you please share some times that would work better for you?\n\n'}I appreciate your flexibility and look forward to connecting soon.

${signoff},
[Your name]`;
      break;

    case 'cancel':
      subject = `Meeting Cancellation`;
      body = `${greeting} ${recipientList},

I regret to inform you that I need to cancel our scheduled meeting. ${input.context ? input.context : ''}

I apologize for any inconvenience this may cause. I'd be happy to reschedule when possible—please let me know if you'd like to find another time.

${signoff},
[Your name]`;
      break;

    case 'follow_up':
      subject = `Following Up on Our Meeting`;
      body = `${greeting} ${recipientList},

Thank you for taking the time to meet with me. ${input.context ? input.context : 'I wanted to follow up on our discussion.'}

Please let me know if you have any questions or if there's anything else I can help with.

${signoff},
[Your name]`;
      break;

    default:
      subject = `Regarding Our Schedule`;
      body = `${greeting} ${recipientList},

${input.context || 'I wanted to reach out regarding our schedules.'}

${input.suggestedTimes?.length ? `Available times:\n${input.suggestedTimes.map(t => `• ${t}`).join('\n')}\n\n` : ''}Please let me know your thoughts.

${signoff},
[Your name]`;
  }

  return { draft: body, subject };
}
