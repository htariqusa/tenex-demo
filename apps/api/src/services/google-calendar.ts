import { google, calendar_v3 } from 'googleapis';
import { getAuthenticatedClient } from './google-auth.js';
import type { CalendarEvent, CreateEvent, UpdateEvent } from '@tenex/shared';

export function getCalendarClient(accessToken: string, refreshToken: string) {
  const auth = getAuthenticatedClient(accessToken, refreshToken);
  return google.calendar({ version: 'v3', auth });
}

function transformEvent(event: calendar_v3.Schema$Event): CalendarEvent {
  return {
    id: event.id!,
    title: event.summary || '(No title)',
    description: event.description || undefined,
    start: event.start?.dateTime || event.start?.date || '',
    end: event.end?.dateTime || event.end?.date || '',
    location: event.location || undefined,
    attendees: event.attendees?.map(a => ({
      email: a.email!,
      name: a.displayName || undefined,
      responseStatus: a.responseStatus as 'accepted' | 'declined' | 'tentative' | 'needsAction' | undefined,
    })),
    isAllDay: !event.start?.dateTime,
    recurringEventId: event.recurringEventId || undefined,
    htmlLink: event.htmlLink || undefined,
  };
}

export async function listEvents(
  accessToken: string,
  refreshToken: string,
  timeMin: string,
  timeMax: string
): Promise<CalendarEvent[]> {
  const calendar = getCalendarClient(accessToken, refreshToken);

  try {
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
    });

    return (response.data.items || []).map(transformEvent);
  } catch (error) {
    console.error('[Calendar] listEvents error:', error);
    throw error;
  }
}

export async function getEvent(
  accessToken: string,
  refreshToken: string,
  eventId: string
): Promise<CalendarEvent | null> {
  const calendar = getCalendarClient(accessToken, refreshToken);

  try {
    const response = await calendar.events.get({
      calendarId: 'primary',
      eventId,
    });
    return transformEvent(response.data);
  } catch {
    return null;
  }
}

interface RecurrenceOptions {
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  until: string;
  daysOfWeek?: string[];
}

interface CreateEventWithRecurrence extends CreateEvent {
  recurrence?: RecurrenceOptions;
}

function buildRecurrenceRule(recurrence: RecurrenceOptions): string[] {
  // Build RRULE format: https://tools.ietf.org/html/rfc5545#section-3.8.5.3
  let rule = `RRULE:FREQ=${recurrence.frequency}`;

  // Add UNTIL date (must be in YYYYMMDD format for all-day or YYYYMMDDTHHMMSSZ for timed)
  const untilDate = recurrence.until.replace(/-/g, '');
  rule += `;UNTIL=${untilDate}`;

  // Add BYDAY for weekly recurrence
  if (recurrence.frequency === 'WEEKLY' && recurrence.daysOfWeek?.length) {
    rule += `;BYDAY=${recurrence.daysOfWeek.join(',')}`;
  }

  return [rule];
}

export async function createEvent(
  accessToken: string,
  refreshToken: string,
  event: CreateEventWithRecurrence
): Promise<CalendarEvent> {
  const calendar = getCalendarClient(accessToken, refreshToken);

  const requestBody: calendar_v3.Schema$Event = {
    summary: event.title,
    description: event.description,
    location: event.location,
    start: {
      dateTime: event.start,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: {
      dateTime: event.end,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    attendees: event.attendees?.map(email => ({ email })),
  };

  // Add recurrence rule if specified
  if (event.recurrence) {
    requestBody.recurrence = buildRecurrenceRule(event.recurrence);
  }

  const response = await calendar.events.insert({
    calendarId: 'primary',
    requestBody,
  });

  return transformEvent(response.data);
}

export async function updateEvent(
  accessToken: string,
  refreshToken: string,
  eventId: string,
  updates: Omit<UpdateEvent, 'eventId'>
): Promise<CalendarEvent> {
  const calendar = getCalendarClient(accessToken, refreshToken);

  const requestBody: calendar_v3.Schema$Event = {};

  if (updates.title) requestBody.summary = updates.title;
  if (updates.description) requestBody.description = updates.description;
  if (updates.location) requestBody.location = updates.location;
  if (updates.start) {
    requestBody.start = {
      dateTime: updates.start,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }
  if (updates.end) {
    requestBody.end = {
      dateTime: updates.end,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }

  const response = await calendar.events.patch({
    calendarId: 'primary',
    eventId,
    requestBody,
  });

  return transformEvent(response.data);
}

export async function deleteEvent(
  accessToken: string,
  refreshToken: string,
  eventId: string
): Promise<void> {
  const calendar = getCalendarClient(accessToken, refreshToken);

  await calendar.events.delete({
    calendarId: 'primary',
    eventId,
  });
}

export async function findFreeSlots(
  accessToken: string,
  refreshToken: string,
  timeMin: string,
  timeMax: string,
  durationMinutes: number
): Promise<{ start: string; end: string }[]> {
  const calendar = getCalendarClient(accessToken, refreshToken);

  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      items: [{ id: 'primary' }],
    },
  });

  const busy = response.data.calendars?.primary?.busy || [];
  const slots: { start: string; end: string }[] = [];

  // Find free slots between busy periods
  let currentTime = new Date(timeMin);
  const endTime = new Date(timeMax);

  for (const period of busy) {
    const busyStart = new Date(period.start!);

    // Check if there's a slot before this busy period
    const gapMinutes = (busyStart.getTime() - currentTime.getTime()) / (1000 * 60);

    if (gapMinutes >= durationMinutes) {
      const slotEnd = new Date(currentTime.getTime() + durationMinutes * 60 * 1000);
      slots.push({
        start: currentTime.toISOString(),
        end: slotEnd.toISOString(),
      });
    }

    currentTime = new Date(period.end!);
  }

  // Check for slot after last busy period
  const finalGap = (endTime.getTime() - currentTime.getTime()) / (1000 * 60);
  if (finalGap >= durationMinutes) {
    const slotEnd = new Date(currentTime.getTime() + durationMinutes * 60 * 1000);
    slots.push({
      start: currentTime.toISOString(),
      end: slotEnd.toISOString(),
    });
  }

  return slots.slice(0, 5); // Return up to 5 slots
}
