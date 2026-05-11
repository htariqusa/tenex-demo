# Tenex - AI Calendar Assistant

A calendar assistant that connects to Google Calendar and uses AI to help manage your schedule through natural language.

## Features

- **Google Calendar Integration** - View your calendar in a clean week view
- **AI-Powered Chat** - Ask questions about your schedule, find free time, analyze meeting load
- **Smart Scheduling** - Find available slots and create events with natural language
- **Confirmation Flow** - All mutations require explicit user confirmation
- **Meeting Analytics** - Visualize meeting patterns, focus time, and busiest days
- **AI Draft Messages** - Generate agenda, follow-up, and reschedule emails for meetings

## Architecture

```
apps/
  api/         Express backend (Node.js, TypeScript)
  web/         React frontend (Vite, TypeScript, Tailwind CSS)
packages/
  shared/      Shared types and Zod schemas
```

```
React SPA  <-->  Express API  <-->  Google Calendar API
  (Vite)          (Node.js)         Claude API (tool_use)
                                    Groq API (message drafts)
```

**Key design decisions:**
- OAuth tokens stored server-side only (encrypted with AES-256-GCM)
- Session managed via httpOnly cookies
- SSE for streaming chat responses
- Tool-use pattern for calendar operations

## Quick Start (Local)

```bash
# Install dependencies
pnpm install

# Copy environment file and fill in values
cp .env.example .env

# Start development servers (API + Web)
pnpm dev
```

The app will be running at:
- **Web:** http://localhost:5173
- **API:** http://localhost:3001

## Environment Variables

See `.env.example` for all required variables:

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 client secret |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |
| `GROQ_API_KEY` | Groq API key for message drafts |
| `SESSION_SECRET` | 32+ character secret for token encryption |
| `PORT` | API server port (default: 3001) |
| `CLIENT_URL` | Frontend URL (default: http://localhost:5173) |

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable the **Google Calendar API**
4. Configure OAuth consent screen (External, add your email as test user)
5. Create OAuth credentials (Web application)
   - Local redirect URI: `http://localhost:3001/api/auth/callback`
   - Vercel redirect URI: `https://your-domain.vercel.app/api/auth/callback`
6. Copy Client ID and Client Secret to your `.env`

## Deploy to Vercel

The app is configured to deploy both frontend and API as a single Vercel project.

1. Connect your repo to [Vercel](https://vercel.com)
2. Set all environment variables in the Vercel dashboard:
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI` = `https://your-domain.vercel.app/api/auth/callback`
   - `ANTHROPIC_API_KEY`, `GROQ_API_KEY`
   - `SESSION_SECRET`
   - `CLIENT_URL` = `https://your-domain.vercel.app`
3. Deploy

> **Note:** Sessions are in-memory on Vercel serverless. They reset on cold starts, requiring users to re-authenticate. For persistent sessions, swap in Vercel KV or a hosted database.

## Agent Tools

The Claude agent has access to these tools:

| Tool | Description |
|------|-------------|
| `list_events` | List calendar events in a date range |
| `find_free_slots` | Find available time slots |
| `create_event` | Schedule a new event (requires confirmation) |
| `analyze_calendar` | Analyze meeting load and patterns |

## Tech Stack

- **Frontend:** React 18, Vite, TypeScript, TanStack Query, Tailwind CSS, Recharts
- **Backend:** Node.js, Express, TypeScript, googleapis
- **AI:** Claude (tool_use for calendar ops), Groq/Llama (message drafts)
- **Deployment:** Vercel (frontend + serverless API)
