import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  X,
  Clock,
  MapPin,
  Users,
  Building2,
  Lightbulb,
  Search,
  MessageSquare,
  ExternalLink,
  Sparkles,
  BookOpen,
  HelpCircle,
  Send,
  Loader2,
  Mail,
  CheckCircle,
  FileText,
} from 'lucide-react';
import type { CalendarEvent } from '@tenex/shared';
import { api } from '@/lib/api';

interface MeetingPrepDrawerProps {
  meeting: CalendarEvent;
  onClose: () => void;
}

interface AttendeeInfo {
  email: string;
  name?: string;
  domain: string;
  company: string;
  role?: string;
  isExternal: boolean;
}

interface PrepContent {
  attendees: AttendeeInfo[];
  researchTopics: string[];
  prepQuestions: string[];
  domainContext: string | null;
  meetingType: string;
  suggestedActions: string[];
}

// Generate Google search URL
function googleSearchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

// Generate LinkedIn search URL
function linkedInSearchUrl(name: string, company?: string): string {
  const query = company && company !== 'Personal'
    ? `${name} ${company}`
    : name;
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}`;
}

// Extract company name from email domain
function getCompanyFromDomain(domain: string): string {
  const commonDomains: Record<string, string> = {
    'gmail.com': 'Personal',
    'yahoo.com': 'Personal',
    'hotmail.com': 'Personal',
    'outlook.com': 'Personal',
    'icloud.com': 'Personal',
    'google.com': 'Google',
    'microsoft.com': 'Microsoft',
    'amazon.com': 'Amazon',
    'meta.com': 'Meta',
    'apple.com': 'Apple',
    'anthropic.com': 'Anthropic',
    'openai.com': 'OpenAI',
  };

  if (commonDomains[domain]) {
    return commonDomains[domain];
  }

  // Clean up domain to company name
  const name = domain.split('.')[0] || domain;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// Analyze meeting title to determine type and generate prep
function analyzeMeeting(meeting: CalendarEvent): PrepContent {
  const title = meeting.title.toLowerCase();
  const description = meeting.description?.toLowerCase() || '';

  // Parse attendees
  const attendees: AttendeeInfo[] = (meeting.attendees || []).map(a => {
    const domain = a.email.split('@')[1] || '';
    const isExternal = !a.email.includes('gmail.com'); // Simplified check
    return {
      email: a.email,
      name: a.name,
      domain,
      company: getCompanyFromDomain(domain),
      isExternal,
    };
  });

  // Determine meeting type
  let meetingType = 'General Meeting';
  let researchTopics: string[] = [];
  let prepQuestions: string[] = [];
  let domainContext: string | null = null;
  let suggestedActions: string[] = [];

  // Interview
  if (title.includes('interview')) {
    meetingType = 'Interview';
    researchTopics = [
      'Review candidate resume and portfolio',
      'Company background and recent news',
      'Role requirements and team structure',
      'Common interview questions for this role',
    ];
    prepQuestions = [
      'What specific skills are must-haves for this role?',
      'What does success look like in the first 90 days?',
      'Are there any red flags to watch for?',
    ];
    suggestedActions = [
      'Prepare your interview questions',
      'Review the job description',
      'Check LinkedIn for candidate background',
    ];
  }
  // 1:1 Meeting
  else if (title.includes('1:1') || title.includes('one on one') || title.includes('1-1')) {
    meetingType = '1:1 Meeting';
    researchTopics = [
      'Review notes from last 1:1',
      'Check on previously assigned action items',
      'Recent team updates or changes',
    ];
    prepQuestions = [
      'What wins should be celebrated?',
      'Are there any blockers to discuss?',
      'What feedback do you need to give or receive?',
    ];
    suggestedActions = [
      'Review last meeting notes',
      'Prepare talking points',
      'Think about career development topics',
    ];
  }
  // Standup / Sync
  else if (title.includes('standup') || title.includes('sync') || title.includes('daily')) {
    meetingType = 'Team Sync';
    researchTopics = [
      'Your completed work since last sync',
      'Current blockers or dependencies',
      'Upcoming priorities',
    ];
    prepQuestions = [
      'What did you accomplish?',
      'What are you working on today?',
      'Any blockers the team should know about?',
    ];
    suggestedActions = [
      'Update your task status',
      'Note any blockers',
      'Keep update brief (2 min max)',
    ];
  }
  // Review / Demo
  else if (title.includes('review') || title.includes('demo') || title.includes('presentation')) {
    meetingType = 'Review/Demo';
    researchTopics = [
      'Key features or changes to highlight',
      'Known issues or limitations',
      'Success metrics and goals',
    ];
    prepQuestions = [
      'What is the key message to convey?',
      'What questions might come up?',
      'What decisions need to be made?',
    ];
    suggestedActions = [
      'Test your demo environment',
      'Prepare backup screenshots',
      'Have documentation ready to share',
    ];
  }
  // Planning / Strategy
  else if (title.includes('planning') || title.includes('strategy') || title.includes('roadmap')) {
    meetingType = 'Planning Session';
    researchTopics = [
      'Current project status and metrics',
      'Market trends and competitor analysis',
      'Resource availability and constraints',
    ];
    prepQuestions = [
      'What are the top priorities?',
      'What trade-offs need to be considered?',
      'What dependencies exist?',
    ];
    suggestedActions = [
      'Review relevant data and metrics',
      'Prepare your proposals',
      'Identify key stakeholders',
    ];
  }
  // External / Client meeting
  else if (attendees.some(a => a.isExternal)) {
    meetingType = 'External Meeting';
    const externalCompanies = [...new Set(attendees.filter(a => a.isExternal).map(a => a.company))];
    researchTopics = [
      `Research ${externalCompanies.join(', ')} - recent news and updates`,
      'Review previous interactions and notes',
      'Understand their business challenges',
      'Prepare relevant case studies or examples',
    ];
    prepQuestions = [
      'What is the goal of this meeting?',
      'What value can you provide?',
      'What are their likely concerns?',
    ];
    domainContext = `Meeting with ${externalCompanies.join(' & ')}`;
    suggestedActions = [
      'Research the attendees on LinkedIn',
      'Review any previous communications',
      'Prepare materials to share',
    ];
  }
  // Default
  else {
    researchTopics = [
      'Review any pre-read materials',
      'Check for related documents or context',
      'Note any updates since last discussion',
    ];
    prepQuestions = [
      'What is the purpose of this meeting?',
      'What outcome do you want?',
      'What do you need to contribute?',
    ];
    suggestedActions = [
      'Review the meeting agenda',
      'Prepare your talking points',
      'Check if you need to bring anything',
    ];
  }

  // Add topic-specific research based on keywords in title
  const keywords = ['product', 'design', 'engineering', 'sales', 'marketing', 'finance', 'hr', 'legal'];
  for (const keyword of keywords) {
    if (title.includes(keyword)) {
      researchTopics.push(`Review latest ${keyword} updates and metrics`);
      break;
    }
  }

  return {
    attendees,
    researchTopics,
    prepQuestions,
    domainContext,
    meetingType,
    suggestedActions,
  };
}

type MessageType = 'agenda' | 'intro' | 'followup' | 'reschedule' | 'cancel';

const messageTypeLabels: Record<MessageType, string> = {
  agenda: 'Meeting Agenda',
  intro: 'Introduction',
  followup: 'Follow-up',
  reschedule: 'Reschedule Request',
  cancel: 'Cancellation',
};

export function MeetingPrepDrawer({ meeting, onClose }: MeetingPrepDrawerProps) {
  const [prep, setPrep] = useState<PrepContent | null>(null);
  const [messageType, setMessageType] = useState<MessageType>('agenda');
  const [draftContent, setDraftContent] = useState('');
  const [draftSubject, setDraftSubject] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Analyze meeting and generate prep content
    const prepContent = analyzeMeeting(meeting);
    setPrep(prepContent);
  }, [meeting]);

  async function handleGenerateDraft() {
    setIsGenerating(true);
    setError(null);
    try {
      const result = await api.draftMessage({
        meetingTitle: meeting.title,
        meetingType: prep?.meetingType || 'General Meeting',
        attendees: meeting.attendees || [],
        messageType,
      });
      setDraftContent(result.draft);
      setDraftSubject(result.subject);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate draft');
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSendMessage() {
    if (!draftContent.trim()) return;
    setIsSending(true);
    setError(null);
    try {
      await api.sendMeetingMessage(meeting.id, draftContent, draftSubject);
      setSendSuccess(true);
      setTimeout(() => setSendSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  }

  const startTime = parseISO(meeting.start);
  const endTime = parseISO(meeting.end);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <div className="relative w-full max-w-md bg-white shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-5 text-white">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full p-1.5 text-white/70 hover:bg-white/20 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-5 w-5" />
            <span className="text-sm font-medium text-purple-200">AI Meeting Prep</span>
          </div>
          <h2 className="text-xl font-bold pr-8 leading-tight">{meeting.title}</h2>

          <div className="mt-3 flex flex-wrap gap-3 text-sm text-purple-100">
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {format(startTime, 'h:mm a')} - {format(endTime, 'h:mm a')}
            </div>
            {meeting.location && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                <span className="truncate max-w-[150px]">
                  {meeting.location.includes('http') ? 'Video Call' : meeting.location}
                </span>
              </div>
            )}
          </div>

          {prep && (
            <div className="mt-3">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-medium">
                {prep.meetingType}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {prep && (
            <>
              {/* Attendees */}
              {prep.attendees.length > 0 && (
                <section>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-3">
                    <Users className="h-4 w-4 text-slate-400" />
                    Attendees ({prep.attendees.length})
                  </h3>
                  <div className="space-y-2">
                    {prep.attendees.map((attendee, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 p-3 rounded-lg bg-slate-50"
                      >
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-slate-600 font-medium text-sm">
                          {(attendee.name || attendee.email).charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 truncate">
                            {attendee.name || attendee.email.split('@')[0]}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <a
                              href={googleSearchUrl(attendee.company)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 hover:text-blue-600 hover:underline"
                            >
                              <Building2 className="h-3 w-3" />
                              {attendee.company}
                            </a>
                            {attendee.isExternal && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                                External
                              </span>
                            )}
                          </div>
                        </div>
                        <a
                          href={linkedInSearchUrl(attendee.name ?? attendee.email.split('@')[0] ?? attendee.email, attendee.company)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition"
                          title="Search on LinkedIn"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Domain Context */}
              {prep.domainContext && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                  <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
                    <Building2 className="h-4 w-4" />
                    {prep.domainContext}
                  </div>
                </div>
              )}

              {/* Research Topics */}
              <section>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-3">
                  <Search className="h-4 w-4 text-slate-400" />
                  Research & Look Up
                </h3>
                <div className="space-y-2">
                  {prep.researchTopics.map((topic, i) => (
                    <a
                      key={i}
                      href={googleSearchUrl(topic)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 border border-blue-100 hover:bg-blue-100 hover:border-blue-200 transition group"
                    >
                      <BookOpen className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-blue-900 flex-1">{topic}</span>
                      <ExternalLink className="h-4 w-4 text-blue-400 opacity-0 group-hover:opacity-100 transition flex-shrink-0" />
                    </a>
                  ))}
                </div>
              </section>

              {/* Prep Questions */}
              <section>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-3">
                  <HelpCircle className="h-4 w-4 text-slate-400" />
                  Questions to Consider
                </h3>
                <div className="space-y-2">
                  {prep.prepQuestions.map((question, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3 rounded-lg bg-purple-50 border border-purple-100"
                    >
                      <MessageSquare className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-purple-900">{question}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Suggested Actions */}
              <section>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-3">
                  <Lightbulb className="h-4 w-4 text-slate-400" />
                  Suggested Actions
                </h3>
                <div className="space-y-2">
                  {prep.suggestedActions.map((action, i) => {
                    // Check if action suggests looking up something
                    const isSearchAction = action.toLowerCase().includes('research') ||
                      action.toLowerCase().includes('review') ||
                      action.toLowerCase().includes('check') ||
                      action.toLowerCase().includes('linkedin');

                    const searchUrl = action.toLowerCase().includes('linkedin')
                      ? 'https://www.linkedin.com/search/results/people/'
                      : googleSearchUrl(action);

                    return (
                      <div
                        key={i}
                        className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-100 hover:bg-green-100 transition"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-green-300 text-green-600 focus:ring-green-500"
                        />
                        <span className="text-sm text-green-900 flex-1">{action}</span>
                        {isSearchAction && (
                          <a
                            href={searchUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center h-7 w-7 rounded-full bg-green-100 text-green-600 hover:bg-green-200 transition"
                            title="Search"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* AI Draft Message */}
              <section className="border-t pt-6">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-3">
                  <Mail className="h-4 w-4 text-slate-400" />
                  Draft Message to Attendees
                </h3>

                {/* Message Type Selector */}
                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-500 mb-2">
                    Message Type
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(messageTypeLabels) as MessageType[]).map((type) => (
                      <button
                        key={type}
                        onClick={() => setMessageType(type)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                          messageType === type
                            ? 'bg-violet-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {messageTypeLabels[type]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Generate Button */}
                <button
                  onClick={handleGenerateDraft}
                  disabled={isGenerating}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 py-2.5 text-sm font-semibold text-white hover:from-violet-700 hover:to-purple-700 transition disabled:opacity-50 mb-4"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate AI Draft
                    </>
                  )}
                </button>

                {/* Error Display */}
                {error && (
                  <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                    {error}
                  </div>
                )}

                {/* Draft Content */}
                {draftContent && (
                  <div className="space-y-3">
                    {/* Subject */}
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">
                        Subject
                      </label>
                      <input
                        type="text"
                        value={draftSubject}
                        onChange={(e) => setDraftSubject(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      />
                    </div>

                    {/* Message Body */}
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">
                        Message
                      </label>
                      <textarea
                        value={draftContent}
                        onChange={(e) => setDraftContent(e.target.value)}
                        rows={6}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
                      />
                    </div>

                    {/* Send Button */}
                    <button
                      onClick={handleSendMessage}
                      disabled={isSending || !draftContent.trim()}
                      className={`w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition ${
                        sendSuccess
                          ? 'bg-green-600 text-white'
                          : 'bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50'
                      }`}
                    >
                      {isSending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : sendSuccess ? (
                        <>
                          <CheckCircle className="h-4 w-4" />
                          Sent to Attendees!
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          Send to All Attendees
                        </>
                      )}
                    </button>

                    <p className="text-xs text-slate-500 text-center">
                      This will update the meeting description and notify attendees
                    </p>
                  </div>
                )}
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        {meeting.location && meeting.location.includes('http') && (
          <div className="p-4 border-t">
            <a
              href={meeting.location}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 py-3 text-sm font-semibold text-white hover:from-violet-700 hover:to-purple-700 transition"
            >
              <ExternalLink className="h-4 w-4" />
              Join Meeting
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
