import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../api/client';

interface State<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
}

/**
 * Minimal data-fetching hook (what TanStack Query would give us, reduced to the
 * essentials we actually need): loading / error / data + a manual refetch.
 *
 *   const { data, loading, error, refetch } = useApi(() => listingsApi.mine(), []);
 *
 * It also ignores responses that arrive after the component re-fetched or unmounted
 * (race condition: an old slow request must not overwrite newer data).
 */
export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<State<T>>({ data: undefined, error: null, loading: true });
  const requestId = useRef(0);

  const run = useCallback(fetcher, deps);

  const refetch = useCallback(async () => {
    const id = ++requestId.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await run();
      if (id === requestId.current) setState({ data, error: null, loading: false });
    } catch (err) {
      if (id === requestId.current) setState((s) => ({ ...s, error: errorMessage(err), loading: false }));
    }
  }, [run]);

  useEffect(() => {
    refetch();
    return () => {
      requestId.current++; // invalidate in-flight request on unmount / deps change
    };
  }, [refetch]);

  return { ...state, refetch };
}
