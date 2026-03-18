'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Lock, TrendingUp, TrendingDown, AlertCircle,
  Target, Shield, Calendar, Wallet, Plus, Pencil, Trash2, Loader2, X,
} from 'lucide-react';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { AddHoldingModal } from '@/components/family/AddHoldingModal';

// ─── Types ────────────────────────────────────────────────────────────────────

type Relationship = 'SELF' | 'SPOUSE' | 'CHILD' | 'PARENT' | 'OTHER';
type AssetClass =
  | 'STOCK' | 'MUTUAL_FUND' | 'FD' | 'RD' | 'PPF' | 'EPF'
  | 'NPS' | 'GOLD' | 'SGB' | 'REAL_ESTATE' | 'CRYPTO';

interface MemberInfo {
  id:               string;
  fullName:         string;
  relationship:     Relationship;
  dateOfBirth:      string | null;
  age:              number | null;
  isMinor:          boolean;
  monthlyAllowance: number | null;
}

interface Holding {
  id:            string;
  assetClass:    AssetClass;
  name:          string;
  symbol:        string | null;
  quantity:      number;
  avgBuyPrice:   number;
  totalInvested: number;
  currentPrice:  number | null;
  currentValue:  number;
  pnlAbsolute:   number;
  pnlPercent:    number | null;
  maturityDate:  string | null;
  interestRate:  number | null;
  brokerSource:  string;
  notes:         string | null;
  createdAt:     string;
}

interface Goal {
  id:              string;
  name:            string;
  category:        string;
  targetAmount:    number;
  currentAmount:   number;
  targetDate:      string;
  healthStatus:    string;
  progressPercent: number;
}

interface Portfolio {
  id:            string;
  name:          string;
  totalInvested: number;
  currentValue:  number;
  pnlAbsolute:   number;
  pnlPercent:    number;
  holdings:      Holding[];
  goals:         Goal[];
}

