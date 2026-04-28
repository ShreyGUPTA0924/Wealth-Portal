'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Lightbulb, CheckCircle2, Circle,
  AlertCircle, Target, Clock, ArrowRight, Plus, Sparkles, ShieldAlert
} from 'lucide-react';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { Card } from '@/components/ui/Card';
import { MotionWrapper, MotionItem } from '@/components/ui/MotionWrapper';
import { BentoGrid, BentoItem } from '@/components/ui/BentoGrid';

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
  upcomingBills: Array<{
    id: string; label: string; category: string; amount: number | null;
    dueDayOfMonth: number; isPaid: boolean; paidAt: string | null;
    daysUntilDue: number; isOverdue: boolean;
  }>;
  aiInsights: string[];
}

interface NetWorthHistory {
  period: string;
  dataPoints: { date: string; value: number }[];
  isPlaceholder?: boolean;
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
  SPLIT:    'bg-border text-foreground-muted',
};

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label, prefix = '' }: any) => {
  if (active && payload && payload.length) {
    return (
      <Card className="p-3 !rounded-2xl !bg-[#0f172a]/80 !backdrop-blur-xl border border-white/10 shadow-[0_0_30px_rgba(139,92,246,0.2)]">
        <p className="text-[10px] uppercase tracking-widest text-foreground-muted mb-1 font-bold">{label}</p>
        <p className="text-sm font-black text-white flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 block shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
          {prefix}{formatInr(payload[0].value)}
        </p>
      </Card>
    );
  }
  return null;
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-border rounded-3xl ${className ?? ''}`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 dark:via-white/5 to-transparent" />
    </div>
  );
}

// ─── Net Worth Chart ─────────────────────────────────────────────────────────

const HISTORY_PERIODS = [
  { label: 'Today', value: '1M' },
  { label: '1W',    value: '1M' },
  { label: '1M',    value: '1M' },
  { label: '1Y',    value: '1Y' },
] as const;

/** Generate fallback mock data when API returns empty */
function generateFallbackHistory(currentNetWorth: number, days = 30): { date: string; value: number }[] {
  const points = [];
  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const jitter = (Math.random() - 0.48) * 0.015;
    const base   = currentNetWorth * (1 - (i / days) * 0.06);
    points.push({
      date:  d.toISOString().split('T')[0] as string,
      value: Math.max(0, Math.round(base * (1 + jitter))),
    });
  }
  return points;
}

function NetWorthSection({ data }: { data: DashboardData }) {
  const [period, setPeriod] = useState<'Today' | '1W' | '1M' | '1Y'>('1M');
  const apiPeriod = period === '1Y' ? '1Y' : '1M';

  // Track seconds since last refetch
  const [secondsSince, setSecondsSince] = useState(0);
  const lastRefetchRef = useRef(Date.now());
  useEffect(() => {
    lastRefetchRef.current = Date.now();
    setSecondsSince(0);
  }, [data]);
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsSince(Math.round((Date.now() - lastRefetchRef.current) / 1000));
    }, 10_000);
    return () => clearInterval(interval);
  }, []);

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

  const rawPoints   = historyData?.dataPoints ?? [];
  const isPlaceholder = historyData?.isPlaceholder ?? false;
  const chartData   = rawPoints.length > 0
    ? rawPoints
    : generateFallbackHistory(Math.max(data.netWorth.current ?? 0, 1), period === '1Y' ? 365 : 30);

  const bestPerformer = [...(data.topGainers ?? [])].sort((a, b) => b.pnlPercent - a.pnlPercent)[0];
  const stats = [
    { label: 'Total Invested', value: formatInr(data.netWorth.invested), sub: null, color: 'text-foreground' },
    { label: 'Current Value', value: formatInr(data.netWorth.current), sub: null, color: 'text-foreground' },
    { label: 'Total P&L', value: formatInr(data.netWorth.pnlAbsolute), sub: `${data.netWorth.pnlPercent >= 0 ? '+' : ''}${data.netWorth.pnlPercent.toFixed(2)}%`, color: pnlColor(data.netWorth.pnlAbsolute) },
    { label: 'Best Performer', value: bestPerformer?.name ?? '—', sub: bestPerformer ? `+${bestPerformer.pnlPercent.toFixed(1)}%` : null, color: 'text-green-600' },
  ];

  return (
    <Card className="p-6 h-full flex flex-col relative overflow-hidden group bg-background-card/40 backdrop-blur-3xl border border-white/5 hover:border-brand/40 transition-all duration-500 hover:shadow-[0_0_50px_-15px_rgba(139,92,246,0.3)]">
      {/* Subtle background glow for the card */}
      <div className="absolute -top-32 -right-32 w-64 h-64 bg-brand/20 rounded-full blur-[80px] pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity duration-700" />
      
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 relative z-10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className="text-[10px] font-black text-foreground-muted uppercase tracking-widest">Net Worth</p>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
              </span>
              <span className="text-[9px] font-black text-cyan-500 uppercase tracking-widest shadow-cyan-500/50">LIVE</span>
            </span>
          </div>
          <p className="text-4xl md:text-6xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-white via-gray-200 to-gray-500 drop-shadow-sm mt-1">
            {formatInr(data.netWorth.current)}
          </p>
          <p className="text-xs text-foreground-muted mt-1">
            {secondsSince < 60
              ? `Updated just now`
              : `Last updated ${Math.floor(secondsSince / 60)}m ago`}
          </p>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-sm font-semibold px-3 py-1.5 rounded-full ${pnlBg(data.netWorth.pnlAbsolute)}`}>
              {data.netWorth.pnlAbsolute >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {formatInr(data.netWorth.pnlAbsolute)} ({data.netWorth.pnlPercent >= 0 ? '+' : ''}{data.netWorth.pnlPercent.toFixed(2)}%)
            </span>
            <span className={`text-sm font-medium px-3 py-1.5 rounded-full ${pnlBg(changeValue)}`}>
              {period}: {changeValue >= 0 ? '+' : ''}{changeValue.toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="flex gap-1 p-1 bg-border/50 rounded-xl">
          {HISTORY_PERIODS.map(({ label }) => (
            <button
              key={label}
              onClick={() => setPeriod(label as typeof period)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 ${
                period === label
                  ? 'bg-background-card text-brand shadow-sm shadow-black/5 shadow-black/5'
                  : 'text-foreground-muted hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 4 stats above the graph */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-8 relative z-10">
        {stats.map((s) => (
          <div key={s.label} className="p-4 rounded-2xl bg-white/5 dark:bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-colors">
            <p className="text-[10px] uppercase tracking-widest text-foreground-muted font-bold">{s.label}</p>
            <p className={`text-xl font-black mt-1 truncate tracking-tight ${s.color}`}>{s.value}</p>
            {s.sub && <p className={`text-xs mt-0.5 font-bold ${s.color}`}>{s.sub}</p>}
          </div>
        ))}
      </div>

      <div className="mt-6 flex-1 min-h-[200px] relative" style={{ height: 280 }}>
        {isPlaceholder && (
          <p className="absolute top-0 right-0 text-[10px] text-foreground-muted/70 z-10">
            Sample trend — add holdings to see your net worth
          </p>
        )}
        {chartData.length === 0 ? (
          <Skeleton className="h-full w-full" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="premiumGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"  stopColor="#06B6D4" stopOpacity={0.6} />
                  <stop offset="50%" stopColor="#8B5CF6" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
                </linearGradient>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#06B6D4" floodOpacity="0.5" />
                </filter>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: 'var(--foreground-muted)' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                dy={10}
              />
              <YAxis
                tickFormatter={(v: number) => formatInr(v, true)}
                tick={{ fontSize: 10, fill: 'var(--foreground-muted)' }}
                tickLine={false}
                axisLine={false}
                width={50}
                dx={-10}
                domain={[0, (dataMax: number) => Math.max(dataMax ?? 0, 1)]}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(168, 85, 247, 0.2)', strokeWidth: 2, strokeDasharray: '4 4' }} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="url(#premiumGrad)"
                strokeWidth={3}
                fill="url(#premiumGrad)"
                activeDot={{ r: 6, fill: '#ec4899', stroke: 'var(--background-card)', strokeWidth: 2 }}
                dot={false}
                animationDuration={1500}
                animationEasing="ease-in-out"
                style={{ filter: 'url(#glow)' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
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
      <Card className="p-6 h-full flex flex-col justify-center items-center text-foreground-muted text-sm">
        No holdings to show
      </Card>
    );
  }

  return (
    <Card className="p-6 h-full flex flex-col bg-background-card/40 backdrop-blur-3xl border border-white/5 hover:border-brand/40 transition-all duration-500 hover:shadow-[0_0_40px_-15px_rgba(139,92,246,0.3)]">
      <h3 className="text-[10px] font-black text-foreground uppercase tracking-widest mb-6">Asset Allocation</h3>
      <div className="flex flex-col items-center flex-1 gap-6 justify-center">
        <div className="w-48 h-48 shrink-0 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                dataKey="value"
                paddingAngle={3}
                stroke="none"
                animationDuration={1500}
              >
                {slices.map((s, i) => (
                  <Cell key={i} fill={s.color} />
                ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
             <span className="text-xs text-foreground-muted font-medium">Assets</span>
             <span className="text-lg font-bold text-foreground">{slices.length}</span>
          </div>
        </div>
        <div className="grid grid-cols-1 w-full gap-3 overflow-y-auto pr-2" style={{ maxHeight: '180px' }}>
          {slices.map((s) => (
            <div key={s.assetClass} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm shadow-black/5" style={{ background: s.color }} />
                <span className="text-sm font-medium text-foreground truncate">{s.label}</span>
              </div>
              <div className="text-right shrink-0">
                <span className="text-sm font-bold text-foreground">{s.percent.toFixed(1)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ─── Top Movers ───────────────────────────────────────────────────────────────

function MoverCard({ holding, positive }: { holding: DashboardData['topGainers'][number]; positive: boolean }) {
  return (
    <Link href={`/portfolio`} className="flex items-center justify-between py-2.5 group">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground truncate group-hover:text-brand transition-colors">{holding.name}</p>
        <p className="text-xs text-foreground-muted mt-0.5">{formatInr(holding.currentValue, true)}</p>
      </div>
      <div className="text-right shrink-0">
         <span className={`text-sm font-bold ml-2 py-1 px-2.5 rounded-lg ${positive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
          {positive ? '+' : ''}{holding.pnlPercent.toFixed(2)}%
         </span>
      </div>
    </Link>
  );
}

function TopMoversSection({ data }: { data: DashboardData }) {
  return (
    <div className="flex flex-col gap-4 h-full">
      <Card className="p-5 flex-1 bg-background-card/40 backdrop-blur-3xl border border-white/5 hover:border-brand/40 transition-all duration-500 hover:shadow-[0_0_40px_-15px_rgba(139,92,246,0.3)]">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
             <TrendingUp className="w-4 h-4 text-green-500" />
          </div>
          <h3 className="text-[10px] font-black text-foreground uppercase tracking-widest">Top Gainers</h3>
        </div>
        <div className="divide-y divide-white/5">
          {data.topGainers.length === 0
            ? <p className="text-xs text-foreground-muted text-center py-4 font-bold tracking-wider">NO GAINERS YET</p>
            : data.topGainers.map((h) => <MoverCard key={h.id} holding={h} positive />)
          }
        </div>
      </Card>
      <Card className="p-5 flex-1 bg-background-card/40 backdrop-blur-3xl border border-white/5 hover:border-brand/40 transition-all duration-500 hover:shadow-[0_0_40px_-15px_rgba(139,92,246,0.3)]">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center">
            <TrendingDown className="w-4 h-4 text-red-500" />
          </div>
          <h3 className="text-[10px] font-black text-foreground uppercase tracking-widest">Top Losers</h3>
        </div>
        <div className="divide-y divide-gray-50">
          {data.topLosers.length === 0
            ? <p className="text-xs text-foreground-muted text-center py-4">No holdings in loss</p>
            : data.topLosers.map((h) => <MoverCard key={h.id} holding={h} positive={false} />)
          }
        </div>
      </Card>
    </div>
  );
}

// ─── AI Insights ─────────────────────────────────────────────────────────────

function AiInsightsSection({ insights }: { insights: string[] }) {
  return (
    <Card className="relative p-[1px] h-full overflow-hidden group rounded-[2rem] bg-gradient-to-r from-brand/20 via-purple-500/20 to-cyan-500/20 hover:from-brand/40 hover:via-purple-500/40 hover:to-cyan-500/40 transition-all duration-1000">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-[2000ms]" />
      <div className="p-6 h-full bg-[#0f172a]/90 backdrop-blur-3xl rounded-[calc(2rem-1px)] relative z-10 flex flex-col">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand/20 rounded-full blur-[100px] transform translate-x-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-1000 group-hover:scale-150" />
        <div className="flex items-center justify-between mb-6 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand/20 flex items-center justify-center relative shadow-[0_0_20px_rgba(99,102,241,0.4)]">
               <div className="absolute inset-0 rounded-xl bg-brand/30 animate-ping" />
               <Sparkles className="w-5 h-5 text-brand drop-shadow-[0_0_10px_rgba(99,102,241,0.8)]" />
            </div>
            <h3 className="text-lg font-black text-white flex items-center gap-2 tracking-tight">
              AI Assistant
              <span className="flex gap-0.5 mt-1 ml-2">
                <span className="w-1.5 h-1.5 bg-brand rounded-full animate-bounce shadow-[0_0_5px_rgba(99,102,241,0.8)]" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce shadow-[0_0_5px_rgba(168,85,247,0.8)]" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce shadow-[0_0_5px_rgba(34,211,238,0.8)]" style={{ animationDelay: '300ms' }} />
              </span>
            </h3>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-gradient-to-r from-brand/20 to-purple-500/20 text-white border border-white/10 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
            Generating Insights
          </span>
        </div>
        <MotionWrapper stagger className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10 flex-1">
          {insights.map((insight, i) => (
            <MotionItem key={i}>
              <div className="flex gap-4 p-5 bg-white/5 backdrop-blur-2xl rounded-2xl border border-white/10 transition-all duration-300 hover:bg-white/10 hover:shadow-[0_10px_30px_-10px_rgba(99,102,241,0.3)] hover:-translate-y-1 relative overflow-hidden h-full">
                <div className="absolute left-0 top-0 w-1.5 h-full bg-gradient-to-b from-brand to-cyan-400 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <div className="shrink-0 mt-0.5">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shadow-inner">
                    <Lightbulb className="w-4 h-4 text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]" />
                  </div>
                </div>
                <p className="text-sm font-semibold text-gray-200 leading-relaxed tracking-tight">
                {insight}
              </p>
            </div>
          </MotionItem>
        ))}
      </MotionWrapper>
      </div>
    </Card>
  );
}

// ─── Checklist (Bill Reminders) ───────────────────────────────────────────────

function ChecklistSection({ checklist, upcomingBills }: { checklist: DashboardData['checklist']; upcomingBills: DashboardData['upcomingBills'] }) {
  const queryClient = useQueryClient();

  const toggleMutation = useMutation({
    mutationFn: ({ templateId, isPaid }: { templateId: string; isPaid: boolean }) =>
      apiClient.post(`/api/dashboard/checklist/${templateId}/toggle`, { isPaid }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      queryClient.invalidateQueries({ queryKey: ['reminders-upcoming'] });
    },
  });

  const { totalItems, paidItems } = checklist;
  const pct = totalItems > 0 ? Math.round((paidItems / totalItems) * 100) : 0;
  const displayItems = upcomingBills.length > 0 ? upcomingBills.slice(0, 3) : [];

  return (
    <Card className="p-6 h-full flex flex-col bg-background-card/40 backdrop-blur-3xl border border-white/5 hover:border-brand/40 transition-all duration-500 hover:shadow-[0_0_40px_-15px_rgba(139,92,246,0.3)]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-[10px] font-black text-foreground uppercase tracking-widest">Bill Reminders</h3>
          <p className="text-[10px] text-foreground-muted font-bold mt-1 tracking-wider">{paidItems} of {totalItems} paid this month</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-24 h-2 bg-border rounded-full overflow-hidden shadow-inner">
              <div
                className="h-full bg-gradient-stripe rounded-full transition-all duration-700 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs font-bold text-brand">{pct}%</span>
          </div>
        </div>
      </div>

      {displayItems.length === 0 ? (
        <div className="text-center py-8 text-foreground-muted">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-gray-200" />
          <p className="text-sm font-medium">All caught up!</p>
          <Link href="/reminders" className="text-xs font-semibold text-brand hover:text-brand-dark mt-2 inline-block">
            View all reminders →
          </Link>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {displayItems.map((item) => (
              <li
                key={item.id}
                className={`flex items-center justify-between gap-3 p-3 rounded-2xl border border-transparent hover:border-white/60 transition-all duration-300 group ${
                  item.isOverdue ? 'bg-red-50/50 border-red-100' : 'bg-background-card/50 hover:bg-background-card/80'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => toggleMutation.mutate({ templateId: item.id, isPaid: !item.isPaid })}
                    disabled={toggleMutation.isPending}
                    className="shrink-0 transition-transform active:scale-90"
                  >
                    {item.isPaid
                      ? <CheckCircle2 className="w-6 h-6 text-brand" />
                      : <Circle className="w-6 h-6 text-gray-300 group-hover:text-brand transition-colors" />
                    }
                  </button>
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold truncate transition-colors ${item.isPaid ? 'line-through text-foreground-muted' : 'text-foreground'}`}>
                      {item.label}
                    </p>
                    <p className="text-xs text-foreground-muted font-medium mt-0.5">
                      Due {item.dueDayOfMonth}th · {item.category}
                      {item.isOverdue && !item.isPaid && (
                        <span className="text-red-500 font-medium ml-1">· {Math.abs(item.daysUntilDue)}d overdue</span>
                      )}
                    </p>
                  </div>
                </div>
                <span className={`text-sm font-bold shrink-0 ${item.isPaid ? 'text-foreground-muted' : item.isOverdue ? 'text-red-500' : 'text-foreground'}`}>
                  {item.amount ? formatInr(item.amount) : '—'}
                </span>
              </li>
            ))}
          </ul>
          <Link
            href="/reminders"
            className="mt-4 text-xs font-semibold text-brand hover:text-brand-dark flex items-center gap-1 transition-colors"
          >
            View all reminders <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </>
      )}
    </Card>
  );
}

// ─── Goals Summary ────────────────────────────────────────────────────────────

function GoalsSummarySection({ goals }: { goals: DashboardData['goalsSummary'] }) {
  return (
    <Card className="p-6 h-full flex flex-col bg-background-card/40 backdrop-blur-3xl border border-white/5 hover:border-brand/40 transition-all duration-500 hover:shadow-[0_0_40px_-15px_rgba(139,92,246,0.3)]">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-[10px] font-black text-foreground uppercase tracking-widest">Goal Progress</h3>
        <Link href="/goals" className="text-xs font-semibold text-brand hover:text-brand-dark flex items-center gap-1 transition-colors">
          View all <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {goals.length === 0 ? (
        <div className="text-center py-8 text-foreground-muted flex-1 flex flex-col justify-center">
          <Target className="w-10 h-10 mx-auto mb-3 text-gray-200" />
          <p className="text-sm font-medium mb-4">No goals yet</p>
          <Link
            href="/goals/new"
            className="inline-flex mx-auto items-center gap-1.5 text-sm font-bold text-white bg-gradient-stripe hover:opacity-90 px-4 py-2 rounded-xl transition-opacity shadow-lg shadow-brand/20"
          >
            <Plus className="w-4 h-4" /> Create a Goal
          </Link>
        </div>
      ) : (
        <div className="space-y-5 flex-1 overflow-y-auto pr-1">
          {goals.map((g) => (
            <Link key={g.id} href={`/goals/${g.id}`} className="block group">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-bold text-foreground group-hover:text-brand transition-colors truncate mr-2">
                  {g.name}
                </p>
                <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-md font-bold shrink-0 ${HEALTH_STYLES[g.healthStatus] ?? 'bg-border text-foreground-muted'}`}>
                  {g.healthStatus.replace('_', ' ')}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2.5 bg-border rounded-full overflow-hidden shadow-inner">
                  <div
                    className="h-full bg-gradient-stripe rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${g.progressPercent}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-foreground w-9 text-right shrink-0">{g.progressPercent.toFixed(0)}%</span>
              </div>
              <div className="flex justify-between text-xs font-medium text-foreground-muted mt-1.5">
                <span>{formatInr(g.currentAmount, true)} saved</span>
                <span>{formatInr(g.targetAmount, true)} target</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── Reminders ────────────────────────────────────────────────────────────────

function RemindersSection({ reminders }: { reminders: DashboardData['upcomingReminders'] }) {
  return (
    <Card className="p-6 h-full flex flex-col bg-background-card/40 backdrop-blur-3xl border border-white/5 hover:border-brand/40 transition-all duration-500 hover:shadow-[0_0_40px_-15px_rgba(139,92,246,0.3)]">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
            <Clock className="w-4 h-4 text-amber-500" />
        </div>
        <h3 className="text-[10px] font-black text-foreground uppercase tracking-widest">Upcoming Reminders</h3>
      </div>
      {reminders.length === 0 ? (
        <p className="text-sm font-medium text-foreground-muted text-center py-8">No upcoming events in 30 days</p>
      ) : (
        <ul className="space-y-4">
          {reminders.map((r, i) => {
            const d     = new Date(r.date);
            const days  = Math.max(0, Math.round((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
            const urgnt = days <= 7;
            return (
              <li key={i} className="flex items-center justify-between gap-3 group">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 shadow-sm shadow-black/5 ${urgnt ? 'bg-red-400' : 'bg-amber-400'}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{r.name}</p>
                    <p className="text-xs font-medium text-foreground-muted mt-0.5">{r.type} · {d.toLocaleDateString('en-IN')}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-xs font-bold px-2 py-1 rounded-md ${urgnt ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                    {days}d left
                  </span>
                  {r.amount && <p className="text-sm font-bold text-foreground mt-1.5">{formatInr(r.amount, true)}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// ─── Recent Transactions ──────────────────────────────────────────────────────

function RecentTxnsSection({ txns }: { txns: DashboardData['recentTransactions'] }) {
  return (
    <Card className="p-6 h-full flex flex-col bg-background-card/40 backdrop-blur-3xl border border-white/5 hover:border-brand/40 transition-all duration-500 hover:shadow-[0_0_40px_-15px_rgba(139,92,246,0.3)]">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-[10px] font-black text-foreground uppercase tracking-widest">Recent Transactions</h3>
        <Link href="/portfolio" className="text-xs font-semibold text-[#6366f1] hover:text-[#818cf8] flex items-center gap-1 transition-colors">
          View all <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      {txns.length === 0 ? (
        <p className="text-sm font-medium text-foreground-muted text-center py-8">No transactions yet</p>
      ) : (
        <MotionWrapper stagger className="space-y-3 flex-1 overflow-y-auto pr-1">
          {txns.map((t) => (
            <MotionItem key={t.id}>
              <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-background-card hover:bg-border/50 border border-transparent hover:border-border transition-all duration-300 group cursor-pointer relative overflow-hidden">
                <div className="flex items-center gap-3 min-w-0 flex-1 transition-transform duration-300 group-hover:-translate-x-12">
                  <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-md shrink-0 ${TXN_STYLES[t.type] ?? 'bg-border text-foreground-muted'}`}>
                    {t.type}
                  </span>
                  <p className="text-sm font-semibold text-foreground truncate">{t.holdingName}</p>
                </div>
                
                {/* Default Amount & Date view */}
                <div className="text-right shrink-0 transition-opacity transition-transform duration-300 group-hover:opacity-0 group-hover:translate-x-8">
                  <p className="text-sm font-bold text-foreground">{formatInr(t.amount)}</p>
                  <p className="text-xs font-medium text-foreground-muted mt-0.5">{new Date(t.date).toLocaleDateString('en-IN')}</p>
                </div>

                {/* Hover Reveal Action Buttons */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 opacity-0 translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                   <button className="px-3 py-1.5 rounded-lg bg-background-card text-foreground-muted hover:text-[#6366f1] hover:bg-[#6366f1]/10 shadow-sm shadow-black/5 border border-border border-b-0 transition-colors">
                      <span className="text-xs font-medium">Edit</span>
                   </button>
                </div>
              </div>
            </MotionItem>
          ))}
        </MotionWrapper>
      )}
    </Card>
  );
}

// ─── Risk Metrics (VaR / CVaR) ────────────────────────────────────────────────

function RiskMetricsSection({ data }: { data: any }) {
  if (!data) return null;

  return (
    <Card className="p-6 h-full relative overflow-hidden group bg-background-card/40 backdrop-blur-3xl border border-white/5 hover:border-brand/40 transition-all duration-500 hover:shadow-[0_0_40px_-15px_rgba(139,92,246,0.3)]">
      <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-red-500/10 rounded-full blur-[100px] transform -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-1000 group-hover:scale-125 group-hover:bg-red-500/20" />
      
      <div className="flex items-center justify-between mb-8 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center relative shadow-[0_0_20px_rgba(239,68,68,0.3)]">
            <div className="absolute inset-0 rounded-xl bg-red-500/20 animate-pulse" />
            <ShieldAlert className="w-5 h-5 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
          </div>
          <div>
            <h3 className="text-[12px] font-black text-foreground uppercase tracking-widest">Advanced Risk Metrics</h3>
            <p className="text-[10px] text-foreground-muted font-bold tracking-wider mt-0.5">Statistical Vulnerability (95% Confidence)</p>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
         <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-5 border border-white/10 hover:bg-white/10 transition-colors relative overflow-hidden">
            <div className="absolute left-0 top-0 w-1 h-full bg-gradient-to-b from-red-400 to-red-600" />
            <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-2 flex justify-between">
              <span>1-Month VaR (95%)</span>
              <span className="text-white/50">{data.var_95_pct.toFixed(2)}% of port.</span>
            </p>
            <p className="text-3xl font-black text-white tracking-tighter mb-4">{formatInr(data.var_amount)}</p>
            
            {/* High-tech Progress Bar representation */}
            <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden shadow-inner mb-3">
               <div className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full relative" style={{ width: `${Math.min(100, data.var_95_pct * 3)}%` }}>
                  <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/50 blur-[2px]" />
               </div>
            </div>
            
            <p className="text-[10px] font-medium text-gray-400 leading-relaxed">{data.message}</p>
         </div>

         <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-5 border border-white/10 hover:bg-white/10 transition-colors relative overflow-hidden">
            <div className="absolute left-0 top-0 w-1 h-full bg-gradient-to-b from-amber-400 to-amber-600" />
            <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-2 flex justify-between">
              <span>Conditional VaR (CVaR)</span>
              <span className="text-white/50">{data.cvar_95_pct.toFixed(2)}% of port.</span>
            </p>
            <p className="text-3xl font-black text-white tracking-tighter mb-4">{formatInr(data.cvar_amount)}</p>
            
            <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden shadow-inner mb-3">
               <div className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full relative" style={{ width: `${Math.min(100, data.cvar_95_pct * 3)}%` }}>
                  <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/50 blur-[2px]" />
               </div>
            </div>
            
            <p className="text-[10px] font-medium text-gray-400 leading-relaxed">Expected loss severity if the 5% worst-case scenario occurs.</p>
         </div>
      </div>
    </Card>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-[450px] w-full" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Skeleton className="h-80 md:col-span-1" />
        <Skeleton className="h-80 md:col-span-2" />
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

  const { data: aiRiskMetrics } = useQuery({
    queryKey: ['ai-risk-metrics'],
    queryFn:  () => apiClient.get('/api/ai/risk-metrics').then((r) => r.data.data),
  });

  if (isLoading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-foreground-muted">
        <AlertCircle className="w-12 h-12 mb-4 text-red-400" />
        <p className="text-base font-medium mb-4">Failed to load dashboard data</p>
        <button
          onClick={() => refetch()}
          className="text-sm font-bold text-white bg-gradient-stripe hover:opacity-90 px-6 py-2.5 rounded-xl transition-all shadow-lg shadow-brand/20 active:scale-95"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="relative min-h-screen">
      {/* Ambient background blobs */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px] mix-blend-screen" />
        <div className="absolute top-[40%] right-[-10%] w-[30%] h-[50%] bg-cyan-600/10 rounded-full blur-[120px] mix-blend-screen" />
        <div className="absolute bottom-[-10%] left-[20%] w-[40%] h-[40%] bg-brand/10 rounded-full blur-[120px] mix-blend-screen" />
      </div>
      
      <MotionWrapper stagger className="flex flex-col gap-8 max-w-[1400px] mx-auto pb-12 relative z-10">
      {/* Top Section: Net Worth card (stats above chart) */}
      <BentoGrid>
        <BentoItem className="md:col-span-3 xl:col-span-4">
          <NetWorthSection data={data} />
        </BentoItem>
      </BentoGrid>

      {/* Middle Section: Allocation & Movers */}
      <BentoGrid>
        <BentoItem className="md:col-span-1">
          <AllocationSection data={data} />
        </BentoItem>
        <BentoItem className="md:col-span-2">
          <TopMoversSection data={data} />
        </BentoItem>
      </BentoGrid>

      {/* AI Insights (Full Span) */}
      <MotionItem>
        <AiInsightsSection insights={data.aiInsights} />
      </MotionItem>

      <BentoGrid>
        <BentoItem className="md:col-span-3 xl:col-span-4">
          <RiskMetricsSection data={aiRiskMetrics} />
        </BentoItem>
      </BentoGrid>

      {/* Bottom Grid: Checklist, Goals, Reminders, Transactions */}
      <BentoGrid>
         <BentoItem className="md:col-span-3 xl:col-span-2">
           <GoalsSummarySection goals={data.goalsSummary} />
         </BentoItem>
         <BentoItem className="md:col-span-3 xl:col-span-2">
           <RecentTxnsSection txns={data.recentTransactions} />
         </BentoItem>
         <BentoItem className="md:col-span-3 xl:col-span-2">
           <ChecklistSection checklist={data.checklist} upcomingBills={data.upcomingBills} />
         </BentoItem>
         <BentoItem className="md:col-span-3 xl:col-span-2">
           <RemindersSection reminders={data.upcomingReminders} />
         </BentoItem>
      </BentoGrid>
      
    </MotionWrapper>
    </div>
  );
}
