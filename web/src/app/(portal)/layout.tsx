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
  { label: 'Reports',     href: '/reports',    icon: FileBarChart2 },
];

const BOTTOM_NAV_ITEMS = [
  { label: 'Settings', href: '/settings', icon: Settings },
];

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
    <aside className="flex flex-col h-full bg-background-card border-r border-border w-64 shrink-0 transition-colors duration-300">
      {/* Logo */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow bg-premium-gradient"
          >
            W
          </div>
          <span className="text-lg font-semibold text-foreground tracking-tight">
            Wealth<span className="text-[#6366f1]">Portal</span>
          </span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-foreground-muted hover:text-foreground lg:hidden">
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
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                          transition-all duration-150 group
                          ${active
                            ? 'bg-[#6366f1]/10 text-[#6366f1] dark:bg-[#6366f1]/20 dark:text-[#818cf8]'
                            : 'text-foreground-muted hover:bg-border hover:text-foreground'
                          }`}
            >
              <Icon
                className={`w-4.5 h-4.5 shrink-0 ${active ? 'text-[#6366f1] dark:text-[#818cf8]' : 'text-foreground-muted group-hover:text-foreground'}`}
                size={18}
              />
              {label}
              {active && <ChevronRight className="w-3.5 h-3.5 ml-auto text-[#6366f1] dark:text-[#818cf8]" />}
            </Link>
          );
        })}
      </nav>

      {/* Bottom nav (Settings) */}
      <div className="px-3 pb-2 border-t border-border pt-3">
        {BOTTOM_NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                          transition-all duration-150 group
                          ${active
                            ? 'bg-[#6366f1]/10 text-[#6366f1] dark:bg-[#6366f1]/20 dark:text-[#818cf8]'
                            : 'text-foreground-muted hover:bg-border hover:text-foreground'
                          }`}
            >
              <Icon
                className={`w-4.5 h-4.5 shrink-0 ${active ? 'text-[#6366f1] dark:text-[#818cf8]' : 'text-foreground-muted group-hover:text-foreground'}`}
                size={18}
              />
              {label}
              {active && <ChevronRight className="w-3.5 h-3.5 ml-auto text-[#6366f1] dark:text-[#818cf8]" />}
            </Link>
          );
        })}
      </div>

      {/* User + Logout */}
      <div className="px-3 pb-4 pt-2 border-t border-border">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-border transition-colors">
          <div className="w-8 h-8 rounded-full bg-premium-gradient flex items-center justify-center text-white text-xs font-bold shrink-0">
            {user?.fullName?.charAt(0)?.toUpperCase() ?? 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{user?.fullName ?? 'User'}</p>
            <p className="text-xs text-foreground-muted truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-foreground-muted hover:text-red-500 transition-colors shrink-0"
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

  // Derive page title from path
  const title = (() => {
    for (const item of NAV_ITEMS) {
      if (pathname === item.href || pathname.startsWith(item.href + '/')) return item.label;
    }
    return 'WealthPortal';
  })();

  return (
    <header className="sticky top-0 z-30 h-16 bg-background-card/70 backdrop-blur-xl border-b border-border shadow-sm shadow-black/5 flex items-center justify-between px-4 lg:px-6 shrink-0 transition-all duration-300">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden text-foreground-muted hover:text-foreground transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold text-foreground">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle />
        <button className="relative w-9 h-9 flex items-center justify-center rounded-xl text-foreground-muted hover:bg-border transition-colors">
          <Bell className="w-4.5 h-4.5" size={18} />
          <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full" />
        </button>
        <div className="w-9 h-9 rounded-full bg-premium-gradient flex items-center justify-center text-white text-xs font-bold shadow-md shadow-brand/20">
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
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative z-50">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 relative overflow-y-auto bg-background">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />
        <main className="max-w-[1400px] mx-auto p-4 lg:p-8 lg:pt-10 min-h-[calc(100vh-4rem)]">
          {children}
        </main>
      </div>
    </div>
  );
}
