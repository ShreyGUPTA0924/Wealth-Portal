'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Mail, RefreshCw } from 'lucide-react';
import apiClient, { getErrorMessage } from '@/lib/api-client';
import { useAuthStore } from '@/store/authStore';

const OTP_LENGTH = 6;
const RESEND_COUNTDOWN = 60;

export default function VerifyPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [apiError, setApiError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState('');
  const [countdown, setCountdown] = useState(RESEND_COUNTDOWN);
  const [canResend, setCanResend] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>(Array(OTP_LENGTH).fill(null));

  // Start countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          setCanResend(true);
          clearInterval(timer);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const focusInput = (index: number) => {
    inputRefs.current[index]?.focus();
  };

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // digits only

    const newDigits = [...digits];
    newDigits[index] = value.slice(-1); // keep last typed char
    setDigits(newDigits);
    setApiError('');

    if (value && index < OTP_LENGTH - 1) focusInput(index + 1);

    // Auto-submit when all filled
    const code = newDigits.join('');
    if (code.length === OTP_LENGTH && !newDigits.includes('')) {
      verifyOtp(code);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        const newDigits = [...digits];
        newDigits[index] = '';
        setDigits(newDigits);
      } else if (index > 0) {
        focusInput(index - 1);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      focusInput(index - 1);
    } else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      focusInput(index + 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    const newDigits = [...digits];
    pasted.split('').forEach((ch, i) => { newDigits[i] = ch; });
    setDigits(newDigits);
    focusInput(Math.min(pasted.length, OTP_LENGTH - 1));
    if (pasted.length === OTP_LENGTH) verifyOtp(pasted);
  };

  const verifyOtp = useCallback(async (code: string) => {
    setApiError('');
    setIsLoading(true);
    try {
      await apiClient.post('/api/auth/verify-otp', { otp: code, email: user?.email });
      router.push('/onboarding');
    } catch (err) {
      setApiError(getErrorMessage(err));
      setDigits(Array(OTP_LENGTH).fill(''));
      setTimeout(() => focusInput(0), 50);
    } finally {
      setIsLoading(false);
    }
  }, [router, user?.email]);

  const handleResend = async () => {
    if (!canResend || isResending) return;
    setIsResending(true);
    setResendSuccess('');
    setApiError('');
    try {
      await apiClient.post('/api/auth/resend-otp', { email: user?.email });
      setResendSuccess('A new code has been sent to your email.');
      setCountdown(RESEND_COUNTDOWN);
      setCanResend(false);
      // Restart countdown
      const timer = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) { setCanResend(true); clearInterval(timer); return 0; }
          return c - 1;
        });
      }, 1000);
    } catch (err) {
      setApiError(getErrorMessage(err));
    } finally {
      setIsResending(false);
    }
  };

  const otp = digits.join('');
  const isFilled = otp.length === OTP_LENGTH && !digits.includes('');

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 px-8 py-10">

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-[#ede9f5] rounded-2xl flex items-center justify-center">
            <Mail className="w-8 h-8 text-[#3C3489]" />
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Check your email</h1>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            We&apos;ve sent a 6-digit verification code to{' '}
            <span className="font-medium text-gray-700">{user?.email ?? 'your email'}</span>
          </p>
        </div>

        {/* OTP boxes */}
        <div className="flex gap-2 justify-center mb-6" onPaste={handlePaste}>
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onFocus={(e) => e.target.select()}
              placeholder="·"
              className="otp-input"
              disabled={isLoading}
              autoFocus={i === 0}
            />
          ))}
        </div>

        {/* Errors / success */}
        {apiError && (
          <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 mb-4 text-center">
            {apiError}
          </p>
        )}
        {resendSuccess && (
          <p className="text-sm text-green-600 bg-green-50 border border-green-100 rounded-xl px-4 py-2.5 mb-4 text-center">
            {resendSuccess}
          </p>
        )}

        {/* Verify button */}
        <button
          onClick={() => verifyOtp(otp)}
          disabled={!isFilled || isLoading}
          className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white
                     bg-[#3C3489] hover:bg-[#2d2871] active:scale-[0.98]
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-all duration-150 flex items-center justify-center gap-2"
        >
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          Verify email
        </button>

        {/* Resend */}
        <div className="mt-5 text-center">
          {canResend ? (
            <button
              onClick={handleResend}
              disabled={isResending}
              className="text-sm font-medium text-[#3C3489] hover:text-[#2d2871] transition-colors
                         flex items-center gap-1.5 mx-auto"
            >
              {isResending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Resend code
            </button>
          ) : (
            <p className="text-sm text-gray-400">
              Resend code in{' '}
              <span className="font-medium text-gray-600 tabular-nums">{countdown}s</span>
            </p>
          )}
        </div>

        {/* Skip for now */}
        <div className="mt-4 pt-4 border-t border-gray-100 text-center">
          <button
            onClick={() => router.push('/onboarding')}
            className="text-sm text-gray-400 hover:text-[#3C3489] transition-colors"
          >
            Skip for now → Continue to setup
          </button>
        </div>
      </div>
    </div>
  );
}
