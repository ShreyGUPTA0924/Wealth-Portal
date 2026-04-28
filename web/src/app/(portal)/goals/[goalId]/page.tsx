'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid, ComposedChart, Line, Legend
} from 'recharts';
import {
  ArrowLeft, Pencil, Trash2, Target, Umbrella, Home,
  GraduationCap, Plane, Shield, Heart, AlertCircle, Plus, X, Check, Activity,
} from 'lucide-react';
import apiClient from '@/lib/api-client';
import { getErrorMessage } from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GoalDetail {
  id:                    string;
  portfolioId:           string;
  name:                  string;
  category:              string;
  targetAmount:          number;
  currentAmount:         number;
  targetDate:            string;
  recommendedMonthlySip: number | null;
  recommendedSip:        number;
  healthStatus:          string;
  progressPercent:       number;
  priority:              number;
  createdAt:             string;
  linkedHoldings: {
    id:                string;
    holdingId:         string;
    allocationPercent: number;
    holding: {
      id:           string;
      name:         string;
      symbol:       string | null;
      assetClass:   string;
      currentValue: number;
      pnlPercent:   number | null;
    };
  }[];
  timelineData: { month: number; date: string; projected: number }[];
}

interface Holding {
  id:   string;
  name: string;
  assetClass: string;
  currentValue: number | null;
}

