import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'WealthWise — Sign In' };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-background">
      {/* ── Left Branding Section ── */}
      <div className="hidden lg:flex w-1/2 relative bg-premium-gradient flex-col justify-between p-12 overflow-hidden">
        {/* Abstract Background Elements */}
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1633158829585-23ba8f7c8caf?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-overlay"></div>
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-24 -right-24 w-[30rem] h-[30rem] bg-[#ec4899]/20 rounded-full blur-3xl"></div>
        
        {/* Brand */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg bg-white/20 backdrop-blur-md border border-white/30">
            W
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">
            WealthWise
          </span>
        </div>

        {/* Copy */}
        <div className="relative z-10 space-y-6 max-w-lg">
          <h1 className="text-4xl lg:text-5xl font-bold text-white leading-tight">
            Take control of your <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-amber-400">financial future.</span>
          </h1>
          <p className="text-lg text-white/80">
            Track stocks, mutual funds, gold, crypto, and all your investments in one unified platform with AI-powered insights tailored for Indian investors.
          </p>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-white/60 text-sm">
          © {new Date().getFullYear()} WealthWise. All rights reserved.
        </div>
      </div>

      {/* ── Right Content Section ── */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 relative overflow-hidden">
        {/* Mobile Header */}
        <div className="lg:hidden absolute top-8 left-8 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold bg-premium-gradient shadow-md">
            W
          </div>
          <span className="text-xl font-bold text-foreground tracking-tight">
            WealthWise
          </span>
        </div>
        
        {children}
      </div>
    </div>
  );
}
