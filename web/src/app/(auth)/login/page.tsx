'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import apiClient, { getErrorMessage } from '@/lib/api-client';
import { useAuthStore } from '@/store/authStore';
import type { LoginPayload } from '@/types/auth.types';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

const totpSchema = z.object({
  totpCode: z.string().length(6, 'Enter the 6-digit code from your authenticator app'),
});

type LoginForm = z.infer<typeof loginSchema>;
type TotpForm = z.infer<typeof totpSchema>;

// ─── Input Component ──────────────────────────────────────────────────────────

function FormInput({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

const inputClass =
  'block w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 ' +
  'placeholder-gray-400 bg-white transition-colors ' +
  'focus:outline-none focus:ring-2 focus:ring-[#3C3489]/30 focus:border-[#3C3489]';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const { setUser, isAuthenticated } = useAuthStore();

  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [needsTwoFa, setNeedsTwoFa] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [pendingPassword, setPendingPassword] = useState('');

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) router.replace('/dashboard');
  }, [isAuthenticated, router]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const {
    register: registerTotp,
    handleSubmit: handleTotpSubmit,
    formState: { errors: totpErrors },
  } = useForm<TotpForm>({ resolver: zodResolver(totpSchema) });

  // ── Step 1: email + password ──────────────────────────────────────────────
  const onLogin = async (values: LoginForm) => {
    setApiError('');
    setIsLoading(true);
    try {
      const res = await apiClient.post<{ success: boolean; data: LoginPayload }>(
        '/api/auth/login',
        values
      );
      const { data } = res.data;

      if (data.requiresTwoFa) {
        setPendingEmail(values.email);
        setPendingPassword(values.password);
        setNeedsTwoFa(true);
      } else if (data.user) {
        setUser(data.user);
        router.push('/dashboard');
      }
    } catch (err) {
      setApiError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  // ── Step 2: TOTP code ─────────────────────────────────────────────────────
  const onTotpVerify = async (values: TotpForm) => {
    setApiError('');
    setIsLoading(true);
    try {
      const res = await apiClient.post<{ success: boolean; data: LoginPayload }>(
        '/api/auth/login',
        { email: pendingEmail, password: pendingPassword, totpCode: values.totpCode }
      );
      const { data } = res.data;
      if (data.user) {
        setUser(data.user);
        router.push('/dashboard');
      }
    } catch (err) {
      setApiError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 px-8 py-10">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            {needsTwoFa ? 'Two-factor authentication' : 'Welcome back'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {needsTwoFa
              ? 'Enter the 6-digit code from your authenticator app'
              : 'Sign in to your WealthPortal account'}
          </p>
        </div>

        {/* ── 2FA code form ── */}
        {needsTwoFa ? (
          <form onSubmit={handleTotpSubmit(onTotpVerify)} className="space-y-5">
            <div className="flex items-center justify-center w-14 h-14 bg-[#ede9f5] rounded-2xl mx-auto mb-4">
              <ShieldCheck className="w-7 h-7 text-[#3C3489]" />
            </div>

            <FormInput label="Authenticator code" error={totpErrors.totpCode?.message}>
              <input
                {...registerTotp('totpCode')}
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                className={`${inputClass} tracking-[0.4em] text-center`}
                autoFocus
              />
            </FormInput>

            {apiError && (
              <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
                {apiError}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white
                         bg-[#3C3489] hover:bg-[#2d2871] active:scale-[0.98]
                         disabled:opacity-60 disabled:cursor-not-allowed
                         transition-all duration-150 flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Verify & Sign In
            </button>

            <button
              type="button"
              onClick={() => { setNeedsTwoFa(false); setApiError(''); }}
              className="w-full text-sm text-gray-500 hover:text-[#3C3489] transition-colors"
            >
              ← Back to login
            </button>
          </form>
        ) : (

          /* ── Email + password form ── */
          <form onSubmit={handleSubmit(onLogin)} className="space-y-5">
            <FormInput label="Email address" error={errors.email?.message}>
              <input
                {...register('email')}
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                className={inputClass}
              />
            </FormInput>

            <FormInput label="Password" error={errors.password?.message}>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className={`${inputClass} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </FormInput>

            {apiError && (
              <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
                {apiError}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white
                         bg-[#3C3489] hover:bg-[#2d2871] active:scale-[0.98]
                         disabled:opacity-60 disabled:cursor-not-allowed
                         transition-all duration-150 flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Sign in
            </button>
          </form>
        )}
      </div>

      {/* Sign-up link */}
      {!needsTwoFa && (
        <p className="text-center text-sm text-gray-500 mt-6">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-medium text-[#3C3489] hover:text-[#2d2871] transition-colors">
            Create one free
          </Link>
        </p>
      )}
    </div>
  );
}
