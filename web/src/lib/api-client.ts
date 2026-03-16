import axios, { AxiosError } from 'axios';

const apiClient = axios.create({
  baseURL: process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:5000',
  withCredentials: true, // send httpOnly JWT cookies automatically
  headers: { 'Content-Type': 'application/json' },
});

// ─── Silent token refresh on 401 ─────────────────────────────────────────────
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as typeof error.config & { _retry?: boolean };

    if (error.response?.status === 401 && original && !original._retry) {
      if (isRefreshing) {
        // Queue concurrent requests until refresh completes
        return new Promise((resolve) => {
          refreshQueue.push(() => resolve(apiClient(original)));
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        await apiClient.post('/api/auth/refresh');
        refreshQueue.forEach((cb) => cb(''));
        refreshQueue = [];
        return apiClient(original);
      } catch {
        refreshQueue = [];
        // Refresh failed — boot to login
        if (typeof window !== 'undefined') window.location.href = '/login';
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

/** Extract a user-friendly message from any caught error */
export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as Record<string, string> | undefined;
    return data?.['error'] ?? data?.['message'] ?? err.message ?? 'Something went wrong';
  }
  if (err instanceof Error) return err.message;
  return 'Something went wrong';
}

export default apiClient;
