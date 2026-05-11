import {
  Calendar,
  Sparkles,
  MessageSquare,
  BarChart3,
  Zap,
  Clock,
  ArrowRight,
  Bot,
  Wrench,
  Brain,
} from 'lucide-react';
import { api } from '@/lib/api';

export function LoginPage() {
  const handleLogin = () => {
    window.location.href = api.getLoginUrl();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-auto">
      {/* Hero Section */}
      <div className="relative">
        {/* Background gradient orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/30 rounded-full blur-3xl" />
        <div className="absolute top-20 right-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />

        <div className="relative max-w-6xl mx-auto px-6 pt-12 pb-20">
          {/* Nav */}
          <nav className="flex items-center justify-between mb-16">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Zap className="h-5 w-5" />
              </div>
              <span className="text-xl font-bold">Tempo</span>
            </div>
            <button
              onClick={handleLogin}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition text-sm font-medium"
            >
              Sign in
              <ArrowRight className="h-4 w-4" />
            </button>
          </nav>

          {/* Hero Content */}
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300 text-sm mb-6">
              <Bot className="h-4 w-4" />
              Powered by Agentic AI
            </div>

            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white via-white to-slate-400 bg-clip-text text-transparent">
              Your Calendar,
              <br />
              <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text">
                Orchestrated by AI
              </span>
            </h1>

            <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
              Tempo is an AI agent that doesn't just answer questions—it takes action.
              Schedule meetings, analyze your time, and draft communications,
              all through natural conversation.
            </p>

            <button
              onClick={handleLogin}
              className="inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 transition text-lg font-semibold shadow-lg shadow-violet-500/25"
            >
              <GoogleIcon />
              Connect Google Calendar
            </button>

            <p className="mt-4 text-sm text-slate-500">
              Secure OAuth 2.0 authentication • Your data stays private
            </p>
          </div>
        </div>
      </div>

      {/* Architecture Section */}
      <div className="relative py-20 border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Agentic AI Architecture</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Unlike traditional chatbots that only respond, Tempo uses an autonomous
              reasoning loop to understand, act, and iterate until your task is complete.
            </p>
          </div>

          {/* Architecture Diagram */}
          <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-8 mb-12">
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
              {/* User Intent */}
              <div className="flex flex-col items-center">
                <div className="h-16 w-16 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center mb-2">
                  <MessageSquare className="h-8 w-8 text-blue-400" />
                </div>
                <span className="text-sm font-medium">Your Request</span>
                <span className="text-xs text-slate-500">Natural language</span>
              </div>

              <ArrowRight className="h-6 w-6 text-slate-600 rotate-90 md:rotate-0" />

              {/* Reasoning Loop */}
              <div className="flex flex-col items-center">
                <div className="relative">
                  <div className="h-24 w-24 rounded-full border-2 border-dashed border-violet-500/50 flex items-center justify-center animate-spin-slow">
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-violet-500" />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Brain className="h-10 w-10 text-violet-400" />
                  </div>
                </div>
                <span className="text-sm font-medium mt-2">Agent Loop</span>
                <span className="text-xs text-slate-500">Reason → Act → Observe</span>
              </div>

              <ArrowRight className="h-6 w-6 text-slate-600 rotate-90 md:rotate-0" />

              {/* Tools */}
              <div className="flex flex-col items-center">
                <div className="h-16 w-16 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center mb-2">
                  <Wrench className="h-8 w-8 text-green-400" />
                </div>
                <span className="text-sm font-medium">Tools</span>
                <span className="text-xs text-slate-500">Calendar APIs</span>
              </div>

              <ArrowRight className="h-6 w-6 text-slate-600 rotate-90 md:rotate-0" />

              {/* Result */}
              <div className="flex flex-col items-center">
                <div className="h-16 w-16 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mb-2">
                  <Sparkles className="h-8 w-8 text-amber-400" />
                </div>
                <span className="text-sm font-medium">Action Taken</span>
                <span className="text-xs text-slate-500">Real results</span>
              </div>
            </div>

            {/* Tools List */}
            <div className="mt-8 pt-8 border-t border-slate-700">
              <p className="text-center text-sm text-slate-400 mb-4">Available Tools</p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  'list_events',
                  'find_free_slots',
                  'analyze_calendar',
                  'create_event',
                  'update_event',
                  'delete_event',
                  'draft_message',
                ].map((tool) => (
                  <span
                    key={tool}
                    className="px-3 py-1 rounded-full bg-slate-700 text-slate-300 text-xs font-mono"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="py-20 border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">What Tempo Can Do</h2>
            <p className="text-slate-400">
              Real actions, not just answers
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={<MessageSquare className="h-6 w-6" />}
              title="Natural Language Control"
              description="'Schedule a meeting with Joe next week avoiding mornings' — and it happens."
              gradient="from-blue-500 to-cyan-500"
            />
            <FeatureCard
              icon={<Clock className="h-6 w-6" />}
              title="Smart Time Analysis"
              description="Understand where your time goes with AI-powered calendar analytics."
              gradient="from-violet-500 to-purple-500"
            />
            <FeatureCard
              icon={<Calendar className="h-6 w-6" />}
              title="Intelligent Scheduling"
              description="Find optimal meeting times that respect your preferences and habits."
              gradient="from-green-500 to-emerald-500"
            />
            <FeatureCard
              icon={<Sparkles className="h-6 w-6" />}
              title="Meeting Prep"
              description="AI-generated prep notes, research topics, and questions for every meeting."
              gradient="from-amber-500 to-orange-500"
            />
            <FeatureCard
              icon={<BarChart3 className="h-6 w-6" />}
              title="Visual Analytics"
              description="Beautiful charts showing meeting distribution, focus time, and trends."
              gradient="from-pink-500 to-rose-500"
            />
            <FeatureCard
              icon={<Zap className="h-6 w-6" />}
              title="AI Draft Messages"
              description="Generate contextual emails and send them directly to meeting attendees."
              gradient="from-indigo-500 to-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Example Prompts */}
      <div className="py-20 border-t border-slate-800">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Just Ask</h2>
            <p className="text-slate-400">
              Talk to your calendar like you'd talk to an assistant
            </p>
          </div>

          <div className="space-y-4">
            <ExamplePrompt>
              What does my week look like?
            </ExamplePrompt>
            <ExamplePrompt>
              Find me 30 minutes free this week
            </ExamplePrompt>
            <ExamplePrompt>
              Draft an email to schedule a meeting with Sarah
            </ExamplePrompt>
            <ExamplePrompt>
              How much time am I spending in meetings?
            </ExamplePrompt>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-20 border-t border-slate-800">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to orchestrate your calendar?</h2>
          <p className="text-slate-400 mb-8">
            Connect your Google Calendar and let Tempo handle the rest.
          </p>
          <button
            onClick={handleLogin}
            className="inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 transition text-lg font-semibold shadow-lg shadow-violet-500/25"
          >
            <GoogleIcon />
            Get Started Free
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-8 border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-6 text-center text-slate-500 text-sm">
          Built with React, Express, Google APIs & Groq LLM
        </div>
      </footer>

      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
      `}</style>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  gradient,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
}) {
  return (
    <div className="group p-6 rounded-2xl bg-slate-800/50 border border-slate-700 hover:border-slate-600 transition">
      <div
        className={`h-12 w-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition`}
      >
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-slate-400 text-sm">{description}</p>
    </div>
  );
}

function ExamplePrompt({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 text-slate-300 text-lg italic">
      "{children}"
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}
