import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { listEvents, getEvent, createEvent, updateEvent, deleteEvent } from '../services/google-calendar.js';
import { CalendarQuerySchema, CreateEventSchema, UpdateEventSchema } from '@tenex/shared';
import { AppError } from '../middleware/error.js';

export const calendarRouter = Router();

// All calendar routes require auth
calendarRouter.use(requireAuth);

// List events
calendarRouter.get('/', async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const query = CalendarQuerySchema.safeParse(req.query);

    if (!query.success) {
      throw new AppError(400, 'Invalid query parameters', 'INVALID_QUERY');
    }

    const events = await listEvents(
      authReq.session.accessToken,
      authReq.session.refreshToken,
      query.data.start,
      query.data.end
    );

    res.json({ events });
  } catch (error) {
    next(error);
  }
});

// Analytics endpoint - MUST be before /:eventId to avoid path conflict
calendarRouter.get('/analytics', async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const query = CalendarQuerySchema.safeParse(req.query);

    if (!query.success) {
      throw new AppError(400, 'Invalid query parameters', 'INVALID_QUERY');
    }

    const events = await listEvents(
      authReq.session.accessToken,
      authReq.session.refreshToken,
      query.data.start,
      query.data.end
    );

    // Calculate comprehensive analytics
    let totalMeetingMinutes = 0;
    const eventsByDay: Record<string, { count: number; minutes: number }> = {};
    const eventsByHour: Record<number, number> = {};
    const recurringEvents: string[] = [];
    const oneOnOnes: string[] = [];
    const groupMeetings: string[] = [];
    const externalMeetings: string[] = [];

    for (const event of events) {
      if (event.isAllDay) continue;

      const start = new Date(event.start);
      const end = new Date(event.end);
      const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);

      totalMeetingMinutes += durationMinutes;

      // By day
      const dayKey = start.toISOString().split('T')[0] ?? '';
      if (dayKey) {
        if (!eventsByDay[dayKey]) {
          eventsByDay[dayKey] = { count: 0, minutes: 0 };
        }
        eventsByDay[dayKey].count += 1;
        eventsByDay[dayKey].minutes += durationMinutes;
      }

      // By hour
      const hour = start.getHours();
      eventsByHour[hour] = (eventsByHour[hour] || 0) + 1;

      // Categorize
      if (event.recurringEventId) {
        recurringEvents.push(event.title);
      }

      const attendeeCount = event.attendees?.length || 0;
      if (attendeeCount === 2) {
        oneOnOnes.push(event.title);
      } else if (attendeeCount > 2) {
        groupMeetings.push(event.title);
      }

      // Check for external attendees (different domain)
      const hasExternal = event.attendees?.some(a =>
        !a.email.endsWith('@gmail.com') && !a.email.includes(authReq.session.email.split('@')[1] || '')
      );
      if (hasExternal) {
        externalMeetings.push(event.title);
      }
    }

    // Calculate daily breakdown for chart
    const dailyData = Object.entries(eventsByDay).map(([date, data]) => ({
      date,
      dayName: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
      meetings: data.count,
      hours: Math.round(data.minutes / 60 * 10) / 10,
    })).sort((a, b) => a.date.localeCompare(b.date));

    // Calculate hourly distribution for chart
    const hourlyData = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      label: `${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}${hour < 12 ? 'am' : 'pm'}`,
      count: eventsByHour[hour] || 0,
    })).filter(h => h.hour >= 8 && h.hour <= 20); // Business hours only

    // Find busiest day
    const busiestDay = dailyData.reduce((max, day) =>
      day.hours > (max?.hours || 0) ? day : max, dailyData[0]);

    // Find peak hours
    const peakHour = hourlyData.reduce((max, h) =>
      h.count > (max?.count || 0) ? h : max, hourlyData[0]);

    const totalHours = Math.round(totalMeetingMinutes / 60 * 10) / 10;
    const days = Object.keys(eventsByDay).length || 1;
    const avgHoursPerDay = Math.round(totalHours / days * 10) / 10;

    // Calculate focus time (assuming 8 work hours per day)
    const workHoursPerDay = 8;
    const totalWorkHours = days * workHoursPerDay;
    const focusTimePercent = Math.round((1 - totalHours / totalWorkHours) * 100);

    // Generate AI insights
    const insights: string[] = [];
    if (avgHoursPerDay > 5) {
      insights.push(`You're averaging ${avgHoursPerDay} hours of meetings per day - consider blocking focus time.`);
    }
    if (oneOnOnes.length > groupMeetings.length && events.length > 0) {
      insights.push(`${Math.round(oneOnOnes.length / events.length * 100)}% of your meetings are 1:1s - good for relationship building.`);
    }
    if (busiestDay && busiestDay.hours > 6) {
      insights.push(`${busiestDay.dayName} is your busiest day with ${busiestDay.hours} hours of meetings.`);
    }
    if (recurringEvents.length > events.length * 0.5 && events.length > 0) {
      insights.push(`${Math.round(recurringEvents.length / events.length * 100)}% of meetings are recurring - audit which are still valuable.`);
    }
    if (insights.length === 0) {
      insights.push('Your calendar looks well-balanced this period.');
    }

    res.json({
      summary: {
        totalMeetings: events.length,
        totalHours,
        avgHoursPerDay,
        focusTimePercent: Math.max(0, focusTimePercent),
        recurringCount: recurringEvents.length,
        oneOnOneCount: oneOnOnes.length,
        groupMeetingCount: groupMeetings.length,
        externalMeetingCount: externalMeetings.length,
      },
      busiestDay: busiestDay ? {
        date: busiestDay.date,
        dayName: busiestDay.dayName,
        hours: busiestDay.hours
      } : null,
      peakHour: peakHour ? {
        hour: peakHour.hour,
        label: peakHour.label,
        count: peakHour.count
      } : null,
      dailyData,
      hourlyData,
      meetingTypes: {
        oneOnOne: oneOnOnes.length,
        group: groupMeetings.length,
        external: externalMeetings.length,
        recurring: recurringEvents.length,
      },
      insights,
    });
  } catch (error) {
    next(error);
  }
});

