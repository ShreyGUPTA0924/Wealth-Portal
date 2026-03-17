'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, ChevronDown, ChevronUp, CheckCircle, Clock, BarChart } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lesson {
  id: string;
  title: string;
  duration: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  content?: {
    paragraphs: string[];
    takeaway: string;
    relatedTerms: string[];
  };
  comingSoon?: boolean;
}

interface Category {
  id: string;
  label: string;
  icon: string;
  description: string;
  color: string;
  textColor: string;
  lessons: Lesson[];
}

// ─── Lesson Content Database ──────────────────────────────────────────────────

const CATEGORIES: Record<string, Category> = {
  basics: {
    id: 'basics',
    label: 'Basics of Investing',
    icon: '📚',
    description: 'Learn the fundamental concepts of personal finance and investing — starting from zero.',
    color: 'bg-blue-50 border-blue-200',
    textColor: 'text-blue-700',
    lessons: [
      {
        id: 'basics-1',
        title: 'Why Invest? Beat Inflation',
        duration: '5 min',
        difficulty: 'Beginner',
        content: {
          paragraphs: [
            'Inflation is the silent thief of your wealth. In India, inflation runs at 6–7% per year on average. This means ₹100 today will only buy ₹93–94 worth of goods next year. Your money is losing purchasing power every single day it sits idle.',
            'A regular savings account gives you just 3–4% interest — which is below inflation. This means in real terms, you are losing money. An FD at 6.5% barely keeps pace with inflation after tax. To truly grow wealth, you need investments that beat inflation over time.',
            'Equity (stocks and mutual funds) has historically delivered 12–15% CAGR over 10+ year periods in India. Real estate averages 8–10%. Even PPF at 7.1% beats inflation slightly. The key insight: every rupee parked in a savings account is slowly losing value.',
          ],
          takeaway: 'Start investing to protect your money\'s value. Even ₹500/month makes a difference. The goal is to earn more than the inflation rate consistently.',
          relatedTerms: ['SIP', 'Liquid Fund', 'PPF', 'Expense Ratio'],
        },
      },
      {
        id: 'basics-2',
        title: 'Risk vs Return',
        duration: '6 min',
        difficulty: 'Beginner',
        content: {
          paragraphs: [
            'The most fundamental principle in investing: higher return always means higher risk. There are no free lunches in finance. If someone promises you 30% guaranteed returns, it\'s either a fraud or an investment you don\'t fully understand.',
            'In India, the risk-return spectrum looks like this: Fixed Deposits (6–7%, near zero risk) → Debt Mutual Funds (7–9%, low risk) → Hybrid Funds (9–11%, moderate risk) → Large Cap Equity (10–13%, moderate-high risk) → Mid/Small Cap (12–18% potential, high risk). Your age, income stability, and financial goals determine where you should sit on this spectrum.',
            'Risk profiling is essential before investing. A 25-year-old with stable income can afford more equity risk — they have time to recover from market crashes. A 55-year-old nearing retirement should shift towards debt for capital preservation. The right mix is personal, not universal.',
          ],
          takeaway: 'Never chase returns without understanding the risk. Match your investments to your risk profile, time horizon, and financial goals.',
          relatedTerms: ['Equity Fund', 'Debt Fund', 'Hybrid Fund', 'LTCG', 'STCG'],
        },
      },
      {
        id: 'basics-3',
        title: 'Power of Compounding',
        duration: '7 min',
        difficulty: 'Beginner',
        content: {
          paragraphs: [
            'Albert Einstein reportedly called compound interest the "eighth wonder of the world." Compounding means earning returns on your returns — and over time, this creates exponential wealth. ₹10,000 invested at 12% CAGR becomes ₹96,463 in 25 years. But wait 10 more years and it becomes ₹2,99,599 — 3× more wealth for just 10 extra years.',
            'The Rule of 72 is a handy shortcut: divide 72 by your annual return to know how many years it takes to double your money. At 12%, your money doubles in 6 years. At 8%, it doubles in 9 years. This shows why a seemingly small difference in returns has a massive impact over time.',
            'The most critical variable in compounding is time — not how much you invest. Starting a ₹5,000 SIP at 25 gives you ₹3.2Cr by 60 at 12%. Starting the same SIP at 35 gives only ₹1Cr. You lose ₹2.2Cr by waiting 10 years. This is the cost of procrastination.',
          ],
          takeaway: 'Start early, even with small amounts. Time in the market matters far more than timing the market. Every year of delay is exponentially expensive.',
          relatedTerms: ['SIP', 'XIRR', 'NAV', 'AUM'],
        },
      },
      {
        id: 'basics-4',
        title: 'Diversification',
        duration: '5 min',
        difficulty: 'Beginner',
        content: {
          paragraphs: [
            'Diversification means spreading investments across different assets so that a loss in one doesn\'t wipe out your entire portfolio. The classic analogy: don\'t put all eggs in one basket. In India, the four main asset classes are equity (stocks/MF), debt (bonds/FD), gold (physical/SGB), and real estate.',
            'Within equity itself, diversification matters: large cap (stable), mid cap (growth), small cap (high risk), international funds (currency hedge). A well-diversified portfolio might have 60% equity, 25% debt, 10% gold, and 5% alternatives depending on your risk profile.',
            'Diversification reduces volatility but doesn\'t eliminate risk. During extreme events like COVID (2020), almost everything fell together. However, gold actually rose during COVID, demonstrating why including non-correlated assets like gold is valuable.',
          ],
          takeaway: 'Spread your wealth across equity, debt, and gold at minimum. Concentration in one asset is the biggest wealth risk for most Indian investors.',
          relatedTerms: ['Index Fund', 'Hybrid Fund', 'SGB', 'Debt Fund'],
        },
      },
      {
        id: 'basics-5',
        title: 'SIP vs Lump Sum',
        duration: '5 min',
        difficulty: 'Beginner',
        content: {
          paragraphs: [
            'SIP (Systematic Investment Plan) means investing a fixed amount every month, regardless of market conditions. Lump sum means investing a large amount at once. Both have their place, but for most salaried investors, SIP is the smarter choice.',
            'The advantage of SIP is rupee cost averaging: when markets are down, your fixed amount buys more units. When markets are up, it buys fewer units. Over time, this averages out your cost per unit and reduces the risk of investing at market peaks. A ₹5,000 SIP over 10 years is far less risky than a ₹6L lump sum.',
            'Lump sum beats SIP only if you invest at a market bottom — which requires perfect timing. Since no one can predict markets consistently, SIP removes the decision entirely. The best investors don\'t time markets; they spend time in markets.',
          ],
          takeaway: 'Use SIP for regular income. Use lump sum when markets correct significantly. Automate your SIPs so you never miss a month.',
          relatedTerms: ['SIP', 'NAV', 'Lump Sum', 'XIRR'],
        },
      },
      {
        id: 'basics-6',
        title: 'Asset Allocation',
        duration: '6 min',
        difficulty: 'Intermediate',
        content: {
          paragraphs: [
            'Asset allocation is deciding what percentage of your portfolio goes into each asset class. It\'s the single most important investment decision — research shows it accounts for 90%+ of portfolio returns. Your specific stock or fund picks matter far less than your overall allocation.',
            'A popular rule of thumb: subtract your age from 100 to get your equity allocation. At 30, hold 70% equity. At 50, hold 50% equity. This is a starting point — adjust based on your risk tolerance, income stability, and specific goals.',
            'Rebalancing is crucial: if equity rallies and grows from 60% to 75% of your portfolio, sell some equity and buy debt to restore 60%. This forces you to buy low and sell high automatically. Annual rebalancing is sufficient for most investors.',
          ],
          takeaway: 'Decide your equity-debt-gold split based on age and risk profile. Rebalance once a year. Asset allocation beats fund selection every time.',
          relatedTerms: ['Hybrid Fund', 'Index Fund', 'Debt Fund', 'SGB'],
        },
      },
    ],
  },

  'mutual-funds': {
    id: 'mutual-funds',
    label: 'Mutual Funds',
    icon: '📈',
    description: 'Everything about Indian mutual funds — from NAV to direct plans, SIPs to ELSS.',
    color: 'bg-teal-50 border-teal-200',
    textColor: 'text-teal-700',
    lessons: [
      {
        id: 'mf-1',
        title: 'What is a Mutual Fund?',
        duration: '6 min',
        difficulty: 'Beginner',
        content: {
          paragraphs: [
            'A mutual fund pools money from thousands of investors and invests it in stocks, bonds, or other securities according to the fund\'s stated objective. A professional fund manager makes the investment decisions. In return, the AMC (Asset Management Company) charges a fee called the expense ratio.',
            'Your investment is represented as units. Each unit has a price called NAV (Net Asset Value). If a fund\'s NAV is ₹50 and you invest ₹5,000, you get 100 units. If NAV rises to ₹60, your investment is worth ₹6,000. SEBI regulates all mutual funds in India through stringent guidelines.',
            'India has 40+ AMCs (like SBI, HDFC, Nippon, Mirae, Axis) offering thousands of mutual fund schemes. They are categorized by SEBI into equity, debt, hybrid, and solution-oriented funds.',
          ],
          takeaway: 'Mutual funds offer professional management, diversification, and SEBI regulation. They are ideal for most retail investors who lack time to research individual stocks.',
          relatedTerms: ['NAV', 'AUM', 'Expense Ratio', 'ELSS'],
        },
      },
      {
        id: 'mf-2',
        title: 'Direct vs Regular Plans',
        duration: '5 min',
        difficulty: 'Beginner',
        content: {
          paragraphs: [
            'Every mutual fund has two versions: Direct and Regular. Direct plans are bought directly from the AMC (or platforms like Groww, Zerodha Coin) without a distributor. Regular plans are bought via banks, agents, or distributors who earn a commission from the AMC.',
            'This commission (typically 0.5–1.5%) comes out of your returns in the form of a higher expense ratio. A regular plan might charge 1.8% expense ratio while the same direct plan charges only 0.3%. On a ₹10L portfolio, that\'s ₹15,000 extra charges per year — compounding against you.',
            'Over 20 years, the difference between direct and regular plans on the same fund can be 20–30% in total returns. SEBI mandates that AMCs offer both versions. Always choose direct plans unless you need hand-holding from a certified financial planner.',
          ],
          takeaway: 'Always invest in direct plans. The 0.5–1.5% annual saving compounds to lakhs over 15–20 years. Use platforms like Groww or Kuvera for direct fund access.',
          relatedTerms: ['Direct Plan', 'Regular Plan', 'Expense Ratio', 'NAV'],
        },
      },
      {
        id: 'mf-3', title: 'Types of Equity Funds', duration: '8 min', difficulty: 'Intermediate', comingSoon: true,
      },
      {
        id: 'mf-4', title: 'Debt Funds Explained', duration: '7 min', difficulty: 'Intermediate', comingSoon: true,
      },
      {
        id: 'mf-5', title: 'ELSS — Tax Saving Funds', duration: '6 min', difficulty: 'Beginner', comingSoon: true,
      },
      {
        id: 'mf-6', title: 'How to Read a Fund Factsheet', duration: '9 min', difficulty: 'Intermediate', comingSoon: true,
      },
      {
        id: 'mf-7', title: 'Switching and Redemption', duration: '5 min', difficulty: 'Beginner', comingSoon: true,
      },
      {
        id: 'mf-8', title: 'XIRR vs CAGR vs Absolute Returns', duration: '7 min', difficulty: 'Advanced', comingSoon: true,
      },
    ],
  },

  stocks: {
    id: 'stocks',
    label: 'Stocks & Equity',
    icon: '📊',
    description: 'Understand the Indian stock market, equity investing, and how to evaluate companies.',
    color: 'bg-purple-50 border-purple-200',
    textColor: 'text-purple-700',
    lessons: [
      {
        id: 'stocks-1',
        title: 'How the Stock Market Works',
        duration: '8 min',
        difficulty: 'Beginner',
        content: {
          paragraphs: [
            'A stock represents ownership in a company. When you buy one share of Infosys, you own a tiny fraction of the company and are entitled to a proportionate share of its profits (dividends) and growth. Companies list their shares on exchanges — primarily NSE (National Stock Exchange) and BSE (Bombay Stock Exchange) in India.',
            'Stock prices fluctuate based on supply and demand, which is driven by company performance, economic conditions, global events, and investor sentiment. The Nifty50 index tracks the 50 largest companies on NSE; Sensex tracks 30 companies on BSE. These indices represent the overall market health.',
            'Trading happens during market hours: 9:15 AM to 3:30 PM on weekdays. You need a Demat account (electronic storage for shares) and a trading account from a broker like Zerodha, Upstox, or Angel One to participate.',
          ],
          takeaway: 'Stocks give you ownership in businesses. Long-term equity investing (5–10+ years) in quality companies is the most proven wealth-creation strategy for retail investors.',
          relatedTerms: ['LTCG', 'STCG', 'Index Fund', 'Equity Fund'],
        },
      },
      {
        id: 'stocks-2',
        title: 'Fundamental Analysis Basics',
        duration: '10 min',
        difficulty: 'Intermediate',
        content: {
          paragraphs: [
            'Fundamental analysis evaluates a company\'s intrinsic value by examining its financials, business model, competitive advantages, and management quality. Key metrics: P/E Ratio (Price to Earnings — how much you pay per rupee of profit), ROE (Return on Equity — how efficiently the company uses shareholder capital), and Debt-to-Equity ratio (financial leverage).',
            'A quality business typically shows: consistent revenue growth (15%+ CAGR), high ROE (>15%), low debt, pricing power, and a sustainable competitive moat (brand, patents, network effects). Companies like HDFC Bank, Titan, and Asian Paints have delivered 20%+ CAGR for 15+ years due to these traits.',
            'Don\'t invest in a company you don\'t understand. Start with businesses you use daily — your bank, telecom provider, paint brand. Screener.in and Tickertape offer free fundamental data for all Indian listed companies.',
          ],
          takeaway: 'Invest in quality businesses at reasonable valuations. Focus on ROE, revenue growth, and debt levels. Hold for years, not months.',
          relatedTerms: ['LTCG', 'STCG', 'Index Fund'],
        },
      },
      {
        id: 'stocks-3', title: 'Technical Analysis Intro', duration: '9 min', difficulty: 'Intermediate', comingSoon: true,
      },
      {
        id: 'stocks-4', title: 'IPOs — Should You Apply?', duration: '7 min', difficulty: 'Intermediate', comingSoon: true,
      },
      {
        id: 'stocks-5', title: 'Dividends and Buybacks', duration: '6 min', difficulty: 'Beginner', comingSoon: true,
      },
      {
        id: 'stocks-6', title: 'Sectoral Investing in India', duration: '10 min', difficulty: 'Advanced', comingSoon: true,
      },
      {
        id: 'stocks-7', title: 'International Stocks via Mutual Funds', duration: '8 min', difficulty: 'Intermediate', comingSoon: true,
      },
    ],
  },

  tax: {
    id: 'tax',
    label: 'Tax Planning',
    icon: '🧾',
    description: 'Master Indian tax laws, deductions, and legal ways to reduce your tax outgo.',
    color: 'bg-amber-50 border-amber-200',
    textColor: 'text-amber-700',
    lessons: [
      {
        id: 'tax-1',
        title: 'Section 80C Deductions Guide',
        duration: '7 min',
        difficulty: 'Beginner',
        content: {
          paragraphs: [
            'Section 80C allows deductions up to ₹1,50,000 per year from taxable income. Instruments that qualify: ELSS mutual funds (best for growth), PPF (safest, tax-free), EPF (automatic for salaried), NSC (guaranteed), life insurance premiums, home loan principal repayment, children\'s school fees, and 5-year FDs.',
            'Not all 80C instruments are equal. ELSS has the shortest lock-in (3 years) with equity growth potential. PPF has 15-year lock-in but tax-free maturity. FDs have 5-year lock-in with taxable interest. For most taxpayers below 40, ELSS + PPF is the optimal combination.',
            'At the 30% tax bracket, fully using ₹1.5L in 80C saves ₹46,800 in tax. This is essentially free money — invest first, save tax second. Don\'t treat tax saving as an afterthought in March; spread investments throughout the year.',
          ],
          takeaway: 'Use ₹1.5L 80C limit every year without fail. Prioritize ELSS for growth and PPF for safety. Never buy LIC endowment plans just for 80C — the returns are too low.',
          relatedTerms: ['ELSS', 'PPF', 'NPS'],
        },
      },
      {
        id: 'tax-2',
        title: 'LTCG and STCG Explained',
        duration: '6 min',
        difficulty: 'Intermediate',
        content: {
          paragraphs: [
            'Capital gains are profits from selling investments. Short-Term Capital Gains (STCG) arise when equity is sold within 12 months — taxed at 15% flat. Long-Term Capital Gains (LTCG) arise when equity is sold after 12 months — taxed at 10% on gains exceeding ₹1 lakh per year.',
            'For debt mutual funds (post-April 2023), all gains are taxed at your income slab rate regardless of holding period. Gold ETFs and gold funds follow the same new rules. SGB maturity after 8 years is tax-free — a big advantage over other gold instruments.',
            'Tax-loss harvesting is a legal strategy: sell loss-making funds before year-end to offset gains and reduce tax. You can immediately reinvest in similar funds. This can save significant tax for investors with large unrealized gains.',
          ],
          takeaway: 'Hold equity for 1+ year to pay 10% LTCG instead of 15% STCG. ₹1L LTCG exemption per year is yours to use — harvest gains strategically.',
          relatedTerms: ['LTCG', 'STCG', 'ELSS', 'SGB'],
        },
      },
      {
        id: 'tax-3', title: 'New vs Old Tax Regime', duration: '8 min', difficulty: 'Intermediate', comingSoon: true,
      },
      {
        id: 'tax-4', title: 'NPS Tax Benefits (80CCD)', duration: '6 min', difficulty: 'Intermediate', comingSoon: true,
      },
      {
        id: 'tax-5', title: 'HRA, Home Loan & Other Deductions', duration: '9 min', difficulty: 'Advanced', comingSoon: true,
      },
    ],
  },

  goals: {
    id: 'goals',
    label: 'Goal Planning',
    icon: '🎯',
    description: 'Build a goal-based investment plan for retirement, education, home, and more.',
    color: 'bg-green-50 border-green-200',
    textColor: 'text-green-700',
    lessons: [
      {
        id: 'goals-1',
        title: 'Goal-Based Investing Framework',
        duration: '7 min',
        difficulty: 'Beginner',
        content: {
          paragraphs: [
            'Goal-based investing means linking every rupee you invest to a specific life goal — retirement, child\'s education, home purchase, emergency fund, or vacation. This approach is far more effective than generic "wealth creation" because it gives your money a purpose and helps you choose appropriate instruments.',
            'Each goal has three parameters: Target Amount, Time Horizon, and Risk Tolerance. A 3-year goal (car purchase) needs stable debt instruments — you can\'t afford market volatility. A 20-year goal (retirement) can take full equity risk for maximum returns. Match the instrument to the time horizon, always.',
            'The WealthPortal Goals module lets you create and track individual goals. Set a realistic target, enter your current progress, and the AI advisor will suggest monthly SIP amounts and suitable fund categories to stay on track.',
          ],
          takeaway: 'Never invest without a goal. Know your target amount, timeline, and risk tolerance before picking any instrument.',
          relatedTerms: ['SIP', 'XIRR', 'Equity Fund', 'Debt Fund'],
        },
      },
      {
        id: 'goals-2',
        title: 'Retirement Planning in India',
        duration: '10 min',
        difficulty: 'Intermediate',
        content: {
          paragraphs: [
            'Retirement planning is India\'s most neglected financial goal. With no universal social security and joint family structures weakening, the responsibility of retirement corpus falls entirely on the individual. A common benchmark: you need 25–30× your annual expenses as retirement corpus to sustain 30 years of withdrawals using the 4% rule.',
            'For a person spending ₹80,000/month (₹9.6L/year), the corpus needed is ₹2.4Cr–₹2.88Cr. Inflation adjustment makes it higher — in 25 years at 6% inflation, ₹80,000 will have the purchasing power of ₹2.90L/month today. Build your retirement number in today\'s rupee equivalent and then inflate it.',
            'Three pillars of Indian retirement: EPF (automatic for salaried), PPF (voluntary, tax-free), and NPS (market-linked, additional 80CCD tax benefit). Supplement these with equity mutual funds via long-term SIPs. Ideally start by 25, ensure continuity, and increase SIPs 10% each year.',
          ],
          takeaway: 'Start retirement planning early. EPF + PPF + NPS + equity SIPs together can build a solid corpus. The goal is 25–30× annual expenses.',
          relatedTerms: ['NPS', 'PPF', 'SIP', 'LTCG'],
        },
      },
      {
        id: 'goals-3', title: "Child's Education Planning", duration: '8 min', difficulty: 'Intermediate', comingSoon: true,
      },
      {
        id: 'goals-4', title: 'Home Purchase Planning', duration: '7 min', difficulty: 'Intermediate', comingSoon: true,
      },
      {
        id: 'goals-5', title: 'Emergency Fund — How Much & Where?', duration: '5 min', difficulty: 'Beginner', comingSoon: true,
      },
      {
        id: 'goals-6', title: 'Insurance as Risk Management', duration: '8 min', difficulty: 'Intermediate', comingSoon: true,
      },
    ],
  },

  instruments: {
    id: 'instruments',
    label: 'Indian Instruments',
    icon: '🏦',
    description: 'Deep dive into PPF, NPS, SGBs, REITs, and other uniquely Indian investment options.',
    color: 'bg-rose-50 border-rose-200',
    textColor: 'text-rose-700',
    lessons: [
      {
        id: 'inst-1',
        title: 'PPF — The Safest Long-Term Instrument',
        duration: '6 min',
        difficulty: 'Beginner',
        content: {
          paragraphs: [
            'Public Provident Fund (PPF) is a government-backed savings scheme with a 15-year lock-in period. Current interest rate: 7.1% per annum, compounded annually. The government revises this quarterly. PPF has EEE (Exempt-Exempt-Exempt) tax status — contributions are deductible under 80C, interest is tax-free, and maturity amount is tax-free.',
            'Maximum investment: ₹1.5L per year. You can open a PPF account at any post office or major bank. Partial withdrawals are allowed from the 7th year. After 15 years, you can extend in blocks of 5 years. The loan facility is available from the 3rd to 6th year.',
            'PPF is ideal for risk-averse investors, those in high tax brackets (tax-free 7.1% is equivalent to ~10.2% pre-tax at 30% bracket), and for the debt portion of your long-term portfolio. It is best used alongside equity investments for diversification.',
          ],
          takeaway: 'Max out your PPF every year if you are in the 20–30% tax bracket. Tax-free 7.1% is excellent risk-free return. Start a PPF account for your children too.',
          relatedTerms: ['PPF', 'ELSS', 'NPS', 'Debt Fund'],
        },
      },
      {
        id: 'inst-2',
        title: 'NPS — National Pension System',
        duration: '8 min',
        difficulty: 'Intermediate',
        content: {
          paragraphs: [
            'NPS is a market-linked retirement savings scheme regulated by PFRDA. Subscribers choose their allocation between equity (E — up to 75%), corporate bonds (C), government securities (G), and alternative assets (A). Two types of accounts: Tier 1 (mandatory, tax-deductible, locked till 60) and Tier 2 (optional, no tax benefits, fully liquid).',
            'NPS offers two unique tax benefits: ₹1.5L deduction under 80CCD(1) within the 80C limit, PLUS an additional ₹50,000 deduction under 80CCD(1B) over and above 80C. This extra ₹50,000 deduction is exclusive to NPS and can save up to ₹15,600 in tax for those at the 30% bracket.',
            'At retirement (age 60), you must use 40% of the corpus to purchase an annuity (monthly pension). The remaining 60% can be withdrawn tax-free in a lump sum. The annuity income is taxed as regular income. NPS is best suited for long-term retirement savings, not short-term goals.',
          ],
          takeaway: 'Invest ₹50,000/year in NPS Tier 1 specifically for the additional 80CCD(1B) tax benefit. Choose Aggressive LC-75 fund if you are below 45.',
          relatedTerms: ['NPS', 'PPF', 'ELSS', 'LTCG'],
        },
      },
      {
        id: 'inst-3', title: 'Sovereign Gold Bonds (SGBs)', duration: '7 min', difficulty: 'Intermediate', comingSoon: true,
      },
      {
        id: 'inst-4', title: 'REITs and InvITs', duration: '9 min', difficulty: 'Advanced', comingSoon: true,
      },
      {
        id: 'inst-5', title: 'Fixed Deposits — When They Make Sense', duration: '5 min', difficulty: 'Beginner', comingSoon: true,
      },
      {
        id: 'inst-6', title: 'RBI Retail Direct — Government Bonds', duration: '7 min', difficulty: 'Intermediate', comingSoon: true,
      },
      {
        id: 'inst-7', title: 'EPF — Make the Most of It', duration: '6 min', difficulty: 'Beginner', comingSoon: true,
      },
      {
        id: 'inst-8', title: 'Post Office Savings Schemes', duration: '5 min', difficulty: 'Beginner', comingSoon: true,
      },
    ],
  },
};

