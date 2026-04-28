'use client';

import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import {
  Download, TrendingUp, TrendingDown, Zap,
  AlertTriangle, CheckCircle, ArrowUpRight, ArrowDownRight,
  Wallet, BarChart3, Activity, Target,
} from 'lucide-react';
import apiClient from '@/lib/api-client';
import { useAuthStore } from '@/store/authStore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardData {
  netWorth: {
    current: number; invested: number; pnlAbsolute: number; pnlPercent: number;
    change: { today: number; oneWeek: number; oneMonth: number; oneYear: number };
  };
  allocation: { assetClass: string; value: number; percent: number }[];
  topGainers: { id: string; name: string; symbol: string | null; pnlPercent: number; currentValue: number }[];
  topLosers:  { id: string; name: string; symbol: string | null; pnlPercent: number; currentValue: number }[];
  goalsSummary: { id: string; name: string; targetAmount: number; currentAmount: number; progressPercent: number; healthStatus: string }[];
  aiInsights: string[];
}

interface Holding {
  id: string; assetClass: string; symbol: string | null; name: string;
  quantity: number; avgBuyPrice: number; totalInvested: number;
  currentPrice: number | null; currentValue: number | null;
  pnlAbsolute: number | null; pnlPercent: number | null;
  xirr: number | null; riskScore: number | null; weight: number;
  firstBuyDate: string | null;
}

interface NetWorthHistory { period: string; dataPoints: { date: string; value: number }[] }

// ─── Constants ────────────────────────────────────────────────────────────────