interface MemberPortfolioData {
  member:    MemberInfo;
  portfolio: Portfolio;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const RELATIONSHIP_STYLES: Record<Relationship, string> = {
  SELF:   'bg-purple-100 text-purple-700',
  SPOUSE: 'bg-teal-100 text-teal-700',
  CHILD:  'bg-amber-100 text-amber-700',
  PARENT: 'bg-blue-100 text-blue-700',
  OTHER:  'bg-border text-foreground-muted',
};

const ASSET_LABELS: Record<AssetClass, string> = {
  STOCK: 'Stock', MUTUAL_FUND: 'Mutual Fund', FD: 'FD', RD: 'RD',
  PPF: 'PPF', EPF: 'EPF', NPS: 'NPS', GOLD: 'Gold', SGB: 'SGB',
  REAL_ESTATE: 'Real Estate', CRYPTO: 'Crypto',
};

const ASSET_COLORS: Record<string, string> = {
  STOCK:       'bg-purple-100 text-purple-700',
  MUTUAL_FUND: 'bg-teal-100 text-teal-700',
  FD:          'bg-blue-100 text-blue-700',
  RD:          'bg-cyan-100 text-cyan-700',
  PPF:         'bg-green-100 text-green-700',
  EPF:         'bg-indigo-100 text-indigo-700',
  NPS:         'bg-violet-100 text-violet-700',
  GOLD:        'bg-yellow-100 text-yellow-700',
  SGB:         'bg-amber-100 text-amber-700',
  REAL_ESTATE: 'bg-lime-100 text-lime-700',
  CRYPTO:      'bg-orange-100 text-orange-700',
};

const HEALTH_STYLES: Record<string, string> = {
  ON_TRACK:  'bg-green-100 text-green-700',
  AT_RISK:   'bg-amber-100 text-amber-700',
  OFF_TRACK: 'bg-red-100 text-red-700',
};

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

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-border rounded-xl ${className ?? ''}`} />;
}

// ─── Minor Schemes ────────────────────────────────────────────────────────────

const MINOR_SCHEMES = [
  {
    name:         'Sukanya Samriddhi Yojana',
    desc:         'For girl child · Up to 1.5L p.a. · Tax-free',
    icon:         '👧',
    returnLabel:  '8.2% p.a.',
    forGirlsOnly: true,
  },
  {
    name:         'PPF for Minors',
    desc:         'Long-term savings · 15-year lock-in · Tax-free',
    icon:         '📊',
    returnLabel:  '7.1% p.a.',
    forGirlsOnly: false,
  },
  {
    name:         'NPS Vatsalya',
    desc:         'Pension savings from childhood · Low cost',
    icon:         '🏦',
    returnLabel:  '9–11% (est.)',
    forGirlsOnly: false,
  },
];

// ─── Holdings Table ───────────────────────────────────────────────────────────

interface HoldingsTableProps {
  holdings: Holding[];
  isMinor: boolean;
  onEdit: (h: Holding) => void;
  onDelete: (h: Holding) => void;
  onAddTransaction: (h: Holding) => void;
}

function HoldingsTable({ holdings, isMinor, onEdit, onDelete, onAddTransaction }: HoldingsTableProps) {
  if (holdings.length === 0) {
    return (
      <div className="py-10 text-center text-foreground-muted">
        <Wallet className="w-8 h-8 mx-auto mb-2 text-gray-200" />
        <p className="text-sm">No holdings yet</p>
      </div>
    );
  }

  const cols = ['Asset', 'Type', 'Invested', 'Current Value', 'P&L', 'P&L %'];
  if (!isMinor) cols.push('Actions');

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm min-w-[600px]">
        <thead>
          <tr className="border-b border-border">
            {cols.map((h) => (
              <th key={h} className="text-left text-xs font-medium text-foreground-muted uppercase tracking-wide py-2.5 px-2 first:pl-0">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {holdings.map((h) => (
            <tr key={h.id} className="hover:bg-border/50 transition-colors">
              <td className="py-3 px-2 pl-0">
                <div>
                  <p className="text-sm font-medium text-foreground truncate max-w-[140px]">{h.name}</p>
                  {h.symbol && <p className="text-xs text-foreground-muted">{h.symbol}</p>}
                </div>
              </td>
              <td className="py-3 px-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ASSET_COLORS[h.assetClass] ?? 'bg-border text-foreground-muted'}`}>
                  {ASSET_LABELS[h.assetClass] ?? h.assetClass}
                </span>
              </td>
              <td className="py-3 px-2 text-sm text-foreground">{formatInr(h.totalInvested, true)}</td>
              <td className="py-3 px-2 text-sm font-medium text-foreground">{formatInr(h.currentValue, true)}</td>
              <td className={`py-3 px-2 text-sm font-medium ${pnlColor(h.pnlAbsolute)}`}>
                {formatInr(h.pnlAbsolute, true)}
              </td>
              <td className={`py-3 px-2 text-sm font-semibold ${pnlColor(h.pnlPercent ?? 0)}`}>
                {h.pnlPercent != null
                  ? `${h.pnlPercent >= 0 ? '+' : ''}${h.pnlPercent.toFixed(2)}%`
                  : '—'}
              </td>
              {!isMinor && (
                <td className="py-3 px-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onEdit(h)}
                      className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-border/50 transition-colors"
                      title="Edit holding"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDelete(h)}
                      className="p-1.5 rounded-lg text-foreground-muted hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Delete holding"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onAddTransaction(h)}
                      className="p-1.5 rounded-lg text-foreground-muted hover:text-[#3C3489] hover:bg-[#3C3489]/10 transition-colors flex items-center gap-1 text-xs font-medium"
                      title="Add transaction"
                    >
                      <Plus className="w-3.5 h-3.5" /> Txn
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Goals Section ────────────────────────────────────────────────────────────

