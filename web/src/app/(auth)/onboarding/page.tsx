'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ChevronRight, ChevronLeft, Check, X, Building2, TrendingUp } from 'lucide-react';
import apiClient, { getErrorMessage } from '@/lib/api-client';
import { useAuthStore } from '@/store/authStore';

// ─── Step metadata ────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, title: 'Your Profile' },
  { id: 2, title: 'Risk Profile' },
  { id: 3, title: 'Broker' },
  { id: 4, title: 'First Goal' },
  { id: 5, title: 'Family' },
] as const;

// ─── Risk quiz ────────────────────────────────────────────────────────────────

const QUIZ = [
  {
    q: 'What is your investment time horizon?',
    options: ['Less than 1 year', '1–3 years', '3–7 years', 'More than 7 years'],
  },
  {
    q: 'If your portfolio dropped 20% in a month, you would…',
    options: [
      'Sell everything immediately',
      'Sell some to reduce exposure',
      'Hold and wait for recovery',
      'Buy more at the lower price',
    ],
  },
  {
    q: 'What is your primary investment goal?',
    options: [
      'Capital preservation (safety first)',
      'Regular steady income',
      'Balanced growth and income',
      'Maximum long-term wealth growth',
    ],
  },
  {
    q: 'What percentage of monthly income can you invest?',
    options: ['Less than 5%', '5–10%', '10–20%', 'More than 20%'],
  },
  {
    q: 'How would you describe your investing experience?',
    options: [
      'None — complete beginner',
      'Some knowledge, limited experience',
      'Experienced investor',
      'Professional / expert',
    ],
  },
];

function calcRiskProfile(answers: number[]): {
  score: number;
  profile: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
  label: string;
  description: string;
} {
  const score = answers.reduce((s, a) => s + (a + 1), 0); // 1-4 per question → 5-20 total
  if (score <= 9)
    return {
      score,
      profile: 'CONSERVATIVE',
      label: 'Conservative',
      description: 'You prefer capital safety over high returns. Suited to FDs, debt funds, and bonds.',
    };
  if (score <= 14)
    return {
      score,
      profile: 'MODERATE',
      label: 'Moderate',
      description: 'You balance growth and stability. A mix of equity, debt, and hybrid funds works well.',
    };
  return {
    score,
    profile: 'AGGRESSIVE',
    label: 'Aggressive',
    description:
      'You seek maximum growth and can handle volatility. Direct equities and equity mutual funds suit you.',
  };
}

const GOAL_CATEGORIES = [
  { value: 'RETIREMENT', label: '🧓 Retirement', desc: 'Long-term financial independence' },
  { value: 'HOUSE', label: '🏠 Home', desc: 'Buy your dream home' },
  { value: 'EDUCATION', label: '🎓 Education', desc: 'Fund education expenses' },
  { value: 'TRAVEL', label: '✈️ Travel', desc: 'Plan your dream trip' },
  { value: 'EMERGENCY', label: '🛡️ Emergency Fund', desc: 'Build a financial safety net' },
  { value: 'WEDDING', label: '💍 Wedding', desc: 'Plan your special day' },
  { value: 'CUSTOM', label: '⭐ Custom', desc: 'Define your own goal' },
];

const RELATIONSHIPS = ['SPOUSE', 'CHILD', 'PARENT', 'OTHER'];

import React from 'react';
import { MotionWrapper, MotionItem } from '@/components/ui/MotionWrapper';

// ─── Reusable styled input ────────────────────────────────────────────────────

const FloatingInput = React.forwardRef<
  HTMLInputElement,
  {
    label: string;
    error?: string;
    rightElement?: React.ReactNode;
  } & React.InputHTMLAttributes<HTMLInputElement>
