'use client';

import React, { useState, useEffect } from 'react';
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
    <div className="space-y-1">
      <div className="relative group">
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
      <div className="bg-background-card rounded-2xl shadow-xl border border-border px-8 py-10">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">
            {needsTwoFa ? 'Two-factor authentication' : 'Welcome back'}
          </h1>
          <p className="text-sm text-foreground-muted mt-1">
            {needsTwoFa
              ? 'Enter the 6-digit code from your authenticator app'
              : 'Sign in to your WealthPortal account'}
          </p>
        </div>

        {/* ── 2FA code form ── */}
        {needsTwoFa ? (
          <form onSubmit={handleTotpSubmit(onTotpVerify)} className="space-y-5">
            <div className="flex items-center justify-center w-14 h-14 bg-[#6366f1]/10 rounded-2xl mx-auto mb-4">
              <ShieldCheck className="w-7 h-7 text-[#6366f1]" />
            </div>

            <FloatingInput
              label="Authenticator code"
              error={totpErrors.totpCode?.message}
              {...registerTotp('totpCode')}
              type="text"
              inputMode="numeric"
              maxLength={6}
              className="tracking-[0.4em] text-center"
              autoFocus
            />

            {apiError && (
              <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">
                {apiError}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl text-sm font-bold text-white
                         bg-premium-gradient shadow-md shadow-[#6366f1]/20 hover:shadow-lg hover:-translate-y-0.5 active:scale-95
                         disabled:opacity-60 disabled:cursor-not-allowed
                         transition-all duration-300 flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Verify & Sign In
            </button>

            <button
              type="button"
              onClick={() => { setNeedsTwoFa(false); setApiError(''); }}
              className="w-full text-sm text-foreground-muted hover:text-[#6366f1] transition-colors"
            >
              ← Back to login
            </button>
          </form>
        ) : (

          /* ── Email + password form ── */
          <form onSubmit={handleSubmit(onLogin)} className="space-y-5">
            <FloatingInput
              label="Email address"
              error={errors.email?.message}
              {...register('email')}
              type="email"
              autoComplete="email"
            />

            <FloatingInput
              label="Password"
              error={errors.password?.message}
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="text-foreground-muted hover:text-foreground transition-colors p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />

            {apiError && (
              <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">
                {apiError}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl text-sm font-bold text-white
                         bg-premium-gradient shadow-md shadow-[#6366f1]/20 hover:shadow-lg hover:-translate-y-0.5 active:scale-95
                         disabled:opacity-60 disabled:cursor-not-allowed
                         transition-all duration-300 flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Sign in
            </button>
          </form>
        )}
      </div>

      {/* Sign-up link */}
      {!needsTwoFa && (
        <p className="text-center text-sm text-foreground-muted mt-6">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-semibold text-[#6366f1] hover:text-[#818cf8] transition-colors">
            Create one free
          </Link>
        </p>
      )}
    </div>
  );
}
