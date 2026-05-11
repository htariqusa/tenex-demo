import { useState, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import type { ChatStreamEvent, PendingAction } from '@tenex/shared';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  toolCalls?: Array<{
    id: string;
    name: string;
    status: 'running' | 'done' | 'error';
    result?: unknown;
  }>;
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
    };

    // Add placeholder assistant message
    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      isStreaming: true,
      toolCalls: [],
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setIsLoading(true);

    abortControllerRef.current = api.streamChat(
      content,
      (event: ChatStreamEvent) => {
        setMessages((prev) => {
          const lastIdx = prev.length - 1;
          const lastMessage = prev[lastIdx];

          if (lastMessage?.role !== 'assistant') return prev;

          const updated = { ...lastMessage };

          switch (event.type) {
            case 'text':
              updated.content = updated.content + event.content;
              break;

            case 'tool_start':
              updated.toolCalls = [
                ...(updated.toolCalls || []),
                { id: event.toolId, name: event.toolName, status: 'running' as const },
              ];
              break;

            case 'tool_end':
              if (updated.toolCalls) {
                updated.toolCalls = updated.toolCalls.map((t) =>
                  t.id === event.toolId ? { ...t, status: 'done' as const, result: event.result } : t
                );
              }
              break;

            case 'pending_action':
              // Deduplicate pending actions by ID
              setPendingActions((p) => {
                if (p.some(a => a.id === event.action.id)) return p;
                return [...p, event.action];
              });
              return prev; // Don't update messages for this event

            case 'done':
              updated.isStreaming = false;
              setIsLoading(false);
              break;

            case 'error':
              updated.content = updated.content + `\n\nError: ${event.message}`;
              updated.isStreaming = false;
              setIsLoading(false);
              break;
          }

          return [...prev.slice(0, lastIdx), updated];
        });
      },
      (error) => {
        setMessages((prev) => {
          const lastIdx = prev.length - 1;
          const lastMessage = prev[lastIdx];
          if (lastMessage?.role === 'assistant') {
            return [
              ...prev.slice(0, lastIdx),
              { ...lastMessage, content: `Error: ${error.message}`, isStreaming: false },
            ];
          }
          return prev;
        });
        setIsLoading(false);
      }
    );
  }, [isLoading]);

  const confirmAction = useCallback(async (actionId: string, confirm: boolean) => {
    const result = await api.confirmAction(actionId, confirm);

    // Remove the pending action
    setPendingActions((prev) => prev.filter((a) => a.id !== actionId));

    // Add a system message showing the result
    if (confirm && result.success) {
      const successMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '✓ Event created successfully! Your calendar has been updated.',
      };
      setMessages((prev) => [...prev, successMessage]);
    } else if (!confirm) {
      const cancelMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Event creation cancelled.',
      };
      setMessages((prev) => [...prev, cancelMessage]);
    }

    return result;
  }, []);

  const cancelStream = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
    setMessages((prev) => {
      const newMessages = [...prev];
      const lastMessage = newMessages[newMessages.length - 1];
      if (lastMessage?.role === 'assistant' && lastMessage.isStreaming) {
        lastMessage.isStreaming = false;
        lastMessage.content += '\n\n(Cancelled)';
      }
      return newMessages;
    });
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    setPendingActions([]);
  }, []);

  return {
    messages,
    isLoading,
    pendingActions,
    sendMessage,
    confirmAction,
    cancelStream,
    clearChat,
  };
}
