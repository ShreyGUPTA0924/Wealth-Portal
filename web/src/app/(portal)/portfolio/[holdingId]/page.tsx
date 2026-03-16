'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  ChevronLeft, TrendingUp, TrendingDown, Plus, Pencil,
  Trash2, Loader2, AlertCircle, X, CheckCircle,
} from 'lucide-react';
import apiClient, { getErrorMessage } from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Transaction {
  id:              string;
  type:            string;
  quantity:        number;
  pricePerUnit:    number;
  totalAmount:     number;
  brokerage:       number | null;
  transactionDate: string;
  notes:           string | null;
}

interface LinkedGoal {
  goalId:            string;
  name:              string;
  allocationPercent: number;
}

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
  notes:         string | null;
  transactions:  Transaction[];
  linkedGoals:   LinkedGoal[];
}

interface HistoryPoint { date: string; price: number }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatInr(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function RiskPill({ score }: { score: number | null }) {
  if (score == null) return <span className="text-gray-400">—</span>;
  const color = score <= 4 ? 'bg-green-100 text-green-700'
              : score <= 6 ? 'bg-yellow-100 text-yellow-700'
              : 'bg-red-100 text-red-700';
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${color}`}>
      Risk {score}/10
    </span>
  );
}

const inputClass =
  'block w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 ' +
  'placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#3C3489]/20 focus:border-[#3C3489]';

const PERIOD_OPTIONS = ['1M', '3M', '6M', '1Y', 'MAX'];
const TXN_TYPES = ['BUY', 'SELL', 'DIVIDEND', 'SIP'];
const PRICEABLE_CLASSES = ['STOCK', 'MUTUAL_FUND', 'CRYPTO', 'GOLD', 'SGB'];

// ─── Tooltip formatters (typed for Recharts) ──────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tooltipValueFormatter = (value: any): [string, string] => [formatInr(value as number), 'Price'];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tooltipLabelFormatter = (label: any): string => formatDate(String(label));

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HoldingDetailPage({
  params,
}: {
  params: Promise<{ holdingId: string }>;
}) {
  const { holdingId } = use(params);
  const router        = useRouter();
  const queryClient   = useQueryClient();

  const [period,            setPeriod]            = useState('3M');
  const [showTxnForm,       setShowTxnForm]       = useState(false);
  const [showEditForm,      setShowEditForm]      = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [txnError,          setTxnError]          = useState('');
  const [editError,         setEditError]         = useState('');

  // Transaction form
  const [txnType,  setTxnType]  = useState('BUY');
  const [txnQty,   setTxnQty]   = useState('');
  const [txnPrice, setTxnPrice] = useState('');
  const [txnDate,  setTxnDate]  = useState(new Date().toISOString().split('T')[0]!);
  const [txnNotes, setTxnNotes] = useState('');

  // Edit form
  const [editNotes, setEditNotes] = useState('');
  const [editPrice, setEditPrice] = useState('');

  // Queries
  const { data: holding, isLoading, error } = useQuery<Holding>({
    queryKey: ['holding', holdingId],
    queryFn:  () =>
      apiClient
        .get<{ success: boolean; data: Holding }>(`/api/holdings/${holdingId}`)
        .then((r) => r.data.data),
  });

  // Sync edit form when holding loads
  useEffect(() => {
    if (holding) {
      setEditNotes(holding.notes ?? '');
      setEditPrice(holding.currentPrice?.toString() ?? '');
    }
  }, [holding]);

  const priceable = holding && PRICEABLE_CLASSES.includes(holding.assetClass);

  const { data: history } = useQuery<HistoryPoint[]>({
    queryKey: ['price-history', holding?.symbol, holding?.assetClass, period],
    enabled:  !!holding?.symbol && !!priceable,
    queryFn:  () =>
      apiClient
        .get<{ success: boolean; data: HistoryPoint[] }>(
          `/api/market/history/${holding!.symbol}`,
          { params: { assetClass: holding!.assetClass, period } }
        )
        .then((r) => r.data.data),
  });

  // Mutations
  const addTxnMutation = useMutation({
    mutationFn: () =>
      apiClient.post(`/api/holdings/${holdingId}/transactions`, {
        type:         txnType,
        quantity:     parseFloat(txnQty),
        pricePerUnit: parseFloat(txnPrice),
        date:         txnDate,
        notes:        txnNotes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holding', holdingId] });
      queryClient.invalidateQueries({ queryKey: ['holdings'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-summary'] });
      setShowTxnForm(false);
      setTxnQty(''); setTxnPrice(''); setTxnNotes('');
    },
    onError: (err) => setTxnError(getErrorMessage(err)),
  });

  const editMutation = useMutation({
    mutationFn: () =>
      apiClient.patch(`/api/holdings/${holdingId}`, {
        notes:       editNotes || undefined,
        manualPrice: editPrice ? parseFloat(editPrice) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holding', holdingId] });
      queryClient.invalidateQueries({ queryKey: ['holdings'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-summary'] });
      setShowEditForm(false);
    },
    onError: (err) => setEditError(getErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiClient.delete(`/api/holdings/${holdingId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holdings'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-summary'] });
      router.push('/portfolio');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#3C3489] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !holding) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-sm">Holding not found or failed to load</p>
        <button onClick={() => router.back()} className="text-xs text-[#3C3489] hover:underline">
          Go back
        </button>
      </div>
    );
  }

  const pnlPositive = (holding.pnlAbsolute ?? 0) >= 0;

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#3C3489] transition-colors"
      >
        <ChevronLeft className="w-4 h-4" /> Back to Portfolio
      </button>

      {/* ── Header ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{holding.name}</h1>
              {holding.symbol && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                  {holding.symbol}
                </span>
              )}
              <RiskPill score={holding.riskScore} />
            </div>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="text-2xl font-bold text-gray-900">
                {formatInr(holding.currentPrice)}
              </span>
              {holding.pnlPercent != null && (
                <span className={`flex items-center gap-1 text-sm font-medium ${pnlPositive ? 'text-green-600' : 'text-red-500'}`}>
                  {pnlPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  {pnlPositive ? '+' : ''}{holding.pnlPercent.toFixed(2)}%
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEditForm(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-[#3C3489] border border-gray-200 hover:border-[#3C3489] px-3 py-1.5 rounded-lg transition-all"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
            <button
              onClick={() => setShowConfirmDelete(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-700 border border-red-100 hover:border-red-300 px-3 py-1.5 rounded-lg transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        </div>
      </div>

      {/* ── Stats grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {([
          { label: 'Current Value', value: formatInr(holding.currentValue) },
          { label: 'Invested',      value: formatInr(holding.totalInvested) },
          { label: 'P&L',           value: formatInr(holding.pnlAbsolute), color: pnlPositive ? 'text-green-600' : 'text-red-500' },
          { label: 'XIRR',          value: holding.xirr != null ? `${holding.xirr.toFixed(1)}%` : '—' },
          { label: 'Qty',           value: holding.quantity.toLocaleString('en-IN') },
          { label: 'Weight',        value: `${holding.weight.toFixed(1)}%` },
        ]).map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-3.5">
            <p className="text-xs text-gray-500 font-medium">{label}</p>
            <p className={`text-base font-semibold mt-0.5 ${color ?? 'text-gray-900'}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Price chart ── */}
      {priceable && holding.symbol && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Price History</h2>
            <div className="flex gap-1">
              {PERIOD_OPTIONS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors
                              ${period === p ? 'bg-[#3C3489] text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          {history && history.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  tickFormatter={(v: string) =>
                    new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                  }
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  tickFormatter={(v: number) => `₹${v.toLocaleString('en-IN')}`}
                  width={70}
                />
                <Tooltip
                  formatter={tooltipValueFormatter}
                  labelFormatter={tooltipLabelFormatter}
                  contentStyle={{
                    borderRadius: '12px', border: '1px solid #e5e7eb',
                    fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="#3C3489"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#3C3489' }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-300 text-sm">
              No chart data available
            </div>
          )}
        </div>
      )}

      {/* ── Transactions ── */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <h2 className="text-sm font-semibold text-gray-900">Transactions</h2>
          <button
            onClick={() => { setShowTxnForm(true); setTxnError(''); }}
            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#3C3489] hover:bg-[#2d2871] px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>

        {showTxnForm && (
          <div className="px-5 py-4 bg-gray-50/60 border-b border-gray-100">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Type</label>
                <select value={txnType} onChange={(e) => setTxnType(e.target.value)} className={inputClass}>
                  {TXN_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Quantity</label>
                <input type="number" step="any" value={txnQty} onChange={(e) => setTxnQty(e.target.value)} className={inputClass} placeholder="0" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Price/Unit (₹)</label>
                <input type="number" step="any" value={txnPrice} onChange={(e) => setTxnPrice(e.target.value)} className={inputClass} placeholder="0" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Date</label>
                <input type="date" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} className={inputClass} />
              </div>
            </div>
            <input value={txnNotes} onChange={(e) => setTxnNotes(e.target.value)} className={`${inputClass} mb-3`} placeholder="Notes (optional)" />
            {txnError && <p className="text-xs text-red-500 mb-3">{txnError}</p>}
            <div className="flex items-center gap-2">
              <button
                onClick={() => addTxnMutation.mutate()}
                disabled={!txnQty || !txnPrice || addTxnMutation.isPending}
                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#3C3489] hover:bg-[#2d2871] px-4 py-2 rounded-lg disabled:opacity-50"
              >
                {addTxnMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <CheckCircle className="w-3.5 h-3.5" /> Save
              </button>
              <button onClick={() => setShowTxnForm(false)} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg">
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50">
                {['Date', 'Type', 'Qty', 'Price/Unit', 'Amount', 'Notes'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {holding.transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm text-gray-400">No transactions yet</td>
                </tr>
              ) : holding.transactions.map((t) => (
                <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(t.transactionDate)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full
                      ${t.type === 'BUY' || t.type === 'SIP' ? 'bg-blue-50 text-blue-700'
                        : t.type === 'SELL' ? 'bg-red-50 text-red-700'
                        : 'bg-green-50 text-green-700'}`}>
                      {t.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-800">{t.quantity.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-gray-600">{formatInr(t.pricePerUnit)}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{formatInr(t.totalAmount)}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{t.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Linked goals ── */}
      {holding.linkedGoals.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Linked Goals</h2>
          <div className="space-y-2">
            {holding.linkedGoals.map((g) => (
              <div key={g.goalId} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-gray-50">
                <span className="text-sm text-gray-800">{g.name}</span>
                <span className="text-xs font-medium text-[#3C3489]">{g.allocationPercent.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Edit modal ── */}
      {showEditForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Edit Holding</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Manual Price (₹)</label>
                <input type="number" step="any" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} className={inputClass} placeholder="Leave blank to keep current" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
                <input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className={inputClass} />
              </div>
              {editError && <p className="text-xs text-red-500">{editError}</p>}
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => editMutation.mutate()}
                disabled={editMutation.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#3C3489] hover:bg-[#2d2871] disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {editMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Changes
              </button>
              <button onClick={() => setShowEditForm(false)} className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ── */}
      {showConfirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-base font-semibold text-gray-900">Delete Holding?</h3>
            <p className="text-sm text-gray-500 mt-2">
              This will soft-delete <strong>{holding.name}</strong> and update your portfolio.
            </p>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Yes, Delete
              </button>
              <button onClick={() => setShowConfirmDelete(false)} className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
