import axios, { AxiosError } from 'axios';

// One configured axios instance for the whole app.
export const api = axios.create({
  baseURL: '/api', // same origin: Vite proxies it in dev
  withCredentials: true, // send the httpOnly auth cookie
  timeout: 15_000,
});

// Every error the UI sees has this single shape, whatever went wrong
// (validation, 409 conflict, server down...). Components never dig into axios internals.
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fieldErrors: Record<string, string[]> = {},
  ) {
    super(message);
  }
}

interface ErrorBody {
  error?: { code?: string; message?: string; details?: Record<string, string[]> };
}

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ErrorBody>) => {
    if (!error.response) {
      return Promise.reject(new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Is the API running?'));
    }
    const body = error.response.data?.error;
    return Promise.reject(
      new ApiError(
        error.response.status,
        body?.code ?? 'UNKNOWN',
        body?.message ?? 'Something went wrong',
        body?.details ?? {},
      ),
    );
  },
);

/** Turn anything thrown into a user-friendly message. */
export function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Something went wrong';
}
