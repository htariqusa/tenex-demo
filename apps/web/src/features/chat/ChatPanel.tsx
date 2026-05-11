import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, X, Check, Sparkles } from 'lucide-react';
import { useChat, Message } from './useChat';
import { cn } from '@/lib/utils';
import type { PendingAction } from '@tenex/shared';

const SUGGESTED_PROMPTS = [
  "Draft an email to schedule a meeting with Sarah",
  "Send a reminder about my 2pm meeting today",
  "Cancel my meeting with Dan tomorrow",
  "What does my week look like?",
];

export function ChatPanel() {
  const {
    messages,
    isLoading,
    pendingActions,
    sendMessage,
    confirmAction,
    clearChat,
  } = useChat();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage(input);
      setInput('');
    }
  };

  const handleSuggestedPrompt = (prompt: string) => {
    sendMessage(prompt);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Assistant</h2>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear chat
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <EmptyState onPromptClick={handleSuggestedPrompt} />
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}

        {/* Pending actions */}
        {pendingActions.map((action) => (
          <PendingActionCard
            key={action.id}
            action={action}
            onConfirm={() => confirmAction(action.id, true)}
            onCancel={() => confirmAction(action.id, false)}
          />
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t p-4">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your calendar..."
            className="flex-1 rounded-lg border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

function EmptyState({ onPromptClick }: { onPromptClick: (prompt: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <Sparkles className="h-12 w-12 text-primary/50" />
      <h3 className="mt-4 font-semibold">How can I help?</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Ask me about your schedule or to find time for meetings
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => onPromptClick(prompt)}
            className="rounded-full border bg-white px-3 py-1.5 text-xs hover:bg-muted"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-2',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground'
        )}
      >
        {/* Tool calls indicator */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mb-2 space-y-1">
            {message.toolCalls.map((tool) => (
              <div
                key={tool.id}
                className="flex items-center gap-2 text-xs opacity-70"
              >
                {tool.status === 'running' ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                <span>{formatToolName(tool.name)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Message content */}
        <div className="whitespace-pre-wrap text-sm">
          {message.content}
          {message.isStreaming && (
            <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-current" />
          )}
        </div>
      </div>
    </div>
  );
}

function PendingActionCard({
  action,
  onConfirm,
  onCancel,
}: {
  action: PendingAction;
  onConfirm: () => Promise<unknown>;
  onCancel: () => Promise<unknown>;
}) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm();
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      await onCancel();
    } finally {
      setIsCancelling(false);
    }
  };

  const isBatchCreate = action.type === 'create_events';
  const isDelete = action.type === 'delete_event';
  const events = isBatchCreate
    ? (action.payload as { events: Array<{ title: string; start: string; end: string; attendees?: string[] }> }).events
    : null;

  return (
    <div className="rounded-lg border border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-violet-100 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-violet-600" />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-violet-900">
            {isDelete ? 'Cancel Calendar Event?' : isBatchCreate ? `Create ${events?.length} Calendar Events?` : 'Create Calendar Event?'}
          </h4>

          {isBatchCreate && events ? (
            <div className="mt-3 space-y-2">
              {events.map((event, idx) => (
                <div key={idx} className="p-3 rounded-md bg-white/50 border border-violet-100">
                  <div className="grid gap-1 text-sm">
                    <div className="flex gap-2">
                      <span className="text-violet-500 font-medium">#{idx + 1}</span>
                      <span className="text-slate-700 font-medium">{event.title}</span>
                    </div>
                    <div className="flex gap-2 ml-5">
                      <span className="text-violet-500 font-medium">When:</span>
                      <span className="text-slate-700">{formatEventTime(event.start, event.end)}</span>
                    </div>
                    {event.attendees?.length ? (
                      <div className="flex gap-2 ml-5">
                        <span className="text-violet-500 font-medium">With:</span>
                        <span className="text-slate-700">{event.attendees.join(', ')}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <p className="mt-1 text-sm text-violet-700">{action.description}</p>
              {action.payload && (
                <div className="mt-3 p-3 rounded-md bg-white/50 border border-violet-100">
                  <div className="grid gap-1 text-sm">
                    {(action.payload as { title?: string }).title && (
                      <div className="flex gap-2">
                        <span className="text-violet-500 font-medium">Title:</span>
                        <span className="text-slate-700">{(action.payload as { title: string }).title}</span>
                      </div>
                    )}
                    {(action.payload as { start?: string }).start && (
                      <div className="flex gap-2">
                        <span className="text-violet-500 font-medium">When:</span>
                        <span className="text-slate-700">
                          {formatEventTime((action.payload as { start: string; end: string }).start, (action.payload as { start: string; end: string }).end)}
                        </span>
                      </div>
                    )}
                    {(action.payload as { recurrence?: { frequency: string; until: string; daysOfWeek?: string[] } }).recurrence && (
                      <div className="flex gap-2">
                        <span className="text-violet-500 font-medium">Repeats:</span>
                        <span className="text-slate-700">
                          {formatRecurrence((action.payload as { recurrence: { frequency: string; until: string; daysOfWeek?: string[] } }).recurrence)}
                        </span>
                      </div>
                    )}
                    {(action.payload as { location?: string }).location && (
                      <div className="flex gap-2">
                        <span className="text-violet-500 font-medium">Location:</span>
                        <span className="text-slate-700">{(action.payload as { location: string }).location}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="mt-4 flex gap-2 ml-13">
        <button
          onClick={handleConfirm}
          disabled={isConfirming || isCancelling}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 transition",
            isDelete ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"
          )}
        >
          {isConfirming ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {isDelete ? 'Canceling...' : 'Creating...'}
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              {isDelete ? 'Yes, Cancel It' : isBatchCreate ? `Create ${events?.length} Events` : 'Create Event'}
            </>
          )}
        </button>
        <button
          onClick={handleCancel}
          disabled={isConfirming || isCancelling}
          className="flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50 transition"
        >
          {isCancelling ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <X className="h-4 w-4" />
          )}
          Cancel
        </button>
      </div>
    </div>
  );
}

function formatToolName(name: string): string {
  return name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatRecurrence(recurrence: { frequency: string; until: string; daysOfWeek?: string[] }): string {
  const dayNames: Record<string, string> = {
    MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat', SU: 'Sun'
  };

  const freq = recurrence.frequency.toLowerCase();
  let untilStr = recurrence.until;
  try {
    untilStr = new Date(recurrence.until).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    // Keep original
  }

  if (recurrence.frequency === 'WEEKLY' && recurrence.daysOfWeek?.length) {
    const days = recurrence.daysOfWeek.map(d => dayNames[d] || d).join(', ');
    return `Weekly on ${days} until ${untilStr}`;
  }

  return `${freq.charAt(0).toUpperCase() + freq.slice(1)} until ${untilStr}`;
}

function formatEventTime(start: string, end: string): string {
  try {
    const startDate = new Date(start);
    const endDate = new Date(end);

    // Check if dates are valid
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return `${start} - ${end}`;
    }

    const dateStr = startDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    const startTime = startDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
    const endTime = endDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });

    return `${dateStr}, ${startTime} - ${endTime}`;
  } catch {
    return `${start} - ${end}`;
  }
}
