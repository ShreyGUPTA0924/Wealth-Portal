import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'WealthPortal — Sign In' };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── Top branding bar ── */}
      <header className="flex justify-center pt-10 pb-2">
        <div className="flex items-center gap-2.5">
          {/* Logo mark */}
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md"
            style={{ background: 'linear-gradient(135deg, #3C3489 0%, #5048a8 100%)' }}
          >
            W
          </div>
          <span className="text-xl font-semibold text-gray-900 tracking-tight">
            Wealth<span className="text-[#3C3489]">Portal</span>
          </span>
        </div>
      </header>

      {/* ── Page content ── */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        {children}
      </main>

      {/* ── Footer ── */}
      <footer className="text-center pb-6 text-xs text-gray-400">
        © {new Date().getFullYear()} WealthPortal · India-First Wealth Management ·{' '}
        <a href="#" className="hover:text-[#3C3489] transition-colors">Privacy</a>
        {' · '}
        <a href="#" className="hover:text-[#3C3489] transition-colors">Terms</a>
      </footer>
    </div>
  );
}
