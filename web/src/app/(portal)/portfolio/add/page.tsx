'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  TrendingUp, Landmark, Bitcoin, Building2, Coins,
  Sprout, ShieldCheck, Umbrella, BarChart3, ChevronLeft, Loader2,
  BriefcaseBusiness,
} from 'lucide-react';
import apiClient, { getErrorMessage } from '@/lib/api-client';
import { SymbolCombobox } from '@/components/shared/SymbolCombobox';

// ─── Asset classes ────────────────────────────────────────────────────────────

const ASSET_TYPES = [
  { value: 'STOCK',       label: 'Stock',         icon: TrendingUp,       bg: 'bg-blue-50',    text: 'text-blue-600' },
  { value: 'MUTUAL_FUND', label: 'Mutual Fund',   icon: BarChart3,        bg: 'bg-purple-50',  text: 'text-purple-600' },
  { value: 'CRYPTO',      label: 'Crypto',        icon: Bitcoin,          bg: 'bg-orange-50',  text: 'text-orange-500' },
  { value: 'GOLD',        label: 'Gold',          icon: Coins,            bg: 'bg-yellow-50',  text: 'text-yellow-600' },
  { value: 'SGB',         label: 'SGB',           icon: ShieldCheck,      bg: 'bg-yellow-50',  text: 'text-yellow-700' },
  { value: 'FD',          label: 'Fixed Deposit', icon: Landmark,         bg: 'bg-green-50',   text: 'text-green-600' },
  { value: 'RD',          label: 'Recurring Dep', icon: Landmark,         bg: 'bg-teal-50',    text: 'text-teal-600' },
  { value: 'PPF',         label: 'PPF',           icon: Umbrella,         bg: 'bg-indigo-50',  text: 'text-indigo-600' },
  { value: 'EPF',         label: 'EPF',           icon: Sprout,           bg: 'bg-lime-50',    text: 'text-lime-600' },
  { value: 'NPS',         label: 'NPS',           icon: BriefcaseBusiness,bg: 'bg-violet-50',  text: 'text-violet-600' },
  { value: 'REAL_ESTATE', label: 'Real Estate',   icon: Building2,        bg: 'bg-rose-50',    text: 'text-rose-600' },
];

type AssetValue = string;

