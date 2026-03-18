'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Loader2, AlertTriangle } from 'lucide-react';
import apiClient from '@/lib/api-client';

export interface SearchResult {
  symbol:     string;
  name:       string;
  assetClass: string;
  exchange?:  string;
  price?:     number;
  nav?:       number;
}

const inputClass =
  'block w-full px-3.5 py-2.5 border border-border rounded-xl text-sm text-foreground ' +
  'placeholder-gray-400 bg-background-card transition-colors ' +
  'focus:outline-none focus:ring-2 focus:ring-[#3C3489]/20 focus:border-[#3C3489]';

export interface SymbolComboboxProps {
  assetType: string;
  onSelect:  (symbol: string, name: string) => void;
  error?:    string;
  label?:    string;
  /** Compact label style (uppercase, smaller) for modals */
  compactLabel?: boolean;
}

export function SymbolCombobox({
  assetType,
  onSelect,
  error,
  label = 'Symbol / Scheme',
  compactLabel = false,
}: SymbolComboboxProps) {
  const [query,       setQuery]       = useState('');
  const [results,     setResults]     = useState<SearchResult[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [open,        setOpen]        = useState(false);
  const [selected,    setSelected]    = useState('');
  const [verifyWarn,  setVerifyWarn]  = useState('');
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const placeholder =
    assetType === 'MUTUAL_FUND' ? 'Search fund name (e.g. Axis Bluechip)…'
    : assetType === 'CRYPTO'    ? 'Search coin (e.g. bitcoin, ETH)…'
    : 'Search symbol (e.g. HDFC, RELIANCE)…';

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await apiClient.get<{ success: boolean; data: { results: SearchResult[] } }>(
        '/api/market/search',
        { params: { q, assetClass: assetType } }
      );
      const list = res.data?.data?.results;
      setResults(Array.isArray(list) ? list : []);
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [assetType]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setSelected('');
    setVerifyWarn('');
    if (timerRef.current) clearTimeout(timerRef.current);
    if (val.length >= 2) {
      timerRef.current = setTimeout(() => doSearch(val), 400);
    } else {
      setResults([]);
      setOpen(false);
    }
  };

  const handleSelect = (r: SearchResult) => {
    setQuery(`${r.symbol} — ${r.name}`);
    setSelected(r.symbol);
    setResults([]);
    setOpen(false);
    setVerifyWarn('');
    onSelect(r.symbol, r.name);
  };

  const handleBlur = async () => {
    setTimeout(() => setOpen(false), 200);

    const trimmed = query.trim();
    if (trimmed && !selected) {
      const rawSymbol = trimmed.split('—')[0]!.trim().toUpperCase();
      onSelect(rawSymbol, rawSymbol);

      try {
        await apiClient.get(`/api/market/price/${rawSymbol}`, {
          params: { assetClass: assetType },
        });
      } catch {
        setVerifyWarn('Could not verify this symbol — double check before saving');
      }
    }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const labelClass = compactLabel
    ? 'block text-xs font-medium text-foreground-muted uppercase tracking-wide mb-1.5'
    : 'block text-sm font-medium text-foreground';

  return (
    <div className="space-y-1.5">
      <label className={labelClass}>{label}</label>
      <div className="relative" ref={wrapperRef}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted z-10" />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted animate-spin z-10" />
        )}
        <input
          className={`${inputClass} pl-9 pr-9`}
          placeholder={placeholder}
          value={query}
          onChange={handleChange}
          onFocus={() => Array.isArray(results) && results.length > 0 && setOpen(true)}
          onBlur={handleBlur}
          autoComplete="off"
        />

        {open && (
          <ul className="absolute z-20 top-full mt-1 left-0 right-0 bg-background-card border border-border rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
            {(!Array.isArray(results) || results.length === 0) && !loading && query.length >= 2 ? (
              <li className="px-4 py-3 text-sm text-foreground-muted italic">
                No results — you can still enter manually
              </li>
            ) : (
              results.map((r, i) => (
                <li
                  key={`${r.assetClass}-${r.symbol}-${i}`}
                  className="px-4 py-2.5 hover:bg-border/50 cursor-pointer border-b border-border/50 last:border-0"
                  onMouseDown={() => handleSelect(r)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{r.symbol}</p>
                      <p className="text-xs text-foreground-muted truncate">{r.name}</p>
                      {r.exchange && <p className="text-[10px] text-foreground-muted">{r.exchange}</p>}
                    </div>
                    {(r.price != null || r.nav != null) && (
                      <span className="text-xs font-medium text-green-600 shrink-0">
                        ₹{(r.price ?? r.nav)?.toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {verifyWarn && (
        <p className="flex items-center gap-1.5 text-xs text-amber-600 mt-1">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {verifyWarn}
        </p>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
