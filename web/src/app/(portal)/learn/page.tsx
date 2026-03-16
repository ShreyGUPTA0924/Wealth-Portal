'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Quote, BookOpen, TrendingUp, BarChart2, Receipt, Target, Landmark,
  Search, PlayCircle, X, ChevronRight, CheckCircle,
} from 'lucide-react';
import apiClient from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DailyTip { tip: string; category: string }
interface HealthScore {
  overall: number;
  breakdown: { diversification: number; goals: number; quality: number; discipline: number };
  summary: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'basics',      label: 'Basics of Investing',   icon: '📚', color: 'bg-blue-50 border-blue-200',   iconBg: 'bg-blue-100',  text: 'text-blue-700',  lessons: 6 },
  { id: 'mutual-funds',label: 'Mutual Funds',           icon: '📈', color: 'bg-teal-50 border-teal-200',   iconBg: 'bg-teal-100',  text: 'text-teal-700',  lessons: 8 },
  { id: 'stocks',      label: 'Stocks & Equity',        icon: '📊', color: 'bg-purple-50 border-purple-200',iconBg: 'bg-purple-100',text: 'text-purple-700',lessons: 7 },
  { id: 'tax',         label: 'Tax Planning',           icon: '🧾', color: 'bg-amber-50 border-amber-200', iconBg: 'bg-amber-100', text: 'text-amber-700', lessons: 5 },
  { id: 'goals',       label: 'Goal Planning',          icon: '🎯', color: 'bg-green-50 border-green-200', iconBg: 'bg-green-100', text: 'text-green-700', lessons: 6 },
  { id: 'instruments', label: 'Indian Instruments',     icon: '🏦', color: 'bg-rose-50 border-rose-200',   iconBg: 'bg-rose-100',  text: 'text-rose-700',  lessons: 8 },
];

const GLOSSARY_TERMS = [
  { term: 'XIRR',          def: 'Extended Internal Rate of Return — measures actual annual return on irregular cash flows like SIPs, accounting for exact dates of investments.' },
  { term: 'NAV',           def: "Net Asset Value — the per-unit price of a mutual fund. Calculated as (Total Assets − Liabilities) ÷ Total Units. Buyat today's NAV." },
  { term: 'AUM',           def: "Assets Under Management — total market value of investments managed by a fund house. Higher AUM means more trust but doesn't guarantee better returns." },
  { term: 'ELSS',          def: 'Equity Linked Savings Scheme — tax-saving mutual fund with 3-year lock-in qualifying for ₹1.5L deduction under Section 80C.' },
  { term: 'LTCG',          def: 'Long-Term Capital Gains — profit from selling equity after 1 year taxed at 10% beyond ₹1L. Debt funds LTCG after 3 years taxed at 20% with indexation.' },
  { term: 'STCG',          def: 'Short-Term Capital Gains — profit from selling equity within 1 year taxed at 15%. For debt funds, taxed at your income slab rate.' },
  { term: 'SIP',           def: 'Systematic Investment Plan — automated periodic investments (weekly/monthly) in mutual funds. Rupee cost averaging reduces timing risk.' },
  { term: 'Lump Sum',      def: 'One-time investment of a large amount. Better than SIP when markets are low; riskier when markets are at highs.' },
  { term: 'Expense Ratio', def: 'Annual fee charged by a mutual fund as a % of AUM. Direct plans have 0.1–1%; regular plans 0.5–2%. Lower is better for returns.' },
  { term: 'Exit Load',     def: 'Fee charged when you redeem mutual fund units before a specified period (usually 1 year for equity funds). Typically 1% of redemption value.' },
  { term: 'Direct Plan',   def: 'Mutual fund plan bought directly from the AMC without a distributor. Has lower expense ratio by 0.5–1%, leading to higher returns.' },
  { term: 'Regular Plan',  def: 'Mutual fund plan bought via broker/distributor. Higher expense ratio due to distributor commission. Consider switching to direct plans.' },
  { term: 'Debt Fund',     def: 'Mutual fund investing in bonds, treasury bills, and fixed income instruments. Lower risk than equity. Suitable for 1–3 year horizons.' },
  { term: 'Equity Fund',   def: 'Mutual fund investing primarily in stocks. Higher risk, higher return potential. Suitable for 5+ year investment horizon.' },
  { term: 'Hybrid Fund',   def: 'Mutual fund with mix of equity and debt. Balanced/Aggressive hybrid funds auto-rebalance. Good starting point for new investors.' },
  { term: 'Index Fund',    def: 'Passively managed fund tracking an index like Nifty50 or Sensex. Very low expense ratio (0.05–0.2%). Beats most active funds long-term.' },
  { term: 'PPF',           def: 'Public Provident Fund — government-backed savings with 15-year lock-in, ~7.1% return, and EEE (Exempt-Exempt-Exempt) tax status.' },
  { term: 'NPS',           def: 'National Pension System — retirement savings with equity/debt allocation. Extra ₹50,000 deduction under 80CCD(1B). Mandatory partial annuity at 60.' },
  { term: 'SGB',           def: 'Sovereign Gold Bond — government-issued bonds linked to gold price. 2.5% annual interest + gold price gains. Tax-free at maturity after 8 years.' },
  { term: 'Liquid Fund',   def: 'Debt fund investing in very short-term instruments (< 91 days). T+1 redemption. Better than savings account for parking surplus cash.' },
];

