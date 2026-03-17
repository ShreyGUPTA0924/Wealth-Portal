'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Zap, AlertTriangle, Info, CheckCheck, X, ArrowRight,
  RefreshCw, Bell, BellOff,
} from 'lucide-react';
import Link from 'next/link';
import apiClient from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

type Severity = 'INFO' | 'WARNING' | 'URGENT';

interface Nudge {
  id: string;
  nudgeType: string;
  title: string;
  message: string;
  severity: Severity;
  relatedHoldingId?: string;
  relatedGoalId?: string;
  isRead: boolean;
  isDismissed: boolean;
  createdAt: string;
}

type FilterTab = 'ALL' | 'UNREAD' | 'WARNING' | 'URGENT';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function severityIcon(severity: Severity) {
  if (severity === 'URGENT')  return <Zap className="w-4 h-4 text-red-500" />;
  if (severity === 'WARNING') return <AlertTriangle className="w-4 h-4 text-amber-500" />;
  return <Info className="w-4 h-4 text-blue-500" />;
}

function severityBadge(severity: Severity): string {
  if (severity === 'URGENT')  return 'bg-red-100 text-red-700 border-red-200';
  if (severity === 'WARNING') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-blue-100 text-blue-700 border-blue-200';
}

function nudgeTypeBadge(type: string): string {
  const map: Record<string, string> = {
    REBALANCE:        'bg-purple-100 text-purple-700',
    EXPENSE_RATIO:    'bg-orange-100 text-orange-700',
    CONCENTRATION:    'bg-red-100 text-red-700',
    SIP_UNDERPERFORM: 'bg-yellow-100 text-yellow-700',
    PANIC_SELL:       'bg-pink-100 text-pink-700',
    HEALTH_REPORT:    'bg-teal-100 text-teal-700',
  };
  return map[type] ?? 'bg-border text-foreground-muted';
}

