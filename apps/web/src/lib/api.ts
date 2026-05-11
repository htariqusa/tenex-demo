const API_BASE = import.meta.env.VITE_API_URL || '/api';

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      data.error?.message || 'Request failed',
      data.error?.code
    );
  }
  return response.json();
}

export const api = {
  // Auth
  async getMe() {
    const res = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });
    return handleResponse<{ user: { id: string; email: string; name?: string; picture?: string } | null }>(res);
  },

  async logout() {
    const res = await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    return handleResponse<{ success: boolean }>(res);
  },

  getLoginUrl() {
    return `${API_BASE}/auth/login`;
  },

  // Calendar
  async getEvents(start: string, end: string) {
    const params = new URLSearchParams({ start, end });
    const res = await fetch(`${API_BASE}/calendar?${params}`, { credentials: 'include' });
    return handleResponse<{ events: import('@tenex/shared').CalendarEvent[] }>(res);
  },

  // Chat - SSE stream
  streamChat(
    message: string,
    onEvent: (event: import('@tenex/shared').ChatStreamEvent) => void,
    onError: (error: Error) => void
  ): AbortController {
    const controller = new AbortController();

    fetch(`${API_BASE}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
      credentials: 'include',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new ApiError(response.status, data.error?.message || 'Chat failed');
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.slice(6));
                onEvent(event);
              } catch {
                // Skip malformed events
              }
            }
          }
        }
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          onError(error);
        }
      });

    return controller;
  },

  async confirmAction(actionId: string, confirm: boolean) {
    const res = await fetch(`${API_BASE}/chat/confirm/${actionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm }),
      credentials: 'include',
    });
    return handleResponse<{ success: boolean }>(res);
  },

  // Analytics
  async getAnalytics(start: string, end: string) {
    const params = new URLSearchParams({ start, end });
    const res = await fetch(`${API_BASE}/calendar/analytics?${params}`, { credentials: 'include' });
    return handleResponse<{
      summary: {
        totalMeetings: number;
        totalHours: number;
        avgHoursPerDay: number;
        focusTimePercent: number;
        recurringCount: number;
        oneOnOneCount: number;
        groupMeetingCount: number;
        externalMeetingCount: number;
      };
      busiestDay: { date: string; dayName: string; hours: number } | null;
      peakHour: { hour: number; label: string; count: number } | null;
      dailyData: Array<{ date: string; dayName: string; meetings: number; hours: number }>;
      hourlyData: Array<{ hour: number; label: string; count: number }>;
      meetingTypes: { oneOnOne: number; group: number; external: number; recurring: number };
      insights: string[];
    }>(res);
  },

  // AI Draft Message
  async draftMessage(data: {
    meetingTitle: string;
    meetingType: string;
    attendees: Array<{ email: string; name?: string }>;
    messageType: 'agenda' | 'intro' | 'followup' | 'reschedule' | 'cancel';
    additionalContext?: string;
  }) {
    const res = await fetch(`${API_BASE}/ai/draft-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include',
    });
    return handleResponse<{ draft: string; subject: string; messageType: string }>(res);
  },

  // Send message to meeting attendees
  async sendMeetingMessage(eventId: string, message: string, subject?: string) {
    const res = await fetch(`${API_BASE}/calendar/${eventId}/send-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, subject }),
      credentials: 'include',
    });
    return handleResponse<{ success: boolean; event: import('@tenex/shared').CalendarEvent; message: string }>(res);
  },
};
