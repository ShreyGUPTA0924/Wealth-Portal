'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Lightbulb, CheckCircle2, Circle,
  AlertCircle, Target, Clock, ArrowRight, Plus, Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import apiClient from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardData {
  netWorth: {
    current: number; invested: number; pnlAbsolute: number; pnlPercent: number;
    change: { today: number; oneWeek: number; oneMonth: number; oneYear: number };
  };
  allocation: { assetClass: string; value: number; percent: number }[];
  topGainers: { id: string; name: string; symbol: string | null; pnlPercent: number; currentValue: number }[];
  topLosers:  { id: string; name: string; symbol: string | null; pnlPercent: number; currentValue: number }[];
  upcomingReminders: { type: string; name: string; date: string; amount: number | null }[];
  recentTransactions: { id: string; holdingName: string; type: string; amount: number; date: string }[];
  goalsSummary: {
    id: string; name: string; targetAmount: number; currentAmount: number;
    progressPercent: number; healthStatus: string;
  }[];
  checklist: {
    items: {
      templateId: string; label: string; category: string; amount: number | null;
      dueDayOfMonth: number; isPaid: boolean; paidAt: string | null;
    }[];
    totalItems: number; paidItems: number;
  };
  aiInsights: string[];
}

interface NetWorthHistory {
  period: string;
  dataPoints: { date: string; value: number }[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatInr(n: number | null | undefined, compact = false): string {
  if (n == null) return '—';
  const abs = Math.abs(n);
  if (compact) {
    if (abs >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`;
    if (abs >= 1_00_000)    return `₹${(n / 1_00_000).toFixed(2)} L`;
    if (abs >= 1_000)       return `₹${(n / 1_000).toFixed(1)} K`;
  }
  return n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
}

function pnlColor(v: number) { return v >= 0 ? 'text-green-600' : 'text-red-500'; }
function pnlBg(v: number)    { return v >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'; }

const ALLOCATION_COLORS: Record<string, string> = {
  STOCK:       '#7C3AED',
  MUTUAL_FUND: '#0D9488',
  CRYPTO:      '#F97316',
  GOLD:        '#EAB308',
  SGB:         '#FBBF24',
  FD:          '#3B82F6',
  RD:          '#06B6D4',
  PPF:         '#10B981',
  EPF:         '#6366F1',
  NPS:         '#8B5CF6',
  REAL_ESTATE: '#84CC16',
};
const DEFAULT_COLOR = '#9CA3AF';

const ASSET_LABELS: Record<string, string> = {
  STOCK: 'Stocks', MUTUAL_FUND: 'Mutual Funds', CRYPTO: 'Crypto',
  GOLD: 'Gold', SGB: 'SGB', FD: 'Fixed Deposits', RD: 'RD',
  PPF: 'PPF', EPF: 'EPF', NPS: 'NPS', REAL_ESTATE: 'Real Estate',
};

const HEALTH_STYLES: Record<string, string> = {
  ON_TRACK:  'bg-green-100 text-green-700',
  AT_RISK:   'bg-amber-100 text-amber-700',
  OFF_TRACK: 'bg-red-100 text-red-700',
};

const TXN_STYLES: Record<string, string> = {
  BUY:      'bg-blue-100 text-blue-700',
  SELL:     'bg-orange-100 text-orange-700',
  SIP:      'bg-purple-100 text-purple-700',
  DIVIDEND: 'bg-green-100 text-green-700',
  BONUS:    'bg-teal-100 text-teal-700',
  SPLIT:    'bg-gray-100 text-gray-600',
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-100 rounded-xl ${className ?? ''}`} />;
}

// ─── Net Worth Chart ─────────────────────────────────────────────────────────

const HISTORY_PERIODS = [
  { label: 'Today', value: '1M' },
  { label: '1W',    value: '1M' },
  { label: '1M',    value: '1M' },
  { label: '1Y',    value: '1Y' },
] as const;

function NetWorthSection({ data }: { data: DashboardData }) {
  const [period, setPeriod] = useState<'Today' | '1W' | '1M' | '1Y'>('1M');
  const apiPeriod = period === '1Y' ? '1Y' : '1M';

  const { data: historyData } = useQuery({
    queryKey: ['net-worth-history', apiPeriod],
    queryFn:  () =>
      apiClient.get<{ success: boolean; data: NetWorthHistory }>(`/api/dashboard/net-worth-history?period=${apiPeriod}`)
        .then((r) => r.data.data),
    staleTime: 60_000,
  });

  const changeValue = {
    Today: data.netWorth.change.today,
    '1W':  data.netWorth.change.oneWeek,
    '1M':  data.netWorth.change.oneMonth,
    '1Y':  data.netWorth.change.oneYear,
  }[period] ?? 0;

  const chartData = historyData?.dataPoints ?? [];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Net Worth</p>
          <p className="text-4xl font-bold text-gray-900 tracking-tight">
            {formatInr(data.netWorth.current)}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-sm font-semibold px-2.5 py-1 rounded-full ${pnlBg(data.netWorth.pnlAbsolute)}`}>
              {data.netWorth.pnlAbsolute >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {formatInr(data.netWorth.pnlAbsolute)} ({data.netWorth.pnlPercent >= 0 ? '+' : ''}{data.netWorth.pnlPercent.toFixed(2)}%)
            </span>
            <span className={`text-sm font-medium px-2.5 py-1 rounded-full ${pnlBg(changeValue)}`}>
              {period}: {changeValue >= 0 ? '+' : ''}{changeValue.toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="flex gap-1">
          {HISTORY_PERIODS.map(({ label }) => (
            <button
              key={label}
              onClick={() => setPeriod(label as typeof period)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                period === label
                  ? 'bg-[#3C3489] text-white'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 h-48">
        {chartData.length === 0 ? (
          <Skeleton className="h-full w-full" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="netWorthGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3C3489" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#3C3489" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#9CA3AF' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={(v: number) => formatInr(v, true)}
                tick={{ fontSize: 10, fill: '#9CA3AF' }}
                tickLine={false}
                axisLine={false}
                width={60}
              />
              <Tooltip
                formatter={(v: number) => [formatInr(v), 'Net Worth']}
                contentStyle={{ borderRadius: 12, border: '1px solid #E5E7EB', fontSize: 12 }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#3C3489"
                strokeWidth={2.5}
                fill="url(#netWorthGrad)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ─── Stats Row ────────────────────────────────────────────────────────────────

function StatsRow({ data }: { data: DashboardData }) {
  const bestPerformer = [...(data.topGainers ?? [])].sort((a, b) => b.pnlPercent - a.pnlPercent)[0];

  const stats = [
    {
      label: 'Total Invested',
      value: formatInr(data.netWorth.invested),
      sub:   null,
      color: 'text-gray-900',
    },
    {
      label: 'Current Value',
      value: formatInr(data.netWorth.current),
      sub:   null,
      color: 'text-gray-900',
    },
    {
      label: 'Total P&L',
      value: formatInr(data.netWorth.pnlAbsolute),
      sub:   `${data.netWorth.pnlPercent >= 0 ? '+' : ''}${data.netWorth.pnlPercent.toFixed(2)}%`,
      color: pnlColor(data.netWorth.pnlAbsolute),
    },
    {
      label: 'Best Performer',
      value: bestPerformer?.name ?? '—',
      sub:   bestPerformer ? `+${bestPerformer.pnlPercent.toFixed(1)}%` : null,
      color: 'text-green-600',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((s) => (
        <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs text-gray-400 font-medium">{s.label}</p>
          <p className={`text-lg font-bold mt-1 truncate ${s.color}`}>{s.value}</p>
          {s.sub && <p className={`text-xs mt-0.5 font-medium ${s.color}`}>{s.sub}</p>}
        </div>
      ))}
    </div>
  );
}

// ─── Allocation Donut ─────────────────────────────────────────────────────────

function AllocationSection({ data }: { data: DashboardData }) {
  const slices = data.allocation.map((a) => ({
    ...a,
    label: ASSET_LABELS[a.assetClass] ?? a.assetClass,
    color: ALLOCATION_COLORS[a.assetClass] ?? DEFAULT_COLOR,
  }));

  if (slices.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-6 flex items-center justify-center text-gray-400 text-sm h-48">
        No holdings to show
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Asset Allocation</h3>
      <div className="flex flex-col lg:flex-row items-center gap-6">
        <div className="w-44 h-44 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={72}
                dataKey="value"
                paddingAngle={2}
              >
                {slices.map((s, i) => (
                  <Cell key={i} fill={s.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number) => [formatInr(v), '']}
                contentStyle={{ borderRadius: 10, fontSize: 12, border: '1px solid #E5E7EB' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 grid grid-cols-1 gap-2 w-full">
          {slices.map((s) => (
            <div key={s.assetClass} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                <span className="text-sm text-gray-700 truncate">{s.label}</span>
              </div>
              <div className="text-right shrink-0">
                <span className="text-sm font-medium text-gray-900">{s.percent.toFixed(1)}%</span>
                <span className="text-xs text-gray-400 ml-2">{formatInr(s.value, true)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Top Movers ───────────────────────────────────────────────────────────────

function MoverCard({ holding, positive }: {
  holding: DashboardData['topGainers'][number];
  positive: boolean;
}) {
  return (
    <Link href={`/portfolio`} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors group">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate group-hover:text-[#3C3489] transition-colors">{holding.name}</p>
        <p className="text-xs text-gray-400 mt-0.5">{formatInr(holding.currentValue, true)}</p>
      </div>
      <span className={`text-sm font-bold shrink-0 ml-2 ${positive ? 'text-green-600' : 'text-red-500'}`}>
        {positive ? '+' : ''}{holding.pnlPercent.toFixed(2)}%
      </span>
    </Link>
  );
}

function TopMoversSection({ data }: { data: DashboardData }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-green-500" />
          <h3 className="text-sm font-semibold text-gray-900">Top Gainers</h3>
        </div>
        {data.topGainers.length === 0
          ? <p className="text-xs text-gray-400 text-center py-4">No data yet</p>
          : data.topGainers.map((h) => <MoverCard key={h.id} holding={h} positive />)
        }
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center gap-2 mb-3">
          <TrendingDown className="w-4 h-4 text-red-500" />
          <h3 className="text-sm font-semibold text-gray-900">Top Losers</h3>
        </div>
        {data.topLosers.length === 0
          ? <p className="text-xs text-gray-400 text-center py-4">No data yet</p>
          : data.topLosers.map((h) => <MoverCard key={h.id} holding={h} positive={false} />)
        }
      </div>
    </div>
  );
}

// ─── AI Insights ─────────────────────────────────────────────────────────────

function AiInsightsSection({ insights }: { insights: string[] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500" />
          <h3 className="text-sm font-semibold text-gray-900">AI Insights</h3>
        </div>
        <span className="text-xs bg-purple-50 text-purple-600 font-medium px-2 py-0.5 rounded-full">
          Powered by AI
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {insights.map((insight, i) => (
          <div key={i} className="flex gap-3 p-3 bg-purple-50/60 rounded-xl border border-purple-100/70">
            <Lightbulb className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
            <p className="text-sm text-gray-700 leading-relaxed">{insight}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Checklist ────────────────────────────────────────────────────────────────

function ChecklistSection({ checklist }: { checklist: DashboardData['checklist'] }) {
  const queryClient = useQueryClient();

  const toggleMutation = useMutation({
    mutationFn: ({ templateId, isPaid }: { templateId: string; isPaid: boolean }) =>
      apiClient.post(`/api/dashboard/checklist/${templateId}/toggle`, { isPaid }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  });

  const { totalItems, paidItems, items } = checklist;
  const pct = totalItems > 0 ? Math.round((paidItems / totalItems) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Daily Checklist</h3>
          <p className="text-xs text-gray-400 mt-0.5">{paidItems} of {totalItems} paid this month</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs font-medium text-gray-500">{pct}%</span>
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-gray-200" />
          <p className="text-sm">No checklist items yet</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.templateId} className="flex items-center justify-between gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => toggleMutation.mutate({ templateId: item.templateId, isPaid: !item.isPaid })}
                  disabled={toggleMutation.isPending}
                  className="shrink-0 transition-transform hover:scale-110"
                >
                  {item.isPaid
                    ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                    : <Circle className="w-5 h-5 text-gray-300 group-hover:text-gray-400" />
                  }
                </button>
                <div className="min-w-0">
                  <p className={`text-sm font-medium truncate ${item.isPaid ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                    {item.label}
                  </p>
                  <p className="text-xs text-gray-400">Due: {item.dueDayOfMonth}th · {item.category}</p>
                </div>
              </div>
              <span className="text-sm font-semibold text-gray-700 shrink-0">
                {item.amount ? formatInr(item.amount) : '—'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Goals Summary ────────────────────────────────────────────────────────────

function GoalsSummarySection({ goals }: { goals: DashboardData['goalsSummary'] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Goal Progress</h3>
        <Link href="/goals" className="text-xs text-[#3C3489] hover:underline flex items-center gap-1">
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {goals.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <Target className="w-8 h-8 mx-auto mb-2 text-gray-200" />
          <p className="text-sm mb-3">No goals yet</p>
          <Link
            href="/goals/new"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#3C3489] hover:bg-[#2d2871] px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus className="w-3 h-3" /> Create a Goal
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {goals.map((g) => (
            <Link key={g.id} href={`/goals/${g.id}`} className="block group">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-sm font-medium text-gray-800 group-hover:text-[#3C3489] transition-colors truncate mr-2">
                  {g.name}
                </p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${HEALTH_STYLES[g.healthStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                  {g.healthStatus.replace('_', ' ')}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#3C3489] rounded-full transition-all duration-500"
                    style={{ width: `${g.progressPercent}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-gray-500 shrink-0">{g.progressPercent.toFixed(0)}%</span>
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>{formatInr(g.currentAmount, true)}</span>
                <span>Target: {formatInr(g.targetAmount, true)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Reminders ────────────────────────────────────────────────────────────────

function RemindersSection({ reminders }: { reminders: DashboardData['upcomingReminders'] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-4 h-4 text-amber-500" />
        <h3 className="text-sm font-semibold text-gray-900">Upcoming Reminders</h3>
      </div>
      {reminders.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No upcoming events in 30 days</p>
      ) : (
        <ul className="space-y-3">
          {reminders.map((r, i) => {
            const d     = new Date(r.date);
            const days  = Math.max(0, Math.round((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
            const urgnt = days <= 7;
            return (
              <li key={i} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${urgnt ? 'bg-red-400' : 'bg-amber-400'}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{r.name}</p>
                    <p className="text-xs text-gray-400">{r.type} · {d.toLocaleDateString('en-IN')}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-xs font-semibold ${urgnt ? 'text-red-500' : 'text-amber-600'}`}>
                    {days}d left
                  </span>
                  {r.amount && <p className="text-xs text-gray-400">{formatInr(r.amount, true)}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Recent Transactions ──────────────────────────────────────────────────────

function RecentTxnsSection({ txns }: { txns: DashboardData['recentTransactions'] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Recent Transactions</h3>
        <Link href="/portfolio" className="text-xs text-[#3C3489] hover:underline flex items-center gap-1">
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      {txns.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No transactions yet</p>
      ) : (
        <ul className="space-y-2">
          {txns.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 py-2 border-b border-gray-50 last:border-0">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${TXN_STYLES[t.type] ?? 'bg-gray-100 text-gray-600'}`}>
                  {t.type}
                </span>
                <p className="text-sm text-gray-800 truncate">{t.holdingName}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-gray-900">{formatInr(t.amount)}</p>
                <p className="text-xs text-gray-400">{new Date(t.date).toLocaleDateString('en-IN')}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-72 w-full" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
      <Skeleton className="h-32 w-full" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey:    ['dashboard'],
    queryFn:     () =>
      apiClient.get<{ success: boolean; data: DashboardData }>('/api/dashboard')
        .then((r) => r.data.data),
    staleTime:   60_000,
    refetchInterval: 60_000,
  });

  if (isLoading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <AlertCircle className="w-10 h-10 mb-3 text-red-400" />
        <p className="text-sm mb-3">Failed to load dashboard</p>
        <button
          onClick={() => refetch()}
          className="text-xs font-semibold text-white bg-[#3C3489] hover:bg-[#2d2871] px-4 py-2 rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-5">
      {/* 1. Net Worth + Chart */}
      <NetWorthSection data={data} />

      {/* 2. Stats Row */}
      <StatsRow data={data} />

      {/* 3. Allocation + Top Movers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AllocationSection data={data} />
        <div className="flex flex-col gap-4">
          <TopMoversSection data={data} />
        </div>
      </div>

      {/* 4. AI Insights */}
      <AiInsightsSection insights={data.aiInsights} />

      {/* 5. Checklist + Goals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChecklistSection checklist={data.checklist} />
        <GoalsSummarySection goals={data.goalsSummary} />
      </div>

      {/* 6. Reminders + Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RemindersSection reminders={data.upcomingReminders} />
        <RecentTxnsSection txns={data.recentTransactions} />
      </div>
    </div>
  );
}
