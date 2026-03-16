'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  TrendingUp, Landmark, Bitcoin, Building2, Coins,
  Sprout, ShieldCheck, Umbrella, BarChart3, ChevronLeft, Loader2, Search,
} from 'lucide-react';
import apiClient, { getErrorMessage } from '@/lib/api-client';

// ─── Asset classes ────────────────────────────────────────────────────────────

const ASSET_TYPES = [
  { value: 'STOCK',       label: 'Stock',         icon: TrendingUp,  bg: 'bg-blue-50',    text: 'text-blue-600' },
  { value: 'MUTUAL_FUND', label: 'Mutual Fund',   icon: BarChart3,   bg: 'bg-purple-50',  text: 'text-purple-600' },
  { value: 'CRYPTO',      label: 'Crypto',        icon: Bitcoin,     bg: 'bg-orange-50',  text: 'text-orange-500' },
  { value: 'GOLD',        label: 'Gold',          icon: Coins,       bg: 'bg-yellow-50',  text: 'text-yellow-600' },
  { value: 'SGB',         label: 'SGB',           icon: ShieldCheck, bg: 'bg-yellow-50',  text: 'text-yellow-700' },
  { value: 'FD',          label: 'Fixed Deposit', icon: Landmark,    bg: 'bg-green-50',   text: 'text-green-600' },
  { value: 'RD',          label: 'Recurring Dep', icon: Landmark,    bg: 'bg-teal-50',    text: 'text-teal-600' },
  { value: 'PPF',         label: 'PPF',           icon: Umbrella,    bg: 'bg-indigo-50',  text: 'text-indigo-600' },
  { value: 'EPF',         label: 'EPF',           icon: Sprout,      bg: 'bg-lime-50',    text: 'text-lime-600' },
  { value: 'REAL_ESTATE', label: 'Real Estate',   icon: Building2,   bg: 'bg-rose-50',    text: 'text-rose-600' },
];

type AssetValue = string;