const VIDEOS = [
  { id: 'v1', title: 'What is SIP?',                   duration: '8 min',  ytId: 'hQqJLCUCFk4' },
  { id: 'v2', title: 'How to pick mutual funds',        duration: '12 min', ytId: 'hQqJLCUCFk4' },
  { id: 'v3', title: 'Understanding ELSS',              duration: '10 min', ytId: 'hQqJLCUCFk4' },
  { id: 'v4', title: 'Stock market basics',             duration: '15 min', ytId: 'hQqJLCUCFk4' },
  { id: 'v5', title: 'Tax planning guide',              duration: '11 min', ytId: 'hQqJLCUCFk4' },
  { id: 'v6', title: 'Retirement planning at 30',       duration: '13 min', ytId: 'hQqJLCUCFk4' },
];

const QUIZ_QUESTIONS = [
  {
    q: 'What does NAV stand for?',
    options: ['Net Asset Value', 'National Asset Value', 'New Asset Valuation', 'None of the above'],
    answer: 0,
  },
  {
    q: 'Maximum 80C deduction limit is?',
    options: ['₹1,00,000', '₹1,50,000', '₹2,00,000', '₹2,50,000'],
    answer: 1,
  },
  {
    q: 'LTCG on equity funds is applicable after holding for?',
    options: ['6 months', '1 year', '2 years', '3 years'],
    answer: 1,
  },
  {
    q: 'Which fund has the shortest lock-in for 80C benefit?',
    options: ['PPF', 'NSC', 'ELSS', 'Tax Saving FD'],
    answer: 2,
  },
  {
    q: 'Expense ratio is charged by?',
    options: ['Stock broker', 'Mutual fund', 'Bank', 'SEBI'],
    answer: 1,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-100 rounded-xl ${className ?? ''}`} />;
}

function scoreColor(s: number) {
  if (s >= 70) return 'text-green-600';
  if (s >= 40) return 'text-amber-500';
  return 'text-red-500';
}
function scoreRing(s: number) {
  if (s >= 70) return 'stroke-green-500';
  if (s >= 40) return 'stroke-amber-400';
  return 'stroke-red-400';
}
function scoreBarBg(s: number) {
  if (s >= 70) return 'bg-green-500';
  if (s >= 40) return 'bg-amber-400';
  return 'bg-red-400';
}

function ScoreRing({ score }: { score: number }) {
  const r = 44, circ = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center w-28 h-28">
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 104 104">
        <circle cx="52" cy="52" r={r} fill="none" stroke="#E5E7EB" strokeWidth="10" />
        <circle
          cx="52" cy="52" r={r} fill="none" strokeWidth="10"
          strokeDasharray={circ}
          strokeDashoffset={circ - (score / 100) * circ}
          strokeLinecap="round"
          className={`transition-all duration-700 ${scoreRing(score)}`}
        />
      </svg>
      <span className={`text-3xl font-bold ${scoreColor(score)}`}>{Math.round(score)}</span>
    </div>
  );
}

function fmtINR(n: number) {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)}Cr`;
  if (n >= 1_00_000)    return `₹${(n / 1_00_000).toFixed(2)}L`;
  if (n >= 1_000)       return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
}

// ─── Compounding Visualiser ───────────────────────────────────────────────────

function CompoundingVisualiser() {
  const [principal,  setPrincipal]  = useState(100000);
  const [sip,        setSip]        = useState(5000);
  const [rate,       setRate]       = useState(12);
  const [years,      setYears]      = useState(20);

  const { chartData, totalInvested, finalCorpus } = useMemo(() => {
    const r = rate / 100 / 12;
    const data: { year: number; invested: number; corpus: number }[] = [];
    let corpus = 0;
    let invested = 0;

    for (let yr = 1; yr <= years; yr++) {
      const n = yr * 12;
      corpus   = principal * Math.pow(1 + r, n) + (r > 0 ? sip * ((Math.pow(1 + r, n) - 1) / r) : sip * n);
      invested = principal + sip * n;
      data.push({ year: yr, invested: Math.round(invested), corpus: Math.round(corpus) });
    }
    return { chartData: data, totalInvested: invested, finalCorpus: corpus };
  }, [principal, sip, rate, years]);

  const wealthGained = finalCorpus - totalInvested;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 h-full flex flex-col">
      <h3 className="text-base font-semibold text-gray-900 mb-4">Compounding Visualiser</h3>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="text-xs text-gray-500 font-medium">Principal (₹)</label>
          <input
            type="number" value={principal}
            onChange={e => setPrincipal(Number(e.target.value))}
            className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#3C3489]/50"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">Monthly SIP (₹)</label>
          <input
            type="number" value={sip}
            onChange={e => setSip(Number(e.target.value))}
            className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#3C3489]/50"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">Annual Return: <span className="text-[#3C3489] font-semibold">{rate}%</span></label>
          <input type="range" min={6} max={20} step={0.5} value={rate}
            onChange={e => setRate(Number(e.target.value))}
            className="w-full mt-1 accent-[#3C3489]"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">Time: <span className="text-[#3C3489] font-semibold">{years} yrs</span></label>
          <input type="range" min={1} max={40} step={1} value={years}
            onChange={e => setYears(Number(e.target.value))}
            className="w-full mt-1 accent-[#3C3489]"
          />
        </div>
      </div>

      <div className="flex-1 min-h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="invested" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="corpus" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22C55E" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#22C55E" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} tickFormatter={v => `${v}y`} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => fmtINR(v)} width={60} />
            <Tooltip
              formatter={(val, name) => [fmtINR(Number(val)), name === 'invested' ? 'Total Invested' : 'Total Corpus']}
              labelFormatter={(l: unknown) => `Year ${l}`}
            />
            <Legend formatter={v => v === 'invested' ? 'Total Invested' : 'Total Corpus'} />
            <Area type="monotone" dataKey="invested" stroke="#3B82F6" fill="url(#invested)" strokeWidth={2} />
            <Area type="monotone" dataKey="corpus"   stroke="#22C55E" fill="url(#corpus)"   strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4">
        {[
          { label: 'Total Invested', val: fmtINR(totalInvested) },
          { label: 'Final Corpus',   val: fmtINR(finalCorpus),   highlight: true },
          { label: 'Wealth Gained',  val: fmtINR(wealthGained),  green: true },
          { label: 'CAGR',           val: `${rate}%` },
        ].map(({ label, val, highlight, green }) => (
          <div key={label} className={`rounded-xl p-3 ${highlight ? 'bg-[#3C3489]/5' : green ? 'bg-green-50' : 'bg-gray-50'}`}>
            <p className="text-xs text-gray-500">{label}</p>
            <p className={`text-base font-bold mt-0.5 ${highlight ? 'text-[#3C3489]' : green ? 'text-green-600' : 'text-gray-800'}`}>{val}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SIP Calculator ──────────────────────────────────────────────────────────

function SIPCalculator() {
  const [target, setTarget] = useState(5000000);
  const [years,  setYears]  = useState(15);
  const [rate,   setRate]   = useState(12);
  const router = useRouter();

  const monthlySIP = useMemo(() => {
    const r = rate / 100 / 12;
    const n = years * 12;
    if (r === 0) return target / n;
    return (target * r) / (Math.pow(1 + r, n) - 1);
  }, [target, years, rate]);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col">
      <h3 className="text-base font-semibold text-gray-900 mb-4">SIP Calculator</h3>
      <p className="text-sm text-gray-500 mb-5">Find out how much you need to invest monthly to reach your goal.</p>

      <div className="space-y-4 flex-1">
        <div>
          <label className="text-xs text-gray-500 font-medium">Target Amount (₹)</label>
          <input
            type="number" value={target}
            onChange={e => setTarget(Number(e.target.value))}
            className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#3C3489]/50"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">Time Period: <span className="text-[#3C3489] font-semibold">{years} years</span></label>
          <input type="range" min={1} max={40} step={1} value={years}
            onChange={e => setYears(Number(e.target.value))}
            className="w-full mt-1 accent-[#3C3489]"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">Expected Return: <span className="text-[#3C3489] font-semibold">{rate}%</span></label>
          <input type="range" min={6} max={20} step={0.5} value={rate}
            onChange={e => setRate(Number(e.target.value))}
            className="w-full mt-1 accent-[#3C3489]"
          />
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-gradient-to-br from-[#3C3489] to-[#5048a8] p-5 text-white text-center">
        <p className="text-sm opacity-80">Required Monthly SIP</p>
        <p className="text-3xl font-bold mt-1">{fmtINR(Math.round(monthlySIP))}</p>
        <p className="text-xs opacity-70 mt-2">
          To reach {fmtINR(target)} in {years} years at {rate}% returns
        </p>
      </div>

      <button
        onClick={() => router.push('/portfolio/add')}
        className="mt-4 w-full py-2.5 rounded-xl bg-[#3C3489]/10 text-[#3C3489] text-sm font-semibold hover:bg-[#3C3489]/20 transition-colors flex items-center justify-center gap-2"
      >
        Start this SIP <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Quiz ─────────────────────────────────────────────────────────────────────

function Quiz() {
  const [current,  setCurrent]  = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers,  setAnswers]  = useState<(number | null)[]>(Array(QUIZ_QUESTIONS.length).fill(null));
  const [done,     setDone]     = useState(false);

  const q = QUIZ_QUESTIONS[current]!;
  const score = answers.filter((a, i) => a === QUIZ_QUESTIONS[i]!.answer).length;

  function pick(idx: number) {
    if (selected !== null) return;
    setSelected(idx);
    const next = [...answers];
    next[current] = idx;
    setAnswers(next);
  }

  function advance() {
    if (current < QUIZ_QUESTIONS.length - 1) {
      setCurrent(current + 1);
      setSelected(answers[current + 1] ?? null);
    } else {
      setDone(true);
    }
  }

  function retake() {
    setCurrent(0);
    setSelected(null);
    setAnswers(Array(QUIZ_QUESTIONS.length).fill(null));
    setDone(false);
  }

  if (done) {
    const msgs = ['Keep learning! Every step counts. 💪', 'Good effort! Review the glossary below. 📖', 'Well done! You know your basics. ⭐', 'Great score! You\'re a finance enthusiast. 🏆', 'Perfect! Financial wizard level unlocked! 🎓'];
    return (
      <div className="text-center py-8">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#3C3489] to-[#5048a8] flex items-center justify-center mx-auto mb-4">
          <span className="text-white text-3xl font-bold">{score}/5</span>
        </div>
        <p className="text-lg font-semibold text-gray-900 mt-4">{msgs[score]}</p>
        <button onClick={retake} className="mt-6 px-6 py-2.5 rounded-xl bg-[#3C3489] text-white text-sm font-semibold hover:bg-[#2d2871] transition-colors">
          Retake Quiz
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        {QUIZ_QUESTIONS.map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < current ? 'bg-[#3C3489]' : i === current ? 'bg-[#3C3489]/50' : 'bg-gray-200'}`} />
        ))}
      </div>
      <p className="text-xs text-gray-400 mb-1">Question {current + 1} of {QUIZ_QUESTIONS.length}</p>
      <p className="text-base font-semibold text-gray-900 mb-4">{q.q}</p>
      <div className="space-y-2.5">
        {q.options.map((opt, i) => {
          const isCorrect  = i === q.answer;
          const isSelected = i === selected;
          let cls = 'border-gray-200 bg-gray-50 text-gray-700 hover:border-[#3C3489]/40';
          if (selected !== null) {
            if (isCorrect)                  cls = 'border-green-400 bg-green-50 text-green-800';
            else if (isSelected && !isCorrect) cls = 'border-red-400 bg-red-50 text-red-800';
          }
          return (
            <button key={i} onClick={() => pick(i)}
              className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all ${cls}`}
            >
              <span className="opacity-60 mr-2">{String.fromCharCode(65 + i)})</span>{opt}
            </button>
          );
        })}
      </div>
      {selected !== null && (
        <button onClick={advance}
          className="mt-4 w-full py-2.5 rounded-xl bg-[#3C3489] text-white text-sm font-semibold hover:bg-[#2d2871] transition-colors"
        >
          {current < QUIZ_QUESTIONS.length - 1 ? 'Next Question' : 'See Results'}
        </button>
      )}
    </div>
  );
}

// ─── Video Modal ──────────────────────────────────────────────────────────────

function VideoModal({ video, onClose }: { video: typeof VIDEOS[0]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-2xl mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-900">{video.title}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="aspect-video bg-gray-900">
          <iframe
            className="w-full h-full"
            src={`https://www.youtube.com/embed/${video.ytId}?autoplay=1`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LearnPage() {
  const router = useRouter();
  const [glossarySearch, setGlossarySearch] = useState('');
  const [openVideo, setOpenVideo]           = useState<typeof VIDEOS[0] | null>(null);

  const { data: tipData, isLoading: tipLoading } = useQuery({
    queryKey: ['daily-tip'],
    queryFn: () =>
      apiClient.get<{ success: boolean; data: DailyTip }>('/api/learn/daily-tip').then(r => r.data.data),
    staleTime: 60 * 60_000,
  });

  const { data: healthScore, isLoading: scoreLoading } = useQuery({
    queryKey: ['health-score'],
    queryFn: () =>
      apiClient.get<{ success: boolean; data: HealthScore }>('/api/ai/health-score').then(r => r.data.data),
    staleTime: 5 * 60_000,
  });

  const filteredGlossary = useMemo(
    () => GLOSSARY_TERMS.filter(t =>
      t.term.toLowerCase().includes(glossarySearch.toLowerCase()) ||
      t.def.toLowerCase().includes(glossarySearch.toLowerCase())
    ),
    [glossarySearch]
  );

  const improveTips: Record<string, string> = {
    diversification: 'Add debt or gold instruments to spread risk across asset classes.',
    goals: 'Link your investments to specific goals like retirement, education, or home.',
    quality: 'Switch from regular to direct mutual fund plans to reduce expense ratio.',
    discipline: 'Set up auto-debit SIPs so you never miss a monthly investment.',
  };

  return (
    <div className="space-y-8">

      {/* ── Daily Tip ─────────────────────────────────────────────────────── */}
      {tipLoading ? (
        <Skeleton className="h-36" />
      ) : (
        <div className="rounded-2xl p-6 text-white relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #3C3489 0%, #5048a8 60%, #6d62c9 100%)' }}>
          <div className="absolute top-4 right-6 opacity-10">
            <Quote className="w-20 h-20" />
          </div>
          <div className="flex items-start gap-4 relative z-10">
            <Quote className="w-8 h-8 shrink-0 opacity-80 mt-0.5" />
            <div className="flex-1">
              <p className="text-lg font-medium leading-relaxed">{tipData?.tip ?? '—'}</p>
              <div className="flex items-center gap-3 mt-3">
                <span className="px-3 py-1 rounded-full bg-white/20 text-xs font-semibold backdrop-blur-sm">
                  {tipData?.category ?? '—'}
                </span>
                <span className="text-xs opacity-60">New tip tomorrow</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Financial Health Score ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-5">Your Financial Health Score</h2>
        {scoreLoading ? (
          <Skeleton className="h-40" />
        ) : healthScore ? (
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="flex flex-col items-center gap-2 shrink-0">
              <ScoreRing score={healthScore.overall} />
              <p className="text-sm font-medium text-gray-600">Overall Score</p>
              <p className={`text-xs font-semibold ${scoreColor(healthScore.overall)}`}>
                {healthScore.overall >= 70 ? 'Excellent' : healthScore.overall >= 40 ? 'Average' : 'Needs Work'}
              </p>
            </div>
            <div className="flex-1 space-y-3">
              {Object.entries(healthScore.breakdown).map(([key, val]) => (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700 capitalize">{key}</span>
                    <span className={`text-sm font-bold ${scoreColor(val)}`}>{Math.round(val)}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${scoreBarBg(val)}`} style={{ width: `${val}%` }} />
                  </div>
                  {val < 50 && (
                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      <span>💡</span> {improveTips[key] ?? ''}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-gray-50 p-4 text-center">
            <p className="text-sm text-gray-400">Add holdings and goals to compute your financial health score.</p>
          </div>
        )}
      </div>

      {/* ── Learn Categories ──────────────────────────────────────────────── */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-4">Learn by Category</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => router.push(`/learn/${cat.id}`)}
              className={`text-left rounded-2xl border p-5 transition-all hover:shadow-md hover:-translate-y-0.5 ${cat.color}`}
            >
              <div className={`w-11 h-11 rounded-xl ${cat.iconBg} flex items-center justify-center text-2xl mb-3`}>
                {cat.icon}
              </div>
              <p className={`text-sm font-semibold ${cat.text}`}>{cat.label}</p>
              <p className="text-xs text-gray-500 mt-1">{cat.lessons} lessons</p>
              <div className="flex items-center gap-1 mt-3">
                <span className={`text-xs font-medium ${cat.text}`}>Start learning</span>
                <ChevronRight className={`w-3.5 h-3.5 ${cat.text}`} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Interactive Tools ─────────────────────────────────────────────── */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-4">Interactive Tools</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CompoundingVisualiser />
          <SIPCalculator />
        </div>
      </div>

      {/* ── Glossary ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-base font-semibold text-gray-900">Finance Glossary</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={glossarySearch}
              onChange={e => setGlossarySearch(e.target.value)}
              placeholder="Search terms…"
              className="pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#3C3489]/50 w-56"
            />
          </div>
        </div>

        {filteredGlossary.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No matching terms found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredGlossary.map(({ term, def }) => (
              <div key={term} className="rounded-xl bg-gray-50 p-4">
                <p className="text-sm font-bold text-[#3C3489]">{term}</p>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">{def}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Video Lessons ─────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-4">Video Lessons</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {VIDEOS.map(v => (
            <button
              key={v.id}
              onClick={() => setOpenVideo(v)}
              className="text-left rounded-2xl border border-gray-100 bg-white overflow-hidden hover:shadow-md transition-all hover:-translate-y-0.5 group"
            >
              <div className="h-36 bg-gray-100 flex items-center justify-center relative">
                <div className="w-12 h-12 rounded-full bg-[#3C3489]/10 flex items-center justify-center group-hover:bg-[#3C3489]/20 transition-colors">
                  <PlayCircle className="w-8 h-8 text-[#3C3489]" />
                </div>
              </div>
              <div className="p-4">
                <p className="text-sm font-semibold text-gray-900">{v.title}</p>
                <p className="text-xs text-gray-400 mt-1">{v.duration}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Quiz ──────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Test Your Financial Knowledge</h2>
        <p className="text-sm text-gray-400 mb-6">5 quick questions on Indian personal finance</p>
        <Quiz />
      </div>

      {openVideo && <VideoModal video={openVideo} onClose={() => setOpenVideo(null)} />}
    </div>
  );
}
