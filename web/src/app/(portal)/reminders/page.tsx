'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell, Plus, CheckCircle2, Circle, Pencil, Trash2, X, Loader2,
  Home, Zap, Droplets, Wifi, Smartphone, CreditCard, Car, Wallet,
  Shield, Tv, Users, Wrench, FileUp, AlertCircle,
} from 'lucide-react';
import apiClient, { getErrorMessage } from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

type ReminderCategory =
  | 'RENT' | 'ELECTRICITY' | 'WATER' | 'INTERNET' | 'MOBILE'
  | 'CREDIT_CARD' | 'EMI_HOME_LOAN' | 'EMI_CAR_LOAN' | 'EMI_PERSONAL_LOAN'
  | 'INSURANCE' | 'SUBSCRIPTION' | 'DOMESTIC_HELP' | 'MAINTENANCE' | 'OTHER';

interface ReminderItem {
  id:              string;
  label:           string;
  category:        string;
  amount:          number | null;
  dueDayOfMonth:   number;
  isPaid:          boolean;
  paidAt:          string | null;
  actualAmount:    number | null;
  daysUntilDue:    number;
  isOverdue:       boolean;
}

interface CibilSuggestion {
  label:          string;
  category:       string;
  amount:         number;
  dueDayOfMonth:  number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatInr(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
}

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  RENT:            Home,
  ELECTRICITY:     Zap,
  WATER:           Droplets,
  INTERNET:        Wifi,
  MOBILE:          Smartphone,
  CREDIT_CARD:     CreditCard,
  EMI_HOME_LOAN:   Home,
  EMI_CAR_LOAN:    Car,
  EMI_PERSONAL_LOAN: Wallet,
  INSURANCE:       Shield,
  SUBSCRIPTION:    Tv,
  DOMESTIC_HELP:   Users,
  MAINTENANCE:     Wrench,
  OTHER:           Bell,
};

const CATEGORY_LABELS: Record<string, string> = {
  RENT: 'Rent', ELECTRICITY: 'Electricity', WATER: 'Water', INTERNET: 'Internet',
  MOBILE: 'Mobile', CREDIT_CARD: 'Credit Card', EMI_HOME_LOAN: 'Home Loan EMI',
  EMI_CAR_LOAN: 'Car Loan EMI', EMI_PERSONAL_LOAN: 'Personal Loan EMI',
  INSURANCE: 'Insurance', SUBSCRIPTION: 'Subscription', DOMESTIC_HELP: 'Domestic Help',
  MAINTENANCE: 'Maintenance', OTHER: 'Other',
};

const CATEGORY_OPTIONS: { value: ReminderCategory; label: string }[] = [
  { value: 'RENT', label: 'Rent' },
  { value: 'ELECTRICITY', label: 'Electricity' },
  { value: 'WATER', label: 'Water' },
  { value: 'INTERNET', label: 'Internet' },
  { value: 'MOBILE', label: 'Mobile' },
  { value: 'CREDIT_CARD', label: 'Credit Card' },
  { value: 'EMI_HOME_LOAN', label: 'Home Loan EMI' },
  { value: 'EMI_CAR_LOAN', label: 'Car Loan EMI' },
  { value: 'EMI_PERSONAL_LOAN', label: 'Personal Loan EMI' },
  { value: 'INSURANCE', label: 'Insurance' },
  { value: 'SUBSCRIPTION', label: 'Subscription' },
  { value: 'DOMESTIC_HELP', label: 'Domestic Help' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'OTHER', label: 'Other' },
];

// ─── Add Reminder Modal ───────────────────────────────────────────────────────

function AddReminderModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    label: '',
    category: 'RENT' as ReminderCategory,
    amount: '',
    dueDayOfMonth: '5',
  });

  const mutation = useMutation({
    mutationFn: () =>
      apiClient.post('/api/reminders', {
        label: form.label.trim(),
        category: form.category,
        amount: parseFloat(form.amount),
        dueDayOfMonth: parseInt(form.dueDayOfMonth, 10),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      queryClient.invalidateQueries({ queryKey: ['reminders-upcoming'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onSuccess();
      onClose();
    },
  });

  const addError = mutation.isError ? getErrorMessage(mutation.error) : null;
  const inputClass =
    'block w-full px-3.5 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background-card focus:outline-none focus:ring-2 focus:ring-[#3C3489]/20 focus:border-[#3C3489]';

  const dueDay = parseInt(form.dueDayOfMonth, 10) || 5;
  const suffix = dueDay === 1 ? 'st' : dueDay === 2 ? 'nd' : dueDay === 3 ? 'rd' : 'th';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-background-card rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground">Add Bill Reminder</h2>
          <button onClick={onClose} className="text-foreground-muted hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground-muted uppercase tracking-wide mb-1.5">Label</label>
            <input
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              className={inputClass}
              placeholder="e.g. HDFC Credit Card"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground-muted uppercase tracking-wide mb-1.5">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as ReminderCategory }))}
              className={inputClass}
            >
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground-muted uppercase tracking-wide mb-1.5">Amount (₹)</label>
            <input
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              className={inputClass}
              placeholder="e.g. 5000"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground-muted uppercase tracking-wide mb-1.5">Due day of month (1–31)</label>
            <input
              type="number"
              min={1}
              max={31}
              value={form.dueDayOfMonth}
              onChange={(e) => setForm((f) => ({ ...f, dueDayOfMonth: e.target.value }))}
              className={inputClass}
            />
          </div>
          <p className="text-xs text-foreground-muted">
            This will remind you on the {dueDay}{suffix} of every month.
          </p>
          {addError && (
            <p className="text-sm text-red-500">{addError}</p>
          )}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm text-foreground-muted hover:bg-border/50 transition-colors">
              Cancel
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={!form.label.trim() || !form.amount || mutation.isPending}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#3C3489] text-white text-sm font-medium hover:bg-[#2d2871] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Add Reminder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Reminder Modal ───────────────────────────────────────────────────────

function EditReminderModal({
  item,
  onClose,
  onSuccess,
}: {
  item: ReminderItem;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    label: item.label,
    amount: item.amount?.toString() ?? '',
    dueDayOfMonth: item.dueDayOfMonth.toString(),
  });

  const mutation = useMutation({
    mutationFn: () =>
      apiClient.patch(`/api/reminders/${item.id}`, {
        label: form.label.trim(),
        amount: parseFloat(form.amount),
        dueDayOfMonth: parseInt(form.dueDayOfMonth, 10),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      queryClient.invalidateQueries({ queryKey: ['reminders-upcoming'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
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
          <h2 className="text-lg font-semibold text-foreground">Edit Reminder</h2>
          <button onClick={onClose} className="text-foreground-muted hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground-muted uppercase tracking-wide mb-1.5">Label</label>
            <input
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground-muted uppercase tracking-wide mb-1.5">Amount (₹)</label>
            <input
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground-muted uppercase tracking-wide mb-1.5">Due day (1–31)</label>
            <input
              type="number"
              min={1}
              max={31}
              value={form.dueDayOfMonth}
              onChange={(e) => setForm((f) => ({ ...f, dueDayOfMonth: e.target.value }))}
              className={inputClass}
            />
          </div>
          {mutation.isError && (
            <p className="text-sm text-red-500">Failed to update. Please try again.</p>
          )}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm text-foreground-muted hover:bg-border/50 transition-colors">
              Cancel
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={!form.label.trim() || !form.amount || mutation.isPending}
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

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteConfirmModal({
  item,
  onClose,
  onConfirm,
}: {
  item: ReminderItem;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => apiClient.delete(`/api/reminders/${item.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      queryClient.invalidateQueries({ queryKey: ['reminders-upcoming'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onConfirm();
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-background-card rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-foreground mb-2">Delete {item.label}?</h2>
        <p className="text-sm text-foreground-muted mb-6">This reminder and its payment history will be removed.</p>
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

// ─── Mark Paid Modal (actual amount input) ─────────────────────────────────────

function MarkPaidModal({
  item,
  onClose,
  onSuccess,
}: {
  item: ReminderItem;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const [actualAmount, setActualAmount] = useState((item.actualAmount ?? item.amount ?? 0).toString());

  const mutation = useMutation({
    mutationFn: () =>
      apiClient.post(`/api/reminders/${item.id}/pay`, {
        actualAmount: parseFloat(actualAmount) || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      queryClient.invalidateQueries({ queryKey: ['reminders-upcoming'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
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
          <h2 className="text-lg font-semibold text-foreground">Mark as Paid — {item.label}</h2>
          <button onClick={onClose} className="text-foreground-muted hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground-muted uppercase tracking-wide mb-1.5">Amount paid (₹)</label>
            <input
              type="number"
              step="0.01"
              value={actualAmount}
              onChange={(e) => setActualAmount(e.target.value)}
              className={inputClass}
              placeholder={(item.amount ?? 0).toString()}
            />
          </div>
          {mutation.isError && (
            <p className="text-sm text-red-500">Failed to update. Please try again.</p>
          )}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm text-foreground-muted hover:bg-border/50 transition-colors">
              Cancel
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="flex-1 px-4 py-2.5 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Mark Paid
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CIBIL Import Modal ──────────────────────────────────────────────────────

function CibilImportModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<(CibilSuggestion & { checked: boolean; amount: string; dueDay: string })[]>([]);

  const importMutation = useMutation({
    mutationFn: async (selected: CibilSuggestion[]) => {
      for (const s of selected) {
        await apiClient.post('/api/reminders', {
          label: s.label,
          category: s.category,
          amount: s.amount,
          dueDayOfMonth: s.dueDayOfMonth,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      queryClient.invalidateQueries({ queryKey: ['reminders-upcoming'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onSuccess();
      onClose();
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== 'application/pdf') {
      setError('Please select a PDF file');
      return;
    }
    setLoading(true);
    setError(null);
    setSuggestions([]);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiClient.post<{ success: boolean; data: { suggestions: CibilSuggestion[]; error?: string } }>(
        '/api/reminders/import-cibil',
        formData
      );
      const data = res.data?.data;
      if (data?.error) {
        setError(data.error);
      } else if (Array.isArray(data?.suggestions) && data.suggestions.length > 0) {
        setSuggestions(
          data.suggestions.map((s) => ({
            ...s,
            checked: true,
            amount: s.amount.toString(),
            dueDay: s.dueDayOfMonth.toString(),
          }))
        );
      } else {
        setError('No bills found in the CIBIL report');
      }
    } catch {
      setError('Failed to parse CIBIL report');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const selectedCount = suggestions.filter((s) => s.checked).length;

  const handleImport = () => {
    const selected = suggestions
      .filter((s) => s.checked)
      .map((s) => ({
        label: s.label,
        category: s.category,
        amount: parseFloat(s.amount) || s.amount,
        dueDayOfMonth: parseInt(s.dueDay, 10) || 5,
      }));
    importMutation.mutate(selected);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-background-card rounded-2xl shadow-2xl w-full max-w-2xl p-6 my-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground">Import from CIBIL</h2>
          <button onClick={onClose} className="text-foreground-muted hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {suggestions.length === 0 && !loading && (
          <div className="space-y-4">
            <p className="text-sm text-foreground-muted">Upload your CIBIL credit report PDF to extract loan and credit card EMIs.</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="w-full py-4 border-2 border-dashed border-border rounded-xl text-sm font-medium text-foreground-muted hover:border-[#3C3489] hover:text-[#3C3489] transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Reading your CIBIL report…
                </>
              ) : (
                <>
                  <FileUp className="w-5 h-5" />
                  Choose PDF file
                </>
              )}
            </button>
            {error && (
              <p className="flex items-center gap-2 text-sm text-red-500">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </p>
            )}
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm text-foreground-muted">Review and edit the suggested bills. Uncheck any you don&apos;t want to import.</p>
            <div className="max-h-64 overflow-y-auto border border-border rounded-xl">
              <table className="w-full text-sm">
                <thead className="bg-border/50 sticky top-0">
                  <tr>
                    <th className="text-left py-2 px-3 w-10"></th>
                    <th className="text-left py-2 px-3">Label</th>
                    <th className="text-left py-2 px-3">Category</th>
                    <th className="text-left py-2 px-3">Amount</th>
                    <th className="text-left py-2 px-3">Due Day</th>
                  </tr>
                </thead>
                <tbody>
                  {suggestions.map((s, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="py-2 px-3">
                        <input
                          type="checkbox"
                          checked={s.checked}
                          onChange={(e) =>
                            setSuggestions((prev) => {
                              const next = [...prev];
                              next[i] = { ...next[i]!, checked: e.target.checked };
                              return next;
                            })
                          }
                        />
                      </td>
                      <td className="py-2 px-3 font-medium">{s.label}</td>
                      <td className="py-2 px-3">{CATEGORY_LABELS[s.category] ?? s.category}</td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          value={s.amount}
                          onChange={(e) =>
                            setSuggestions((prev) => {
                              const next = [...prev];
                              next[i] = { ...next[i]!, amount: e.target.value };
                              return next;
                            })
                          }
                          className="w-24 px-2 py-1 border border-border rounded text-foreground bg-background-card"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={s.dueDay}
                          onChange={(e) =>
                            setSuggestions((prev) => {
                              const next = [...prev];
                              next[i] = { ...next[i]!, dueDay: e.target.value };
                              return next;
                            })
                          }
                          className="w-16 px-2 py-1 border border-border rounded text-foreground bg-background-card"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {importMutation.isError && (
              <p className="text-sm text-red-500">Failed to import. Please try again.</p>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm text-foreground-muted hover:bg-border/50 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={selectedCount === 0 || importMutation.isPending}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#3C3489] text-white text-sm font-medium hover:bg-[#2d2871] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {importMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Import {selectedCount} selected
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Bill Row Component ────────────────────────────────────────────────────────

function BillRow({
  item,
  onEdit,
  onDelete,
  onMarkPaid,
}: {
  item: ReminderItem;
  onEdit: () => void;
  onDelete: () => void;
  onMarkPaid: () => void;
}) {
  const queryClient = useQueryClient();
  const Icon = CATEGORY_ICONS[item.category] ?? Bell;

  const payMutation = useMutation({
    mutationFn: () => apiClient.post(`/api/reminders/${item.id}/pay`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      queryClient.invalidateQueries({ queryKey: ['reminders-upcoming'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const unpayMutation = useMutation({
    mutationFn: () => apiClient.post(`/api/reminders/${item.id}/unpay`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      queryClient.invalidateQueries({ queryKey: ['reminders-upcoming'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const statusColor = item.isPaid ? 'text-green-600' : item.isOverdue ? 'text-red-500' : 'text-foreground-muted';

  return (
    <div
      className={`flex items-center justify-between gap-4 p-4 rounded-xl border transition-colors ${
        item.isOverdue ? 'border-red-200 bg-red-50/30' : 'border-border bg-background-card/50 hover:bg-background-card/80'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <button
          onClick={() => (item.isPaid ? unpayMutation.mutate() : onMarkPaid())}
          disabled={payMutation.isPending || unpayMutation.isPending}
          className="shrink-0"
        >
          {item.isPaid ? (
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          ) : (
            <Circle className="w-6 h-6 text-gray-300 hover:text-[#3C3489] transition-colors" />
          )}
        </button>
        <div className="w-9 h-9 rounded-lg bg-[#3C3489]/10 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-[#3C3489]" />
        </div>
        <div className="min-w-0">
          <p className={`text-sm font-semibold truncate ${item.isPaid ? 'line-through text-foreground-muted' : 'text-foreground'}`}>
            {item.label}
          </p>
          <p className="text-xs text-foreground-muted">
            Due on {item.dueDayOfMonth}
            {item.dueDayOfMonth === 1 ? 'st' : item.dueDayOfMonth === 2 ? 'nd' : item.dueDayOfMonth === 3 ? 'rd' : 'th'} of month
            {item.isPaid && item.paidAt && (
              <span className="ml-2 text-green-600">· Paid {new Date(item.paidAt).toLocaleDateString('en-IN')}</span>
            )}
            {item.isOverdue && !item.isPaid && (
              <span className="ml-2 text-red-500 font-medium">· {Math.abs(item.daysUntilDue)} days overdue</span>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-sm font-bold text-foreground">{formatInr(item.amount ?? item.actualAmount)}</span>
        <span className={`text-xs font-medium ${statusColor}`}>
          {item.isPaid ? 'Paid ✓' : item.isOverdue ? 'Overdue' : 'Unpaid'}
        </span>
        <button onClick={onEdit} className="p-1.5 rounded-lg text-foreground-muted hover:text-[#3C3489] hover:bg-[#3C3489]/10 transition-colors">
          <Pencil className="w-4 h-4" />
        </button>
        <button onClick={onDelete} className="p-1.5 rounded-lg text-foreground-muted hover:text-red-500 hover:bg-red-50 transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RemindersPage() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [showCibil, setShowCibil] = useState(false);
  const [editItem, setEditItem] = useState<ReminderItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<ReminderItem | null>(null);
  const [markPaidItem, setMarkPaidItem] = useState<ReminderItem | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['reminders'],
    queryFn: () =>
      apiClient.get<{ success: boolean; data: { items: ReminderItem[] } }>('/api/reminders').then((r) => r.data.data.items),
    staleTime: 30_000,
  });

  const items = data ?? [];
  const totalMonthly = items.reduce((s, i) => s + (i.amount ?? 0), 0);
  const paidItems = items.filter((i) => i.isPaid);
  const unpaidItems = items.filter((i) => !i.isPaid);
  const overdueItems = items.filter((i) => i.isOverdue);
  const paidTotal = paidItems.reduce((s, i) => s + (i.actualAmount ?? i.amount ?? 0), 0);
  const unpaidTotal = unpaidItems.reduce((s, i) => s + (i.amount ?? 0), 0);

  // Group by category
  const byCategory = items.reduce<Record<string, ReminderItem[]>>((acc, item) => {
    const cat = item.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat]!.push(item);
    return acc;
  }, {});

  const categoryOrder = [
    'RENT', 'ELECTRICITY', 'WATER', 'INTERNET', 'MOBILE',
    'CREDIT_CARD', 'EMI_HOME_LOAN', 'EMI_CAR_LOAN', 'EMI_PERSONAL_LOAN',
    'INSURANCE', 'SUBSCRIPTION', 'DOMESTIC_HELP', 'MAINTENANCE', 'OTHER',
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-10 h-10 animate-spin text-[#3C3489]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-foreground-muted">
        <AlertCircle className="w-12 h-12 mb-4 text-red-400" />
        <p className="text-base font-medium mb-4">Failed to load reminders</p>
        <button
          onClick={() => refetch()}
          className="px-6 py-2.5 rounded-xl bg-[#3C3489] text-white text-sm font-semibold hover:bg-[#2d2871] transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Bell className="w-7 h-7 text-[#3C3489]" />
          Bill Reminders
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCibil(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-border/50 transition-colors"
          >
            <FileUp className="w-4 h-4" /> Import from CIBIL
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#3C3489] text-white text-sm font-medium hover:bg-[#2d2871] transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Bill Reminder
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-background-card rounded-2xl border border-border p-4">
          <p className="text-xs text-foreground-muted font-medium">Total Monthly</p>
          <p className="text-lg font-bold text-foreground mt-1">{formatInr(totalMonthly)}</p>
        </div>
        <div className="bg-background-card rounded-2xl border border-border p-4">
          <p className="text-xs text-foreground-muted font-medium">Paid This Month</p>
          <p className="text-lg font-bold text-green-600 mt-1">{formatInr(paidTotal)}</p>
          <p className="text-xs text-foreground-muted">{paidItems.length} bills</p>
        </div>
        <div className="bg-background-card rounded-2xl border border-border p-4">
          <p className="text-xs text-foreground-muted font-medium">Unpaid</p>
          <p className="text-lg font-bold text-foreground mt-1">{formatInr(unpaidTotal)}</p>
          <p className="text-xs text-foreground-muted">{unpaidItems.length} bills</p>
        </div>
        <div className="bg-background-card rounded-2xl border border-border p-4">
          <p className="text-xs text-foreground-muted font-medium">Overdue</p>
          <p className="text-lg font-bold text-red-500 mt-1">{overdueItems.length}</p>
          <p className="text-xs text-foreground-muted">bills</p>
        </div>
      </div>

      {/* Overdue alerts */}
      {overdueItems.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <h3 className="text-sm font-bold text-red-800 mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> Overdue Bills
          </h3>
          <ul className="space-y-2">
            {overdueItems.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 py-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.label}</p>
                  <p className="text-xs text-red-600">
                    {formatInr(item.amount)} · {Math.abs(item.daysUntilDue)} days overdue
                  </p>
                </div>
                <button
                  onClick={() => setMarkPaidItem(item)}
                  className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors"
                >
                  Mark Paid
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* This month's bills grouped by category */}
      <div className="space-y-6">
        <h3 className="text-sm font-bold text-foreground">This Month&apos;s Bills</h3>
        {items.length === 0 ? (
          <div className="text-center py-16 bg-background-card rounded-2xl border border-border">
            <Bell className="w-12 h-12 mx-auto mb-3 text-foreground-muted" />
            <p className="text-sm font-medium text-foreground-muted">No bill reminders yet</p>
            <p className="text-xs text-foreground-muted mt-1">Add your first reminder to get started</p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-4 px-4 py-2 rounded-xl bg-[#3C3489] text-white text-sm font-medium hover:bg-[#2d2871] transition-colors"
            >
              Add Bill Reminder
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {categoryOrder.map((cat) => {
              const catItems = byCategory[cat];
              if (!catItems?.length) return null;
              const Icon = CATEGORY_ICONS[cat] ?? Bell;
              return (
                <div key={cat} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#3C3489]/10 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-[#3C3489]" />
                    </div>
                    <h4 className="text-sm font-semibold text-foreground">{CATEGORY_LABELS[cat] ?? cat}</h4>
                  </div>
                  <div className="space-y-2">
                    {catItems.map((item) => (
                      <BillRow
                        key={item.id}
                        item={item}
                        onEdit={() => setEditItem(item)}
                        onDelete={() => setDeleteItem(item)}
                        onMarkPaid={() => setMarkPaidItem(item)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      {showAdd && <AddReminderModal onClose={() => setShowAdd(false)} onSuccess={() => setShowAdd(false)} />}
      {showCibil && <CibilImportModal onClose={() => setShowCibil(false)} onSuccess={() => setShowCibil(false)} />}
      {editItem && (
        <EditReminderModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSuccess={() => setEditItem(null)}
        />
      )}
      {deleteItem && (
        <DeleteConfirmModal
          item={deleteItem}
          onClose={() => setDeleteItem(null)}
          onConfirm={() => setDeleteItem(null)}
        />
      )}
      {markPaidItem && (
        <MarkPaidModal
          item={markPaidItem}
          onClose={() => setMarkPaidItem(null)}
          onSuccess={() => setMarkPaidItem(null)}
        />
      )}
    </div>
  );
}