const PALETTE: Record<string,string> = {
  STOCK:'#7C3AED', MUTUAL_FUND:'#0D9488', CRYPTO:'#F97316',
  GOLD:'#EAB308',  SGB:'#FBBF24',         FD:'#3B82F6',
  RD:'#06B6D4',    PPF:'#10B981',         EPF:'#6366F1',
  NPS:'#8B5CF6',   REAL_ESTATE:'#84CC16',
};
const ALT = '#9CA3AF';
const ASSET_LABEL: Record<string,string> = {
  STOCK:'Stocks', MUTUAL_FUND:'Mutual Funds', CRYPTO:'Crypto',
  GOLD:'Gold',    SGB:'SGB',                  FD:'Fixed Deposits',
  RD:'RD',        PPF:'PPF',                  EPF:'EPF',
  NPS:'NPS',      REAL_ESTATE:'Real Estate',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number|null|undefined, compact=false): string {
  if (n==null) return '—';
  const a=Math.abs(n);
  if (compact){
    if(a>=1_00_00_000) return `₹${(n/1_00_00_000).toFixed(2)} Cr`;
    if(a>=1_00_000)    return `₹${(n/1_00_000).toFixed(2)} L`;
    if(a>=1_000)       return `₹${(n/1_000).toFixed(1)} K`;
  }
  return n.toLocaleString('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0});
}
function pct(n:number|null|undefined):string{ if(n==null)return'—'; return`${n>=0?'+':''}${n.toFixed(2)}%`; }
function clr(n:number|null|undefined):string{ if(n==null)return'text-gray-400'; return n>=0?'text-emerald-500':'text-red-500'; }

// Rule-based insights — no AI tokens
function buildInsights(d:DashboardData, holdings:Holding[]) {
  const ins:{title:string;body:string;icon:string}[]=[];
  const total=d.netWorth.current;
  const classCount=d.allocation.filter(a=>a.value>0).length;
  const eqPct=d.allocation.filter(a=>['STOCK','MUTUAL_FUND'].includes(a.assetClass)).reduce((s,a)=>s+a.percent,0);
  const cryptoPct=d.allocation.find(a=>a.assetClass==='CRYPTO')?.percent??0;
  const topG=d.topGainers[0]; const topL=d.topLosers[0];
  if(classCount<=1)  ins.push({title:'Low Diversification',body:'Portfolio is concentrated in one asset class. Add equity, debt, and gold to reduce risk.',icon:'⚠️'});
  else if(classCount>=4) ins.push({title:'Well Diversified',body:`Portfolio spans ${classCount} asset classes — good risk distribution.`,icon:'✅'});
  if(eqPct>80) ins.push({title:'High Equity Concentration',body:`Equity is ${eqPct.toFixed(0)}% of portfolio. Consider rebalancing into debt or gold.`,icon:'⚠️'});
  else if(eqPct<20&&total>0) ins.push({title:'Low Equity Exposure',body:`Equity is only ${eqPct.toFixed(0)}%. For long-term growth consider adding equity mutual funds.`,icon:'💡'});
  if(topG&&topG.pnlPercent>30) ins.push({title:'Star Performer',body:`${topG.name} is up ${topG.pnlPercent.toFixed(1)}%. Review if rebalancing is needed to lock in gains.`,icon:'🌟'});
  if(topL&&topL.pnlPercent<-15) ins.push({title:'Underperformer Alert',body:`${topL.name} is down ${Math.abs(topL.pnlPercent).toFixed(1)}%. Review if the investment thesis still holds.`,icon:'🔴'});
  if(d.goalsSummary.some(g=>g.healthStatus==='AT_RISK'||g.healthStatus==='OFF_TRACK')) ins.push({title:'Goals Need Attention',body:'One or more goals are off-track. Increase SIP or extend timelines.',icon:'🎯'});
  if(cryptoPct>20) ins.push({title:'Elevated Crypto Risk',body:`Crypto is ${cryptoPct.toFixed(0)}% of portfolio — highly volatile. Consider capping at 10–15%.`,icon:'⚡'});
  const fallbacks=[
    {title:'Switch to Direct Plans',body:'Direct MF plans save 0.5–1.5% annually vs regular plans — a significant long-term compounding benefit.',icon:'💡'},
    {title:'Review Annually',body:'Annual portfolio reviews with rebalancing improve long-term returns and keep risk aligned with your goals.',icon:'📅'},
    {title:'Emergency Fund First',body:'Maintain 6 months of expenses in a liquid fund before aggressive equity investing.',icon:'🛡️'},
  ];
  for(const f of fallbacks){ if(ins.length>=6)break; ins.push(f); }
  return ins.slice(0,6);
}

// ─── Print CSS (injected once) ────────────────────────────────────────────────

const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 8mm; }

  /* Hide all layout chrome */
  aside, header, nav,
  .print-hide { display: none !important; }

  /* Remove scroll / overflow constraints */
  html, body { overflow: visible !important; height: auto !important; background: white !important; }
  #__next > div { display: block !important; height: auto !important; overflow: visible !important; }
  main { max-width: 100% !important; padding: 0 !important; margin: 0 !important; overflow: visible !important; }

  /* Each report section starts on a new page */
  .report-page {
    page-break-after: always !important;
    break-after: page !important;
    width: 100% !important;
    min-height: auto !important;
    border: none !important;
    box-shadow: none !important;
    border-radius: 0 !important;
    padding: 12mm !important;
  }

  /* Report wrapper */
  #report-wrap {
    border: none !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    max-width: 100% !important;
  }

  /* Keep colours intact */
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }

  /* Ensure chart containers get their height */
  .chart-box { height: 280px !important; overflow: visible !important; }
}
`;

// ─── Shared sub-components ────────────────────────────────────────────────────

function PageHeader({page,title,sub}:{page:number;title:string;sub?:string}){
  return(
    <div className="flex items-start justify-between mb-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-500 mb-1">WealthPortal · Personal Wealth Report</p>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
        {sub&&<p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{sub}</p>}
      </div>
      <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-sm font-bold text-indigo-600 dark:text-indigo-400 shrink-0">{page}</div>
    </div>
  );
}

function SC({label,value,sub,pos}:{label:string;value:string;sub?:string;pos?:boolean}){
  return(
    <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-4">
      <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider mb-1.5">{label}</p>
      <p className="text-xl font-bold text-gray-900 dark:text-white leading-none">{value}</p>
      {sub&&<p className={`text-xs font-semibold mt-1 ${pos===undefined?'text-gray-500 dark:text-gray-400':pos?'text-emerald-500':'text-red-500'}`}>{sub}</p>}
    </div>
  );
}

// Chart box with guaranteed explicit height for Recharts
function ChartBox({h=300,children}:{h?:number;children:React.ReactNode}){
  return <div className="chart-box w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden" style={{height:h}}>{children}</div>;
}

// ─── PAGE COMPONENTS ──────────────────────────────────────────────────────────

function P01Cover({user,nw,date}:{user:string;nw:number;date:string}){
  return(
    <section className="report-page flex flex-col items-center justify-center text-center p-10 relative overflow-hidden"
      style={{background:'linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#4c1d95 100%)',minHeight:900}}>
      <div className="absolute top-0 right-0 w-72 h-72 rounded-full blur-3xl" style={{background:'rgba(139,92,246,0.15)'}}/>
      <div className="absolute bottom-0 left-0 w-56 h-56 rounded-full blur-3xl" style={{background:'rgba(99,102,241,0.12)'}}/>
      <div className="relative z-10 flex flex-col items-center gap-6 max-w-lg">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-xl text-white" style={{background:'rgba(255,255,255,0.15)',border:'2px solid rgba(255,255,255,0.2)'}}>W</div>
          <span className="text-2xl font-bold text-white/90">WealthPortal</span>
        </div>
        <div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2">Personal Wealth Report</h1>
          <p className="text-white/60">Prepared for <span className="text-white font-semibold">{user}</span></p>
          <p className="text-white/40 text-sm mt-1">{date}</p>
        </div>
        <div className="w-full px-8 py-6 rounded-2xl" style={{background:'rgba(255,255,255,0.1)',backdropFilter:'blur(12px)',border:'1px solid rgba(255,255,255,0.2)'}}>
          <p className="text-white/60 text-xs uppercase tracking-widest font-semibold mb-2">Total Net Worth</p>
          <p className="text-4xl font-extrabold text-white">{fmt(nw,true)}</p>
          <p className="text-white/40 text-xs mt-2">All values in INR · As of {date}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="h-px w-16" style={{background:'rgba(255,255,255,0.2)'}}/>
          <p className="text-white/30 text-[10px] uppercase tracking-widest">Confidential · Personal Finance</p>
          <div className="h-px w-16" style={{background:'rgba(255,255,255,0.2)'}}/>
        </div>
      </div>
    </section>
  );
}

function P02Executive({d,holdings}:{d:DashboardData;holdings:Holding[]}){
  const best=d.topGainers[0];const worst=d.topLosers[0];
  return(
    <section className="report-page bg-white dark:bg-[#0f0f13] p-8" style={{minHeight:900}}>
      <PageHeader page={2} title="Executive Summary" sub="High-level snapshot of your financial position"/>
      <div className="grid grid-cols-4 gap-3 mb-6">
        <SC label="Net Worth"    value={fmt(d.netWorth.current,true)}/>
        <SC label="Total Invested" value={fmt(d.netWorth.invested,true)}/>
        <SC label="Total P&L"    value={fmt(d.netWorth.pnlAbsolute,true)} sub={pct(d.netWorth.pnlPercent)} pos={d.netWorth.pnlPercent>=0}/>
        <SC label="Holdings"     value={`${holdings.length}`}/>
      </div>
      <div className="grid grid-cols-2 gap-5 mb-6">
        <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Period Performance</p>
          {[['Today',d.netWorth.change.today],['1 Week',d.netWorth.change.oneWeek],['1 Month',d.netWorth.change.oneMonth],['1 Year',d.netWorth.change.oneYear]].map(([l,v])=>(
            <div key={String(l)} className="flex justify-between py-1.5 border-b border-gray-100 dark:border-white/5 last:border-0 text-sm">
              <span className="text-gray-500 dark:text-gray-400">{String(l)}</span>
              <span className={`font-bold ${clr(Number(v))}`}>{pct(Number(v))}</span>
            </div>
          ))}
        </div>
        <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Best &amp; Worst Holding</p>
          {best?(
            <div className="flex items-center gap-3 mb-3 p-3 rounded-lg" style={{background:'rgba(16,185,129,0.08)'}}>
              <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0"/>
              <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{best.name}</p><p className="text-xs text-emerald-500 font-medium">{pct(best.pnlPercent)}</p></div>
            </div>
          ):<p className="text-xs text-gray-400 mb-3">No gainers yet</p>}
          {worst?(
            <div className="flex items-center gap-3 p-3 rounded-lg" style={{background:'rgba(239,68,68,0.08)'}}>
              <TrendingDown className="w-4 h-4 text-red-500 shrink-0"/>
              <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{worst.name}</p><p className="text-xs text-red-500 font-medium">{pct(worst.pnlPercent)}</p></div>
            </div>
          ):<p className="text-xs text-gray-400">No losers yet</p>}
        </div>
      </div>
      <div className="rounded-xl p-5" style={{background:'linear-gradient(135deg,rgba(99,102,241,0.08),rgba(139,92,246,0.05))',border:'1px solid rgba(99,102,241,0.2)'}}>
        <div className="flex items-center gap-2 mb-4"><Zap className="w-4 h-4 text-indigo-500"/><p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">AI-Powered Key Insights</p></div>
        <div className="space-y-2">
          {d.aiInsights.slice(0,3).map((ins,i)=>(
            <div key={i} className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-[10px] font-bold text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">{i+1}</div>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{ins}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function P03Trend({history}:{history:NetWorthHistory}){
  const data=history.dataPoints.map(p=>({date:p.date.slice(5),value:p.value}));
  const mx=Math.max(...data.map(d=>d.value),0);
  const mn=Math.min(...data.map(d=>d.value),0);
  return(
    <section className="report-page bg-white dark:bg-[#0f0f13] p-8" style={{minHeight:900}}>
      <PageHeader page={3} title="Net Worth Trend" sub="12-month portfolio value trajectory"/>
      <div className="grid grid-cols-3 gap-3 mb-5">
        <SC label="Peak Value"   value={fmt(mx,true)}/>
        <SC label="Lowest Dip"  value={fmt(mn,true)}/>
        <SC label="Net Change"  value={fmt(mx-mn,true)} pos={(mx-mn)>=0}/>
      </div>
      <ChartBox h={340}>
        <ResponsiveContainer width="100%" height={340}>
          <AreaChart data={data} margin={{top:12,right:16,bottom:0,left:0}}>
            <defs>
              <linearGradient id="nwG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.1)"/>
            <XAxis dataKey="date" tick={{fontSize:11}} interval="preserveStartEnd"/>
            <YAxis tick={{fontSize:11}} tickFormatter={v=>fmt(v,true)} width={72}/>
            <Tooltip formatter={(v)=>[fmt(Number(v),true),'Net Worth']}/>
            <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2.5} fill="url(#nwG)"/>
          </AreaChart>
        </ResponsiveContainer>
      </ChartBox>
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="flex items-center gap-3 p-4 rounded-xl" style={{background:'rgba(16,185,129,0.08)',border:'1px solid rgba(16,185,129,0.2)'}}>
          <ArrowUpRight className="w-4 h-4 text-emerald-500 shrink-0"/>
          <div><p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">Peak Value</p><p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{fmt(mx,true)}</p></div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl" style={{background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)'}}>
          <ArrowDownRight className="w-4 h-4 text-red-500 shrink-0"/>
          <div><p className="text-xs text-red-600 dark:text-red-400 font-semibold">Lowest Dip</p><p className="text-sm font-bold text-red-700 dark:text-red-300">{fmt(mn,true)}</p></div>
        </div>
      </div>
    </section>
  );
}

function P04Allocation({d}:{d:DashboardData}){
  const data=d.allocation.filter(a=>a.value>0).sort((a,b)=>b.value-a.value);
  return(
    <section className="report-page bg-white dark:bg-[#0f0f13] p-8" style={{minHeight:900}}>
      <PageHeader page={4} title="Asset Allocation" sub="How your wealth is distributed across asset classes"/>
      {data.length===0?(
        <div className="flex items-center justify-center h-64 text-gray-400">Add holdings to see allocation</div>
      ):(
        <div className="grid grid-cols-2 gap-6">
          {/* Donut */}
          <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-4">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Distribution</p>
            <div style={{height:260}}>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={data} dataKey="value" nameKey="assetClass" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2}>
                    {data.map(a=><Cell key={a.assetClass} fill={PALETTE[a.assetClass]??ALT}/>)}
                  </Pie>
                  <Tooltip formatter={(v)=>[fmt(Number(v),true),'Value']}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              {data.map(a=>(
                <div key={a.assetClass} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{background:PALETTE[a.assetClass]??ALT}}/>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{ASSET_LABEL[a.assetClass]??a.assetClass}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Bars */}
          <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-4 flex flex-col gap-3 justify-center">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Value Breakdown</p>
            {data.map(a=>(
              <div key={a.assetClass}>
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-gray-700 dark:text-gray-300">{ASSET_LABEL[a.assetClass]??a.assetClass}</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">{a.percent.toFixed(1)}% · {fmt(a.value,true)}</span>
                </div>
                <div className="h-2.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{width:`${Math.min(a.percent,100)}%`,background:PALETTE[a.assetClass]??ALT}}/>
                </div>
              </div>
            ))}
            {data[0]&&(
              <div className="mt-2 p-3 rounded-lg text-xs font-semibold" style={{background:'rgba(245,158,11,0.1)',border:'1px solid rgba(245,158,11,0.2)',color:'#d97706'}}>
                {ASSET_LABEL[data[0].assetClass]??data[0].assetClass} forms {data[0].percent.toFixed(0)}% of portfolio
                {data[0].percent>60?' — consider diversifying':' — healthy allocation'}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function P05Holdings({holdings}:{holdings:Holding[]}){
  const sorted=[...holdings].sort((a,b)=>(b.currentValue??0)-(a.currentValue??0));
  return(
    <section className="report-page bg-white dark:bg-[#0f0f13] p-8 overflow-hidden" style={{minHeight:900}}>
      <PageHeader page={5} title="Holdings Overview" sub={`${holdings.length} active holdings sorted by value`}/>
      {holdings.length===0?(<div className="flex items-center justify-center h-64 text-gray-400">No holdings yet</div>):(
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-200 dark:border-white/10">
                {['Asset','Class','Qty','Avg Price','Current','Invested','Value','P&L ₹','P&L %','Wt'].map(h=>(
                  <th key={h} className="text-left py-2.5 px-2 text-gray-500 dark:text-gray-400 font-semibold uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((h,i)=>(
                <tr key={h.id} className={`border-b border-gray-100 dark:border-white/5 ${i%2===0?'':'bg-gray-50/60 dark:bg-white/[0.02]'}`}>
                  <td className="py-2.5 px-2 font-semibold text-gray-900 dark:text-white max-w-[130px] truncate">{h.name}</td>
                  <td className="py-2.5 px-2">
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{background:`${PALETTE[h.assetClass]??ALT}20`,color:PALETTE[h.assetClass]??ALT}}>
                      {ASSET_LABEL[h.assetClass]??h.assetClass}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-gray-600 dark:text-gray-400">{h.quantity.toLocaleString('en-IN',{maximumFractionDigits:2})}</td>
                  <td className="py-2.5 px-2 text-gray-600 dark:text-gray-400">{fmt(h.avgBuyPrice,true)}</td>
                  <td className="py-2.5 px-2 text-gray-600 dark:text-gray-400">{h.currentPrice?fmt(h.currentPrice,true):'—'}</td>
                  <td className="py-2.5 px-2 text-gray-600 dark:text-gray-400">{fmt(h.totalInvested,true)}</td>
                  <td className="py-2.5 px-2 font-bold text-gray-900 dark:text-white">{fmt(h.currentValue,true)}</td>
                  <td className={`py-2.5 px-2 font-bold ${clr(h.pnlAbsolute)}`}>{fmt(h.pnlAbsolute,true)}</td>
                  <td className={`py-2.5 px-2 font-bold ${clr(h.pnlPercent)}`}>{pct(h.pnlPercent)}</td>
                  <td className="py-2.5 px-2 text-gray-500">{h.weight.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function P06Gainers({gainers}:{gainers:DashboardData['topGainers']}){
  return(
    <section className="report-page bg-white dark:bg-[#0f0f13] p-8" style={{minHeight:900}}>
      <PageHeader page={6} title="Top Performers" sub="Best performing holdings by return percentage"/>
      {gainers.length===0?(
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
          <TrendingUp className="w-12 h-12 text-gray-200 dark:text-gray-700"/>
          <p className="text-gray-400">No holdings in profit yet</p>
        </div>
      ):(
        <>
          <ChartBox h={300}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={gainers} layout="vertical" margin={{top:8,right:24,left:4,bottom:8}}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(16,185,129,0.1)"/>
                <XAxis type="number" tick={{fontSize:10}} tickFormatter={v=>`${v}%`}/>
                <YAxis type="category" dataKey="name" tick={{fontSize:10}} width={120}/>
                <Tooltip formatter={(v)=>[`${Number(v).toFixed(2)}%`,'Return']}/>
                <Bar dataKey="pnlPercent" radius={[0,5,5,0]}>
                  {gainers.map((_,i)=><Cell key={i} fill={['#10b981','#34d399','#6ee7b7','#a7f3d0','#d1fae5'][i]??'#10b981'}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartBox>
          <div className="mt-5 grid gap-3">
            {gainers.map((h,i)=>(
              <div key={h.id} className="flex items-center gap-3 p-4 rounded-xl" style={{background:'rgba(16,185,129,0.06)',border:'1px solid rgba(16,185,129,0.15)'}}>
                <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center text-xs font-bold text-emerald-700 dark:text-emerald-400 shrink-0">#{i+1}</div>
                <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-gray-900 dark:text-white">{h.name}</p><p className="text-xs text-gray-500">{fmt(h.currentValue,true)}</p></div>
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{pct(h.pnlPercent)}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function P07Losers({losers}:{losers:DashboardData['topLosers']}){
  return(
    <section className="report-page bg-white dark:bg-[#0f0f13] p-8" style={{minHeight:900}}>
      <PageHeader page={7} title="Underperformers" sub="Holdings currently in loss — review for potential action"/>
      {losers.length===0?(
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
          <CheckCircle className="w-16 h-16 text-emerald-400"/>
          <p className="text-xl font-bold text-gray-700 dark:text-gray-300">All holdings in profit!</p>
          <p className="text-sm text-gray-400">No underperformers in your portfolio right now.</p>
        </div>
      ):(
        <>
          <ChartBox h={300}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={losers} layout="vertical" margin={{top:8,right:24,left:4,bottom:8}}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(239,68,68,0.1)"/>
                <XAxis type="number" tick={{fontSize:10}} tickFormatter={v=>`${v}%`}/>
                <YAxis type="category" dataKey="name" tick={{fontSize:10}} width={120}/>
                <Tooltip formatter={(v)=>[`${Number(v).toFixed(2)}%`,'Return']}/>
                <Bar dataKey="pnlPercent" radius={[0,5,5,0]}>
                  {losers.map((_,i)=><Cell key={i} fill={['#ef4444','#f87171','#fca5a5','#fecaca','#fee2e2'][i]??'#ef4444'}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartBox>
          <div className="mt-5 grid gap-3">
            {losers.map((h,i)=>(
              <div key={h.id} className="flex items-center gap-3 p-4 rounded-xl" style={{background:'rgba(239,68,68,0.06)',border:'1px solid rgba(239,68,68,0.15)'}}>
                <div className="w-7 h-7 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center text-xs font-bold text-red-700 dark:text-red-400 shrink-0">#{i+1}</div>
                <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-gray-900 dark:text-white">{h.name}</p><p className="text-xs text-gray-500">{fmt(h.currentValue,true)}</p></div>
                <p className="text-sm font-bold text-red-600 dark:text-red-400">{pct(h.pnlPercent)}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function P08Categories({d}:{d:DashboardData}){
  const eqV=d.allocation.filter(a=>['STOCK','MUTUAL_FUND'].includes(a.assetClass)).reduce((s,a)=>s+a.value,0);
  const dbV=d.allocation.filter(a=>['FD','RD','PPF','EPF','NPS','SGB'].includes(a.assetClass)).reduce((s,a)=>s+a.value,0);
  const alV=d.allocation.filter(a=>['CRYPTO','GOLD','REAL_ESTATE'].includes(a.assetClass)).reduce((s,a)=>s+a.value,0);
  const tot=eqV+dbV+alV;
  const cats=[
    {label:'Equity', v:eqV, p:tot>0?(eqV/tot)*100:0, color:'#6366f1', desc:'Stocks & Mutual Funds',   ideal:'60–75%'},
    {label:'Debt',   v:dbV, p:tot>0?(dbV/tot)*100:0, color:'#3b82f6', desc:'FD, RD, PPF, NPS, SGB',   ideal:'15–25%'},
    {label:'Alt',    v:alV, p:tot>0?(alV/tot)*100:0, color:'#f97316', desc:'Crypto, Gold, Real Estate',ideal:'5–15%'},
  ];
  const pieData=cats.filter(c=>c.v>0);
  return(
    <section className="report-page bg-white dark:bg-[#0f0f13] p-8" style={{minHeight:900}}>
      <PageHeader page={8} title="Category Exposure" sub="Equity · Debt · Alternatives breakdown"/>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {cats.map(c=>(
          <div key={c.label} className="rounded-xl p-5 border border-gray-200 dark:border-white/10" style={{background:`${c.color}0f`}}>
            <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{color:c.color}}>{c.label} · Ideal: {c.ideal}</p>
            <p className="text-3xl font-extrabold text-gray-900 dark:text-white">{c.p.toFixed(1)}%</p>
            <p className="text-sm text-gray-500 mt-1">{fmt(c.v,true)}</p>
            <p className="text-xs text-gray-400 mt-1">{c.desc}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-4">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Category Mix</p>
          <div style={{height:240}}>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} dataKey="v" nameKey="label" cx="50%" cy="50%" outerRadius={90} paddingAngle={3}>
                  {pieData.map(c=><Cell key={c.label} fill={c.color}/>)}
                </Pie>
                <Tooltip formatter={(v)=>[fmt(Number(v),true),'']}/>
                <Legend/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-5 flex flex-col justify-center gap-5">
          {cats.map(c=>(
            <div key={c.label}>
              <div className="flex justify-between mb-1.5"><span className="text-sm font-medium text-gray-700 dark:text-gray-300">{c.label}</span><span className="text-sm font-bold" style={{color:c.color}}>{c.p.toFixed(1)}%</span></div>
              <div className="h-3 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{width:`${c.p}%`,background:c.color}}/></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function P09Risk({holdings,d}:{holdings:Holding[];d:DashboardData}){
  const avgRisk=holdings.length>0?holdings.reduce((s,h)=>s+(h.riskScore??5),0)/holdings.length:0;
  const classCount=d.allocation.filter(a=>a.value>0).length;
  const maxW=Math.max(...d.allocation.map(a=>a.percent),0);
  const gauges=[
    {label:'Concentration',score:Math.round(Math.max(0,maxW)),    color:maxW>60?'#ef4444':maxW>40?'#f97316':'#10b981'},
    {label:'Diversification',score:Math.round(Math.min(classCount*16,100)),color:classCount>=5?'#10b981':classCount>=3?'#f97316':'#ef4444'},
    {label:'Avg Hold Risk', score:Math.round(avgRisk*10),         color:avgRisk>7?'#ef4444':avgRisk>4?'#f97316':'#10b981'},
  ];
  const topRisk=[...holdings].sort((a,b)=>(b.riskScore??0)-(a.riskScore??0)).slice(0,5);
  return(
    <section className="report-page bg-white dark:bg-[#0f0f13] p-8" style={{minHeight:900}}>
      <PageHeader page={9} title="Risk Analysis" sub="Portfolio risk metrics and concentration assessment"/>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {gauges.map(g=>(
          <div key={g.label} className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-5 flex flex-col items-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wide mb-4 text-center">{g.label}</p>
            <div className="relative" style={{width:96,height:96}}>
              <svg viewBox="0 0 100 100" style={{width:96,height:96,transform:'rotate(-90deg)'}}>
                <circle cx="50" cy="50" r="38" fill="none" stroke="#e5e7eb" strokeWidth="10"/>
                <circle cx="50" cy="50" r="38" fill="none" strokeWidth="10" stroke={g.color}
                  strokeDasharray={`${2*Math.PI*38}`}
                  strokeDashoffset={`${2*Math.PI*38*(1-g.score/100)}`}
                  strokeLinecap="round"/>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-extrabold text-gray-900 dark:text-white">{g.score}</span>
              </div>
            </div>
            <p className="text-xs font-bold mt-3" style={{color:g.color}}>{g.score>=70?'High Risk':g.score>=40?'Medium':'Low Risk'}</p>
          </div>
        ))}
      </div>
      <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-5">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">Highest Risk Holdings</p>
        <div className="space-y-3">
          {topRisk.map(h=>{
            const rScore=h.riskScore??0;
            const rColor=rScore>=7?'#ef4444':rScore>=4?'#f97316':'#10b981';
            return(
              <div key={h.id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-900 dark:text-white truncate">{h.name}</p><p className="text-xs text-gray-500">{ASSET_LABEL[h.assetClass]??h.assetClass}</p></div>
                <div className="w-28 h-2 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{width:`${(rScore/10)*100}%`,background:rColor}}/>
                </div>
                <span className="text-xs font-bold w-16 text-right" style={{color:rColor}}>{rScore>=7?'High':rScore>=4?'Med':'Low'} ({rScore}/10)</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function P10Behavior({holdings}:{holdings:Holding[]}){
  const monthly:Record<string,number>={};
  for(const h of holdings){
    if(!h.firstBuyDate)continue;
    const m=h.firstBuyDate.slice(0,7);
    monthly[m]=(monthly[m]??0)+h.totalInvested;
  }
  const chartData=Object.entries(monthly).sort(([a],[b])=>a.localeCompare(b)).map(([m,v])=>({label:m,invested:v})).slice(-12);
  const avg=chartData.length>0?chartData.reduce((s,d)=>s+d.invested,0)/chartData.length:0;
  const peak=chartData.length>0?chartData.reduce((a,b)=>a.invested>b.invested?a:b):null;
  return(
    <section className="report-page bg-white dark:bg-[#0f0f13] p-8" style={{minHeight:900}}>
      <PageHeader page={10} title="Investment Behavior" sub="When and how much you invested over time"/>
      <div className="grid grid-cols-3 gap-3 mb-5">
        <SC label="Total Holdings"  value={`${holdings.length}`}/>
        <SC label="Avg Monthly Buy" value={fmt(avg,true)}/>
        <SC label="Peak Month"      value={peak?peak.label:'—'} sub={peak?fmt(peak.invested,true):undefined}/>
      </div>
      <ChartBox h={280}>
        {chartData.length===0?(
          <div className="h-full flex items-center justify-center text-gray-400 text-sm">No investment history</div>
        ):(
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{top:8,right:12,bottom:8,left:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.1)"/>
              <XAxis dataKey="label" tick={{fontSize:10}}/>
              <YAxis tick={{fontSize:10}} tickFormatter={v=>fmt(v,true)} width={64}/>
              <Tooltip formatter={(v)=>[fmt(Number(v),true),'Invested']}/>
              <Bar dataKey="invested" fill="#6366f1" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartBox>
      <div className="mt-5 grid grid-cols-2 gap-4">
        <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Holdings by Asset Class</p>
          {Object.entries(holdings.reduce((acc,h)=>{acc[h.assetClass]=(acc[h.assetClass]??0)+1;return acc;},{} as Record<string,number>)).sort(([,a],[,b])=>b-a).map(([cls,cnt])=>(
            <div key={cls} className="flex justify-between py-1.5 border-b border-gray-100 dark:border-white/5 last:border-0 text-sm">
              <span className="text-gray-600 dark:text-gray-400">{ASSET_LABEL[cls]??cls}</span>
              <span className="font-bold text-gray-900 dark:text-white">{cnt}</span>
            </div>
          ))}
        </div>
        <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Position Sizes</p>
          {[
            ['Avg Holding Value', fmt(holdings.length>0?holdings.reduce((s,h)=>s+(h.currentValue??0),0)/holdings.length:0,true)],
            ['Largest Position',  fmt(Math.max(...holdings.map(h=>h.currentValue??0),0),true)],
            ['Smallest Position', fmt(Math.min(...holdings.map(h=>h.currentValue??0).filter(v=>v>0),0),true)],
          ].map(([l,v])=>(
            <div key={String(l)} className="flex justify-between py-1.5 border-b border-gray-100 dark:border-white/5 last:border-0 text-sm">
              <span className="text-gray-600 dark:text-gray-400">{String(l)}</span>
              <span className="font-bold text-gray-900 dark:text-white">{String(v)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function P11PnL({d,holdings}:{d:DashboardData;holdings:Holding[]}){
  const byClass=d.allocation.map(a=>{
    const hs=holdings.filter(h=>h.assetClass===a.assetClass);
    const pnl=hs.reduce((s,h)=>s+(h.pnlAbsolute??0),0);
    return{label:ASSET_LABEL[a.assetClass]??a.assetClass,pnl};
  }).filter(a=>a.pnl!==0);
  return(
    <section className="report-page bg-white dark:bg-[#0f0f13] p-8" style={{minHeight:900}}>
      <PageHeader page={11} title="Profit & Loss Breakdown" sub="Gain/loss analysis across your portfolio"/>
      <div className="grid grid-cols-3 gap-3 mb-5">
        <SC label="Total P&L"      value={fmt(d.netWorth.pnlAbsolute,true)} sub={pct(d.netWorth.pnlPercent)} pos={d.netWorth.pnlPercent>=0}/>
        <SC label="Unrealized P&L" value={fmt(d.netWorth.pnlAbsolute,true)} pos={d.netWorth.pnlAbsolute>=0}/>
        <SC label="Realized P&L"   value="₹0" sub="Not tracked yet"/>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-4">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">P&amp;L by Asset Class</p>
          <div style={{height:280}}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byClass} layout="vertical" margin={{top:4,right:16,left:0,bottom:4}}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(99,102,241,0.08)"/>
                <XAxis type="number" tick={{fontSize:10}} tickFormatter={v=>fmt(v,true)}/>
                <YAxis type="category" dataKey="label" tick={{fontSize:10}} width={100}/>
                <Tooltip formatter={(v)=>[fmt(Number(v),true),'P&L']}/>
                <Bar dataKey="pnl" radius={[0,4,4,0]}>
                  {byClass.map((b,i)=><Cell key={i} fill={b.pnl>=0?'#10b981':'#ef4444'}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-5">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">Top P&amp;L Contributors</p>
          <div className="space-y-3">
            {[...holdings].sort((a,b)=>Math.abs(b.pnlAbsolute??0)-Math.abs(a.pnlAbsolute??0)).slice(0,7).map(h=>(
              <div key={h.id} className="flex items-center justify-between gap-3">
                <p className="text-sm text-gray-800 dark:text-white font-medium truncate flex-1">{h.name}</p>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold ${clr(h.pnlAbsolute)}`}>{fmt(h.pnlAbsolute,true)}</p>
                  <p className={`text-xs ${clr(h.pnlPercent)}`}>{pct(h.pnlPercent)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function P12Goals({goals}:{goals:DashboardData['goalsSummary']}){
  return(
    <section className="report-page bg-white dark:bg-[#0f0f13] p-8" style={{minHeight:900}}>
      <PageHeader page={12} title="Goal Tracking" sub="Progress towards your financial goals"/>
      {goals.length===0?(
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
          <Target className="w-12 h-12 text-gray-200 dark:text-gray-700"/>
          <p className="text-gray-400">No goals set yet. Add goals in the Goals section.</p>
        </div>
      ):(
        <>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <SC label="On Track"  value={`${goals.filter(g=>g.healthStatus==='ON_TRACK').length}`}  sub="goals"/>
            <SC label="At Risk"   value={`${goals.filter(g=>g.healthStatus==='AT_RISK').length}`}   sub="goals"/>
            <SC label="Off Track" value={`${goals.filter(g=>g.healthStatus==='OFF_TRACK').length}`} sub="goals"/>
          </div>
          <div className="space-y-4">
            {goals.map(g=>{
              const bar=g.healthStatus==='ON_TRACK'?'#10b981':g.healthStatus==='AT_RISK'?'#f97316':'#ef4444';
              const bg =g.healthStatus==='ON_TRACK'?'rgba(16,185,129,0.06)':g.healthStatus==='AT_RISK'?'rgba(245,158,11,0.06)':'rgba(239,68,68,0.06)';
              const bd =g.healthStatus==='ON_TRACK'?'rgba(16,185,129,0.2)' :g.healthStatus==='AT_RISK'?'rgba(245,158,11,0.2)' :'rgba(239,68,68,0.2)';
              const tag=g.healthStatus==='ON_TRACK'?'#10b981':g.healthStatus==='AT_RISK'?'#f97316':'#ef4444';
              return(
                <div key={g.id} className="p-5 rounded-xl" style={{background:bg,border:`1px solid ${bd}`}}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-base font-semibold text-gray-900 dark:text-white">{g.name}</p>
                      <p className="text-sm text-gray-500">{fmt(g.currentAmount,true)} of {fmt(g.targetAmount,true)}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold" style={{background:`${tag}20`,color:tag}}>
                      {g.healthStatus.replace('_',' ')}
                    </span>
                  </div>
                  <div className="h-3 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden mb-2">
                    <div className="h-full rounded-full" style={{width:`${g.progressPercent}%`,background:bar}}/>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{g.progressPercent.toFixed(1)}% complete</span>
                    <span>Remaining: {fmt(g.targetAmount-g.currentAmount,true)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function P13Reco({d,holdings}:{d:DashboardData;holdings:Holding[]}){
  const ins=buildInsights(d,holdings);
  return(
    <section className="report-page bg-white dark:bg-[#0f0f13] p-8" style={{minHeight:900}}>
      <PageHeader page={13} title="Recommendations" sub="Personalised action items based on your portfolio analysis"/>
      <div className="grid gap-4">
        {ins.map((r,i)=>(
          <div key={i} className="flex items-start gap-4 p-5 rounded-xl" style={{background:'rgba(99,102,241,0.04)',border:'1px solid rgba(99,102,241,0.15)'}}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{background:'rgba(99,102,241,0.1)'}}>{r.icon}</div>
            <div className="flex-1">
              <p className="text-base font-bold text-gray-900 dark:text-white mb-1">{r.title}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{r.body}</p>
            </div>
            <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">{i+1}</div>
          </div>
        ))}
      </div>
      <div className="mt-5 p-4 rounded-xl text-xs font-medium" style={{background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.2)',color:'#b45309'}}>
        ⚠️ <strong>Disclaimer:</strong> These recommendations are based on portfolio data analysis for informational purposes only. They do not constitute financial advice. Consult a SEBI-registered financial advisor before making investment decisions.
      </div>
    </section>
  );
}

function P14Projections({d}:{d:DashboardData}){
  const cur=d.netWorth.current;
  const data=Array.from({length:11},(_,i)=>({
    year: new Date().getFullYear()+i,
    conservative: Math.round(cur*Math.pow(1.07,i)),
    moderate:     Math.round(cur*Math.pow(1.12,i)),
    aggressive:   Math.round(cur*Math.pow(1.18,i)),
  }));
  const last=data[10]!;
  return(
    <section className="report-page bg-white dark:bg-[#0f0f13] p-8" style={{minHeight:900}}>
      <PageHeader page={14} title="Future Projections" sub="10-year wealth forecast under different market scenarios"/>
      <div className="grid grid-cols-3 gap-4 mb-5">
        {([['Conservative','7% CAGR','#3b82f6',last.conservative],['Moderate','12% CAGR','#6366f1',last.moderate],['Aggressive','18% CAGR','#8b5cf6',last.aggressive]] as [string,string,string,number][]).map(([l,r,c,v])=>(
          <div key={l} className="rounded-xl p-5 border border-gray-200 dark:border-white/10" style={{background:`${c}0f`}}>
            <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{color:c}}>{l} · {r}</p>
            <p className="text-2xl font-extrabold text-gray-900 dark:text-white">{fmt(v,true)}</p>
            <p className="text-xs text-gray-400 mt-1">In 10 years</p>
          </div>
        ))}
      </div>
      <ChartBox h={320}>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={data} margin={{top:8,right:12,bottom:8,left:0}}>
            <defs>
              {(['conservative','moderate','aggressive'] as const).map((k,i)=>{
                const c=['#3b82f6','#6366f1','#8b5cf6'][i]!;
                return(<linearGradient key={k} id={`pg-${k}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={c} stopOpacity={0.2}/><stop offset="95%" stopColor={c} stopOpacity={0.02}/></linearGradient>);
              })}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.08)"/>
            <XAxis dataKey="year" tick={{fontSize:11}}/>
            <YAxis tick={{fontSize:11}} tickFormatter={v=>fmt(v,true)} width={72}/>
            <Tooltip formatter={(v,name)=>[fmt(Number(v),true),String(name)]}/>
            <Legend/>
            <Area type="monotone" dataKey="conservative" stroke="#3b82f6" fill="url(#pg-conservative)" strokeWidth={2} name="Conservative"/>
            <Area type="monotone" dataKey="moderate"     stroke="#6366f1" fill="url(#pg-moderate)"     strokeWidth={2} name="Moderate"/>
            <Area type="monotone" dataKey="aggressive"   stroke="#8b5cf6" fill="url(#pg-aggressive)"   strokeWidth={2} name="Aggressive"/>
          </AreaChart>
        </ResponsiveContainer>
      </ChartBox>
      <p className="text-xs text-gray-400 mt-3 text-center">* Projections assume constant CAGR. Actual returns vary. Past performance does not guarantee future results.</p>
    </section>
  );
}

function P15Summary({d,holdings}:{d:DashboardData;holdings:Holding[]}){
  const eqPct=d.allocation.filter(a=>['STOCK','MUTUAL_FUND'].includes(a.assetClass)).reduce((s,a)=>s+a.percent,0);
  const classCount=d.allocation.filter(a=>a.value>0).length;
  const onTrack=d.goalsSummary.filter(g=>g.healthStatus==='ON_TRACK').length;
  const cryptoPct=d.allocation.find(a=>a.assetClass==='CRYPTO')?.percent??0;

  const strengths:string[]=[];
  const risks:string[]=[];
  const actions:string[]=[];

  if(d.netWorth.pnlPercent>0) strengths.push(`Portfolio is ${pct(d.netWorth.pnlPercent)} in profit since inception.`);
  if(classCount>=3) strengths.push(`Good diversification across ${classCount} asset classes.`);
  if(onTrack>0) strengths.push(`${onTrack} financial goal(s) currently on track.`);
  if(strengths.length===0) strengths.push('Portfolio is established and actively tracked.');
  while(strengths.length<3) strengths.push(['Regular investment monitoring in place.','Disciplined approach with multiple asset classes.'][strengths.length-1]??'Consistent investment approach.');

  if(eqPct>80) risks.push(`High equity at ${eqPct.toFixed(0)}% — elevated volatility risk.`);
  else if(eqPct<20) risks.push(`Low equity at ${eqPct.toFixed(0)}% — may limit long-term growth.`);
  if(classCount<3) risks.push('Limited diversification across asset classes.');
  if(cryptoPct>20) risks.push(`Crypto at ${cryptoPct.toFixed(0)}% — very high volatility risk.`);
  if(risks.length===0) risks.push('Monitor interest rate changes affecting debt instruments.');
  while(risks.length<3) risks.push(['Market timing risk — SIP reduces this.','Inflation can erode low-yield debt returns.'][risks.length-1]??'Periodic review needed to stay on track.');

  if(eqPct<30) actions.push('Increase equity via diversified index or flexi-cap mutual funds.');
  if(classCount<4) actions.push('Add a 4th asset class (gold / debt fund) for better risk-return.');
  if(d.goalsSummary.some(g=>g.healthStatus!=='ON_TRACK')) actions.push('Increase SIP for off-track goals immediately.');
  if(actions.length===0) actions.push('Continue current SIP strategy — consistency beats timing.');
  while(actions.length<3) actions.push(['Review allocation every 6 months and rebalance.','Keep 6 months of expenses in a liquid fund.'][actions.length-1]??'Stay consistent with monthly investments.');

  const review=new Date(); review.setMonth(review.getMonth()+4);

  return(
    <section className="report-page bg-white dark:bg-[#0f0f13] p-8" style={{minHeight:900}}>
      <PageHeader page={15} title="Summary & Action Plan" sub="Your personalised financial roadmap"/>
      <div className="grid grid-cols-3 gap-5 mb-6">
        {[
          {title:'3 Key Strengths',items:strengths, bg:'rgba(16,185,129,0.06)', bd:'rgba(16,185,129,0.2)', tc:'#10b981', ic:<CheckCircle className="w-4 h-4" style={{color:'#10b981'}}/>, mk:'✓'},
          {title:'3 Key Risks',   items:risks,     bg:'rgba(239,68,68,0.06)',  bd:'rgba(239,68,68,0.2)',  tc:'#ef4444', ic:<AlertTriangle className="w-4 h-4" style={{color:'#ef4444'}}/>, mk:'!'},
          {title:'3 Action Steps',items:actions,   bg:'rgba(99,102,241,0.06)', bd:'rgba(99,102,241,0.2)', tc:'#6366f1', ic:<Zap className="w-4 h-4" style={{color:'#6366f1'}}/>, mk:'→'},
        ].map(col=>(
          <div key={col.title} className="rounded-2xl p-5" style={{background:col.bg,border:`1px solid ${col.bd}`}}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{background:`${col.tc}20`}}>{col.ic}</div>
              <p className="text-sm font-bold" style={{color:col.tc}}>{col.title}</p>
            </div>
            <div className="space-y-3">
              {col.items.slice(0,3).map((item,i)=>(
                <div key={i} className="flex items-start gap-2">
                  <span className="text-xs font-bold mt-0.5 shrink-0" style={{color:col.tc}}>{col.mk}</span>
                  <p className="text-sm leading-relaxed text-gray-800 dark:text-gray-200">{item}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl p-5 flex items-center gap-4" style={{background:'linear-gradient(135deg,rgba(99,102,241,0.08),rgba(139,92,246,0.05))',border:'1px solid rgba(99,102,241,0.2)'}}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{background:'rgba(99,102,241,0.15)'}}><Activity className="w-6 h-6 text-indigo-600 dark:text-indigo-400"/></div>
        <div className="flex-1">
          <p className="text-sm font-bold text-gray-900 dark:text-white">Next Portfolio Review</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Recommended in <strong className="text-indigo-600 dark:text-indigo-400">{review.toLocaleDateString('en-IN',{month:'long',year:'numeric'})}</strong> — quarterly reviews consistently improve long-term outcomes.</p>
        </div>
        <div className="text-right shrink-0 pl-4 border-l border-indigo-200 dark:border-indigo-500/20">
          <p className="text-xs text-gray-400">Report by</p>
          <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">WealthPortal</p>
        </div>
      </div>
    </section>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ReportsPage(){
  const {user}=useAuthStore();

  const {data:dashboard,isLoading:dl}=useQuery({
    queryKey:['dashboard'],
    queryFn:()=>apiClient.get<{success:boolean;data:DashboardData}>('/api/dashboard').then(r=>r.data.data),
    staleTime:5*60_000,
  });
  const {data:holdings,isLoading:hl}=useQuery({
    queryKey:['holdings'],
    queryFn:()=>apiClient.get<{success:boolean;data:Holding[]}>('/api/holdings').then(r=>r.data.data),
    staleTime:5*60_000,
  });
  const {data:nwHistory}=useQuery({
    queryKey:['net-worth-history','1Y'],
    queryFn:()=>apiClient.get<{success:boolean;data:NetWorthHistory}>('/api/dashboard/net-worth-history?period=1Y').then(r=>r.data.data),
    staleTime:5*60_000,
  });

  const d  = dashboard;
  const hs = holdings??[];
  const nw = nwHistory??{period:'1Y',dataPoints:[]};
  const today=new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'});

  if(dl||hl){
    return(
      <div className="flex items-center justify-center min-h-[60vh] flex-col gap-4">
        <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"/>
        <p className="text-sm text-foreground-muted">Preparing your wealth report…</p>
      </div>
    );
  }

  if(!d){
    return(
      <div className="flex items-center justify-center min-h-[60vh] flex-col gap-4 text-center">
        <BarChart3 className="w-12 h-12 text-gray-300"/>
        <p className="text-lg font-semibold text-foreground">No data available</p>
        <p className="text-sm text-foreground-muted">Add holdings to generate your wealth report.</p>
      </div>
    );
  }

  return(
    <>
      {/* Inject print CSS globally */}
      <style dangerouslySetInnerHTML={{__html:PRINT_CSS}}/>

      {/* ── Action bar (hidden on print) ── */}
      <div className="print-hide sticky top-0 z-40 -mx-4 lg:-mx-8 -mt-6 lg:-mt-10 mb-8 px-4 lg:px-8 py-3 bg-background/90 backdrop-blur-xl border-b border-border">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-foreground">Personal Wealth Report</h1>
            <p className="text-sm text-foreground-muted">15-page detailed analysis · {today}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4 text-sm text-foreground-muted">
              <span className="flex items-center gap-1.5"><Wallet className="w-4 h-4 text-indigo-500"/>{fmt(d.netWorth.current,true)}</span>
              <span className="flex items-center gap-1.5"><BarChart3 className="w-4 h-4 text-indigo-500"/>{hs.length} holdings</span>
            </div>
            <button
              onClick={()=>window.print()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-all shadow-lg"
              style={{background:'linear-gradient(135deg,#6366f1,#7c3aed)'}}
            >
              <Download className="w-4 h-4"/>Download PDF
            </button>
          </div>
        </div>
        {/* Page nav */}
        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
          {['Cover','Summary','Trend','Allocation','Holdings','Gainers','Losers','Categories','Risk','Behavior','P&L','Goals','Reco','Projections','Action Plan'].map((l,i)=>(
            <a key={i} href={`#rp-${i+1}`} className="px-2 py-1 rounded-lg text-[11px] font-medium bg-border/60 hover:bg-indigo-500/15 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-foreground-muted">
              {i+1}. {l}
            </a>
          ))}
        </div>
      </div>

      {/* ── Report pages ── */}
      <div id="report-wrap" className="max-w-4xl mx-auto rounded-2xl overflow-hidden border border-border shadow-2xl divide-y divide-border/50">
        <div id="rp-1"><P01Cover  user={user?.fullName??'Investor'} nw={d.netWorth.current} date={today}/></div>
        <div id="rp-2"><P02Executive d={d} holdings={hs}/></div>
        <div id="rp-3"><P03Trend history={nw}/></div>
        <div id="rp-4"><P04Allocation d={d}/></div>
        <div id="rp-5"><P05Holdings holdings={hs}/></div>
        <div id="rp-6"><P06Gainers gainers={d.topGainers}/></div>
        <div id="rp-7"><P07Losers losers={d.topLosers}/></div>
        <div id="rp-8"><P08Categories d={d}/></div>
        <div id="rp-9"><P09Risk holdings={hs} d={d}/></div>
        <div id="rp-10"><P10Behavior holdings={hs}/></div>
        <div id="rp-11"><P11PnL d={d} holdings={hs}/></div>
        <div id="rp-12"><P12Goals goals={d.goalsSummary}/></div>
        <div id="rp-13"><P13Reco d={d} holdings={hs}/></div>
        <div id="rp-14"><P14Projections d={d}/></div>
        <div id="rp-15"><P15Summary d={d} holdings={hs}/></div>
      </div>
    </>
  );
}
