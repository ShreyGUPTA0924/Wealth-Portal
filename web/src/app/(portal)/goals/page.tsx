'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Target, Plus, AlertCircle, TrendingUp,
  Umbrella, Home, GraduationCap, Plane, Shield, Heart,
} from 'lucide-react';
import apiClient from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Goal {
  id:                    string;
  name:                  string;
  category:              string;
  targetAmount:          number;
  currentAmount:         number;
  targetDate:            string;
  recommendedMonthlySip: number | null;
  healthStatus:          string;
  progressPercent:       number;
  priority:              number;
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

function monthsLeft(targetDate: string): string {
  const months = Math.max(
    0,
    Math.round(
      (new Date(targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30)
    )
  );
  if (months >= 12) return `${Math.floor(months / 12)}y ${months % 12}m left`;
  return `${months}m left`;
}

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  RETIREMENT: { icon: Umbrella,       color: 'text-purple-600',  bg: 'bg-purple-100' },
  HOUSE:      { icon: Home,           color: 'text-blue-600',    bg: 'bg-blue-100' },
  EDUCATION:  { icon: GraduationCap,  color: 'text-teal-600',    bg: 'bg-teal-100' },
  TRAVEL:     { icon: Plane,          color: 'text-amber-600',   bg: 'bg-amber-100' },
  EMERGENCY:  { icon: Shield,         color: 'text-red-600',     bg: 'bg-red-100' },
  WEDDING:    { icon: Heart,          color: 'text-pink-600',    bg: 'bg-pink-100' },
  CUSTOM:     { icon: Target,         color: 'text-foreground-muted',    bg: 'bg-border' },
};

const HEALTH_STYLES: Record<string, string> = {
  ON_TRACK:  'bg-green-100 text-green-700',
  AT_RISK:   'bg-amber-100 text-amber-700',
  OFF_TRACK: 'bg-red-100 text-red-700',
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function GoalCardSkeleton() {
  return (
    <div className="bg-background-card rounded-2xl border border-border p-5 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-border" />
        <div className="flex-1">
          <div className="h-4 w-32 bg-border rounded mb-1" />
          <div className="h-3 w-20 bg-border rounded" />
        </div>
      </div>
      <div className="h-2 bg-border rounded-full mb-3" />
      <div className="grid grid-cols-2 gap-2">
        <div className="h-10 bg-border rounded-lg" />
        <div className="h-10 bg-border rounded-lg" />
      </div>
    </div>
  );
}

// ─── Goal Card ────────────────────────────────────────────────────────────────

function GoalCard({ goal }: { goal: Goal }) {
  const cfg  = CATEGORY_CONFIG[goal.category] ?? CATEGORY_CONFIG['CUSTOM']!;
  const Icon = cfg.icon;

  return (
    <Link href={`/goals/${goal.id}`} className="block group">
      <div className="bg-background-card rounded-2xl border border-border p-5 hover:shadow-md hover:border-[#3C3489]/20 transition-all duration-200">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
              <Icon className={`w-5 h-5 ${cfg.color}`} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground group-hover:text-[#3C3489] transition-colors leading-tight">
                {goal.name}
              </p>
              <p className="text-xs text-foreground-muted mt-0.5">{goal.category} · {monthsLeft(goal.targetDate)}</p>
            </div>
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${HEALTH_STYLES[goal.healthStatus] ?? 'bg-border text-foreground-muted'}`}>
            {goal.healthStatus.replace('_', ' ')}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-foreground-muted mb-1.5">
            <span>{goal.progressPercent.toFixed(0)}% achieved</span>
            <span>{formatInr(goal.currentAmount)} / {formatInr(goal.targetAmount)}</span>
          </div>
          <div className="h-2.5 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-[#3C3489] rounded-full transition-all duration-700"
              style={{ width: `${goal.progressPercent}%` }}
            />
          </div>
        </div>

        {/* Footer stats */}
        <div className="grid grid-cols-2 gap-2 mt-4">
          <div className="bg-border/50 rounded-xl px-3 py-2">
            <p className="text-xs text-foreground-muted">Target</p>
            <p className="text-sm font-semibold text-foreground">{formatInr(goal.targetAmount)}</p>
          </div>
          <div className="bg-border/50 rounded-xl px-3 py-2">
            <p className="text-xs text-foreground-muted">Monthly SIP</p>
            <p className="text-sm font-semibold text-[#3C3489]">
              {goal.recommendedMonthlySip ? formatInr(goal.recommendedMonthlySip) : '—'}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GoalsPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['goals'],
    queryFn:  () =>
      apiClient.get<{ success: boolean; data: { goals: Goal[] } }>('/api/goals')
        .then((r) => r.data.data),
    staleTime: 30_000,
  });

  const goals = data?.goals ?? [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">My Goals</h2>
          <p className="text-sm text-foreground-muted mt-0.5">Track your financial milestones</p>
        </div>
        <Link
          href="/goals/new"
          className="flex items-center gap-1.5 text-sm font-semibold text-white bg-[#3C3489] hover:bg-[#2d2871] px-4 py-2 rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Goal
        </Link>
      </div>

      {/* Error */}
      {error && (
        <div className="flex flex-col items-center justify-center py-16 text-foreground-muted">
          <AlertCircle className="w-8 h-8 mb-3 text-red-400" />
          <p className="text-sm">Failed to load goals</p>
          <button onClick={() => refetch()} className="mt-2 text-xs text-[#3C3489] hover:underline">
            Try again
          </button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <GoalCardSkeleton key={i} />)}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && goals.length === 0 && (
        <div className="bg-background-card rounded-2xl border border-border p-16 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#3C3489]/10 flex items-center justify-center mb-4">
            <Target className="w-8 h-8 text-[#3C3489]" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-2">Create your first goal</h3>
          <p className="text-sm text-foreground-muted max-w-xs mb-6">
            Set financial goals like retirement, home purchase, or education and track your progress.
          </p>
          <Link
            href="/goals/new"
            className="flex items-center gap-2 text-sm font-semibold text-white bg-[#3C3489] hover:bg-[#2d2871] px-5 py-2.5 rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" /> Create a Goal
          </Link>
        </div>
      )}

      {/* Goals grid */}
      {!isLoading && !error && goals.length > 0 && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-background-card rounded-2xl border border-border p-4">
              <p className="text-xs text-foreground-muted">Total Goals</p>
              <p className="text-2xl font-bold text-foreground mt-1">{goals.length}</p>
            </div>
            <div className="bg-background-card rounded-2xl border border-border p-4">
              <p className="text-xs text-foreground-muted">On Track</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {goals.filter((g) => g.healthStatus === 'ON_TRACK').length}
              </p>
            </div>
            <div className="bg-background-card rounded-2xl border border-border p-4">
              <p className="text-xs text-foreground-muted">At Risk</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">
                {goals.filter((g) => g.healthStatus === 'AT_RISK').length}
              </p>
            </div>
            <div className="bg-background-card rounded-2xl border border-border p-4">
              <p className="text-xs text-foreground-muted">Total Target</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {formatInr(goals.reduce((s, g) => s + g.targetAmount, 0))}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {goals.map((g) => <GoalCard key={g.id} goal={g} />)}
          </div>

          <div className="text-center">
            <Link
              href="/goals/new"
              className="inline-flex items-center gap-2 text-sm font-medium text-[#3C3489] hover:text-[#2d2871] border border-[#3C3489]/30 hover:border-[#3C3489] px-4 py-2 rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Another Goal
            </Link>
          </div>
        </>
      )}

      {/* Quick insight for goals */}
      {!isLoading && goals.length > 0 && (
        <div className="bg-[#3C3489]/5 border border-[#3C3489]/10 rounded-2xl p-4 flex items-start gap-3">
          <TrendingUp className="w-5 h-5 text-[#3C3489] shrink-0 mt-0.5" />
          <p className="text-sm text-[#3C3489]">
            You have {goals.filter((g) => g.progressPercent >= 50).length} goal(s) that are more than halfway to their target. Keep going!
          </p>
        </div>
      )}
    </div>
  );
}
