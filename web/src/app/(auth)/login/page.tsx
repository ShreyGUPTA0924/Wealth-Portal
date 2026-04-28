'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';
import apiClient, { getErrorMessage } from '@/lib/api-client';
import { useAuthStore } from '@/store/authStore';
import type { LoginPayload } from '@/types/auth.types';
import type { AuthPayload } from '@/types/auth.types';

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

const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';

export default function LoginPage() {
  const router = useRouter();
  const { setUser, isAuthenticated, user } = useAuthStore();

  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [needsTwoFa, setNeedsTwoFa] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [pendingPassword, setPendingPassword] = useState('');

  const handleGoogleSuccess = async (accessToken: string) => {
    setApiError('');
    setIsGoogleLoading(true);
    try {
      const res = await apiClient.post<{ success: boolean; data: AuthPayload }>(
        '/api/auth/google',
        { accessToken }
      );
      setUser(res.data.data.user);
      router.push(res.data.data.user.onboardingCompleted ? '/dashboard' : '/onboarding');
    } catch (err) {
      setApiError(getErrorMessage(err));
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const googleLogin = useGoogleLogin({
    onSuccess: (tokenResponse) => handleGoogleSuccess(tokenResponse.access_token),
    onError: () => setApiError('Google sign-in failed. Please try again.'),
  });

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.replace(user?.onboardingCompleted ? '/dashboard' : '/onboarding');
    }
  }, [isAuthenticated, user, router]);

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
        router.push(data.user.onboardingCompleted ? '/dashboard' : '/onboarding');
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
        router.push(data.user.onboardingCompleted ? '/dashboard' : '/onboarding');
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

        {/* ── Google Sign-In ── */}
        {!needsTwoFa && googleClientId && (
          <>
            <button
              type="button"
              onClick={() => googleLogin()}
              disabled={isGoogleLoading || isLoading}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl
                         border border-gray-300 bg-white text-sm font-medium text-gray-700
                         hover:bg-gray-50 active:scale-[0.98] transition-all duration-150
                         disabled:opacity-60 disabled:cursor-not-allowed mb-5"
            >
              {isGoogleLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              Continue with Google
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400 font-medium">or sign in with email</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
          </>
        )}

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
