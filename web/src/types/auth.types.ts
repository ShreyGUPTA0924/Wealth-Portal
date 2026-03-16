export interface User {
  id: string;
  email: string;
  fullName: string;
  dateOfBirth: string | null;
  city: string | null;
  riskProfile: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
  riskScore: number;
  avatarUrl: string | null;
  onboardingCompleted: boolean;
  onboardingStep: number;
  twoFaEnabled: boolean;
  createdAt: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error?: string;
  message?: string;
  errors?: Record<string, unknown[]>;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface AuthPayload {
  user: User;
}

export interface LoginPayload {
  user?: User;
  requiresTwoFa?: boolean;
}

export interface RegisterDto {
  email: string;
  password: string;
  fullName: string;
}

export interface LoginDto {
  email: string;
  password: string;
  totpCode?: string;
}