const SYMBOL_TYPES  = ['STOCK', 'MUTUAL_FUND', 'CRYPTO'];
const SAVINGS_TYPES = ['FD', 'RD', 'PPF', 'EPF', 'NPS'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const inputClass =
  'block w-full px-3.5 py-2.5 border border-border rounded-xl text-sm text-foreground ' +
  'placeholder-gray-400 bg-background-card transition-colors ' +
  'focus:outline-none focus:ring-2 focus:ring-[#3C3489]/20 focus:border-[#3C3489]';

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ─── Gold Form ────────────────────────────────────────────────────────────────

type GoldType       = 'JEWELLERY' | 'COIN_BAR';
type GoldInputMethod = 'weight' | 'value';

const PURITY_OPTIONS = [
  { label: '24K (99.9%)', factor: 1.0 },
  { label: '22K (91.6%)', factor: 0.916 },
  { label: '18K (75%)',   factor: 0.75 },
];

interface GoldFormProps {
  onChange: (data: {
    name:      string;
    quantity:  number;
    buyPrice:  number;
    notes?:    string;
  }) => void;
}

function GoldForm({ onChange }: GoldFormProps) {
  const [goldType,     setGoldType]     = useState<GoldType>('COIN_BAR');
  const [inputMethod,  setInputMethod]  = useState<GoldInputMethod>('weight');
  const [weight,       setWeight]       = useState('');
  const [purityIdx,    setPurityIdx]    = useState(0);
  const [makingPct,    setMakingPct]    = useState('');
  const [pricePerGram, setPricePerGram] = useState('');
  const [totalAmount,  setTotalAmount]  = useState('');
  const [weightOpt,    setWeightOpt]    = useState('');

  const purity = PURITY_OPTIONS[purityIdx] ?? PURITY_OPTIONS[0]!;

  useEffect(() => {
    if (inputMethod === 'weight') {
      const w  = parseFloat(weight)       || 0;
      const pg = parseFloat(pricePerGram) || 0;
      const mk = parseFloat(makingPct)    || 0;
      if (!w || !pg) return;
      const baseValue = w * purity.factor * pg;
      const totalVal  = baseValue * (1 + mk / 100);
      const name      = `Gold ${goldType === 'JEWELLERY' ? 'Jewellery' : 'Coin/Bar'} — ${w}g ${purity.label}`;
      onChange({ name, quantity: w, buyPrice: totalVal / w, notes: `${purity.label}` });
    } else {
      const total = parseFloat(totalAmount) || 0;
      const w     = parseFloat(weightOpt)   || 1;
      if (!total) return;
      const name  = `Gold ${goldType === 'JEWELLERY' ? 'Jewellery' : 'Coin/Bar'}`;
      onChange({ name, quantity: w, buyPrice: total / w });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goldType, inputMethod, weight, purityIdx, makingPct, pricePerGram, totalAmount, weightOpt]);

  const computedTotal = (() => {
    if (inputMethod !== 'weight') return null;
    const w  = parseFloat(weight)       || 0;
    const pg = parseFloat(pricePerGram) || 0;
    const mk = parseFloat(makingPct)    || 0;
    if (!w || !pg) return null;
    return (w * purity.factor * pg * (1 + mk / 100)).toFixed(2);
  })();

  return (
    <div className="space-y-5">
      {/* Gold Type */}
      <div>
        <p className="text-sm font-medium text-foreground mb-2.5">Gold Type</p>
        <div className="grid grid-cols-2 gap-2.5">
          {([
            { v: 'JEWELLERY', emoji: '💍', label: 'Jewellery' },
            { v: 'COIN_BAR',  emoji: '🪙', label: 'Coin / Bar' },
          ] as { v: GoldType; emoji: string; label: string }[]).map(({ v, emoji, label }) => (
            <button
              key={v} type="button"
              onClick={() => setGoldType(v)}
              className={`flex flex-col items-center gap-1.5 p-3.5 rounded-2xl border-2 transition-all
                ${goldType === v ? 'border-[#3C3489] bg-[#3C3489]/5' : 'border-border hover:bg-border/50'}`}
            >
              <span className="text-2xl">{emoji}</span>
              <span className={`text-xs font-semibold ${goldType === v ? 'text-[#3C3489]' : 'text-foreground'}`}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Input Method */}
      <div>
        <p className="text-sm font-medium text-foreground mb-2.5">Enter by</p>
        <div className="flex gap-2">
          {([
            { v: 'weight', label: '⚖️ Weight (grams)' },
            { v: 'value',  label: '₹ Total Value' },
          ] as { v: GoldInputMethod; label: string }[]).map(({ v, label }) => (
            <button
              key={v} type="button"
              onClick={() => setInputMethod(v)}
              className={`flex-1 py-2 px-3 rounded-xl border-2 text-xs font-semibold transition-all
                ${inputMethod === v ? 'border-[#3C3489] bg-[#3C3489]/5 text-[#3C3489]' : 'border-border text-foreground-muted hover:border-[#3C3489]/40'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {inputMethod === 'weight' ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Weight (grams)">
              <input type="number" step="0.001" value={weight}
                onChange={e => setWeight(e.target.value)}
                className={inputClass} placeholder="e.g. 10.5" />
            </Field>
            <Field label="Price per gram (₹)">
              <input type="number" step="any" value={pricePerGram}
                onChange={e => setPricePerGram(e.target.value)}
                className={inputClass} placeholder="e.g. 6800" />
            </Field>
          </div>

          <Field label="Purity">
            <select value={purityIdx}
              onChange={e => setPurityIdx(Number(e.target.value))}
              className={inputClass}>
              {PURITY_OPTIONS.map((p, i) => (
                <option key={p.label} value={i}>{p.label}</option>
              ))}
            </select>
          </Field>

          {goldType === 'JEWELLERY' && (
            <Field label="Making Charges % (optional)">
              <input type="number" step="0.1" value={makingPct}
                onChange={e => setMakingPct(e.target.value)}
                className={inputClass} placeholder="e.g. 12" />
            </Field>
          )}

          {computedTotal && (
            <div className="rounded-xl bg-yellow-50 border border-yellow-200 px-4 py-3">
              <p className="text-xs text-yellow-700 font-medium">Calculated Total Value</p>
              <p className="text-lg font-bold text-yellow-800 mt-0.5">
                ₹{parseFloat(computedTotal).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
            </div>
          )}
        </>
      ) : (
        <>
          <Field label="Total Amount Paid (₹)">
            <input type="number" step="any" value={totalAmount}
              onChange={e => setTotalAmount(e.target.value)}
              className={inputClass} placeholder="e.g. 75000" />
          </Field>
          <Field label="Weight (grams) — optional">
            <input type="number" step="0.001" value={weightOpt}
              onChange={e => setWeightOpt(e.target.value)}
              className={inputClass} placeholder="e.g. 10" />
          </Field>
        </>
      )}
    </div>
  );
}

// ─── Real Estate Form ─────────────────────────────────────────────────────────

const PROPERTY_TYPES = [
  { value: 'Residential', emoji: '🏠' },
  { value: 'Commercial',  emoji: '🏢' },
  { value: 'Land/Plot',   emoji: '🌾' },
  { value: 'Industrial',  emoji: '🏭' },
];

interface RealEstateData {
  propertyName:     string;
  propertyType:     string;
  city:             string;
  purchasePrice:    string;
  purchaseDate:     string;
  currentEstimate:  string;
  areaSqFt:         string;
  loanOutstanding:  string;
  monthlyRental:    string;
  propertyTax:      string;
  coOwner:          string;
}

interface RealEstateFormProps {
  data:     RealEstateData;
  onChange: (d: Partial<RealEstateData>) => void;
  errors:   Record<string, string>;
}

function RealEstateForm({ data, onChange, errors }: RealEstateFormProps) {
  return (
    <div className="space-y-4">
      <Field label="Property Name / Nickname" error={errors['propertyName']}>
        <input value={data.propertyName}
          onChange={e => onChange({ propertyName: e.target.value })}
          className={inputClass} placeholder="e.g. Sector 62 Flat, Dad's Shop" />
      </Field>

      <Field label="Property Type" error={errors['propertyType']}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PROPERTY_TYPES.map(({ value, emoji }) => (
            <button key={value} type="button"
              onClick={() => onChange({ propertyType: value })}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs font-medium transition-all
                ${data.propertyType === value ? 'border-[#3C3489] bg-[#3C3489]/5 text-[#3C3489]' : 'border-border text-foreground hover:bg-border/50'}`}
            >
              <span className="text-xl">{emoji}</span>
              {value}
            </button>
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="City / Location" error={errors['city']}>
          <input value={data.city}
            onChange={e => onChange({ city: e.target.value })}
            className={inputClass} placeholder="e.g. Mumbai, Noida" />
        </Field>
        <Field label="Area (sq ft) — optional">
          <input type="number" value={data.areaSqFt}
            onChange={e => onChange({ areaSqFt: e.target.value })}
            className={inputClass} placeholder="e.g. 1200" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Purchase Price (₹)" error={errors['purchasePrice']}>
          <input type="number" step="any" value={data.purchasePrice}
            onChange={e => onChange({ purchasePrice: e.target.value })}
            className={inputClass} placeholder="e.g. 5000000" />
        </Field>
        <Field label="Purchase Date" error={errors['purchaseDate']}>
          <input type="date" value={data.purchaseDate}
            onChange={e => onChange({ purchaseDate: e.target.value })}
            className={inputClass}
            max={new Date().toISOString().split('T')[0]} />
        </Field>
      </div>

      <div className="rounded-xl bg-border/30 p-4 space-y-4">
        <p className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">Optional Details</p>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Current Estimated Value (₹)">
            <input type="number" step="any" value={data.currentEstimate}
              onChange={e => onChange({ currentEstimate: e.target.value })}
              className={inputClass} placeholder="Your estimate" />
          </Field>
          <Field label="Loan Outstanding (₹)">
            <input type="number" step="any" value={data.loanOutstanding}
              onChange={e => onChange({ loanOutstanding: e.target.value })}
              className={inputClass} placeholder="If mortgaged" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Monthly Rental Income (₹)">
            <input type="number" step="any" value={data.monthlyRental}
              onChange={e => onChange({ monthlyRental: e.target.value })}
              className={inputClass} placeholder="If rented out" />
          </Field>
          <Field label="Property Tax/Year (₹)">
            <input type="number" step="any" value={data.propertyTax}
              onChange={e => onChange({ propertyTax: e.target.value })}
              className={inputClass} placeholder="Annual tax" />
          </Field>
        </div>

        <Field label="Co-owner Name (optional)">
          <input value={data.coOwner}
            onChange={e => onChange({ coOwner: e.target.value })}
            className={inputClass} placeholder="If jointly owned" />
        </Field>
      </div>
    </div>
  );
}

// ─── NPS Form ─────────────────────────────────────────────────────────────────

const NPS_FUND_MANAGERS = ['SBI', 'LIC', 'UTI', 'HDFC', 'ICICI', 'Kotak', 'Aditya Birla'];

interface NpsData {
  pran:        string;
  tier:        'I' | 'II';
  fundManager: string;
  startDate:   string;
  corpus:      string;
  contribution:string;
}

interface NpsFormProps {
  data:     NpsData;
  onChange: (d: Partial<NpsData>) => void;
  errors:   Record<string, string>;
}

function NpsForm({ data, onChange, errors }: NpsFormProps) {
  return (
    <div className="space-y-4">
      <Field label="PRAN Number (12-digit, optional)">
        <input value={data.pran}
          onChange={e => onChange({ pran: e.target.value })}
          className={inputClass} placeholder="110012345678" maxLength={12} />
      </Field>

      <Field label="NPS Tier">
        <div className="flex gap-3">
          {(['I', 'II'] as const).map(t => (
            <button key={t} type="button"
              onClick={() => onChange({ tier: t })}
              className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all
                ${data.tier === t ? 'border-[#3C3489] bg-[#3C3489]/5 text-[#3C3489]' : 'border-border text-foreground-muted hover:border-[#3C3489]/40'}`}
            >
              Tier {t}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Fund Manager">
        <select value={data.fundManager}
          onChange={e => onChange({ fundManager: e.target.value })}
          className={inputClass}>
          <option value="">Select fund manager</option>
          {NPS_FUND_MANAGERS.map(fm => (
            <option key={fm} value={fm}>{fm}</option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Contribution (₹)" error={errors['contribution']}>
          <input type="number" step="any" value={data.contribution}
            onChange={e => onChange({ contribution: e.target.value })}
            className={inputClass} placeholder="50000" />
        </Field>
        <Field label="Start Date" error={errors['startDate']}>
          <input type="date" value={data.startDate}
            onChange={e => onChange({ startDate: e.target.value })}
            className={inputClass}
            max={new Date().toISOString().split('T')[0]} />
        </Field>
      </div>

      <Field label="Current Corpus Value (₹)" error={errors['corpus']}>
        <input type="number" step="any" value={data.corpus}
          onChange={e => onChange({ corpus: e.target.value })}
          className={inputClass} placeholder="Current NPS balance" />
      </Field>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AddHoldingPage() {
  const router      = useRouter();
  const queryClient = useQueryClient();

  const [selected, setSelected] = useState<AssetValue | null>(null);
  const [apiError, setApiError] = useState('');

  // Standard form state
  const [name,         setName]         = useState('');
  const [symbol,       setSymbol]       = useState('');
  const [quantity,     setQuantity]     = useState('');
  const [buyPrice,     setBuyPrice]     = useState('');
  const [buyDate,      setBuyDate]      = useState('');
  const [maturityDate, setMaturityDate] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [notes,        setNotes]        = useState('');
  const [errors,       setErrors]       = useState<Record<string, string>>({});

  // Gold-specific state
  const [goldData, setGoldData] = useState<{ name: string; quantity: number; buyPrice: number; notes?: string } | null>(null);

  // Real estate state
  const [reData, setReData] = useState<RealEstateData>({
    propertyName:    '',
    propertyType:    'Residential',
    city:            '',
    purchasePrice:   '',
    purchaseDate:    '',
    currentEstimate: '',
    areaSqFt:        '',
    loanOutstanding: '',
    monthlyRental:   '',
    propertyTax:     '',
    coOwner:         '',
  });

  // NPS state
  const [npsData, setNpsData] = useState<NpsData>({
    pran: '', tier: 'I', fundManager: '', startDate: '', corpus: '', contribution: '',
  });

  const needsSymbol    = selected && SYMBOL_TYPES.includes(selected);
  const needsSavings   = selected && SAVINGS_TYPES.includes(selected) && selected !== 'NPS';
  const needsNps       = selected === 'NPS';
  const needsGold      = selected === 'GOLD';
  const needsRealEstate = selected === 'REAL_ESTATE';

  function resetForm() {
    setName(''); setSymbol(''); setQuantity(''); setBuyPrice('');
    setBuyDate(''); setMaturityDate(''); setInterestRate(''); setNotes('');
    setErrors({}); setGoldData(null);
    setReData({ propertyName: '', propertyType: 'Residential', city: '', purchasePrice: '', purchaseDate: '', currentEstimate: '', areaSqFt: '', loanOutstanding: '', monthlyRental: '', propertyTax: '', coOwner: '' });
    setNpsData({ pran: '', tier: 'I', fundManager: '', startDate: '', corpus: '', contribution: '' });
  }

  function validate(): boolean {
    const e: Record<string, string> = {};

    if (needsGold) {
      if (!goldData) e['gold'] = 'Please fill in gold details';
    } else if (needsRealEstate) {
      if (!reData.propertyName.trim()) e['propertyName'] = 'Property name is required';
      if (!reData.purchasePrice)       e['purchasePrice'] = 'Purchase price is required';
      if (!reData.purchaseDate)        e['purchaseDate']  = 'Purchase date is required';
    } else if (needsNps) {
      if (!npsData.contribution) e['contribution'] = 'Contribution is required';
      if (!npsData.startDate)    e['startDate']    = 'Start date is required';
      if (!npsData.corpus)       e['corpus']       = 'Corpus value is required';
    } else {
      if (!name.trim()) e['name'] = 'Name is required';
      if (needsSymbol && !symbol) e['symbol'] = 'Symbol is required — type and press Enter, or select from list';
      if (!needsSavings && !quantity) e['quantity'] = 'Quantity is required';
      if (!needsSavings && !buyPrice) e['buyPrice']  = 'Buy price is required';
      if (needsSavings && !quantity)  e['quantity']  = 'Amount is required';
      if (needsSavings && !interestRate) e['interestRate'] = 'Interest rate is required';
      if (!buyDate) e['buyDate'] = 'Date is required';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const mutation = useMutation({
    mutationFn: () => {
      let payload: Record<string, unknown>;

      if (needsGold && goldData) {
        payload = {
          assetClass: 'GOLD',
          name:       goldData.name,
          quantity:   goldData.quantity,
          buyPrice:   goldData.buyPrice,
          buyDate:    buyDate || new Date().toISOString().split('T')[0],
          notes:      goldData.notes,
        };
      } else if (needsRealEstate) {
        const notes = [
          reData.propertyType,
          reData.city,
          reData.areaSqFt      ? `${reData.areaSqFt} sq ft` : '',
          reData.loanOutstanding ? `Loan: ₹${reData.loanOutstanding}` : '',
          reData.monthlyRental   ? `Rent: ₹${reData.monthlyRental}/mo` : '',
          reData.coOwner         ? `Co-owner: ${reData.coOwner}` : '',
        ].filter(Boolean).join(' | ');

        payload = {
          assetClass:   'REAL_ESTATE',
          name:         reData.propertyName,
          quantity:     1,
          buyPrice:     parseFloat(reData.purchasePrice),
          currentPrice: reData.currentEstimate ? parseFloat(reData.currentEstimate) : parseFloat(reData.purchasePrice),
          buyDate:      reData.purchaseDate,
          notes,
        };
      } else if (needsNps) {
        const npsName = `NPS Tier ${npsData.tier}${npsData.fundManager ? ` — ${npsData.fundManager}` : ''}`;
        payload = {
          assetClass:   'NPS',
          name:         npsName,
          quantity:     parseFloat(npsData.contribution),
          buyPrice:     1,
          buyDate:      npsData.startDate,
          notes:        npsData.pran ? `PRAN: ${npsData.pran}` : undefined,
          currentPrice: npsData.corpus ? parseFloat(npsData.corpus) / parseFloat(npsData.contribution) : 1,
        };
      } else {
        payload = {
          assetClass: selected,
          name:       name.trim(),
          buyDate,
          notes:      notes || undefined,
        };
        if (needsSymbol)   { payload['symbol'] = symbol; }
        if (needsSavings) {
          payload['quantity']     = parseFloat(quantity);
          payload['buyPrice']     = 1;
          payload['maturityDate'] = maturityDate || undefined;
          payload['interestRate'] = interestRate ? parseFloat(interestRate) : undefined;
        } else {
          payload['quantity'] = parseFloat(quantity);
          payload['buyPrice'] = parseFloat(buyPrice);
        }
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
        className="flex items-center gap-1.5 text-sm text-foreground-muted hover:text-[#3C3489] transition-colors"
      >
        <ChevronLeft className="w-4 h-4" /> Back to Portfolio
      </button>

      <div className="bg-background-card rounded-2xl border border-border p-6">
        <h1 className="text-lg font-semibold text-foreground mb-1">Add Holding</h1>
        <p className="text-sm text-foreground-muted mb-6">Select an asset type to get started</p>

        {/* Asset type grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 mb-8">
          {ASSET_TYPES.map(({ value, label, icon: Icon, bg, text }) => (
            <button
              key={value}
              type="button"
              onClick={() => { setSelected(value); setApiError(''); setErrors({}); resetForm(); }}
              className={`flex flex-col items-center gap-2 p-3.5 rounded-2xl border-2 transition-all text-center
                          ${selected === value
                            ? 'border-[#3C3489] bg-[#3C3489]/5 shadow-sm shadow-black/5'
                            : 'border-border hover:border-border hover:bg-border/50'}`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${bg}`}>
                <Icon className={`${text}`} size={18} />
              </div>
              <span className={`text-xs font-medium leading-tight ${selected === value ? 'text-[#3C3489]' : 'text-foreground'}`}>
                {label}
              </span>
            </button>
          ))}
        </div>

        {selected && (
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* ── Symbol search for STOCK / MUTUAL_FUND / CRYPTO ── */}
            {needsSymbol && (
              <SymbolCombobox
                assetType={selected ?? ''}
                onSelect={(sym, nm) => { setSymbol(sym); if (!name) setName(nm); }}
                error={errors['symbol']}
              />
            )}

            {/* ── GOLD form ── */}
            {needsGold && (
              <>
                <GoldForm onChange={setGoldData} />
                {errors['gold'] && <p className="text-xs text-red-500">{errors['gold']}</p>}
                <Field label={`Buy Date`} error={errors['buyDate']}>
                  <input type="date" value={buyDate}
                    onChange={e => setBuyDate(e.target.value)}
                    className={inputClass}
                    max={new Date().toISOString().split('T')[0]} />
                </Field>
              </>
            )}

            {/* ── REAL_ESTATE form ── */}
            {needsRealEstate && (
              <RealEstateForm
                data={reData}
                onChange={(d) => setReData(prev => ({ ...prev, ...d }))}
                errors={errors}
              />
            )}

            {/* ── NPS form ── */}
            {needsNps && (
              <NpsForm
                data={npsData}
                onChange={(d) => setNpsData(prev => ({ ...prev, ...d }))}
                errors={errors}
              />
            )}

            {/* ── Standard form fields ── */}
            {!needsGold && !needsRealEstate && !needsNps && (
              <>
                {/* Name */}
                <Field
                  label={needsSavings ? 'Bank / Institution' : 'Name'}
                  error={errors['name']}
                >
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
                    placeholder={needsSavings ? 'e.g. SBI Bank' : 'Name'}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  {/* Quantity / Amount */}
                  <Field label={needsSavings ? 'Principal Amount (₹)' : 'Quantity'} error={errors['quantity']}>
                    <input
                      type="number" step="any" value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className={inputClass}
                      placeholder={needsSavings ? '50000' : '10'}
                    />
                  </Field>

                  {/* Buy Price */}
                  {!needsSavings && (
                    <Field label="Buy Price (₹)" error={errors['buyPrice']}>
                      <input
                        type="number" step="any" value={buyPrice}
                        onChange={(e) => setBuyPrice(e.target.value)}
                        className={inputClass} placeholder="e.g. 2500"
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
              </>
            )}

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