// Get single event
calendarRouter.get('/:eventId', async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthenticatedRequest;
    const { eventId } = req.params;

    const event = await getEvent(
      authReq.session.accessToken,
      authReq.session.refreshToken,
      eventId
    );

    if (!event) {
      throw new AppError(404, 'Event not found', 'NOT_FOUND');
    }

    res.json({ event });
  } catch (error) {
    next(error);
  }
});

// Create event
calendarRouter.post('/', async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const body = CreateEventSchema.safeParse(req.body);

    if (!body.success) {
      throw new AppError(400, 'Invalid event data', 'INVALID_DATA');
    }

    const event = await createEvent(
      authReq.session.accessToken,
      authReq.session.refreshToken,
      body.data
    );

    res.status(201).json({ event });
  } catch (error) {
    next(error);
  }
});

// Update event
calendarRouter.patch('/:eventId', async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthenticatedRequest;
    const { eventId } = req.params;
    const body = UpdateEventSchema.omit({ eventId: true }).safeParse(req.body);

    if (!body.success) {
      throw new AppError(400, 'Invalid update data', 'INVALID_DATA');
    }

    const event = await updateEvent(
      authReq.session.accessToken,
      authReq.session.refreshToken,
      eventId,
      body.data
    );

    res.json({ event });
  } catch (error) {
    next(error);
  }
});

// Delete event
calendarRouter.delete('/:eventId', async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthenticatedRequest;
    const { eventId } = req.params;

    await deleteEvent(
      authReq.session.accessToken,
      authReq.session.refreshToken,
      eventId
    );

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Send message to meeting attendees (updates description and sends notification)
calendarRouter.post('/:eventId/send-message', async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthenticatedRequest;
    const { eventId } = req.params;
    const { message, subject } = req.body;

    if (!message) {
      throw new AppError(400, 'Message is required', 'INVALID_DATA');
    }

    // Update the event description with the message and trigger notification
    const event = await updateEvent(
      authReq.session.accessToken,
      authReq.session.refreshToken,
      eventId,
      {
        description: message,
      }
    );

    res.json({
      success: true,
      event,
      message: 'Message sent to all attendees',
    });
  } catch (error) {
    next(error);
  }
});
