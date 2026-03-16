import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import type { User } from '@/types/auth.types';

// ─── Server-safe localStorage ─────────────────────────────────────────────────
// The factory is called lazily on hydration (client only), so this is SSR-safe.
const safeLocalStorage: StateStorage = {
  getItem: (name) => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(name);
  },
  setItem: (name, value) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(name, value);
  },
  removeItem: (name) => {
    if (typeof window !== 'undefined') window.localStorage.removeItem(name);
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  /** True once the store has re-hydrated from localStorage */
  _hasHydrated: boolean;

  setUser: (user: User) => void;
  updateUser: (patch: Partial<User>) => void;
  clearUser: () => void;
  setHasHydrated: (v: boolean) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      _hasHydrated: false,

      setUser: (user: User) => set({ user, isAuthenticated: true }),

      updateUser: (patch: Partial<User>) => {
        const current = get().user;
        if (current) set({ user: { ...current, ...patch } });
      },

      clearUser: () => set({ user: null, isAuthenticated: false }),

      setHasHydrated: (v: boolean) => set({ _hasHydrated: v }),
    }),
    {
      name: 'wealth-portal-auth',
      // createJSONStorage wraps the raw key-value store so Zustand gets
      // serialised/deserialised objects rather than raw JSON strings.
      storage: createJSONStorage(() => safeLocalStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