// ─── Difficulty Badge ─────────────────────────────────────────────────────────

function DifficultyBadge({ difficulty }: { difficulty: Lesson['difficulty'] }) {
  const map = {
    Beginner:     'bg-green-100 text-green-700',
    Intermediate: 'bg-amber-100 text-amber-700',
    Advanced:     'bg-red-100 text-red-700',
  };
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${map[difficulty]}`}>
      {difficulty}
    </span>
  );
}

// ─── Lesson Card ─────────────────────────────────────────────────────────────

function LessonCard({
  lesson,
  index,
  completed,
  onToggleComplete,
}: {
  lesson: Lesson;
  index: number;
  completed: boolean;
  onToggleComplete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  if (lesson.comingSoon) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-border/50 p-4 flex items-center gap-4">
        <div className="w-8 h-8 rounded-xl bg-border flex items-center justify-center text-foreground-muted text-sm font-bold shrink-0">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground-muted">{lesson.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <Clock className="w-3 h-3 text-foreground-muted" />
            <span className="text-xs text-foreground-muted">{lesson.duration}</span>
            <DifficultyBadge difficulty={lesson.difficulty} />
          </div>
        </div>
        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-border text-foreground-muted shrink-0">
          Coming Soon
        </span>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border transition-all ${open ? 'border-[#3C3489]/30 shadow-sm shadow-black/5' : 'border-border'} bg-background-card overflow-hidden`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 p-4 text-left"
      >
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 transition-colors ${completed ? 'bg-green-100 text-green-700' : 'bg-[#3C3489]/10 text-[#3C3489]'}`}>
          {completed ? <CheckCircle className="w-4.5 h-4.5" size={18} /> : index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${completed ? 'text-foreground-muted line-through' : 'text-foreground'}`}>
            {lesson.title}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Clock className="w-3 h-3 text-foreground-muted" />
            <span className="text-xs text-foreground-muted">{lesson.duration}</span>
            <DifficultyBadge difficulty={lesson.difficulty} />
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-foreground-muted shrink-0" /> : <ChevronDown className="w-4 h-4 text-foreground-muted shrink-0" />}
      </button>

      {open && lesson.content && (
        <div className="px-4 pb-5 border-t border-gray-50">
          <div className="pt-4 space-y-3">
            {lesson.content.paragraphs.map((p, i) => (
              <p key={i} className="text-sm text-foreground-muted leading-relaxed">{p}</p>
            ))}
          </div>

          {/* Key Takeaway */}
          <div className="mt-5 rounded-xl p-4" style={{ background: 'linear-gradient(135deg, #3C3489/10, #5048a8/10)', backgroundColor: 'rgba(60,52,137,0.07)' }}>
            <p className="text-xs font-bold text-[#3C3489] uppercase tracking-wide mb-1">Key Takeaway</p>
            <p className="text-sm font-medium text-[#3C3489]/90 leading-relaxed">{lesson.content.takeaway}</p>
          </div>

          {/* Related Terms */}
          {lesson.content.relatedTerms.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-foreground-muted font-medium mb-2">Related Terms</p>
              <div className="flex flex-wrap gap-2">
                {lesson.content.relatedTerms.map(term => (
                  <span key={term} className="px-2.5 py-1 rounded-lg bg-border text-foreground-muted text-xs font-medium">
                    {term}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Mark Complete */}
          <button
            onClick={() => onToggleComplete(lesson.id)}
            className={`mt-5 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              completed
                ? 'bg-green-100 text-green-700 hover:bg-red-50 hover:text-red-600'
                : 'bg-[#3C3489] text-white hover:bg-[#2d2871]'
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            {completed ? 'Mark as Incomplete' : 'Mark as Complete'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'completed_lessons';

export default function CategoryPage() {
  const params = useParams();
  const router = useRouter();
  const categoryId = Array.isArray(params.category) ? params.category[0] : params.category;

  const [completedIds, setCompletedIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setCompletedIds(JSON.parse(stored) as string[]);
    } catch { /* ignore */ }
  }, []);

  const category = categoryId ? CATEGORIES[categoryId] : undefined;

  if (!category) {
    return (
      <div className="text-center py-20">
        <p className="text-foreground-muted text-sm">Category not found.</p>
        <button onClick={() => router.push('/learn')} className="mt-4 text-[#3C3489] text-sm font-medium hover:underline">
          Back to Learn Hub
        </button>
      </div>
    );
  }

  const availableLessons = category.lessons.filter(l => !l.comingSoon);
  const completedInCategory = availableLessons.filter(l => completedIds.includes(l.id)).length;
  const progressPct = availableLessons.length > 0 ? (completedInCategory / availableLessons.length) * 100 : 0;

  function toggleComplete(lessonId: string) {
    setCompletedIds(prev => {
      const next = prev.includes(lessonId)
        ? prev.filter(id => id !== lessonId)
        : [...prev, lessonId];
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Back */}
      <button
        onClick={() => router.push('/learn')}
        className="flex items-center gap-2 text-sm text-foreground-muted hover:text-[#3C3489] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Learn Hub
      </button>

      {/* Header */}
      <div className={`rounded-2xl border p-6 ${category.color}`}>
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-background-card/60 flex items-center justify-center text-3xl shrink-0 shadow-sm shadow-black/5">
            {category.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className={`text-xl font-bold ${category.textColor}`}>{category.label}</h1>
            <p className="text-sm text-foreground-muted mt-1 leading-relaxed">{category.description}</p>
            <div className="flex items-center gap-3 mt-3 text-xs text-foreground-muted">
              <span className="flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5" /> {category.lessons.length} lessons
              </span>
              <span className="flex items-center gap-1">
                <BarChart className="w-3.5 h-3.5" /> {completedInCategory} completed
              </span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        {availableLessons.length > 0 && (
          <div className="mt-5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-foreground-muted">
                {completedInCategory} of {availableLessons.length} lessons completed
              </span>
              <span className={`text-xs font-bold ${category.textColor}`}>{Math.round(progressPct)}%</span>
            </div>
            <div className="h-2 bg-background-card/50 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%`, background: 'rgba(60,52,137,0.7)' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Lessons */}
      <div className="space-y-3">
        {category.lessons.map((lesson, i) => (
          <LessonCard
            key={lesson.id}
            lesson={lesson}
            index={i}
            completed={completedIds.includes(lesson.id)}
            onToggleComplete={toggleComplete}
          />
        ))}
      </div>
    </div>
  );
}
