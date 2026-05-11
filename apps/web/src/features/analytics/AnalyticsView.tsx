import { useEffect, useState } from 'react';
import { startOfWeek, endOfWeek, subWeeks, format } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { api } from '@/lib/api';
import { Clock, Users, Calendar, TrendingUp, Lightbulb, RefreshCw } from 'lucide-react';

interface AnalyticsData {
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
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export function AnalyticsView() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'week' | 'month'>('week');

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  async function loadAnalytics() {
    setIsLoading(true);
    setError(null);
    try {
      const now = new Date();
      const start = timeRange === 'week'
        ? startOfWeek(now, { weekStartsOn: 1 })
        : subWeeks(now, 4);
      const end = timeRange === 'week'
        ? endOfWeek(now, { weekStartsOn: 1 })
        : now;

      const result = await api.getAnalytics(
        start.toISOString(),
        end.toISOString()
      );
      setData(result);
    } catch (err: unknown) {
      console.error('Failed to load analytics:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load analytics';
      // If unauthorized, the useAuth hook will handle redirect
      if (errorMessage.includes('authenticated') || errorMessage.includes('UNAUTHORIZED')) {
        window.location.reload(); // Trigger auth check
        return;
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
        <p>{error || 'Failed to load analytics'}</p>
        <button
          onClick={loadAnalytics}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          Retry
        </button>
      </div>
    );
  }

  const pieData = [
    { name: '1:1s', value: data.meetingTypes.oneOnOne, color: COLORS[0] },
    { name: 'Group', value: data.meetingTypes.group, color: COLORS[1] },
    { name: 'External', value: data.meetingTypes.external, color: COLORS[2] },
  ].filter(d => d.value > 0);

  return (
    <div className="h-full overflow-auto bg-slate-50 p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Calendar Analytics</h2>
          <p className="text-sm text-slate-500">
            {timeRange === 'week' ? 'This week' : 'Last 4 weeks'} overview
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setTimeRange('week')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              timeRange === 'week'
                ? 'bg-primary text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            This Week
          </button>
          <button
            onClick={() => setTimeRange('month')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              timeRange === 'month'
                ? 'bg-primary text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            Last Month
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        <StatCard
          icon={<Calendar className="h-5 w-5" />}
          label="Total Meetings"
          value={data.summary.totalMeetings}
          color="bg-blue-500"
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          label="Hours in Meetings"
          value={`${data.summary.totalHours}h`}
          color="bg-purple-500"
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Focus Time"
          value={`${data.summary.focusTimePercent}%`}
          color="bg-green-500"
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="1:1 Meetings"
          value={data.summary.oneOnOneCount}
          color="bg-orange-500"
        />
      </div>

      {/* Charts Row */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        {/* Daily Hours Chart */}
        <div className="col-span-2 rounded-xl bg-white p-4 shadow-sm">
          <h3 className="mb-4 font-semibold text-slate-900">Meeting Hours by Day</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="dayName" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(value) => [`${value} hours`, 'Meeting Time']}
              />
              <Bar dataKey="hours" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Meeting Types Pie */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <h3 className="mb-4 font-semibold text-slate-900">Meeting Types</h3>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={55}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 flex justify-center gap-4">
                {pieData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-slate-600">{entry.name}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex h-[180px] items-center justify-center text-sm text-slate-400">
              No meeting data
            </div>
          )}
        </div>
      </div>

      {/* Insights */}
      <div className="rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 p-5 text-white shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Lightbulb className="h-5 w-5" />
          <h3 className="font-semibold">AI Insights</h3>
        </div>
        <ul className="space-y-2">
          {data.insights.map((insight, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-blue-100">
              <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-200" />
              {insight}
            </li>
          ))}
        </ul>
      </div>

      {/* Bottom Stats */}
      {(data.busiestDay || data.peakHour) && (
        <div className="mt-6 grid grid-cols-2 gap-4">
          {data.busiestDay && (
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Busiest Day</p>
              <p className="text-xl font-bold text-slate-900">
                {data.busiestDay.dayName}
              </p>
              <p className="text-sm text-slate-600">
                {data.busiestDay.hours} hours of meetings
              </p>
            </div>
          )}
          {data.peakHour && (
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Peak Meeting Time</p>
              <p className="text-xl font-bold text-slate-900">
                {data.peakHour.label}
              </p>
              <p className="text-sm text-slate-600">
                {data.peakHour.count} meetings typically scheduled
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className={`mb-3 inline-flex rounded-lg p-2 text-white ${color}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}
