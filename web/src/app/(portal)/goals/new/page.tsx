'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Umbrella, Home, GraduationCap, Plane, Shield, Heart, Target,
  ArrowLeft, Check, ChevronRight,
} from 'lucide-react';
import apiClient from '@/lib/api-client';
import { getErrorMessage } from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreateGoalPayload {
  name:         string;
  category:     string;
  targetAmount: number;
  targetDate:   string;
}

interface GoalResponse {
  goal: {
    id:                    string;
    name:                  string;
    recommendedMonthlySip: number | null;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatInr(n: number): string {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`;
  if (n >= 1_00_000)    return `₹${(n / 1_00_000).toFixed(2)} L`;
  return n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
}

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'RETIREMENT', label: 'Retirement', icon: Umbrella,      color: 'text-purple-600',  bg: 'bg-purple-100', border: 'border-purple-200' },
  { value: 'HOUSE',      label: 'House',      icon: Home,          color: 'text-blue-600',    bg: 'bg-blue-100',   border: 'border-blue-200' },
  { value: 'EDUCATION',  label: 'Education',  icon: GraduationCap, color: 'text-teal-600',    bg: 'bg-teal-100',   border: 'border-teal-200' },
  { value: 'TRAVEL',     label: 'Travel',     icon: Plane,         color: 'text-amber-600',   bg: 'bg-amber-100',  border: 'border-amber-200' },
  { value: 'EMERGENCY',  label: 'Emergency',  icon: Shield,        color: 'text-red-600',     bg: 'bg-red-100',    border: 'border-red-200' },
  { value: 'WEDDING',    label: 'Wedding',    icon: Heart,         color: 'text-pink-600',    bg: 'bg-pink-100',   border: 'border-pink-200' },
  { value: 'CUSTOM',     label: 'Custom',     icon: Target,        color: 'text-foreground-muted',    bg: 'bg-border',   border: 'border-border' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewGoalPage() {
  const router       = useRouter();
  const queryClient  = useQueryClient();

  const [category,     setCategory]     = useState('');
  const [name,         setName]         = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate,   setTargetDate]   = useState('');
  const [errorMsg,     setErrorMsg]     = useState('');
  const [created,      setCreated]      = useState<GoalResponse['goal'] | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: CreateGoalPayload) =>
      apiClient.post<{ success: boolean; data: GoalResponse }>('/api/goals', payload)
        .then((r) => r.data.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setCreated(data.goal);
    },
    onError: (err) => setErrorMsg(getErrorMessage(err)),
  });

  const selectedCat = CATEGORIES.find((c) => c.value === category);

  // Min date = tomorrow
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().split('T')[0]!;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');

    if (!category)     { setErrorMsg('Please select a category'); return; }
    if (!name.trim())  { setErrorMsg('Please enter a goal name'); return; }
    const amount = parseFloat(targetAmount);
    if (!amount || amount <= 0) { setErrorMsg('Please enter a valid target amount'); return; }
    if (!targetDate)   { setErrorMsg('Please select a target date'); return; }

    mutation.mutate({ name: name.trim(), category, targetAmount: amount, targetDate });
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (created) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="bg-background-card rounded-2xl border border-border p-10 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-1">Goal Created!</h2>
          <p className="text-sm text-foreground-muted mb-6">{created.name}</p>

          {created.recommendedMonthlySip != null && (
            <div className="bg-[#3C3489]/5 border border-[#3C3489]/10 rounded-2xl p-5 mb-6 text-left">
              <p className="text-xs text-foreground-muted font-medium mb-1">Recommended Monthly SIP</p>
              <p className="text-2xl font-bold text-[#3C3489]">
                {formatInr(created.recommendedMonthlySip)}
              </p>
              <p className="text-xs text-foreground-muted mt-1">
                Invest this amount monthly at 12% p.a. to reach your goal
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => router.push('/goals')}
              className="flex-1 text-sm font-medium text-foreground-muted border border-border rounded-xl py-2.5 hover:bg-border/50 transition-colors"
            >
              View All Goals
            </button>
            <button
              onClick={() => router.push(`/goals/${created.id}`)}
              className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold text-white bg-[#3C3489] hover:bg-[#2d2871] rounded-xl py-2.5 transition-colors"
            >
              View Goal <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back link */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-foreground-muted hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Goals
      </button>

      <div className="bg-background-card rounded-2xl border border-border p-6 md:p-8">
        <h2 className="text-xl font-bold text-foreground mb-1">Create a New Goal</h2>
        <p className="text-sm text-foreground-muted mb-7">Set a financial target and we'll recommend a monthly SIP plan.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Category selector */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-3">
              Choose a Category <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {CATEGORIES.map((cat) => {
                const Icon     = cat.icon;
                const selected = category === cat.value;
                return (
                  <button
                    type="button"
                    key={cat.value}
                    onClick={() => {
                      setCategory(cat.value);
                      if (!name) setName(cat.label);
                    }}
                    className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all text-center
                      ${selected
                        ? `${cat.bg} ${cat.border} shadow-sm shadow-black/5`
                        : 'border-border hover:border-border hover:bg-border/50'
                      }`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${selected ? cat.bg : 'bg-border'}`}>
                      <Icon className={`w-5 h-5 ${selected ? cat.color : 'text-foreground-muted'}`} />
                    </div>
                    <span className={`text-xs font-medium ${selected ? cat.color : 'text-foreground-muted'}`}>
                      {cat.label}
                    </span>
                    {selected && (
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center ${cat.bg}`}>
                        <Check className={`w-2.5 h-2.5 ${cat.color}`} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Goal name */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              Goal Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={selectedCat ? `e.g. ${selectedCat.label} Fund` : 'e.g. Retirement Fund'}
              className="w-full px-4 py-3 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3C3489]/30 focus:border-[#3C3489] transition-colors"
            />
          </div>

          {/* Target amount */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              Target Amount (₹) <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground-muted text-sm font-medium">₹</span>
              <input
                type="number"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="0"
                min="1"
                step="any"
                className="w-full pl-8 pr-4 py-3 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3C3489]/30 focus:border-[#3C3489] transition-colors"
              />
            </div>
            {targetAmount && parseFloat(targetAmount) > 0 && (
              <p className="text-xs text-foreground-muted mt-1.5">
                = {formatInr(parseFloat(targetAmount))}
              </p>
            )}
          </div>

          {/* Target date */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              Target Date <span className="text-red-400">*</span>
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              min={minDateStr}
              className="w-full px-4 py-3 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3C3489]/30 focus:border-[#3C3489] transition-colors"
            />
          </div>

          {errorMsg && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full py-3 bg-[#3C3489] hover:bg-[#2d2871] text-white font-semibold rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {mutation.isPending ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating…
              </>
            ) : (
              'Create Goal'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