>(({ label, error, rightElement, id, className, ...props }, ref) => {
  const inputId = id || label.replace(/\s+/g, '-').toLowerCase();
  
  return (
    <div className="space-y-1 w-full">
      <div className="relative group w-full">
        <input
          ref={ref}
          id={inputId}
          placeholder=" "
          className={`peer block w-full px-4 pt-5 pb-2 border border-border rounded-xl text-sm text-foreground placeholder-transparent bg-background-card/60 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:border-[#6366f1] focus:ring-0 focus:shadow-[0_0_20px_rgba(99,102,241,0.2)] hover:border-foreground-muted ${className || ''}`}
          {...props}
        />
        <label
          htmlFor={inputId}
          className="absolute left-4 top-3.5 text-sm font-medium text-foreground-muted transition-all duration-300 pointer-events-none peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:text-[#6366f1] peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-[10px]"
        >
          {label}
        </label>
        {rightElement && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
            {rightElement}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-500 pl-1">{error}</p>}
    </div>
  );
});
FloatingInput.displayName = 'FloatingInput';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const { user, updateUser } = useAuthStore();

  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [apiError, setApiError] = useState('');

  // ── Step 1 data
  const [profile, setProfile] = useState({
    fullName: user?.fullName ?? '',
    dateOfBirth: '',
    city: '',
  });

  // ── Step 2 data
  const [quizAnswers, setQuizAnswers] = useState<number[]>(Array(5).fill(-1));
  const [quizResult, setQuizResult] = useState<ReturnType<typeof calcRiskProfile> | null>(null);

  // ── Step 3 data
  const [broker, setBroker] = useState<string | null>(null);

  // ── Step 4 data
  const [goal, setGoal] = useState({
    name: '',
    category: '',
    targetAmount: '',
    targetDate: '',
  });

  // ── Step 5 data
  const [familyMembers, setFamilyMembers] = useState<
    Array<{ name: string; relationship: string }>
  >([]);
  const [newMember, setNewMember] = useState({ name: '', relationship: 'SPOUSE' });

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const next = () => { setApiError(''); setStep((s) => Math.min(s + 1, 5)); };
  const back = () => { setApiError(''); setStep((s) => Math.max(s - 1, 1)); };

  // Save step data to API (graceful — failing doesn't block UX)
  const saveToApi = async (endpoint: string, data: object) => {
    try {
      await apiClient.patch(endpoint, data);
    } catch {
      // Silent — step progression still allowed; user can fix later in settings
    }
  };

  // ── Step 1 save ──────────────────────────────────────────────────────────
  const saveProfile = async () => {
    if (!profile.fullName.trim()) { setApiError('Full name is required'); return; }
    setIsSaving(true);
    await saveToApi('/api/users/me', {
      fullName: profile.fullName,
      dateOfBirth: profile.dateOfBirth || undefined,
      city: profile.city || undefined,
    });
    setIsSaving(false);
    next();
  };

  // ── Step 2 save ──────────────────────────────────────────────────────────
  const saveRisk = async () => {
    if (quizAnswers.includes(-1)) { setApiError('Please answer all 5 questions'); return; }
    const result = calcRiskProfile(quizAnswers);
    setQuizResult(result);
    setIsSaving(true);
    await saveToApi('/api/users/me', { riskProfile: result.profile, riskScore: result.score });
    if (user) updateUser({ riskProfile: result.profile, riskScore: result.score });
    setIsSaving(false);
    next();
  };

  // ── Step 4 save ──────────────────────────────────────────────────────────
  const saveGoal = async () => {
    if (!goal.name || !goal.category || !goal.targetAmount || !goal.targetDate) {
      setApiError('Please fill in all goal fields');
      return;
    }
    setIsSaving(true);
    const portfolios = await apiClient.get('/api/portfolio').catch(() => null);
    const portfolioId = portfolios?.data?.data?.portfolios?.[0]?.id;
    if (portfolioId) {
      await saveToApi('/api/goals', {
        portfolioId,
        name: goal.name,
        category: goal.category,
        targetAmount: parseFloat(goal.targetAmount),
        targetDate: new Date(goal.targetDate).toISOString(),
      });
    }
    setIsSaving(false);
    next();
  };

  // ── Final save ───────────────────────────────────────────────────────────
  const completeOnboarding = async () => {
    setIsSaving(true);
    // Add family members if any
    for (const m of familyMembers) {
      await saveToApi('/api/family', { fullName: m.name, relationship: m.relationship });
    }
    await saveToApi('/api/users/me', { onboardingCompleted: true, onboardingStep: 5 });
    if (user) updateUser({ onboardingCompleted: true });
    setIsSaving(false);
    router.push('/dashboard');
  };

  // ─── Progress bar ──────────────────────────────────────────────────────────

  const ProgressBar = () => (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step > s.id
                  ? 'bg-premium-gradient text-white shadow-md shadow-[#6366f1]/20'
                  : step === s.id
                  ? 'bg-premium-gradient text-white ring-4 ring-[#6366f1]/20 shadow-md shadow-[#6366f1]/20'
                  : 'bg-border text-foreground-muted'
              }`}
            >
              {step > s.id ? <Check className="w-4 h-4" /> : s.id}
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`h-0.5 w-8 sm:w-12 mx-1 transition-all ${
                  step > s.id ? 'bg-[#6366f1]' : 'bg-border'
                }`}
              />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[11px] text-gray-400">
        {STEPS.map((s) => (
          <span
            key={s.id}
            className={`w-8 text-center ${step === s.id ? 'text-[#6366f1] font-medium' : ''}`}
          >
            {s.title}
          </span>
        ))}
      </div>
    </div>
  );

  // ─── Navigation footer ────────────────────────────────────────────────────

  const NavButtons = ({
    onNext,
    skipLabel,
    onSkip,
    nextLabel = 'Continue',
  }: {
    onNext: () => void;
    skipLabel?: string;
    onSkip?: () => void;
    nextLabel?: string;
  }) => (
    <div className="mt-8 space-y-3">
      {apiError && (
        <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
          {apiError}
        </p>
      )}
      <div className="flex gap-3">
        {step > 1 && (
          <button
            type="button"
            onClick={back}
            className="flex items-center gap-1 px-4 py-2.5 rounded-xl text-sm font-medium
                       text-foreground-muted bg-border hover:bg-border/80 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
        )}
        <button
          type="button"
          onClick={onNext}
          disabled={isSaving}
          className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-white
                     bg-gradient-stripe shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-95
                     disabled:opacity-60 disabled:cursor-not-allowed
                     transition-all duration-300 flex items-center justify-center gap-2"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {nextLabel}
          {!isSaving && <ChevronRight className="w-4 h-4" />}
        </button>
      </div>
      {skipLabel && onSkip && (
        <button
          type="button"
          onClick={() => { setApiError(''); onSkip(); }}
          className="w-full text-sm text-foreground-muted hover:text-[#6366f1] transition-colors py-1"
        >
          {skipLabel}
        </button>
      )}
    </div>
  );

  // ─── Render steps ──────────────────────────────────────────────────────────

  const renderStep = () => {
    switch (step) {

      // ── Step 1: Profile ──────────────────────────────────────────────────
      case 1:
        return (
          <MotionWrapper key="step-1" className="w-full">
            <MotionItem>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-foreground">Tell us about yourself</h2>
                <p className="text-sm text-foreground-muted mt-1">This helps personalise your experience</p>
              </div>
              <div className="space-y-4">
                <FloatingInput
                  label="Full name *"
                  type="text"
                  value={profile.fullName}
                  onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                  placeholder="Arjun Sharma"
                />
                
                <FloatingInput
                  label="Date of birth"
                  type="date"
                  value={profile.dateOfBirth}
                  onChange={(e) => setProfile({ ...profile, dateOfBirth: e.target.value })}
                  max={new Date().toISOString().split('T')[0]}
                  className="pt-6 pb-1"
                />
                
                <FloatingInput
                  label="City"
                  type="text"
                  value={profile.city}
                  onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                  placeholder="Mumbai, Delhi, Bangalore…"
                />
              </div>
              <NavButtons onNext={saveProfile} />
            </MotionItem>
          </MotionWrapper>
        );

      // ── Step 2: Risk quiz ────────────────────────────────────────────────
      case 2:
        return (
          <MotionWrapper key="step-2" className="w-full">
            <MotionItem>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-foreground">Your risk profile</h2>
                <p className="text-sm text-foreground-muted mt-1">
                  Answer 5 quick questions — we&apos;ll suggest the right asset mix for you
                </p>
              </div>

              {quizResult ? (
                /* Result card */
                <MotionItem>
                  <div className="bg-[#6366f1]/10 rounded-2xl p-6 text-center border border-[#6366f1]/20">
                    <div className="text-4xl mb-2">
                      {quizResult.profile === 'CONSERVATIVE' ? '🛡️' : quizResult.profile === 'MODERATE' ? '⚖️' : '🚀'}
                    </div>
                    <h3 className="text-xl font-bold text-[#6366f1]">{quizResult.label} investor</h3>
                    <p className="text-sm text-foreground-muted mt-2 leading-relaxed">{quizResult.description}</p>
                    <p className="text-xs text-foreground-muted mt-3">Risk score: {quizResult.score} / 20</p>
                    <button
                      onClick={() => setQuizResult(null)}
                      className="mt-4 text-xs text-[#6366f1] hover:text-[#818cf8]"
                    >
                      Retake quiz
                    </button>
                  </div>
                </MotionItem>
              ) : (
                /* Quiz questions */
                <div className="space-y-6">
                  {QUIZ.map((q, qi) => (
                    <div key={qi}>
                      <p className="text-sm font-medium text-foreground mb-2.5">
                        <span className="text-transparent bg-clip-text bg-premium-gradient font-bold mr-1">Q{qi + 1}.</span>
                        {q.q}
                      </p>
                      <div className="space-y-2">
                        {q.options.map((opt, oi) => (
                          <button
                            key={oi}
                            type="button"
                            onClick={() => {
                              const ans = [...quizAnswers];
                              ans[qi] = oi;
                              setQuizAnswers(ans);
                            }}
                            className={`w-full text-left px-4 py-2.5 rounded-xl text-sm border transition-all ${
                              quizAnswers[qi] === oi
                                ? 'bg-[#6366f1] text-white border-[#6366f1] shadow-md shadow-[#6366f1]/20'
                                : 'bg-background-card text-foreground border-border hover:border-[#6366f1]/40 hover:bg-border/50'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <NavButtons
                onNext={quizResult ? next : saveRisk}
                nextLabel={quizResult ? 'Continue' : 'Calculate my risk profile'}
              />
            </MotionItem>
          </MotionWrapper>
        );

      // ── Step 3: Connect broker ───────────────────────────────────────────
      case 3:
        return (
          <MotionWrapper key="step-3" className="w-full">
            <MotionItem>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-foreground">Connect your broker</h2>
                <p className="text-sm text-foreground-muted mt-1">
                  Auto-import your holdings — or add them manually later
                </p>
              </div>

              <div className="space-y-3">
                {[
                  { id: 'ZERODHA', name: 'Zerodha', desc: 'India\'s largest broker', color: '#387ed1' },
                  { id: 'UPSTOX', name: 'Upstox', desc: 'Fast & modern trading', color: '#7b2ff7' },
                ].map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBroker(b.id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
                      broker === b.id
                        ? 'border-[#6366f1] bg-[#6366f1]/10'
                        : 'border-border bg-background-card hover:border-[#6366f1]/40'
                    }`}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: b.color }}
                    >
                      {b.name[0]}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-foreground">{b.name}</p>
                      <p className="text-xs text-foreground-muted">{b.desc}</p>
                    </div>
                    {broker === b.id && <Check className="w-5 h-5 text-[#6366f1] ml-auto" />}
                  </button>
                ))}

                <div className="flex items-center gap-3 py-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-foreground-muted">or</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <button
                  type="button"
                  onClick={() => setBroker('MANUAL')}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
                    broker === 'MANUAL'
                      ? 'border-[#6366f1] bg-[#6366f1]/10'
                      : 'border-dashed border-border hover:border-foreground-muted'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-border flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-foreground-muted" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-foreground">Add manually</p>
                    <p className="text-xs text-foreground-muted">Enter holdings yourself</p>
                  </div>
                  {broker === 'MANUAL' && <Check className="w-5 h-5 text-[#6366f1] ml-auto" />}
                </button>
              </div>

              <NavButtons
                onNext={() => { setApiError(''); next(); }}
                skipLabel="Skip — I'll connect later"
                onSkip={next}
              />
            </MotionItem>
          </MotionWrapper>
        );

      // ── Step 4: First goal ───────────────────────────────────────────────
      case 4:
        return (
          <MotionWrapper key="step-4" className="w-full">
            <MotionItem>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-foreground">Set your first goal</h2>
                <p className="text-sm text-foreground-muted mt-1">
                  Goals keep you motivated and help us track your progress
                </p>
              </div>

              <div className="space-y-4">
                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-foreground-muted mb-2">Goal type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {GOAL_CATEGORIES.map((cat) => (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => setGoal({ ...goal, category: cat.value, name: cat.label.split(' ').slice(1).join(' ') })}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          goal.category === cat.value
                            ? 'border-[#6366f1] bg-[#6366f1]/10'
                            : 'border-border bg-background-card hover:border-[#6366f1]/40 hover:bg-border/50'
                        }`}
                      >
                        <p className="text-base">{cat.label.split(' ')[0]}</p>
                        <p className="text-xs font-medium text-foreground mt-0.5">
                          {cat.label.split(' ').slice(1).join(' ')}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name */}
                <FloatingInput
                  label="Goal name"
                  type="text"
                  value={goal.name}
                  onChange={(e) => setGoal({ ...goal, name: e.target.value })}
                  placeholder="e.g. Retirement corpus"
                />

                {/* Amount */}
                <FloatingInput
                  label="Target amount (₹)"
                  type="number"
                  value={goal.targetAmount}
                  onChange={(e) => setGoal({ ...goal, targetAmount: e.target.value })}
                  placeholder="5000000"
                  min="1"
                />

                {/* Date */}
                <FloatingInput
                  label="Target date"
                  type="date"
                  value={goal.targetDate}
                  onChange={(e) => setGoal({ ...goal, targetDate: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  className="pt-6 pb-1"
                />
              </div>

              <NavButtons
                onNext={saveGoal}
                skipLabel="Skip — I'll add goals later"
                onSkip={next}
              />
            </MotionItem>
          </MotionWrapper>
        );

      // ── Step 5: Family ───────────────────────────────────────────────────
      case 5:
        return (
          <MotionWrapper key="step-5" className="w-full">
            <MotionItem>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-foreground">Add family members</h2>
                <p className="text-sm text-foreground-muted mt-1">
                  Manage your family&apos;s finances together in one place
                </p>
              </div>

              {/* Added members list */}
              {familyMembers.length > 0 && (
                <div className="mb-4 space-y-2">
                  {familyMembers.map((m, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-4 py-3 bg-border rounded-xl"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">{m.name}</p>
                        <p className="text-xs text-foreground-muted capitalize">{m.relationship.toLowerCase()}</p>
                      </div>
                      <button
                        onClick={() => setFamilyMembers((prev) => prev.filter((_, j) => j !== i))}
                        className="text-foreground-muted hover:text-red-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add member form */}
              <div className="space-y-3 bg-background-card rounded-2xl p-4 border border-border">
                <p className="text-xs font-semibold text-foreground-muted uppercase tracking-wide px-1">
                  Add a member
                </p>
                
                <FloatingInput
                  label="Full name"
                  type="text"
                  value={newMember.name}
                  onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                  placeholder="Full name"
                />
                
                <div className="relative">
                  <select
                    value={newMember.relationship}
                    onChange={(e) => setNewMember({ ...newMember, relationship: e.target.value })}
                    className="block w-full px-4 py-3 border border-border rounded-xl text-sm text-foreground bg-background-card/60 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:border-[#6366f1] focus:ring-0 hover:border-foreground-muted appearance-none"
                  >
                    {RELATIONSHIPS.map((r) => (
                      <option key={r} value={r}>
                        {r.charAt(0) + r.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                </div>
                
                <button
                  type="button"
                  onClick={() => {
                    if (!newMember.name.trim()) return;
                    setFamilyMembers((prev) => [...prev, { ...newMember }]);
                    setNewMember({ name: '', relationship: 'SPOUSE' });
                  }}
                  disabled={!newMember.name.trim()}
                  className="w-full py-2 px-4 rounded-xl text-sm font-medium
                             text-[#6366f1] border-2 border-[#6366f1] hover:bg-[#6366f1]/10
                             disabled:opacity-40 disabled:cursor-not-allowed transition-colors mt-2"
                >
                  + Add member
                </button>
              </div>

              <NavButtons
                onNext={completeOnboarding}
                nextLabel="Complete setup"
                skipLabel="Skip — I'll add family later"
                onSkip={completeOnboarding}
              />
            </MotionItem>
          </MotionWrapper>
        );

      default:
        return null;
    }
  };

  // ─── Layout ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-lg">
      <div className="bg-background-card rounded-2xl shadow-xl border border-border px-8 py-10 overflow-hidden relative">
        {/* Step header */}
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-4 h-4 text-[#6366f1]" />
          <span className="text-xs font-semibold text-[#6366f1] uppercase tracking-wide">
            Step {step} of {STEPS.length}
          </span>
        </div>

        <ProgressBar />

        {renderStep()}
      </div>

      {/* Skip all */}
      <p className="text-center text-xs text-foreground-muted mt-4">
        <button
          onClick={() => router.push('/dashboard')}
          className="hover:text-[#6366f1] transition-colors"
        >
          Skip onboarding → Go to dashboard
        </button>
      </p>
    </div>
  );
}