const SYMBOL_TYPES = ['STOCK', 'MUTUAL_FUND', 'CRYPTO'];
const SAVINGS_TYPES = ['FD', 'RD', 'PPF', 'EPF', 'NPS'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const inputClass =
  'block w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 ' +
  'placeholder-gray-400 bg-white transition-colors ' +
  'focus:outline-none focus:ring-2 focus:ring-[#3C3489]/20 focus:border-[#3C3489]';

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

interface SearchResult { symbol: string; name: string }

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AddHoldingPage() {
  const router      = useRouter();
  const queryClient = useQueryClient();

  const [selected, setSelected] = useState<AssetValue | null>(null);
  const [apiError, setApiError] = useState('');

  // Form state — flat, no library needed for this dynamic form
  const [name,         setName]         = useState('');
  const [symbol,       setSymbol]       = useState('');
  const [symbolSearch, setSymbolSearch] = useState('');
  const [showSugg,     setShowSugg]     = useState(false);
  const [quantity,     setQuantity]     = useState('');
  const [buyPrice,     setBuyPrice]     = useState('');
  const [buyDate,      setBuyDate]      = useState('');
  const [maturityDate, setMaturityDate] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [notes,        setNotes]        = useState('');
  const [errors,       setErrors]       = useState<Record<string, string>>({});

  // Symbol search
  const { data: suggestions } = useQuery({
    queryKey: ['symbol-search', symbolSearch, selected],
    enabled:  symbolSearch.length >= 2 && !!selected && SYMBOL_TYPES.includes(selected),
    queryFn:  () =>
      apiClient
        .get<{ success: boolean; data: SearchResult[] }>('/api/market/search', {
          params: { q: symbolSearch, assetClass: selected },
        })
        .then((r) => r.data.data),
  });

  const needsSymbol    = selected && SYMBOL_TYPES.includes(selected);
  const needsSavings   = selected && SAVINGS_TYPES.includes(selected);
  const needsRealEstate = selected === 'REAL_ESTATE';

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!name.trim()) e['name'] = 'Name is required';
    if (needsSymbol && !symbol) e['symbol'] = 'Symbol is required';
    if (!needsRealEstate && !needsSavings && !quantity) e['quantity'] = 'Quantity is required';
    if (!needsSavings && !buyPrice) e['buyPrice'] = 'Buy price is required';
    if (needsSavings && !quantity) e['quantity'] = 'Amount is required';
    if (needsSavings && !interestRate) e['interestRate'] = 'Interest rate is required';
    if (!buyDate) e['buyDate'] = 'Date is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const mutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        assetClass: selected,
        name:       name.trim(),
        buyDate,
        notes:      notes || undefined,
      };

      if (needsSymbol)    { payload['symbol']   = symbol; }
      if (needsRealEstate) {
        payload['quantity'] = 1;
        payload['buyPrice'] = parseFloat(buyPrice);
      } else if (needsSavings) {
        payload['quantity']     = parseFloat(quantity);
        payload['buyPrice']     = 1;
        payload['maturityDate'] = maturityDate || undefined;
        payload['interestRate'] = interestRate ? parseFloat(interestRate) : undefined;
      } else {
        payload['quantity'] = parseFloat(quantity);
        payload['buyPrice'] = parseFloat(buyPrice);
      }

      return apiClient.post('/api/holdings', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holdings'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-summary'] });
      router.push('/portfolio');
    },
    onError: (err) => setApiError(getErrorMessage(err)),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setApiError('');
    if (validate()) mutation.mutate();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#3C3489] transition-colors"
      >
        <ChevronLeft className="w-4 h-4" /> Back to Portfolio
      </button>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h1 className="text-lg font-semibold text-gray-900 mb-1">Add Holding</h1>
        <p className="text-sm text-gray-500 mb-6">Select an asset type to get started</p>

        {/* Asset type grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 mb-8">
          {ASSET_TYPES.map(({ value, label, icon: Icon, bg, text }) => (
            <button
              key={value}
              type="button"
              onClick={() => { setSelected(value); setApiError(''); setErrors({}); }}
              className={`flex flex-col items-center gap-2 p-3.5 rounded-2xl border-2 transition-all text-center
                          ${selected === value
                            ? 'border-[#3C3489] bg-[#3C3489]/5 shadow-sm'
                            : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${bg}`}>
                <Icon className={`${text}`} size={18} />
              </div>
              <span className={`text-xs font-medium leading-tight ${selected === value ? 'text-[#3C3489]' : 'text-gray-700'}`}>
                {label}
              </span>
            </button>
          ))}
        </div>

        {selected && (
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Symbol search */}
            {needsSymbol && (
              <Field label="Symbol / Scheme" error={errors['symbol']}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    className={`${inputClass} pl-9`}
                    placeholder={selected === 'MUTUAL_FUND' ? 'Search scheme name…' : 'e.g. RELIANCE, HDFC'}
                    value={symbolSearch}
                    onChange={(e) => { setSymbolSearch(e.target.value); setShowSugg(true); }}
                    onBlur={() => setTimeout(() => setShowSugg(false), 200)}
                    autoComplete="off"
                  />
                  {showSugg && suggestions && suggestions.length > 0 && (
                    <ul className="absolute z-10 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                      {suggestions.map((s) => (
                        <li
                          key={s.symbol}
                          className="px-3 py-2.5 hover:bg-gray-50 cursor-pointer"
                          onMouseDown={() => {
                            setSymbol(s.symbol);
                            setName(s.name);
                            setSymbolSearch(`${s.symbol} — ${s.name}`);
                            setShowSugg(false);
                          }}
                        >
                          <p className="text-sm font-medium text-gray-800">{s.symbol}</p>
                          <p className="text-xs text-gray-500 truncate">{s.name}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Field>
            )}

            {/* Name */}
            <Field
              label={needsRealEstate ? 'Property Name' : needsSavings ? 'Bank / Institution' : 'Name'}
              error={errors['name']}
            >
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                placeholder={needsRealEstate ? 'e.g. Flat in Mumbai' : needsSavings ? 'e.g. SBI Bank' : 'Name'}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              {/* Quantity / Amount */}
              {!needsRealEstate && (
                <Field label={needsSavings ? 'Principal Amount (₹)' : 'Quantity'} error={errors['quantity']}>
                  <input
                    type="number" step="any" value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className={inputClass}
                    placeholder={needsSavings ? '50000' : '10'}
                  />
                </Field>
              )}

              {/* Buy Price */}
              {!needsSavings && !needsRealEstate && (
                <Field label="Buy Price (₹)" error={errors['buyPrice']}>
                  <input
                    type="number" step="any" value={buyPrice}
                    onChange={(e) => setBuyPrice(e.target.value)}
                    className={inputClass} placeholder="e.g. 2500"
                  />
                </Field>
              )}
              {needsRealEstate && (
                <Field label="Purchase Price (₹)" error={errors['buyPrice']}>
                  <input
                    type="number" step="any" value={buyPrice}
                    onChange={(e) => setBuyPrice(e.target.value)}
                    className={inputClass} placeholder="e.g. 5000000"
                  />
                </Field>
              )}

              {/* Interest Rate for savings */}
              {needsSavings && (
                <Field label="Interest Rate (%)" error={errors['interestRate']}>
                  <input
                    type="number" step="0.01" value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    className={inputClass} placeholder="e.g. 7.5"
                  />
                </Field>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label={needsSavings ? 'Start Date' : 'Buy Date'} error={errors['buyDate']}>
                <input
                  type="date" value={buyDate}
                  onChange={(e) => setBuyDate(e.target.value)}
                  className={inputClass}
                  max={new Date().toISOString().split('T')[0]}
                />
              </Field>
              {needsSavings && (
                <Field label="Maturity Date">
                  <input
                    type="date" value={maturityDate}
                    onChange={(e) => setMaturityDate(e.target.value)}
                    className={inputClass}
                  />
                </Field>
              )}
            </div>

            <Field label="Notes (optional)">
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={inputClass} placeholder="Optional notes…"
              />
            </Field>

            {apiError && (
              <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
                {apiError}
              </p>
            )}

            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white
                         bg-[#3C3489] hover:bg-[#2d2871] disabled:opacity-60 disabled:cursor-not-allowed
                         transition-all flex items-center justify-center gap-2"
            >
              {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Add Holding
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
