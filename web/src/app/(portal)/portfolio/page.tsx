'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, TrendingDown, Plus, ChevronUp, ChevronDown,
  Wallet, RefreshCw, AlertCircle, Activity, BarChart2, ShieldAlert
} from 'lucide-react';
import {
  ScatterChart, Scatter, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, ReferenceDot, LabelList
} from 'recharts';
import apiClient from '@/lib/api-client';
import { Card } from '@/components/ui/Card';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Holding {
  id:            string;
  assetClass:    string;
  symbol:        string | null;
  name:          string;
  quantity:      number;
  avgBuyPrice:   number;
  totalInvested: number;
  currentPrice:  number | null;
  currentValue:  number | null;
  pnlAbsolute:   number | null;
  pnlPercent:    number | null;
  xirr:          number | null;
  riskScore:     number | null;
  weight:        number;
}

interface PortfolioSummary {
  totalInvested: number;
  currentValue:  number;
  pnlAbsolute:   number;
  pnlPercent:    number;
}

type SortKey = 'name' | 'currentValue' | 'totalInvested' | 'pnlAbsolute' | 'pnlPercent' | 'xirr' | 'riskScore' | 'weight';

const ASSET_TABS = [
  { label: 'All',          value: '' },
  { label: 'Stocks',       value: 'STOCK' },
  { label: 'Mutual Funds', value: 'MUTUAL_FUND' },
  { label: 'FD',           value: 'FD' },
  { label: 'Gold',         value: 'GOLD' },
  { label: 'Crypto',       value: 'CRYPTO' },
  { label: 'Others',       value: 'OTHERS' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatInr(n: number | null | undefined): string {
  if (n == null) return '—';
  const abs = Math.abs(n);
  if (abs >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`;
  if (abs >= 1_00_000)    return `₹${(n / 1_00_000).toFixed(2)} L`;
  return n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
}

function RiskPill({ score }: { score: number | null }) {
  if (score == null) return <span className="text-foreground-muted">—</span>;
  const color = score <= 4 ? 'bg-green-100 text-green-700'
              : score <= 6 ? 'bg-yellow-100 text-yellow-700'
              : 'bg-red-100 text-red-700';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {score}/10
    </span>
  );
}

function PnlBadge({ value, isPercent }: { value: number | null; isPercent?: boolean }) {
  if (value == null) return <span className="text-foreground-muted">—</span>;
  const positive = value >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-sm font-medium ${positive ? 'text-green-600' : 'text-red-500'}`}>
      {positive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
      {isPercent ? `${value >= 0 ? '+' : ''}${value.toFixed(2)}%` : formatInr(value)}
    </span>
  );
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: 'asc' | 'desc' }) {
  if (col !== sortKey) return <ChevronUp className="w-3 h-3 text-gray-300" />;
  return sortDir === 'asc'
    ? <ChevronUp className="w-3 h-3 text-[#3C3489]" />
    : <ChevronDown className="w-3 h-3 text-[#3C3489]" />;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-50">
      {[...Array(8)].map((_, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="h-4 bg-border rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('');
  const [sortKey,   setSortKey]   = useState<SortKey>('currentValue');
  const [sortDir,   setSortDir]   = useState<'asc' | 'desc'>('desc');

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['portfolio-summary'],
    queryFn:  () =>
      apiClient.get<{ success: boolean; data: PortfolioSummary }>('/api/portfolio')
        .then((r) => r.data.data),
  });

  const { data: aiOptimize } = useQuery({
    queryKey: ['ai-optimize'],
    queryFn:  () => apiClient.get('/api/ai/optimize').then((r) => r.data.data),
  });

  const { data: aiRiskScore } = useQuery({
    queryKey: ['ai-risk-score'],
    queryFn:  () => apiClient.get('/api/ai/custom-risk-score').then((r) => r.data.data),
  });

  const { data: aiCorrelation } = useQuery({
    queryKey: ['ai-correlation'],
    queryFn:  () => apiClient.get('/api/ai/correlation').then((r) => r.data.data),
  });

  const { data: holdingsData, isLoading, error, refetch } = useQuery({
    queryKey: ['holdings', activeTab],
    queryFn:  () =>
      apiClient
        .get<{ success: boolean; data: Holding[] }>(
          '/api/holdings',
          // 'OTHERS' is a UI-only filter — fetch all and filter client-side
          { params: activeTab && activeTab !== 'OTHERS' ? { assetClass: activeTab } : {} }
        )
        .then((r) => r.data.data),
  });

  // Asset classes that have their own dedicated tab — everything else → "Others"
  const TABBED = new Set(['STOCK', 'MUTUAL_FUND', 'FD', 'GOLD', 'CRYPTO']);
  const holdings = holdingsData
    ? activeTab === 'OTHERS'
      ? holdingsData.filter((h) => !TABBED.has(h.assetClass))
      : holdingsData
    : [];

  // Client-side sort
  const sorted = [...holdings].sort((a, b) => {
    if (sortKey === 'name') {
      return sortDir === 'asc'
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name);
    }
    const av = (a[sortKey] as number | null) ?? 0;
    const bv = (b[sortKey] as number | null) ?? 0;
    return sortDir === 'asc' ? av - bv : bv - av;
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const summary = summaryData;

  return (
    <div className="space-y-5">
      {/* ── Summary bar ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryLoading
          ? [...Array(4)].map((_, i) => (
              <div key={i} className="bg-background-card rounded-2xl p-4 border border-border animate-pulse">
                <div className="h-3 w-24 bg-border rounded mb-3" />
                <div className="h-6 w-32 bg-border rounded" />
              </div>
            ))
          : (
            <>
              <SummaryCard label="Total Invested"  value={formatInr(summary?.totalInvested ?? 0)} />
              <SummaryCard label="Current Value"   value={formatInr(summary?.currentValue  ?? 0)} />
              <SummaryCard
                label="P&L (₹)"
                value={formatInr(summary?.pnlAbsolute ?? 0)}
                positive={(summary?.pnlAbsolute ?? 0) >= 0}
                colored
              />
              <SummaryCard
                label="P&L (%)"
                value={`${(summary?.pnlPercent ?? 0) >= 0 ? '+' : ''}${(summary?.pnlPercent ?? 0).toFixed(2)}%`}
                positive={(summary?.pnlPercent ?? 0) >= 0}
                colored
              />
            </>
          )
        }
      </div>

      {/* ── AI Insights Sections ── */}
      {holdings.length >= 2 && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="xl:col-span-2">
             <OptimizationSection data={aiOptimize} />
          </div>
          <div className="flex flex-col gap-5">
             <CustomRiskSection data={aiRiskScore} />
             <CorrelationHeatmap data={aiCorrelation} />
          </div>
        </div>
      )}

      {/* ── Holdings table ── */}
      <div className="bg-background-card rounded-2xl border border-border overflow-hidden">
        {/* Header row */}
        <div className="flex items-center justify-between px-5 pt-5 pb-0">
          <h2 className="text-base font-semibold text-foreground">Holdings</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 text-xs text-foreground-muted hover:text-[#3C3489] transition-colors px-2.5 py-1.5 rounded-lg hover:bg-[#3C3489]/5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            <Link
              href="/portfolio/add"
              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#3C3489] hover:bg-[#2d2871] px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Holding
            </Link>
          </div>
        </div>

        {/* Asset class tabs */}
        <div className="flex gap-1 px-5 pt-4 pb-0 overflow-x-auto">
          {ASSET_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors
                          ${activeTab === tab.value
                            ? 'bg-[#3C3489] text-white'
                            : 'text-foreground-muted hover:bg-border/50 hover:text-foreground'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto mt-3">
          {error ? (
            <div className="flex flex-col items-center justify-center py-16 text-foreground-muted">
              <AlertCircle className="w-8 h-8 mb-3 text-red-400" />
              <p className="text-sm">Failed to load holdings</p>
              <button onClick={() => refetch()} className="mt-3 text-xs text-[#3C3489] hover:underline">
                Try again
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {([
                    ['name',         'Name'],
                    ['currentValue', 'Current Value'],
                    ['totalInvested','Invested'],
                    ['pnlAbsolute',  'P&L (₹)'],
                    ['pnlPercent',   'P&L (%)'],
                    ['xirr',         'XIRR'],
                    ['riskScore',    'Risk'],
                    ['weight',       'Weight'],
                  ] as [SortKey, string][]).map(([key, label]) => (
                    <th
                      key={key}
                      onClick={() => toggleSort(key)}
                      className="px-4 py-3 text-left text-xs font-medium text-foreground-muted cursor-pointer select-none hover:text-foreground whitespace-nowrap"
                    >
                      <div className="flex items-center gap-1">
                        {label}
                        <SortIcon col={key} sortKey={sortKey} sortDir={sortDir} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
                  : sorted.length === 0
                    ? (
                      <tr>
                        <td colSpan={8} className="py-16 text-center">
                          <div className="flex flex-col items-center gap-3 text-foreground-muted">
                            <Wallet className="w-10 h-10 text-gray-200" />
                            <p className="text-sm font-medium text-foreground-muted">No holdings yet</p>
                            <Link
                              href="/portfolio/add"
                              className="text-xs font-semibold text-white bg-[#3C3489] hover:bg-[#2d2871] px-4 py-2 rounded-lg transition-colors"
                            >
                              Add your first holding
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )
                    : sorted.map((h) => (
                        <tr
                          key={h.id}
                          onClick={() => router.push(`/portfolio/${h.id}`)}
                          className="border-b border-gray-50 hover:bg-border/50 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-3.5">
                            <div>
                              <p className="font-medium text-foreground leading-tight">{h.name}</p>
                              <p className="text-xs text-foreground-muted mt-0.5">
                                {h.symbol ?? h.assetClass} · {h.quantity.toLocaleString('en-IN')} units
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 font-medium text-foreground">
                            {formatInr(h.currentValue)}
                          </td>
                          <td className="px-4 py-3.5 text-foreground-muted">
                            {formatInr(h.totalInvested)}
                          </td>
                          <td className="px-4 py-3.5">
                            <PnlBadge value={h.pnlAbsolute} />
                          </td>
                          <td className="px-4 py-3.5">
                            <PnlBadge value={h.pnlPercent} isPercent />
                          </td>
                          <td className="px-4 py-3.5 text-foreground-muted">
                            {h.xirr != null ? `${h.xirr.toFixed(1)}%` : '—'}
                          </td>
                          <td className="px-4 py-3.5">
                            <RiskPill score={h.riskScore} />
                          </td>
                          <td className="px-4 py-3.5 text-foreground-muted">
                            {h.weight.toFixed(1)}%
                          </td>
                        </tr>
                    ))
                }
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({
  label, value, positive, colored,
}: {
  label:    string;
  value:    string;
  positive?: boolean;
  colored?:  boolean;
}) {
  const textColor = colored
    ? positive ? 'text-green-600' : 'text-red-500'
    : 'text-foreground';

  return (
    <div className="bg-background-card rounded-2xl p-4 border border-border">
      <p className="text-xs text-foreground-muted font-medium">{label}</p>
      <p className={`text-xl font-bold mt-1 ${textColor}`}>{value}</p>
    </div>
  );
}

// ─── AI Components ─────────────────────────────────────────────────────────────

function OptimizationSection({ data }: { data: any }) {
  if (!data || !data.efficient_frontier || data.efficient_frontier.length === 0) return null;

  const current = data.current_metrics;
  const optimal = data.optimal_metrics;
  
  // Format frontier for chart
  const frontierData = data.efficient_frontier.map((p: any) => ({ risk: p.risk, return: p.return }));
  const currPoint = [{ risk: current.risk, return: current.return, name: 'Current' }];
  const optPoint = [{ risk: optimal.risk, return: optimal.return, name: 'Optimal' }];

  const COLORS = ['#8B5CF6', '#10B981', '#F59E0B', '#3B82F6', '#EF4444', '#14B8A6'];

  return (
    <Card className="p-5 h-full flex flex-col border border-brand/20 shadow-sm shadow-brand/5 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-brand/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="flex items-center gap-2 mb-4 relative z-10">
        <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center">
          <BarChart2 className="w-4 h-4 text-brand" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            Optimal Portfolio Recommendation
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-premium-gradient text-white">AI POWERED</span>
          </h3>
          <p className="text-xs text-foreground-muted mt-0.5">Modern Portfolio Theory (Markowitz)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 mt-2">
        {/* Efficient Frontier Chart */}
        <div className="flex flex-col">
          <p className="text-xs font-semibold text-foreground-muted mb-4 text-center">Efficient Frontier</p>
          <div className="flex-1 min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                <XAxis type="number" dataKey="risk" name="Risk (Vol)" tickFormatter={(v) => `${v.toFixed(1)}%`} tick={{ fontSize: 10, fill: 'var(--foreground-muted)' }} axisLine={false} tickLine={false} domain={['dataMin - 2', 'dataMax + 2']} label={{ value: 'Risk (Volatility %)', position: 'insideBottom', offset: -10, fontSize: 10, fill: 'var(--foreground-muted)' }} />
                <YAxis type="number" dataKey="return" name="Return" tickFormatter={(v) => `${v.toFixed(1)}%`} tick={{ fontSize: 10, fill: 'var(--foreground-muted)' }} axisLine={false} tickLine={false} domain={['dataMin - 2', 'dataMax + 2']} label={{ value: 'Expected Return %', angle: -90, position: 'insideLeft', fontSize: 10, fill: 'var(--foreground-muted)' }} />
                <RechartsTooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'rgba(var(--background-card-rgb), 0.9)', backdropFilter: 'blur(8px)' }} />
                <Scatter name="Efficient Frontier" data={frontierData} fill="#D1D5DB" line={{ stroke: '#9CA3AF', strokeWidth: 2 }} shape="circle" />
                <Scatter name="Current" data={currPoint} fill="#EF4444" shape="star" />
                <Scatter name="Optimal" data={optPoint} fill="#10B981" shape="star" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-2">
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-red-500 rounded-full" /><span className="text-[10px] text-foreground-muted">Current</span></div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-green-500 rounded-full" /><span className="text-[10px] text-foreground-muted">Optimal</span></div>
          </div>
        </div>

        {/* Optimal Weights */}
        <div className="flex flex-col bg-border/20 rounded-xl p-4 border border-border/50">
          <p className="text-xs font-semibold text-foreground-muted mb-3">Recommended Allocation</p>
          <div className="flex-1 flex items-center justify-center">
            <div className="w-32 h-32 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.optimal_weights} dataKey="weight" nameKey="assetClass" innerRadius={35} outerRadius={55} stroke="none" paddingAngle={2}>
                    {data.optimal_weights.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(val: number) => `${val.toFixed(1)}%`} contentStyle={{ borderRadius: '8px', border: 'none', backgroundColor: '#1F2937', color: '#fff' }} itemStyle={{ color: '#fff' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="ml-4 flex flex-col gap-2 flex-1 max-h-32 overflow-y-auto">
              {data.optimal_weights.map((w: any, i: number) => (
                <div key={w.assetClass} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-[10px] font-medium text-foreground">{w.assetClass}</span>
                  </div>
                  <span className="text-[10px] font-bold text-foreground">{w.weight.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-2 text-center">
             <div>
                <p className="text-[10px] text-foreground-muted mb-1">Expected Return</p>
                <p className="text-sm font-bold text-green-500">{optimal.return.toFixed(1)}%</p>
             </div>
             <div>
                <p className="text-[10px] text-foreground-muted mb-1">Target Risk</p>
                <p className="text-sm font-bold text-foreground">{optimal.risk.toFixed(1)}%</p>
             </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function CustomRiskSection({ data }: { data: any }) {
  if (!data) return null;

  const score = data.risk_score;
  const color = score <= 4 ? 'text-green-500' : score <= 7 ? 'text-amber-500' : 'text-red-500';
  const bg = score <= 4 ? 'bg-green-50' : score <= 7 ? 'bg-amber-50' : 'bg-red-50';

  return (
    <Card className="p-5 relative overflow-hidden group">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full ${bg} flex items-center justify-center`}>
            <ShieldAlert className={`w-4 h-4 ${color}`} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Custom AI Risk Score</h3>
            <p className="text-xs text-foreground-muted mt-0.5">Based on Volatility & Concentration</p>
          </div>
        </div>
        <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center border border-border shadow-inner`}>
           <span className={`text-lg font-bold ${color}`}>{score}</span>
        </div>
      </div>
      
      <p className="text-xs font-semibold text-foreground mb-3">{data.message}</p>
      
      <div className="grid grid-cols-2 gap-3 mt-auto">
         <div className="bg-border/30 rounded-lg p-2 text-center">
            <p className="text-[10px] text-foreground-muted">Est. Volatility</p>
            <p className="text-sm font-bold text-foreground mt-0.5">{(data.factors.volatility * 100).toFixed(1)}%</p>
         </div>
         <div className="bg-border/30 rounded-lg p-2 text-center">
            <p className="text-[10px] text-foreground-muted">Concentration</p>
            <p className="text-sm font-bold text-foreground mt-0.5">{(data.factors.concentration).toFixed(2)}</p>
         </div>
      </div>
    </Card>
  );
}

function CorrelationHeatmap({ data }: { data: any }) {
  if (!data || !data.matrix || data.matrix.length === 0) return null;

  const labels = data.labels;
  const n = labels.length;

  return (
    <Card className="p-5 flex-1 flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
          <Activity className="w-4 h-4 text-blue-500" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Asset Correlation Heatmap</h3>
          <p className="text-xs text-foreground-muted mt-0.5">Check your diversification</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-[240px] aspect-square relative grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {data.matrix.map((cell: any, i: number) => {
             // value ranges roughly from -1 to 1. Map to color.
             // Positive -> Blue, Negative -> Red, near 0 -> white/gray
             const v = cell.value;
             const isPos = v > 0;
             const intensity = Math.min(1, Math.abs(v));
             const r = isPos ? 255 - (intensity * 150) : 255;
             const g = isPos ? 255 - (intensity * 150) : 255 - (intensity * 200);
             const b = isPos ? 255 : 255 - (intensity * 200);
             const color = `rgb(${r},${g},${b})`;
             
             return (
               <div key={i} className="border border-background w-full h-full relative group cursor-pointer" style={{ backgroundColor: color }}>
                 <div className="absolute inset-0 flex items-center justify-center">
                   <span className="text-[8px] font-medium text-black/50 opacity-0 group-hover:opacity-100 transition-opacity">{v.toFixed(2)}</span>
                 </div>
               </div>
             );
          })}
        </div>
      </div>
      <div className="flex justify-between items-center mt-3 px-4">
         <span className="text-[10px] text-foreground-muted flex items-center gap-1"><span className="w-2 h-2 bg-red-400 rounded-full"/> Inverse (-1)</span>
         <span className="text-[10px] text-foreground-muted flex items-center gap-1"><span className="w-2 h-2 bg-gray-200 rounded-full"/> None (0)</span>
         <span className="text-[10px] text-foreground-muted flex items-center gap-1"><span className="w-2 h-2 bg-blue-400 rounded-full"/> Correlated (1)</span>
      </div>
    </Card>
  );
}
