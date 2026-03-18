'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { SymbolCombobox } from '@/components/shared/SymbolCombobox';

const ASSET_CLASSES = [
  { value: 'STOCK', label: 'Stock' },
  { value: 'MUTUAL_FUND', label: 'Mutual Fund' },
  { value: 'CRYPTO', label: 'Crypto' },
  { value: 'GOLD', label: 'Gold' },
  { value: 'SGB', label: 'SGB' },
  { value: 'FD', label: 'FD' },
  { value: 'RD', label: 'RD' },
  { value: 'PPF', label: 'PPF' },
  { value: 'EPF', label: 'EPF' },
  { value: 'NPS', label: 'NPS' },
  { value: 'REAL_ESTATE', label: 'Real Estate' },
] as const;

interface FamilyMember {
  id: string;
  fullName: string;
  isMinor: boolean;
}

interface AddHoldingModalProps {
  member: FamilyMember;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddHoldingModal({ member, onClose, onSuccess }: AddHoldingModalProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    assetClass: 'STOCK' as string,
    name: '',
    symbol: '',
    quantity: '',
    buyPrice: '',
    buyDate: new Date().toISOString().split('T')[0] ?? '',
    maturityDate: '',
    interestRate: '',
    notes: '',
  });

  const mutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        assetClass: form.assetClass,
        name: form.name,
        quantity: form.assetClass === 'REAL_ESTATE' ? 1 : parseFloat(form.quantity),
        buyPrice: parseFloat(form.buyPrice),
        buyDate: form.buyDate,
      };
      if (form.symbol) payload.symbol = form.symbol;
      if (form.maturityDate) payload.maturityDate = form.maturityDate;
      if (form.interestRate) payload.interestRate = parseFloat(form.interestRate);
      if (form.notes) payload.notes = form.notes;
      return apiClient.post(`/api/family/members/${member.id}/holdings`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family'] });
      queryClient.invalidateQueries({ queryKey: ['family-member', member.id] });
      onSuccess();
      onClose();
    },
  });

  const needsSymbol = ['STOCK', 'MUTUAL_FUND', 'CRYPTO'].includes(form.assetClass);
  const needsSavings = ['FD', 'RD', 'PPF', 'EPF'].includes(form.assetClass);
  const isRealEstate = form.assetClass === 'REAL_ESTATE';

  const inputClass =
    'block w-full px-3.5 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background-card focus:outline-none focus:ring-2 focus:ring-[#3C3489]/20 focus:border-[#3C3489]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-background-card rounded-2xl shadow-2xl w-full max-w-md p-6 my-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground">Add Holding for {member.fullName}</h2>
          <button onClick={onClose} className="text-foreground-muted hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground-muted uppercase tracking-wide mb-1.5">Asset Class</label>
            <select
              value={form.assetClass}
              onChange={(e) => setForm((f) => ({ ...f, assetClass: e.target.value, symbol: '', name: '' }))}
              className={inputClass}
            >
              {ASSET_CLASSES.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </div>
          {needsSymbol && (
            <SymbolCombobox
              assetType={form.assetClass}
              onSelect={(symbol, name) => setForm((f) => ({ ...f, symbol, name }))}
              label="Symbol"
              compactLabel
            />
          )}
          <div>
            <label className="block text-xs font-medium text-foreground-muted uppercase tracking-wide mb-1.5">
              {isRealEstate ? 'Property Name' : 'Name'}
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={inputClass}
              placeholder={isRealEstate ? 'e.g. Sector 62 Flat' : 'e.g. HDFC Bank'}
            />
          </div>
          {!isRealEstate && (
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
          )}
          <div>
            <label className="block text-xs font-medium text-foreground-muted uppercase tracking-wide mb-1.5">
              {isRealEstate ? 'Current Value (₹)' : 'Buy Price (₹)'}
            </label>
            <input
              type="number"
              step="any"
              value={form.buyPrice}
              onChange={(e) => setForm((f) => ({ ...f, buyPrice: e.target.value }))}
              className={inputClass}
              placeholder="e.g. 1999"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground-muted uppercase tracking-wide mb-1.5">
              {isRealEstate ? 'Purchase Date' : 'Buy Date'}
            </label>
            <input
              type="date"
              value={form.buyDate}
              onChange={(e) => setForm((f) => ({ ...f, buyDate: e.target.value }))}
              className={inputClass}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
          {needsSavings && (
            <>
              <div>
                <label className="block text-xs font-medium text-foreground-muted uppercase tracking-wide mb-1.5">Maturity Date</label>
                <input
                  type="date"
                  value={form.maturityDate}
                  onChange={(e) => setForm((f) => ({ ...f, maturityDate: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground-muted uppercase tracking-wide mb-1.5">Interest Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.interestRate}
                  onChange={(e) => setForm((f) => ({ ...f, interestRate: e.target.value }))}
                  className={inputClass}
                  placeholder="e.g. 7.5"
                />
              </div>
            </>
          )}
          <div>
            <label className="block text-xs font-medium text-foreground-muted uppercase tracking-wide mb-1.5">Notes (optional)</label>
            <input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className={inputClass}
              placeholder="Optional notes"
            />
          </div>
          {mutation.isError && (
            <p className="text-sm text-red-500">Failed to add holding. Please try again.</p>
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
                !form.name.trim() ||
                !form.buyPrice ||
                (!isRealEstate && !form.quantity) ||
                !form.buyDate ||
                mutation.isPending
              }
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#3C3489] text-white text-sm font-medium hover:bg-[#2d2871] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Add Holding
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
