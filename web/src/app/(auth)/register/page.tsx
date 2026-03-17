'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, Check } from 'lucide-react';
import apiClient, { getErrorMessage } from '@/lib/api-client';
import { useAuthStore } from '@/store/authStore';
import type { AuthPayload } from '@/types/auth.types';

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z
  .object({
    fullName: z
      .string()
      .min(2, 'Full name must be at least 2 characters')
      .max(100, 'Name is too long'),
    email: z.string().email('Enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Include at least one uppercase letter')
      .regex(/[0-9]/, 'Include at least one number'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type RegisterForm = z.infer<typeof schema>;

import React from 'react';

// ─── Input Component ──────────────────────────────────────────────────────────

const FloatingInput = React.forwardRef<
  HTMLInputElement,
  {
    label: string;
    error?: string;
    rightElement?: React.ReactNode;
    children?: React.ReactNode;
  } & React.InputHTMLAttributes<HTMLInputElement>
>(({ label, error, rightElement, children, id, className, ...props }, ref) => {
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
      {children}
      {error && <p className="text-xs text-red-500 pl-1">{error}</p>}
    </div>
  );
});
FloatingInput.displayName = 'FloatingInput';

const strengthLevels = [
  { label: 'Very weak', color: 'bg-red-400' },
  { label: 'Weak', color: 'bg-orange-400' },
  { label: 'Fair', color: 'bg-yellow-400' },
  { label: 'Good', color: 'bg-blue-400' },
  { label: 'Strong', color: 'bg-green-500' },
];

function passwordStrength(pw: string): number {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (pw.length >= 12) score++;
  return score;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const router = useRouter();
  const { setUser, isAuthenticated } = useAuthStore();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [apiError, setApiError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pwStrength, setPwStrength] = useState(0);

  useEffect(() => {
    if (isAuthenticated) router.replace('/dashboard');
  }, [isAuthenticated, router]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>({ resolver: zodResolver(schema) });

  const passwordValue = watch('password', '');

  useEffect(() => {
    setPwStrength(passwordStrength(passwordValue));
  }, [passwordValue]);

  const onSubmit = async (values: RegisterForm) => {
    setApiError('');
    setIsLoading(true);
    try {
      const res = await apiClient.post<{ success: boolean; data: AuthPayload }>(
        '/api/auth/register',
        {
          email: values.email,
          password: values.password,
          fullName: values.fullName,
        }
      );
      setUser(res.data.data.user);
      // Redirect to onboarding — email OTP will be layered in later
      router.push('/onboarding');
    } catch (err) {
      setApiError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const strength = strengthLevels[pwStrength] ?? strengthLevels[0];

  return (
    <div className="w-full max-w-md">
      <div className="bg-background-card rounded-2xl shadow-xl border border-border px-8 py-10">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">Create your account</h1>
          <p className="text-sm text-foreground-muted mt-1">
            Start managing all your investments in one place
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Full Name */}
          <FloatingInput
            label="Full name"
            error={errors.fullName?.message}
            {...register('fullName')}
            type="text"
            autoComplete="name"
          />

          {/* Email */}
          <FloatingInput
            label="Email address"
            error={errors.email?.message}
            {...register('email')}
            type="email"
            autoComplete="email"
          />

          {/* Password */}
          <FloatingInput
            label="Password"
            error={errors.password?.message}
            {...register('password')}
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            rightElement={
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="text-foreground-muted hover:text-foreground transition-colors p-1"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
          >
            {/* Strength bar */}
            {passwordValue.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="flex gap-1">
                  {strengthLevels.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-all duration-200 ${
                        i < pwStrength ? strength.color : 'bg-border'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-[10px] text-foreground-muted pt-1 pl-1">{strength.label}</p>
              </div>
            )}
          </FloatingInput>

          {/* Confirm Password */}
          <FloatingInput
            label="Confirm password"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
            type={showConfirm ? 'text' : 'password'}
            autoComplete="new-password"
            rightElement={
              <button
                type="button"
                onClick={() => setShowConfirm((p) => !p)}
                className="text-foreground-muted hover:text-foreground transition-colors p-1"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
          />

          {apiError && (
            <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">
              {apiError}
            </p>
          )}

          {/* Terms */}
          <p className="text-[11px] text-foreground-muted leading-relaxed text-center px-2">
            By creating an account you agree to our{' '}
            <a href="#" className="text-[#6366f1] hover:underline">Terms of Service</a>
            {' '}and{' '}
            <a href="#" className="text-[#6366f1] hover:underline">Privacy Policy</a>.
          </p>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-xl text-sm font-bold text-white
                       bg-premium-gradient shadow-md shadow-[#6366f1]/20 hover:shadow-lg hover:-translate-y-0.5 active:scale-95
                       disabled:opacity-60 disabled:cursor-not-allowed
                       transition-all duration-300 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Create account
          </button>
        </form>
      </div>

      <p className="text-center text-sm text-foreground-muted mt-6">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-[#6366f1] hover:text-[#818cf8] transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  );
}
