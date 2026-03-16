'use client';

import Link from 'next/link';
import { Briefcase, Target, Bot, TrendingUp } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

export default function DashboardPage() {
  const { user } = useAuthStore();

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-xl font-bold text-gray-900">
          Welcome back, {user?.fullName?.split(' ')[0] ?? 'there'} 👋
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Your financial dashboard is coming soon. Start by managing your portfolio.
        </p>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Portfolio',  href: '/portfolio',  icon: Briefcase,  desc: 'View & manage holdings',    color: 'bg-[#3C3489]' },
          { label: 'Goals',      href: '/goals',      icon: Target,     desc: 'Track financial goals',     color: 'bg-emerald-500' },
          { label: 'AI Advisor', href: '/ai-advisor', icon: Bot,        desc: 'Get AI-powered insights',   color: 'bg-purple-500' },
          { label: 'Markets',    href: '/portfolio',  icon: TrendingUp, desc: 'Live NSE / crypto prices',  color: 'bg-blue-500' },
        ].map(({ label, href, icon: Icon, desc, color }) => (
          <Link
            key={label}
            href={href}
            className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-sm hover:border-gray-200 transition-all group"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color} text-white shrink-0`}>
              <Icon size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 group-hover:text-[#3C3489] transition-colors">{label}</p>
              <p className="text-xs text-gray-400">{desc}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">
        <p className="text-sm">Full dashboard with charts and insights — coming in the next step.</p>
      </div>
    </div>
  );
}