function GoalsSection({ goals, memberName }: { goals: Goal[]; memberName: string }) {
  return (
    <div className="bg-background-card rounded-2xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Target className="w-4 h-4 text-[#3C3489]" />
          Goals
        </h3>
      </div>

      {goals.length === 0 ? (
        <div className="py-6 text-center text-foreground-muted">
          <Target className="w-8 h-8 mx-auto mb-2 text-gray-200" />
          <p className="text-sm mb-1">No goals yet</p>
          <p className="text-xs text-foreground-muted">Add goals for {memberName} to track their progress</p>
        </div>
      ) : (
        <div className="space-y-4">
          {goals.map((g) => (
            <div key={g.id}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-sm font-medium text-foreground truncate mr-2">{g.name}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${HEALTH_STYLES[g.healthStatus] ?? 'bg-border text-foreground-muted'}`}>
                  {g.healthStatus.replace('_', ' ')}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#3C3489] rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(g.progressPercent, 100)}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-foreground-muted shrink-0">{g.progressPercent.toFixed(0)}%</span>
              </div>
              <div className="flex justify-between text-xs text-foreground-muted mt-1">
                <span>{formatInr(g.currentAmount, true)}</span>
                <span>Target: {formatInr(g.targetAmount, true)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Allowance Tracker ────────────────────────────────────────────────────────

function AllowanceTracker({ monthlyAllowance }: { monthlyAllowance: number }) {
  const months = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
  const currentMonth = new Date().toLocaleString('en-IN', { month: 'short' });

  return (
    <div className="bg-background-card rounded-2xl border border-border p-5">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
        <Calendar className="w-4 h-4 text-amber-500" />
        Allowance Tracker
      </h3>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-foreground-muted">Monthly Allowance</p>
          <p className="text-xl font-bold text-foreground">{formatInr(monthlyAllowance)}</p>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-medium">
          This month: Paid
        </span>
      </div>
      <div>
        <p className="text-xs text-foreground-muted mb-2">Last 6 months</p>
        <div className="flex gap-2">
          {months.map((m) => (
            <div key={m} className="flex-1 flex flex-col items-center gap-1">
              <div className={`w-full h-8 rounded-lg ${m === currentMonth ? 'bg-[#3C3489]' : 'bg-green-100'}`} />
              <span className="text-[10px] text-foreground-muted">{m}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Edit Holding Modal ───────────────────────────────────────────────────────

function EditHoldingModal({
  holding,
  memberId,
  onClose,
  onSuccess,
}: {
  holding: Holding;
  memberId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    notes: holding.notes ?? '',
    manualPrice: holding.currentPrice?.toString() ?? '',
    quantity: holding.quantity.toString(),
  });

  const mutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {};
      if (form.notes !== (holding.notes ?? '')) payload.notes = form.notes;
      if (form.manualPrice) payload.manualPrice = parseFloat(form.manualPrice);
      if (form.quantity) payload.quantity = parseFloat(form.quantity);
      return apiClient.patch(`/api/family/members/${memberId}/holdings/${holding.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family'] });
      queryClient.invalidateQueries({ queryKey: ['family-member', memberId] });
      onSuccess();
      onClose();
    },
  });

  const inputClass =
    'block w-full px-3.5 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background-card focus:outline-none focus:ring-2 focus:ring-[#3C3489]/20 focus:border-[#3C3489]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-background-card rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground">Edit {holding.name}</h2>
          <button onClick={onClose} className="text-foreground-muted hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground-muted uppercase tracking-wide mb-1.5">Notes</label>
            <input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className={inputClass}
              placeholder="Optional notes"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground-muted uppercase tracking-wide mb-1.5">Manual Price (₹)</label>
            <input
              type="number"
              step="any"
              value={form.manualPrice}
              onChange={(e) => setForm((f) => ({ ...f, manualPrice: e.target.value }))}
              className={inputClass}
              placeholder="Override current price"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground-muted uppercase tracking-wide mb-1.5">Quantity</label>
            <input
              type="number"
              step="any"
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              className={inputClass}
            />
          </div>
          {mutation.isError && (
            <p className="text-sm text-red-500">Failed to update. Please try again.</p>
          )}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm text-foreground-muted hover:bg-border/50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#3C3489] text-white text-sm font-medium hover:bg-[#2d2871] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Add Transaction Modal ───────────────────────────────────────────────────

function AddTransactionModal({
  holding,
  memberId,
  onClose,
  onSuccess,
}: {
  holding: Holding;
  memberId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    type: 'BUY' as 'BUY' | 'SELL' | 'SIP' | 'DIVIDEND',
    quantity: '',
    pricePerUnit: '',
    date: new Date().toISOString().split('T')[0] ?? '',
    notes: '',
  });

  const mutation = useMutation({
    mutationFn: () =>
      apiClient.post(`/api/family/members/${memberId}/holdings/${holding.id}/transactions`, {
        type: form.type,
        quantity: parseFloat(form.quantity),
        pricePerUnit: parseFloat(form.pricePerUnit),
        date: form.date,
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family'] });
      queryClient.invalidateQueries({ queryKey: ['family-member', memberId] });
      onSuccess();
      onClose();
    },
  });

  const inputClass =
    'block w-full px-3.5 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background-card focus:outline-none focus:ring-2 focus:ring-[#3C3489]/20 focus:border-[#3C3489]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-background-card rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground">Add Transaction — {holding.name}</h2>
          <button onClick={onClose} className="text-foreground-muted hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground-muted uppercase tracking-wide mb-1.5">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as 'BUY' | 'SELL' | 'SIP' | 'DIVIDEND' }))}
              className={inputClass}
            >
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
              <option value="SIP">SIP</option>
              <option value="DIVIDEND">DIVIDEND</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground-muted uppercase tracking-wide mb-1.5">Quantity</label>
            <input
              type="number"
              step="any"
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              className={inputClass}
              placeholder="e.g. 10"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground-muted uppercase tracking-wide mb-1.5">Price per Unit (₹)</label>
            <input
              type="number"
              step="any"
              value={form.pricePerUnit}
              onChange={(e) => setForm((f) => ({ ...f, pricePerUnit: e.target.value }))}
              className={inputClass}
              placeholder="e.g. 1999"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground-muted uppercase tracking-wide mb-1.5">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className={inputClass}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground-muted uppercase tracking-wide mb-1.5">Notes (optional)</label>
            <input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className={inputClass}
              placeholder="Optional"
            />
          </div>
          {mutation.isError && (
            <p className="text-sm text-red-500">Failed to add transaction. Please try again.</p>
          )}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm text-foreground-muted hover:bg-border/50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={
                !form.quantity ||
                !form.pricePerUnit ||
                !form.date ||
                mutation.isPending
              }
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#3C3489] text-white text-sm font-medium hover:bg-[#2d2871] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Add Transaction
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Holding Confirm ───────────────────────────────────────────────────

function DeleteHoldingConfirm({
  holding,
  memberId,
  onClose,
  onConfirm,
}: {
  holding: Holding;
  memberId: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => apiClient.delete(`/api/family/members/${memberId}/holdings/${holding.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family'] });
      queryClient.invalidateQueries({ queryKey: ['family-member', memberId] });
      onConfirm();
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-background-card rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-foreground mb-2">Remove {holding.name}?</h2>
        <p className="text-sm text-foreground-muted mb-6">This holding will be removed from the portfolio.</p>
        {mutation.isError && (
          <p className="text-sm text-red-500 mb-4">Failed to delete. Please try again.</p>
        )}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm text-foreground-muted hover:bg-border/50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function MemberPageSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-24 w-full" />
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MemberPortfolioPage() {
  const params    = useParams();
  const memberId  = params['memberId'] as string;

  const [editHolding, setEditHolding] = useState<Holding | null>(null);
  const [deleteHolding, setDeleteHolding] = useState<Holding | null>(null);
  const [addTransactionHolding, setAddTransactionHolding] = useState<Holding | null>(null);
  const [showAddHolding, setShowAddHolding] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['family-member', memberId],
    queryFn: () =>
      apiClient
        .get<{ success: boolean; data: MemberPortfolioData }>(`/api/family/members/${memberId}/portfolio`)
        .then((r) => r.data.data),
    staleTime: 60_000,
  });

  if (isLoading) return <MemberPageSkeleton />;

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-foreground-muted">
        <AlertCircle className="w-10 h-10 mb-3 text-red-400" />
        <p className="text-sm mb-3">Failed to load member portfolio</p>
        <button
          onClick={() => refetch()}
          className="text-xs font-semibold text-white bg-[#3C3489] hover:bg-[#2d2871] px-4 py-2 rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const { member, portfolio } = data;
  const isMinor = member.isMinor;

  const initials = member.fullName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-5">
      {/* Back + Header */}
      <div>
        <Link
          href="/family"
          className="inline-flex items-center gap-1.5 text-sm text-foreground-muted hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Family Vault
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#3C3489] to-[#5048a8] flex items-center justify-center text-white font-bold text-lg">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-foreground">{member.fullName}</h1>
                {isMinor && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 uppercase tracking-wide">
                    Minor
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RELATIONSHIP_STYLES[member.relationship]}`}>
                  {member.relationship}
                </span>
                {member.age !== null && (
                  <span className="text-xs text-foreground-muted">{member.age} years old</span>
                )}
              </div>
            </div>
          </div>
          {!isMinor && (
            <button
              onClick={() => setShowAddHolding(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#3C3489] text-white text-sm font-medium hover:bg-[#2d2871] transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" /> Add Holding
            </button>
          )}
        </div>
      </div>

      {/* Minor Banner */}
      {isMinor && (
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 flex items-start gap-3">
          <Lock className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-purple-800">Minor Account — View Only</p>
            <p className="text-sm text-purple-600 mt-0.5">
              This is a minor account. Holdings can only be managed by the family head.
            </p>
          </div>
        </div>
      )}

      {/* Portfolio Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Invested', value: formatInr(portfolio.totalInvested, true), color: 'text-foreground' },
          { label: 'Current Value',  value: formatInr(portfolio.currentValue,  true), color: 'text-foreground' },
          {
            label: 'P&L',
            value: formatInr(portfolio.pnlAbsolute, true),
            sub: `${portfolio.pnlPercent >= 0 ? '+' : ''}${portfolio.pnlPercent.toFixed(2)}%`,
            color: pnlColor(portfolio.pnlAbsolute),
          },
          { label: 'Holdings', value: `${portfolio.holdings.length} assets`, color: 'text-foreground' },
        ].map((s, i) => (
          <div key={i} className="bg-background-card rounded-2xl border border-border p-4">
            <p className="text-xs text-foreground-muted">{s.label}</p>
            <p className={`text-lg font-bold mt-1 ${s.color}`}>{s.value}</p>
            {'sub' in s && s.sub && <p className={`text-xs mt-0.5 font-medium ${s.color}`}>{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Overall P&L badge */}
      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm ${pnlBg(portfolio.pnlAbsolute)}`}>
        {portfolio.pnlAbsolute >= 0
          ? <TrendingUp className="w-4 h-4" />
          : <TrendingDown className="w-4 h-4" />
        }
        Overall {portfolio.pnlAbsolute >= 0 ? 'Gain' : 'Loss'}: {formatInr(portfolio.pnlAbsolute)}
        &nbsp;({portfolio.pnlPercent >= 0 ? '+' : ''}{portfolio.pnlPercent.toFixed(2)}%)
      </div>

      {/* Holdings */}
      <div className="bg-background-card rounded-2xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#3C3489]" />
            Holdings
          </h3>
          {isMinor && (
            <span className="flex items-center gap-1.5 text-xs text-foreground-muted">
              <Lock className="w-3.5 h-3.5" /> Read-only
            </span>
          )}
        </div>
        <HoldingsTable
          holdings={portfolio.holdings}
          isMinor={isMinor}
          onEdit={setEditHolding}
          onDelete={setDeleteHolding}
          onAddTransaction={setAddTransactionHolding}
        />
      </div>

      {/* Minor Schemes (only for minors) */}
      {isMinor && (
        <div className="bg-background-card rounded-2xl border border-border p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">
            Schemes for {member.fullName}
          </h3>
          <p className="text-xs text-foreground-muted mb-4">Government-backed schemes designed for minors</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {MINOR_SCHEMES.map((s) => (
              <div
                key={s.name}
                className="rounded-xl border border-purple-100 bg-purple-50/40 p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{s.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{s.name}</p>
                    <p className="text-xs text-foreground-muted mt-0.5">{s.desc}</p>
                    <span className="inline-block mt-2 text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                      {s.returnLabel}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {showAddHolding && (
        <AddHoldingModal
          member={{ id: memberId, fullName: member.fullName, isMinor: member.isMinor }}
          onClose={() => setShowAddHolding(false)}
          onSuccess={() => setShowAddHolding(false)}
        />
      )}
      {editHolding && (
        <EditHoldingModal
          holding={editHolding}
          memberId={memberId}
          onClose={() => setEditHolding(null)}
          onSuccess={() => setEditHolding(null)}
        />
      )}
      {deleteHolding && (
        <DeleteHoldingConfirm
          holding={deleteHolding}
          memberId={memberId}
          onClose={() => setDeleteHolding(null)}
          onConfirm={() => setDeleteHolding(null)}
        />
      )}
      {addTransactionHolding && (
        <AddTransactionModal
          holding={addTransactionHolding}
          memberId={memberId}
          onClose={() => setAddTransactionHolding(null)}
          onSuccess={() => setAddTransactionHolding(null)}
        />
      )}

      {/* Goals */}
      <GoalsSection goals={portfolio.goals} memberName={member.fullName} />

      {/* Allowance Tracker (only for minors with allowance) */}
      {isMinor && member.monthlyAllowance && (
        <AllowanceTracker monthlyAllowance={member.monthlyAllowance} />
      )}
    </div>
  );
}
