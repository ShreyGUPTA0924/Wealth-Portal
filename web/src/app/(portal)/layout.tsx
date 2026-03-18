'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Briefcase,
  Target,
  Bot,
  Users,
  BookOpen,
  FileBarChart2,
  Bell,
  ChevronRight,
  Menu,
  X,
  LogOut,
  Settings,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: 'Dashboard',   href: '/dashboard',  icon: LayoutDashboard },
  { label: 'Portfolio',   href: '/portfolio',  icon: Briefcase },
  { label: 'Goals',       href: '/goals',      icon: Target },
  { label: 'AI Advisor',  href: '/advisor',    icon: Bot },
  { label: 'Family',      href: '/family',     icon: Users },
  { label: 'Learn',       href: '/learn',      icon: BookOpen },
  { label: 'Reminders',   href: '/reminders',  icon: Bell },
  { label: 'Reports',     href: '/reports',    icon: FileBarChart2 },
];

const BOTTOM_NAV_ITEMS = [
  { label: 'Settings', href: '/settings', icon: Settings },
];

// ─── Mobile Nav (Joby-style full-screen) ──────────────────────────────────────

function MobileNavOverlay({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, clearUser } = useAuthStore();

  const handleLogout = () => {
    clearUser();
    onClose();
    router.push('/login');
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 lg:hidden">
      <header className="flex items-center justify-between px-6 py-5">
        <button onClick={onClose} className="flex items-center gap-2 text-white/90 hover:text-white transition-colors">
          <div className="w-9 h-9 rounded-xl border-2 border-white/40 flex items-center justify-center bg-white/5">
            <X className="w-5 h-5" />
          </div>
          <span className="text-sm font-semibold">Close</span>
        </button>
        <Link href="/dashboard" onClick={onClose} className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold text-base ring-2 ring-white/30">
            W
          </div>
          <span className="text-lg font-bold text-white">WealthPortal</span>
        </Link>
        <Link href="/reports" onClick={onClose} className="flex items-center gap-1.5 text-white/90 hover:text-white text-sm font-semibold">
          Reports <ChevronRight className="w-4 h-4 -rotate-90" />
        </Link>
      </header>

      <div className="flex-1 flex flex-col md:flex-row px-6 pb-16 overflow-auto">
        <div className="flex flex-col gap-6 py-6 md:py-16 md:w-1/3 order-2 md:order-1">
          <div className="flex flex-col gap-3">
            <Link href="/settings" onClick={onClose} className="text-white/80 hover:text-white text-sm font-medium transition-colors">
              Settings
            </Link>
            <button onClick={handleLogout} className="text-left text-white/80 hover:text-white text-sm font-medium transition-colors">
              Sign out
            </button>
          </div>
          <div className="pt-4 border-t border-white/20">
            <p className="text-xs text-white/60 mb-1">{user?.fullName ?? 'User'}</p>
            <p className="text-xs text-white/50 truncate max-w-[200px]">{user?.email}</p>
          </div>
        </div>
        <nav className="flex-1 flex flex-col justify-center md:justify-center md:items-end gap-2 py-8 md:py-0 order-1 md:order-2">
          {NAV_ITEMS.map(({ label, href }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={`text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight transition-colors leading-tight
                  ${active ? 'text-white' : 'text-white/75 hover:text-white'}`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, clearUser } = useAuthStore();

  const handleLogout = () => {
    clearUser();
    router.push('/login');
  };

  return (
    <aside className="flex flex-col h-full w-64 shrink-0 m-3 rounded-2xl overflow-hidden
      bg-white/80 dark:bg-[#161618]/95 backdrop-blur-2xl
      border border-black/5 dark:border-white/[0.08]
      shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_16px_48px_-12px_rgba(0,0,0,0.15)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_16px_48px_-12px_rgba(0,0,0,0.5)]
      transition-all duration-300">
      {/* Logo — visible in light & dark */}
      <div className="flex items-center justify-between px-5 py-5 bg-gradient-to-b from-indigo-500/5 to-transparent dark:from-indigo-500/10 dark:to-transparent border-b border-black/5 dark:border-white/5">
        <Link href="/dashboard" onClick={onClose} className="flex items-center gap-3 group">
          <div className="nav-logo-icon w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base ring-2 ring-white/30 dark:ring-white/20 group-hover:scale-105 transition-transform">
            W
          </div>
          <span className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">
            Wealth<span className="nav-logo-accent">Portal</span>
          </span>
        </Link>
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-2.5 rounded-xl text-foreground-muted hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-all">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`relative flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold
                transition-all duration-200 group
                ${active
                  ? 'bg-gradient-to-r from-indigo-500/15 to-violet-500/10 dark:from-indigo-500/25 dark:to-violet-500/15 text-indigo-600 dark:text-indigo-300 shadow-sm'
                  : 'text-foreground-muted hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground'
                }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 rounded-r-full bg-gradient-to-b from-indigo-500 to-violet-500" />
              )}
              <span className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 transition-colors ${active ? 'bg-indigo-500/20 dark:bg-indigo-500/30' : 'bg-black/5 dark:bg-white/5 group-hover:bg-black/10 dark:group-hover:bg-white/10'}`}>
                <Icon className={`w-5 h-5 ${active ? 'text-indigo-600 dark:text-indigo-400' : 'text-foreground-muted group-hover:text-foreground'}`} />
              </span>
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="w-4 h-4 text-indigo-500/80" />}
            </Link>
          );
        })}
      </nav>

      {/* Settings */}
      <div className="px-3 pb-3 border-t border-black/5 dark:border-white/5 pt-3">
        {BOTTOM_NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`relative flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 group
                ${active ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400' : 'text-foreground-muted hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground'}`}
            >
              {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 rounded-r-full bg-gradient-to-b from-indigo-500 to-violet-500" />}
              <span className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${active ? 'bg-indigo-500/20' : 'bg-black/5 dark:bg-white/5 group-hover:bg-black/10 dark:group-hover:bg-white/10'}`}>
                <Icon className={`w-5 h-5 ${active ? 'text-indigo-600 dark:text-indigo-400' : 'text-foreground-muted group-hover:text-foreground'}`} />
              </span>
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="w-4 h-4 text-indigo-500/80" />}
            </Link>
          );
        })}
      </div>

      {/* User card */}
      <div className="px-3 pb-5 pt-3 border-t border-black/5 dark:border-white/5">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-500/10 to-violet-500/5 dark:from-indigo-500/15 dark:to-violet-500/10 border border-indigo-500/10 dark:border-indigo-500/20 hover:from-indigo-500/15 hover:to-violet-500/10 transition-all duration-200">
          <div className="nav-logo-icon w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0 ring-2 ring-white/30 dark:ring-white/20">
            {user?.fullName?.charAt(0)?.toUpperCase() ?? 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user?.fullName ?? 'User'}</p>
            <p className="text-xs text-gray-600 dark:text-gray-300 truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg text-foreground-muted hover:text-red-500 hover:bg-red-500/10 transition-all shrink-0"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

// ─── Top Bar ─────────────────────────────────────────────────────────────────

import { ThemeToggle } from '@/components/ui/ThemeToggle';

function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const { user } = useAuthStore();
  const pathname = usePathname();

  const title = (() => {
    for (const item of NAV_ITEMS) {
      if (pathname === item.href || pathname.startsWith(item.href + '/')) return item.label;
    }
    return 'WealthPortal';
  })();

  return (
    <header className="sticky top-0 z-30 h-16 shrink-0 flex items-center justify-between px-4 lg:px-8
      bg-white/70 dark:bg-[#0c0c0e]/90 backdrop-blur-2xl
      border-b border-black/5 dark:border-white/5
      shadow-[0_1px_0_0_rgba(0,0,0,0.03)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.04)]
      transition-all duration-300">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2.5 rounded-xl text-foreground-muted hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-all"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold tracking-tight nav-logo-text">
          <span className="nav-logo-accent">{title}</span>
        </h1>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <button className="relative w-10 h-10 flex items-center justify-center rounded-xl text-foreground-muted hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-all">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-[#0c0c0e]" />
        </button>
        <div className="nav-logo-icon w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0 ring-2 ring-white/30 dark:ring-white/20">
          {user?.fullName?.charAt(0)?.toUpperCase() ?? 'U'}
        </div>
      </div>
    </header>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router          = useRouter();
  const { isAuthenticated, _hasHydrated } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (_hasHydrated && !isAuthenticated) {
      router.replace('/login');
    }
  }, [_hasHydrated, isAuthenticated, router]);

  if (!_hasHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-border/50">
        <div className="w-8 h-8 border-2 border-[#3C3489] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8f9fa] dark:bg-[#050506]">
      {/* Desktop sidebar — floating glass panel */}
      <div className="hidden lg:flex shrink-0 pt-4 pl-4 pb-4">
        <Sidebar />
      </div>

      {/* Mobile nav — Joby-style full-screen */}
      {sidebarOpen && <MobileNavOverlay onClose={() => setSidebarOpen(false)} />}

      {/* Main content */}
      <div className="flex-1 relative overflow-y-auto bg-background min-w-0">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />
        <main className="max-w-[1400px] mx-auto p-4 lg:p-8 lg:pt-10 min-h-[calc(100vh-4rem)]">
          {children}
        </main>
      </div>
    </div>
  );
}
