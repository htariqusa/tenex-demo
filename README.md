# Tenex - AI Calendar Assistant

A calendar assistant that connects to Google Calendar and uses AI to help manage your schedule through natural language.

## Live Demo

A hosted version is deployed on Vercel. Access is restricted to authorized users only — contact the maintainers of this repo to request access.

## Features

- **Google Calendar Integration** - View your calendar in a clean week view
- **AI-Powered Chat** - Ask questions about your schedule, find free time, analyze meeting load
- **Smart Scheduling** - Find available slots and create events with natural language
- **Confirmation Flow** - All mutations require explicit user confirmation
- **Meeting Analytics** - Visualize meeting patterns, focus time, and busiest days
- **AI Draft Messages** - Generate agenda, follow-up, and reschedule emails for meetings

## Running Locally

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/) (v9+)
- A Google Cloud project with OAuth credentials (see below)
- An [Anthropic API key](https://console.anthropic.com/) (for Claude AI chat)
- A [Groq API key](https://console.groq.com/) (for AI-drafted meeting messages)

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/htariqusa/tenex-demo.git
cd tenex-demo

# 2. Install dependencies
pnpm install

# 3. Copy the example env file
cp .env.example .env

# 4. Fill in your API keys and secrets in .env (see below)

# 5. Start development servers (API + Web)
pnpm dev
```

The app will be running at:
- **Web:** http://localhost:5173
- **API:** http://localhost:3001

### Environment Variables

Fill in all values in your `.env` file:

| Variable | Description | Where to get it |
|----------|-------------|-----------------|
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 client ID | Google Cloud Console (see below) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 client secret | Google Cloud Console (see below) |
| `GOOGLE_REDIRECT_URI` | Set to `http://localhost:3001/api/auth/callback` for local | - |
| `ANTHROPIC_API_KEY` | API key for Claude AI | [console.anthropic.com](https://console.anthropic.com/) |
| `GROQ_API_KEY` | API key for Groq (Llama models) | [console.groq.com](https://console.groq.com/) |
| `SESSION_SECRET` | 32+ character random string | Generate with `openssl rand -base64 32` |
| `PORT` | API server port (default: `3001`) | - |
| `CLIENT_URL` | Frontend URL (default: `http://localhost:5173`) | - |

### Google OAuth Setup

You need your own Google Cloud project to run this app. Google OAuth controls who can log in — you must add authorized test users in your project's consent screen.

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable the **Google Calendar API**:
   - Go to APIs & Services > Library
   - Search "Google Calendar API" and enable it
4. Configure the OAuth consent screen:
   - Go to APIs & Services > OAuth consent screen
   - User type: **External**
   - Add your app name and contact email
   - Under **Test users**, add the Google accounts that should have access
   - Only users listed here can log in while the app is in "Testing" status
5. Create OAuth credentials:
   - Go to APIs & Services > Credentials > Create Credentials > OAuth client ID
   - Application type: **Web application**
   - Authorized redirect URIs: `http://localhost:3001/api/auth/callback`
6. Copy the **Client ID** and **Client Secret** into your `.env`

### Groq API Setup

Groq is used for drafting meeting messages (agenda, follow-up, reschedule, etc.).

1. Go to [console.groq.com](https://console.groq.com/)
2. Create an account and generate an API key
3. Copy the key into `GROQ_API_KEY` in your `.env`

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
