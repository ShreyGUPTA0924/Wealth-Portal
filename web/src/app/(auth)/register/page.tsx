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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputClass =
  'block w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 ' +
  'placeholder-gray-400 bg-white transition-colors ' +
  'focus:outline-none focus:ring-2 focus:ring-[#3C3489]/30 focus:border-[#3C3489]';

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
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 px-8 py-10">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
          <p className="text-sm text-gray-500 mt-1">
            Start managing all your investments in one place
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Full Name */}
          <FormInput label="Full name" error={errors.fullName?.message}>
            <input
              {...register('fullName')}
              type="text"
              placeholder="Arjun Sharma"
              autoComplete="name"
              className={inputClass}
            />
          </FormInput>

          {/* Email */}
          <FormInput label="Email address" error={errors.email?.message}>
            <input
              {...register('email')}
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              className={inputClass}
            />
          </FormInput>

          {/* Password */}
          <FormInput label="Password" error={errors.password?.message}>
            <div className="relative">
              <input
                {...register('password')}
                type={showPassword ? 'text' : 'password'}
                placeholder="Min. 8 characters"
                autoComplete="new-password"
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

            {/* Strength bar */}
            {passwordValue.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="flex gap-1">
                  {strengthLevels.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-all duration-200 ${
                        i < pwStrength ? strength.color : 'bg-gray-200'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-gray-400">{strength.label}</p>
              </div>
            )}
          </FormInput>

          {/* Confirm Password */}
          <FormInput label="Confirm password" error={errors.confirmPassword?.message}>
            <div className="relative">
              <input
                {...register('confirmPassword')}
                type={showConfirm ? 'text' : 'password'}
                placeholder="Re-enter password"
                autoComplete="new-password"
                className={`${inputClass} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </FormInput>

          {apiError && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
              {apiError}
            </p>
          )}

          {/* Terms */}
          <p className="text-xs text-gray-400 leading-relaxed">
            By creating an account you agree to our{' '}
            <a href="#" className="text-[#3C3489] hover:underline">Terms of Service</a>
            {' '}and{' '}
            <a href="#" className="text-[#3C3489] hover:underline">Privacy Policy</a>.
          </p>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white
                       bg-[#3C3489] hover:bg-[#2d2871] active:scale-[0.98]
                       disabled:opacity-60 disabled:cursor-not-allowed
                       transition-all duration-150 flex items-center justify-center gap-2"
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

      <p className="text-center text-sm text-gray-500 mt-6">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-[#3C3489] hover:text-[#2d2871] transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  );
}
