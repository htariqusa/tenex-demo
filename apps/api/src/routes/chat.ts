import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { runAgentStream } from '../services/agent.js';
import { executePendingAction, deletePendingAction } from '../services/pending-actions.js';
import { ChatRequestSchema } from '@tenex/shared';
import { AppError } from '../middleware/error.js';
import { randomUUID } from 'crypto';

export const chatRouter = Router();

chatRouter.use(requireAuth);

// SSE endpoint for streaming chat
chatRouter.post('/stream', async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const body = ChatRequestSchema.safeParse(req.body);

    if (!body.success) {
      throw new AppError(400, 'Invalid message', 'INVALID_MESSAGE');
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    const sendEvent = (event: unknown) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    const messageId = randomUUID();

    try {
      const { pendingActions } = await runAgentStream({
        message: body.data.message,
        conversationHistory: [], // TODO: Load from session/db for multi-turn
        toolContext: {
          accessToken: authReq.session.accessToken,
          refreshToken: authReq.session.refreshToken,
        },
        onEvent: sendEvent,
      });

      // Send done event
      sendEvent({ type: 'done', messageId, pendingActions });
    } catch (error) {
      console.error('[Chat Error]', error);
      sendEvent({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    res.end();
  } catch (error) {
    next(error);
  }
});

// Confirm pending action
chatRouter.post('/confirm/:actionId', async (req, res, next) => {
  try {
    const { actionId } = req.params;
    const { confirm } = req.body;

    if (typeof confirm !== 'boolean') {
      throw new AppError(400, 'Must specify confirm: true or false', 'INVALID_CONFIRM');
    }

    if (!confirm) {
      // User declined - just delete the pending action
      deletePendingAction(actionId);
      res.json({
        success: true,
        actionId,
        confirmed: false,
        message: 'Action cancelled',
      });
      return;
    }

    // User confirmed - execute the pending action
    const result = await executePendingAction(actionId);

    if (!result.success) {
      throw new AppError(400, result.error || 'Failed to execute action', 'EXECUTION_FAILED');
    }

    res.json({
      success: true,
      actionId,
      confirmed: true,
      message: 'Event created successfully',
      result: result.result,
    });
  } catch (error) {
    next(error);
  }
});
