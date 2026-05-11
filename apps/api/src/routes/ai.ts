import { Router } from 'express';
import Groq from 'groq-sdk';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';

export const aiRouter = Router();

aiRouter.use(requireAuth);

// Lazy init Groq client
let groq: Groq | null = null;
function getGroqClient(): Groq {
  if (!groq) {
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groq;
}

interface DraftMessageRequest {
  meetingTitle: string;
  meetingType: string;
  attendees: Array<{ email: string; name?: string }>;
  messageType: 'agenda' | 'intro' | 'followup' | 'reschedule' | 'cancel';
  additionalContext?: string;
}

// Draft a message for a meeting
aiRouter.post('/draft-message', async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const body = req.body as DraftMessageRequest;

    if (!body.meetingTitle || !body.messageType) {
      throw new AppError(400, 'Meeting title and message type are required', 'INVALID_REQUEST');
    }

    const attendeeNames = body.attendees
      ?.map(a => a.name || a.email.split('@')[0])
      .join(', ') || 'attendees';

    const prompts: Record<string, string> = {
      agenda: `Write a brief, professional meeting agenda email for "${body.meetingTitle}".
Include 3-4 agenda items based on the meeting title. Keep it concise and actionable.
Address it to: ${attendeeNames}
${body.additionalContext ? `Additional context: ${body.additionalContext}` : ''}`,

      intro: `Write a brief, professional introduction email for a meeting titled "${body.meetingTitle}".
Introduce the purpose of the meeting and what you hope to accomplish.
Address it to: ${attendeeNames}
${body.additionalContext ? `Additional context: ${body.additionalContext}` : ''}`,

      followup: `Write a brief, professional follow-up email after a meeting titled "${body.meetingTitle}".
Thank attendees, summarize key discussion points (use placeholders), and list action items.
Address it to: ${attendeeNames}
${body.additionalContext ? `Additional context: ${body.additionalContext}` : ''}`,

      reschedule: `Write a brief, professional email to reschedule a meeting titled "${body.meetingTitle}".
Apologize for the inconvenience and ask for availability.
Address it to: ${attendeeNames}
${body.additionalContext ? `Additional context: ${body.additionalContext}` : ''}`,

      cancel: `Write a brief, professional email to cancel a meeting titled "${body.meetingTitle}".
Apologize and offer to reschedule if appropriate.
Address it to: ${attendeeNames}
${body.additionalContext ? `Additional context: ${body.additionalContext}` : ''}`,
    };

    const prompt = prompts[body.messageType];
    if (!prompt) {
      throw new AppError(400, 'Invalid message type', 'INVALID_MESSAGE_TYPE');
    }

    const completion = await getGroqClient().chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content: `You are a professional email writer. Write concise, clear emails.
Do not include subject lines - just the body.
Use a friendly but professional tone.
Keep emails under 150 words.
Sign off with just the user's first name: ${authReq.session.email.split('@')[0]}`,
        },
        { role: 'user', content: prompt },
      ],
    });

    const draft = completion.choices[0]?.message?.content || '';

    // Generate a suggested subject line
    const subjectCompletion = await getGroqClient().chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      max_tokens: 50,
      messages: [
        {
          role: 'system',
          content: 'Generate a short, professional email subject line. Just the subject, nothing else.',
        },
        {
          role: 'user',
          content: `Meeting: ${body.meetingTitle}, Type: ${body.messageType}`,
        },
      ],
    });

    const subject = subjectCompletion.choices[0]?.message?.content?.trim() || body.meetingTitle;

    res.json({
      draft,
      subject,
      messageType: body.messageType,
    });
  } catch (error) {
    console.error('[AI Draft Error]', error);
    next(error);
  }
});
