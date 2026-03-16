'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, TrendingDown, Plus, ChevronUp, ChevronDown,
  Wallet, RefreshCw, AlertCircle,
} from 'lucide-react';
import apiClient from '@/lib/api-client';

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
  if (score == null) return <span className="text-gray-400">—</span>;
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
  if (value == null) return <span className="text-gray-400">—</span>;
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
          <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const [activeTab, setActiveTab] = useState('');
  const [sortKey,   setSortKey]   = useState<SortKey>('currentValue');
  const [sortDir,   setSortDir]   = useState<'asc' | 'desc'>('desc');

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['portfolio-summary'],
    queryFn:  () =>
      apiClient.get<{ success: boolean; data: PortfolioSummary }>('/api/portfolio')
        .then((r) => r.data.data),
  });

  const { data: holdingsData, isLoading, error, refetch } = useQuery({
    queryKey: ['holdings', activeTab],
    queryFn:  () =>
      apiClient
        .get<{ success: boolean; data: Holding[] }>(
          '/api/holdings',
          { params: activeTab ? { assetClass: activeTab } : {} }
        )
        .then((r) => r.data.data),
  });

  // Filter "Others" tab client-side
  const KNOWN = ['STOCK', 'MUTUAL_FUND', 'FD', 'GOLD', 'CRYPTO'];
  const holdings = holdingsData
    ? activeTab === 'OTHERS'
      ? holdingsData.filter((h) => !KNOWN.includes(h.assetClass))
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
              <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 animate-pulse">
                <div className="h-3 w-24 bg-gray-100 rounded mb-3" />
                <div className="h-6 w-32 bg-gray-100 rounded" />
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

      {/* ── Holdings table ── */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {/* Header row */}
        <div className="flex items-center justify-between px-5 pt-5 pb-0">
          <h2 className="text-base font-semibold text-gray-900">Holdings</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#3C3489] transition-colors px-2.5 py-1.5 rounded-lg hover:bg-[#3C3489]/5"
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
                            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto mt-3">
          {error ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <AlertCircle className="w-8 h-8 mb-3 text-red-400" />
              <p className="text-sm">Failed to load holdings</p>
              <button onClick={() => refetch()} className="mt-3 text-xs text-[#3C3489] hover:underline">
                Try again
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
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
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 cursor-pointer select-none hover:text-gray-700 whitespace-nowrap"
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
                          <div className="flex flex-col items-center gap-3 text-gray-400">
                            <Wallet className="w-10 h-10 text-gray-200" />
                            <p className="text-sm font-medium text-gray-500">No holdings yet</p>
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
                      <Link key={h.id} href={`/portfolio/${h.id}`} legacyBehavior>
                        <tr
                          className="border-b border-gray-50 hover:bg-gray-50/60 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-3.5">
                            <div>
                              <p className="font-medium text-gray-900 leading-tight">{h.name}</p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {h.symbol ?? h.assetClass} · {h.quantity.toLocaleString('en-IN')} units
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 font-medium text-gray-800">
                            {formatInr(h.currentValue)}
                          </td>
                          <td className="px-4 py-3.5 text-gray-600">
                            {formatInr(h.totalInvested)}
                          </td>
                          <td className="px-4 py-3.5">
                            <PnlBadge value={h.pnlAbsolute} />
                          </td>
                          <td className="px-4 py-3.5">
                            <PnlBadge value={h.pnlPercent} isPercent />
                          </td>
                          <td className="px-4 py-3.5 text-gray-600">
                            {h.xirr != null ? `${h.xirr.toFixed(1)}%` : '—'}
                          </td>
                          <td className="px-4 py-3.5">
                            <RiskPill score={h.riskScore} />
                          </td>
                          <td className="px-4 py-3.5 text-gray-600">
                            {h.weight.toFixed(1)}%
                          </td>
                        </tr>
                      </Link>
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
    : 'text-gray-900';

  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100">
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className={`text-xl font-bold mt-1 ${textColor}`}>{value}</p>
    </div>
  );
}
