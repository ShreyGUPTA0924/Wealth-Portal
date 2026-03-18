'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, Plus, TrendingUp, TrendingDown, AlertCircle,
  Lock, ArrowRight, X, ChevronDown, Pencil, Trash2, Loader2,
} from 'lucide-react';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { AddHoldingModal } from '@/components/family/AddHoldingModal';

// ─── Types ────────────────────────────────────────────────────────────────────

type Relationship = 'SELF' | 'SPOUSE' | 'CHILD' | 'PARENT' | 'OTHER';

interface MemberPortfolio {
  id:            string;
  totalInvested: number;
  currentValue:  number;
  pnlAbsolute:   number;
  pnlPercent:    number;
  holdingsCount: number;
}

interface FamilyMember {
  id:              string;
  fullName:        string;
  relationship:    Relationship;
  dateOfBirth:     string | null;
  age:             number | null;
  isMinor:         boolean;
  monthlyAllowance: number | null;
  createdAt:       string;
  portfolio:       MemberPortfolio | null;
}

interface FamilyOverview {
  members:            FamilyMember[];
  familyNetWorth:     number;
  totalInvested:      number;
  familyPnlAbsolute:  number;
  familyPnlPercent:   number;
  allocationByMember: { memberId: string; fullName: string; currentValue: number; percent: number }[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MEMBER_COLORS = [
  'bg-[#3C3489]', 'bg-teal-500', 'bg-amber-500',
  'bg-pink-500',  'bg-blue-500', 'bg-green-500',
];

const RELATIONSHIP_STYLES: Record<Relationship, string> = {
  SELF:   'bg-purple-100 text-purple-700',
  SPOUSE: 'bg-teal-100 text-teal-700',
  CHILD:  'bg-amber-100 text-amber-700',
  PARENT: 'bg-blue-100 text-blue-700',
  OTHER:  'bg-border text-foreground-muted',
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

function memberColor(index: number): string {
  return MEMBER_COLORS[index % MEMBER_COLORS.length]!;
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-border rounded-xl ${className ?? ''}`} />;
}

// ─── Bar chart for member contribution ────────────────────────────────────────

function MemberContributionBar({
  allocation,
}: {
  allocation: FamilyOverview['allocationByMember'];
}) {
  if (allocation.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
        {allocation.map((a, i) => (
          <div
            key={a.memberId}
            className={`h-full transition-all ${memberColor(i)}`}
            style={{ width: `${a.percent}%` }}
            title={`${a.fullName}: ${a.percent.toFixed(1)}%`}
          />
        ))}
      </div>
      <div className="flex items-center gap-4 flex-wrap">
        {allocation.map((a, i) => (
          <div key={a.memberId} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${memberColor(i)}`} />
            <span className="text-xs text-foreground-muted">{a.fullName}</span>
            <span className="text-xs font-medium text-foreground">{a.percent.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Add Member Modal ─────────────────────────────────────────────────────────

interface AddMemberForm {
  fullName:         string;
  relationship:     Relationship;
  dateOfBirth:      string;
  monthlyAllowance: string;
}

function AddMemberModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AddMemberForm>({
    fullName:         '',
    relationship:     'SPOUSE',
    dateOfBirth:      '',
    monthlyAllowance: '',
  });

  const mutation = useMutation({
    mutationFn: () =>
      apiClient.post('/api/family/members', {
        fullName:     form.fullName,
        relationship: form.relationship,
        dateOfBirth:  form.dateOfBirth || undefined,
        monthlyAllowance:
          form.monthlyAllowance ? parseFloat(form.monthlyAllowance) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family'] });
      onClose();
    },
  });

  const isChild = form.relationship === 'CHILD';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-background-card rounded-2xl shadow-2xl w-full max-w-md p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground">Add Family Member</h2>
          <button onClick={onClose} className="text-foreground-muted hover:text-foreground-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-foreground-muted uppercase tracking-wide">Full Name</label>
            <input
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              className="mt-1 w-full px-3 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-[#3C3489] transition-colors"
              placeholder="Enter full name"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-foreground-muted uppercase tracking-wide">Relationship</label>
            <div className="relative mt-1">
              <select
                value={form.relationship}
                onChange={(e) => setForm((f) => ({ ...f, relationship: e.target.value as Relationship }))}
                className="w-full appearance-none px-3 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-[#3C3489] transition-colors bg-background-card"
              >
                <option value="SPOUSE">Spouse</option>
                <option value="CHILD">Child</option>
                <option value="PARENT">Parent</option>
                <option value="OTHER">Other</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-foreground-muted uppercase tracking-wide">Date of Birth</label>
            <input
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
              className="mt-1 w-full px-3 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-[#3C3489] transition-colors"
            />
          </div>

          {isChild && (
            <div>
              <label className="text-xs font-medium text-foreground-muted uppercase tracking-wide">Monthly Allowance (₹)</label>
              <input
                type="number"
                value={form.monthlyAllowance}
                onChange={(e) => setForm((f) => ({ ...f, monthlyAllowance: e.target.value }))}
                className="mt-1 w-full px-3 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-[#3C3489] transition-colors"
                placeholder="0"
                min="0"
              />
            </div>
          )}

          {mutation.isError && (
            <p className="text-sm text-red-500">
              Failed to add member. Please try again.
            </p>
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
              disabled={!form.fullName.trim() || mutation.isPending}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#3C3489] text-white text-sm font-medium hover:bg-[#2d2871] transition-colors disabled:opacity-50"
            >
              {mutation.isPending ? 'Adding…' : 'Add Member'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Member Modal ───────────────────────────────────────────────────────

function EditMemberModal({
  member,
  onClose,
  onSuccess,
}: {
  member: FamilyMember;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    fullName: member.fullName,
    monthlyAllowance: member.monthlyAllowance?.toString() ?? '',
  });

  const mutation = useMutation({
    mutationFn: () =>
      apiClient.patch(`/api/family/members/${member.id}`, {
        fullName: form.fullName,
        monthlyAllowance: form.monthlyAllowance ? parseFloat(form.monthlyAllowance) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family'] });
      onSuccess();
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-background-card rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground">Edit Member</h2>
          <button onClick={onClose} className="text-foreground-muted hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-foreground-muted uppercase tracking-wide">Full Name</label>
            <input
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              className="mt-1 w-full px-3 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-[#3C3489] transition-colors"
              placeholder="Enter full name"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground-muted uppercase tracking-wide">Monthly Allowance (₹)</label>
            <input
              type="number"
              value={form.monthlyAllowance}
              onChange={(e) => setForm((f) => ({ ...f, monthlyAllowance: e.target.value }))}
              className="mt-1 w-full px-3 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-[#3C3489] transition-colors"
              placeholder="0"
              min="0"
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
              disabled={!form.fullName.trim() || mutation.isPending}
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

// ─── Delete Confirm Modal ────────────────────────────────────────────────────

function DeleteConfirmModal({
  member,
  onClose,
  onConfirm,
}: {
  member: FamilyMember;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const mutation = useMutation({
    mutationFn: () => apiClient.delete(`/api/family/members/${member.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family'] });
      onConfirm();
      onClose();
      router.push('/family');
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-background-card rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-foreground mb-2">Delete {member.fullName}?</h2>
        <p className="text-sm text-foreground-muted mb-6">
          Their portfolio and all holdings will be removed permanently.
        </p>
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
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Member Card ──────────────────────────────────────────────────────────────

interface MemberCardProps {
  member: FamilyMember;
  index: number;
  onEdit: (m: FamilyMember) => void;
  onDelete: (m: FamilyMember) => void;
  onAddHolding: (m: FamilyMember) => void;
}

function MemberCard({ member, index, onEdit, onDelete, onAddHolding }: MemberCardProps) {
  const initials = member.fullName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const portfolio = member.portfolio;

  return (
    <div className="bg-background-card rounded-2xl border border-border p-5 hover:shadow-sm shadow-black/5 transition-shadow group">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl ${memberColor(index)} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
            {initials}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-foreground">{member.fullName}</h3>
              {member.isMinor && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 uppercase tracking-wide">
                  Minor
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RELATIONSHIP_STYLES[member.relationship]}`}>
                {member.relationship}
              </span>
              {member.age !== null && (
                <span className="text-xs text-foreground-muted">{member.age} yrs</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(member)}
            className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-border/50 transition-colors"
            title="Edit member"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(member)}
            className="p-1.5 rounded-lg text-foreground-muted hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Delete member"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {portfolio ? (
        <div className="space-y-2 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-xs text-foreground-muted">Portfolio Value</span>
            <span className="text-sm font-bold text-foreground">{formatInr(portfolio.currentValue, true)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-foreground-muted">P&L</span>
            <span className={`text-sm font-semibold flex items-center gap-1 ${pnlColor(portfolio.pnlAbsolute)}`}>
              {portfolio.pnlAbsolute >= 0
                ? <TrendingUp className="w-3.5 h-3.5" />
                : <TrendingDown className="w-3.5 h-3.5" />
              }
              {formatInr(portfolio.pnlAbsolute, true)}
              <span className="font-normal text-xs">
                ({portfolio.pnlPercent >= 0 ? '+' : ''}{portfolio.pnlPercent.toFixed(1)}%)
              </span>
            </span>
          </div>
          {member.monthlyAllowance && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-foreground-muted">Monthly Allowance</span>
              <span className="text-sm font-medium text-foreground">{formatInr(member.monthlyAllowance)}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-xs text-foreground-muted">Holdings</span>
            <span className="text-xs text-foreground-muted">{portfolio.holdingsCount} assets</span>
          </div>
        </div>
      ) : (
        <div className="py-3 text-center text-xs text-foreground-muted mb-3">No portfolio data yet</div>
      )}

      <div className="flex gap-2">
        <Link
          href={`/family/${member.id}`}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#3C3489] text-white text-xs font-medium hover:bg-[#2d2871] transition-colors"
        >
          View Portfolio <ArrowRight className="w-3.5 h-3.5" />
        </Link>
        {member.isMinor ? (
          <button
            disabled
            className="px-3 py-2 rounded-xl border border-border text-foreground-muted text-xs flex items-center gap-1 cursor-not-allowed"
            title="Holdings can only be managed by the family head"
          >
            <Lock className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            onClick={() => onAddHolding(member)}
            className="px-3 py-2 rounded-xl border border-border text-foreground-muted text-xs hover:bg-border/50 transition-colors"
          >
            + Holding
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function FamilySkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-36 w-full" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-52" />)}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FamilyPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editMember, setEditMember] = useState<FamilyMember | null>(null);
  const [deleteMember, setDeleteMember] = useState<FamilyMember | null>(null);
  const [addHoldingMember, setAddHoldingMember] = useState<FamilyMember | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['family'],
    queryFn: () =>
      apiClient
        .get<{ success: boolean; data: FamilyOverview }>('/api/family')
        .then((r) => r.data.data),
    staleTime: 60_000,
  });

  if (isLoading) return <FamilySkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-foreground-muted">
        <AlertCircle className="w-10 h-10 mb-3 text-red-400" />
        <p className="text-sm mb-3">Failed to load family data</p>
        <button
          onClick={() => refetch()}
          className="text-xs font-semibold text-white bg-[#3C3489] hover:bg-[#2d2871] px-4 py-2 rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const overview = data!;
  const members  = overview.members;

  return (
    <>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">Family Vault</h1>
            <p className="text-sm text-foreground-muted mt-0.5">
              {members.length > 0
                ? `${members.length} member${members.length > 1 ? 's' : ''} · consolidated wealth view`
                : 'Track your family\'s wealth together'
              }
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#3C3489] text-white text-sm font-medium hover:bg-[#2d2871] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Member
          </button>
        </div>

        {members.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#3C3489] to-[#5048a8] flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">Your family vault is empty</h2>
            <p className="text-sm text-foreground-muted mb-1">Add family members to track everyone's wealth together</p>
            <p className="text-sm text-foreground-muted mb-6">Manage portfolios for spouse, children, and parents</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#3C3489] text-white text-sm font-semibold hover:bg-[#2d2871] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Member
            </button>
          </div>
        ) : (
          <>
            {/* Family Net Worth Card */}
            <div className="bg-background-card rounded-2xl border border-border p-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
                <div>
                  <p className="text-xs font-medium text-foreground-muted uppercase tracking-wider mb-1">Family Net Worth</p>
                  <p className="text-4xl font-bold text-foreground">{formatInr(overview.familyNetWorth)}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 text-sm font-semibold px-2.5 py-1 rounded-full ${pnlBg(overview.familyPnlAbsolute)}`}>
                      {overview.familyPnlAbsolute >= 0
                        ? <TrendingUp className="w-3.5 h-3.5" />
                        : <TrendingDown className="w-3.5 h-3.5" />
                      }
                      {formatInr(overview.familyPnlAbsolute, true)}
                      &nbsp;({overview.familyPnlPercent >= 0 ? '+' : ''}{overview.familyPnlPercent.toFixed(2)}%)
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-foreground-muted">Total Invested</p>
                  <p className="text-lg font-semibold text-foreground">{formatInr(overview.totalInvested, true)}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-foreground-muted mb-2">Contribution by member</p>
                <MemberContributionBar allocation={overview.allocationByMember} />
              </div>
            </div>

            {/* Member Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {members.map((m, i) => (
                <MemberCard
                  key={m.id}
                  member={m}
                  index={i}
                  onEdit={setEditMember}
                  onDelete={setDeleteMember}
                  onAddHolding={setAddHoldingMember}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {showAddModal && <AddMemberModal onClose={() => setShowAddModal(false)} />}
      {editMember && (
        <EditMemberModal
          member={editMember}
          onClose={() => setEditMember(null)}
          onSuccess={() => setEditMember(null)}
        />
      )}
      {deleteMember && (
        <DeleteConfirmModal
          member={deleteMember}
          onClose={() => setDeleteMember(null)}
          onConfirm={() => setDeleteMember(null)}
        />
      )}
      {addHoldingMember && (
        <AddHoldingModal
          member={addHoldingMember}
          onClose={() => setAddHoldingMember(null)}
          onSuccess={() => setAddHoldingMember(null)}
        />
      )}
    </>
  );
}