function nudgeTypeLabel(type: string): string {
  const map: Record<string, string> = {
    REBALANCE:        'Rebalance',
    EXPENSE_RATIO:    'Expense Ratio',
    CONCENTRATION:    'Concentration',
    SIP_UNDERPERFORM: 'SIP',
    PANIC_SELL:       'Panic Sell',
    HEALTH_REPORT:    'Health',
  };
  return map[type] ?? type;
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-border rounded-xl ${className ?? ''}`} />;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day:   'numeric',
    month: 'short',
    year:  'numeric',
  });
}

// ─── Nudge Card ───────────────────────────────────────────────────────────────

function NudgeCard({
  nudge,
  onMarkRead,
  onDismiss,
}: {
  nudge: Nudge;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const actionLink = nudge.relatedGoalId
    ? `/goals/${nudge.relatedGoalId}`
    : nudge.relatedHoldingId
    ? `/portfolio`
    : null;

  return (
    <div
      className={`bg-background-card rounded-2xl border p-5 transition-all
        ${!nudge.isRead ? 'border-[#3C3489]/20 shadow-sm shadow-black/5' : 'border-border'}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="mt-0.5">{severityIcon(nudge.severity)}</div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className={`text-sm font-semibold ${!nudge.isRead ? 'text-foreground' : 'text-foreground-muted'}`}>
                {nudge.title}
              </h3>
              {!nudge.isRead && (
                <span className="w-2 h-2 rounded-full bg-[#3C3489] shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${severityBadge(nudge.severity)}`}>
                {nudge.severity}
              </span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${nudgeTypeBadge(nudge.nudgeType)}`}>
                {nudgeTypeLabel(nudge.nudgeType)}
              </span>
              <span className="text-xs text-foreground-muted">{formatDate(nudge.createdAt)}</span>
            </div>
            <p className="text-sm text-foreground-muted leading-relaxed">{nudge.message}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!nudge.isRead && (
            <button
              onClick={() => onMarkRead(nudge.id)}
              className="p-1.5 rounded-lg text-foreground-muted hover:text-[#3C3489] hover:bg-border/50 transition-colors"
              title="Mark as read"
            >
              <CheckCheck className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => onDismiss(nudge.id)}
            className="p-1.5 rounded-lg text-foreground-muted hover:text-red-400 hover:bg-border/50 transition-colors"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {actionLink && (
        <div className="mt-3 pt-3 border-t border-gray-50">
          <Link
            href={actionLink}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#3C3489] hover:underline"
          >
            Take Action <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'ALL',     label: 'All' },
  { id: 'UNREAD',  label: 'Unread' },
  { id: 'WARNING', label: 'Warnings' },
  { id: 'URGENT',  label: 'Urgent' },
];

export default function NudgesPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['nudges', 'all'],
    queryFn: () =>
      apiClient
        .get<{ success: boolean; data: { nudges: Nudge[]; unread_count: number } }>('/api/ai/nudges?limit=50')
        .then((r) => r.data.data),
    staleTime: 30_000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/api/ai/nudges/${id}`, { isRead: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['nudges'] }),
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/api/ai/nudges/${id}`, { isDismissed: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['nudges'] }),
  });

  const analyseMutation = useMutation({
    mutationFn: () => apiClient.post('/api/ai/analyse'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['nudges'] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const unread = (data?.nudges ?? []).filter((n) => !n.isRead);
      await Promise.all(
        unread.map((n) => apiClient.patch(`/api/ai/nudges/${n.id}`, { isRead: true }))
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['nudges'] }),
  });

  const allNudges   = data?.nudges ?? [];
  const unreadCount = data?.unread_count ?? 0;

  const filtered = allNudges.filter((n) => {
    if (activeTab === 'UNREAD')  return !n.isRead;
    if (activeTab === 'WARNING') return n.severity === 'WARNING';
    if (activeTab === 'URGENT')  return n.severity === 'URGENT';
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">AI Nudges</h1>
          <p className="text-sm text-foreground-muted mt-0.5">
            {unreadCount > 0
              ? `${unreadCount} unread nudge${unreadCount > 1 ? 's' : ''} · personalized for your portfolio`
              : 'All caught up · your portfolio is being monitored'
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-sm text-foreground-muted hover:bg-border/50 transition-colors disabled:opacity-50"
            >
              <BellOff className="w-4 h-4" />
              Mark all read
            </button>
          )}
          <button
            onClick={() => analyseMutation.mutate()}
            disabled={analyseMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#3C3489] text-white text-sm font-medium hover:bg-[#2d2871] transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${analyseMutation.isPending ? 'animate-spin' : ''}`} />
            {analyseMutation.isPending ? 'Analysing…' : 'Re-analyse'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {FILTER_TABS.map((tab) => {
          const count =
            tab.id === 'ALL'     ? allNudges.length :
            tab.id === 'UNREAD'  ? allNudges.filter((n) => !n.isRead).length :
            tab.id === 'WARNING' ? allNudges.filter((n) => n.severity === 'WARNING').length :
            allNudges.filter((n) => n.severity === 'URGENT').length;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors
                ${activeTab === tab.id
                  ? 'border-[#3C3489] text-[#3C3489]'
                  : 'border-transparent text-foreground-muted hover:text-foreground'
                }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium
                  ${activeTab === tab.id ? 'bg-[#3C3489] text-white' : 'bg-border text-foreground-muted'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-foreground-muted">
          <AlertTriangle className="w-10 h-10 mb-3 text-red-400" />
          <p className="text-sm mb-3">Failed to load nudges</p>
          <button
            onClick={() => refetch()}
            className="text-xs font-semibold text-white bg-[#3C3489] hover:bg-[#2d2871] px-4 py-2 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-foreground-muted">
          <Bell className="w-12 h-12 mb-3 text-gray-200" />
          <p className="text-base font-medium text-foreground-muted mb-1">
            {activeTab === 'UNREAD' ? 'All nudges read' : 'No nudges found'}
          </p>
          <p className="text-sm text-foreground-muted mb-4">
            {activeTab === 'ALL'
              ? 'Click "Re-analyse" to check your portfolio for new issues'
              : `No ${activeTab.toLowerCase()} nudges at the moment`
            }
          </p>
          {activeTab === 'ALL' && (
            <button
              onClick={() => analyseMutation.mutate()}
              disabled={analyseMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#3C3489] text-white text-sm font-medium hover:bg-[#2d2871] transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Analyse Portfolio
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((n) => (
            <NudgeCard
              key={n.id}
              nudge={n}
              onMarkRead={(id) => markReadMutation.mutate(id)}
              onDismiss={(id) => dismissMutation.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