interface SimulationResult {
  projectedCompletionDate: string;
  corpusAtTarget:          number;
  shortfallOrSurplus:      number;
  monthsToComplete:        number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatInr(n: number | null | undefined): string {
  if (n == null) return '—';
  const abs = Math.abs(n);
  if (abs >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`;
  if (abs >= 1_00_000)    return `₹${(n / 1_00_000).toFixed(2)} L`;
  if (abs >= 1_000)       return `₹${(n / 1_000).toFixed(1)} K`;
  return n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
}

function monthsBetween(a: Date, b: Date) {
  return (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth();
}

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  RETIREMENT: { icon: Umbrella,       color: 'text-purple-600 dark:text-purple-400',  bg: 'bg-purple-100 dark:bg-purple-500/20' },
  HOUSE:      { icon: Home,           color: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-100 dark:bg-blue-500/20' },
  EDUCATION:  { icon: GraduationCap,  color: 'text-teal-600 dark:text-teal-400',    bg: 'bg-teal-100 dark:bg-teal-500/20' },
  TRAVEL:     { icon: Plane,          color: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-100 dark:bg-amber-500/20' },
  EMERGENCY:  { icon: Shield,         color: 'text-red-600 dark:text-red-400',     bg: 'bg-red-100 dark:bg-red-500/20' },
  WEDDING:    { icon: Heart,          color: 'text-pink-600 dark:text-pink-400',    bg: 'bg-pink-100 dark:bg-pink-500/20' },
  CUSTOM:     { icon: Target,         color: 'text-foreground-muted',    bg: 'bg-border' },
};

const HEALTH_STYLES: Record<string, string> = {
  ON_TRACK:  'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
  AT_RISK:   'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  OFF_TRACK: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-border rounded-xl ${className ?? ''}`} />;
}

// ─── Simulator ────────────────────────────────────────────────────────────────

function GoalSimulator({ goal }: { goal: GoalDetail }) {
  const [sipAmount, setSipAmount] = useState(goal.recommendedSip || 5000);
  const [result, setResult]       = useState<SimulationResult | null>(null);
  const debounceRef               = useRef<ReturnType<typeof setTimeout> | null>(null);

  const simulateMutation = useMutation({
    mutationFn: (sip: number) =>
      apiClient.post<{ success: boolean; data: SimulationResult }>(
        `/api/goals/${goal.id}/simulate`,
        { monthlySip: sip }
      ).then((r) => r.data.data),
    onSuccess: setResult,
  });

  const runSimulate = useCallback((sip: number) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => simulateMutation.mutate(sip), 500);
  }, [simulateMutation]);

  useEffect(() => {
    runSimulate(sipAmount);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [sipAmount, runSimulate]);

  const completion = result
    ? new Date(result.projectedCompletionDate).toLocaleDateString('en-IN', {
        month: 'short', year: 'numeric',
      })
    : null;

  return (
    <div className="bg-background-card rounded-2xl border border-border p-6">
      <h3 className="text-sm font-semibold text-foreground mb-1">What-if Simulator</h3>
      <p className="text-xs text-foreground-muted mb-5">Adjust monthly SIP to see projected outcomes</p>

      {/* Slider */}
      <div className="mb-5">
        <div className="flex justify-between items-center mb-2">
          <label className="text-xs text-foreground-muted font-medium">Monthly SIP</label>
          <span className="text-base font-bold text-indigo-600 dark:text-indigo-400">{formatInr(sipAmount)}</span>
        </div>
        <input
          type="range"
          min={500}
          max={100000}
          step={500}
          value={sipAmount}
          onChange={(e) => {
            const v = parseInt(e.target.value);
            setSipAmount(v);
            runSimulate(v);
          }}
          className="w-full h-2 bg-border rounded-full appearance-none cursor-pointer accent-[#3C3489]"
        />
        <div className="flex justify-between text-xs text-foreground-muted mt-1">
          <span>₹500</span>
          <span>₹1 L</span>
        </div>
      </div>

      {/* Result cards */}
      {simulateMutation.isPending && !result ? (
        <div className="grid grid-cols-2 gap-3">
          {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : result ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-border/50 rounded-xl p-4">
            <p className="text-xs text-foreground-muted mb-1">Goal achieved by</p>
            <p className="text-base font-bold text-foreground">{completion}</p>
            <p className="text-xs text-foreground-muted">{result.monthsToComplete} months</p>
          </div>
          <div className={`rounded-xl p-4 ${result.shortfallOrSurplus >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <p className="text-xs text-foreground-muted mb-1">
              {result.shortfallOrSurplus >= 0 ? 'Surplus at target' : 'Shortfall at target'}
            </p>
            <p className={`text-base font-bold ${result.shortfallOrSurplus >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              {formatInr(Math.abs(result.shortfallOrSurplus))}
            </p>
            <p className="text-xs text-foreground-muted">Corpus: {formatInr(result.corpusAtTarget)}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── AI Monte Carlo Simulation ────────────────────────────────────────────────

function MonteCarloSimulation({ goalId, targetAmount }: { goalId: string; targetAmount: number }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['ai-monte-carlo', goalId],
    queryFn:  () => apiClient.post('/api/ai/monte-carlo', { goalId }).then((r) => r.data.data),
    staleTime: 60_000,
  });

  if (isLoading) return <Skeleton className="h-64 w-full mt-5" />;
  if (error || !data) return null;

  return (
    <div className="bg-background-card rounded-2xl border border-brand/20 p-6 relative overflow-hidden mt-5 shadow-sm shadow-brand/5">
      <div className="absolute top-0 right-0 w-32 h-32 bg-brand/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center">
            <Activity className="w-4 h-4 text-brand" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              Wealth Projection
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-premium-gradient text-white">AI POWERED</span>
            </h3>
            <p className="text-xs text-foreground-muted mt-0.5">Monte Carlo Simulation (10,000 paths)</p>
          </div>
        </div>
        <div className="text-right">
           <p className="text-xs text-foreground-muted">Success Probability</p>
           <p className={`text-xl font-bold ${data.probability >= 80 ? 'text-green-500' : data.probability >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
              {data.probability.toFixed(1)}%
           </p>
        </div>
      </div>

      <div className="h-64 mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data.chart_data} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="colorMedian" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
            <XAxis dataKey="year" tick={{ fontSize: 10, fill: 'var(--foreground-muted)' }} tickLine={false} axisLine={false} />
            <YAxis tickFormatter={(v: number) => formatInr(v)} tick={{ fontSize: 10, fill: 'var(--foreground-muted)' }} tickLine={false} axisLine={false} width={60} />
            <Tooltip
              formatter={(v: any) => formatInr(Number(v))}
              contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'rgba(var(--background-card-rgb), 0.9)', backdropFilter: 'blur(8px)' }}
            />
            <Legend wrapperStyle={{ fontSize: '10px' }} />
            
            <Area type="monotone" dataKey="p90" name="Best Case (90th %ile)" stroke="none" fill="#10B981" fillOpacity={0.1} />
            <Area type="monotone" dataKey="p10" name="Worst Case (10th %ile)" stroke="none" fill="#EF4444" fillOpacity={0.1} />
            <Area type="monotone" dataKey="median" name="Median Path" stroke="#8B5CF6" strokeWidth={3} fill="url(#colorMedian)" />
            
            <ReferenceLine y={targetAmount} stroke="#F59E0B" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'Target Goal', fill: '#F59E0B', fontSize: 10 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Link Holding Modal ───────────────────────────────────────────────────────

function LinkHoldingPanel({ goalId, onClose }: { goalId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [selectedId,  setSelectedId]  = useState('');
  const [allocation,  setAllocation]  = useState('100');
  const [error,       setError]       = useState('');

  const { data: holdingsData } = useQuery({
    queryKey: ['holdings-list'],
    queryFn:  () =>
      apiClient.get<{ success: boolean; data: Holding[] }>('/api/holdings')
        .then((r) => r.data.data),
  });

  const linkMutation = useMutation({
    mutationFn: () =>
      apiClient.post(`/api/goals/${goalId}/link-holding`, {
        holdingId: selectedId,
        allocationPercent: parseFloat(allocation),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goal', goalId] });
      onClose();
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  return (
    <div className="bg-border/50 rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Link a Holding</p>
        <button onClick={onClose} className="text-foreground-muted hover:text-foreground-muted">
          <X className="w-4 h-4" />
        </button>
      </div>

      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3C3489]/30 focus:border-[#3C3489] bg-background-card"
      >
        <option value="">Select holding…</option>
        {holdingsData?.map((h) => (
          <option key={h.id} value={h.id}>{h.name} ({h.assetClass})</option>
        ))}
      </select>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs text-foreground-muted block mb-1">Allocation %</label>
          <input
            type="number"
            value={allocation}
            onChange={(e) => setAllocation(e.target.value)}
            min="1"
            max="100"
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3C3489]/30 focus:border-[#3C3489]"
          />
        </div>
        <button
          onClick={() => linkMutation.mutate()}
          disabled={!selectedId || linkMutation.isPending}
          className="self-end px-4 py-2 bg-[#3C3489] hover:bg-[#2d2871] text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
        >
          {linkMutation.isPending ? '…' : 'Link'}
        </button>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GoalDetailPage() {
  const { goalId } = useParams<{ goalId: string }>();
  const router     = useRouter();
  const queryClient = useQueryClient();

  const [showLinkPanel,   setShowLinkPanel]   = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal,   setShowEditModal]   = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['goal', goalId],
    queryFn:  () =>
      apiClient.get<{ success: boolean; data: { goal: GoalDetail } }>(`/api/goals/${goalId}`)
        .then((r) => r.data.data),
    staleTime: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiClient.delete(`/api/goals/${goalId}`),
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      router.push('/goals');
    },
  });

  const goal = data?.goal;

  if (isLoading) {
    return (
      <div className="space-y-5 max-w-4xl">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-52 w-full" />
      </div>
    );
  }

  if (error || !goal) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-foreground-muted">
        <AlertCircle className="w-10 h-10 mb-3 text-red-400" />
        <p className="text-sm">Goal not found</p>
        <button
          onClick={() => router.push('/goals')}
          className="mt-3 text-xs text-[#3C3489] hover:underline"
        >
          Back to Goals
        </button>
      </div>
    );
  }

  const cfg    = CATEGORY_CONFIG[goal.category] ?? CATEGORY_CONFIG['CUSTOM']!;
  const Icon   = cfg.icon;
  const now    = new Date();
  const months = Math.max(0, monthsBetween(now, new Date(goal.targetDate)));
  const years  = Math.floor(months / 12);
  const remMo  = months % 12;
  const timeLabel = years > 0 ? `${years}y ${remMo}mo left` : `${months} months left`;

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-foreground-muted hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Goals
      </button>

      {/* Header card */}
      <div className="bg-background-card rounded-2xl border border-border p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
              <Icon className={`w-7 h-7 ${cfg.color}`} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{goal.name}</h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs text-foreground-muted">{goal.category} · {timeLabel}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${HEALTH_STYLES[goal.healthStatus] ?? 'bg-border text-foreground-muted'}`}>
                  {goal.healthStatus.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEditModal(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-foreground-muted border border-border hover:bg-border/50 px-3 py-2 rounded-lg transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-red-500 border border-red-100 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium text-foreground">{goal.progressPercent.toFixed(1)}% achieved</span>
            <span className="text-foreground-muted">
              {formatInr(goal.currentAmount)} / {formatInr(goal.targetAmount)}
            </span>
          </div>
          <div className="h-3 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-[#3C3489] rounded-full transition-all duration-700"
              style={{ width: `${goal.progressPercent}%` }}
            />
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
          {[
            { label: 'Current',      value: formatInr(goal.currentAmount) },
            { label: 'Target',       value: formatInr(goal.targetAmount) },
            { label: 'Monthly SIP',  value: formatInr(goal.recommendedMonthlySip) },
            { label: 'Time Left',    value: timeLabel },
          ].map((s) => (
            <div key={s.label} className="bg-border/50 rounded-xl px-4 py-3">
              <p className="text-xs text-foreground-muted">{s.label}</p>
              <p className="text-sm font-bold text-foreground mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline chart */}
      {goal.timelineData.length > 0 && (
        <div className="bg-background-card rounded-2xl border border-border p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Projected Growth</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={goal.timelineData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="goalGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3C3489" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3C3489" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tickFormatter={(v: number) => formatInr(v)} tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} width={58} />
                <Tooltip
                  formatter={(v: any) => formatInr(Number(v))}
                  contentStyle={{ borderRadius: 10, fontSize: 12, border: '1px solid #E5E7EB' }}
                />
                <ReferenceLine
                  y={goal.targetAmount}
                  stroke="#EF4444"
                  strokeDasharray="4 4"
                  label={{ value: 'Target', position: 'right', fontSize: 10, fill: '#EF4444' }}
                />
                <Area name="Projected" type="monotone" dataKey="projected" stroke="#3C3489" strokeWidth={2.5} fill="url(#goalGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* What-if simulator */}
      <GoalSimulator goal={goal} />

      {/* AI Monte Carlo Simulator */}
      <MonteCarloSimulation goalId={goal.id} targetAmount={goal.targetAmount} />

      {/* Linked holdings */}
      <div className="bg-background-card rounded-2xl border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">Linked Holdings</h3>
          <button
            onClick={() => setShowLinkPanel((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-[#3C3489] border border-[#3C3489]/30 hover:bg-[#3C3489]/5 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Link Holding
          </button>
        </div>

        {showLinkPanel && (
          <div className="mb-4">
            <LinkHoldingPanel goalId={goal.id} onClose={() => setShowLinkPanel(false)} />
          </div>
        )}

        {goal.linkedHoldings.length === 0 ? (
          <p className="text-sm text-foreground-muted text-center py-6">
            No holdings linked yet. Link holdings to track goal progress automatically.
          </p>
        ) : (
          <ul className="space-y-2">
            {goal.linkedHoldings.map((gh) => (
              <li key={gh.id} className="flex items-center justify-between gap-3 p-3 bg-border/50 rounded-xl">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{gh.holding.name}</p>
                  <p className="text-xs text-foreground-muted">
                    {gh.holding.assetClass} · {formatInr(gh.holding.currentValue)}
                  </p>
                </div>
                <span className="text-sm font-semibold text-[#3C3489] shrink-0">
                  {gh.allocationPercent}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-background-card rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-base font-bold text-foreground mb-2">Delete Goal?</h3>
            <p className="text-sm text-foreground-muted mb-5">
              This will permanently delete <strong>{goal.name}</strong> and unlink all associated holdings. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 text-sm font-medium text-foreground-muted border border-border rounded-xl py-2.5 hover:bg-border/50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="flex-1 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl py-2.5 transition-colors disabled:opacity-60"
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {showEditModal && (
        <EditGoalModal
          goal={goal}
          onClose={() => setShowEditModal(false)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['goal', goalId] });
            queryClient.invalidateQueries({ queryKey: ['goals'] });
            setShowEditModal(false);
          }}
        />
      )}
    </div>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditGoalModal({
  goal,
  onClose,
  onSaved,
}: {
  goal:    GoalDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name,         setName]         = useState(goal.name);
  const [targetAmount, setTargetAmount] = useState(String(goal.targetAmount));
  const [targetDate,   setTargetDate]   = useState(goal.targetDate.slice(0, 10));
  const [error,        setError]        = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      apiClient.patch(`/api/goals/${goal.id}`, {
        name:         name.trim(),
        targetAmount: parseFloat(targetAmount),
        targetDate,
      }),
    onSuccess: onSaved,
    onError:   (err) => setError(getErrorMessage(err)),
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-background-card rounded-2xl p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-foreground">Edit Goal</h3>
          <button onClick={onClose} className="text-foreground-muted hover:text-foreground-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-foreground-muted block mb-1.5">Goal Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3C3489]/30 focus:border-[#3C3489]"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground-muted block mb-1.5">Target Amount (₹)</label>
            <input
              type="number"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3C3489]/30 focus:border-[#3C3489]"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground-muted block mb-1.5">Target Date</label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3C3489]/30 focus:border-[#3C3489]"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 text-sm font-medium text-foreground-muted border border-border rounded-xl py-2.5 hover:bg-border/50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-white bg-[#3C3489] hover:bg-[#2d2871] rounded-xl py-2.5 disabled:opacity-60 transition-colors"
            >
              {mutation.isPending ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <><Check className="w-4 h-4" /> Save</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
