import { keepPreviousData, useQuery, type UseQueryResult } from "@tanstack/react-query";

/**
 * Raw-fetch + retry/backoff query hook for the trade pages' hand-rolled error
 * banners. Uses `fetch` directly (not `apiGet`) so the thrown message embeds
 * the url + status for display — `apiGet`'s generic message would lose that
 * detail. Tolerates the ~1s window during desktop-shell startup where uvicorn
 * isn't bound yet, so the first paint self-heals without a reload.
 *
 * `key` often embeds live filter state (e.g. `trades-page-0-ownerA-`), so a
 * filter change is a brand-new query key. `keepPreviousData` holds the last
 * result (and keeps `isLoading` false) while the new key fetches, so callers
 * gating their whole page on `isLoading` don't unmount on every filter tick —
 * a page reacting to a *static* key never had a "previous" query, so this is a
 * no-op for those callers.
 */
export function useJson<T>(key: string, url: string): UseQueryResult<T, Error> {
  return useQuery<T>({
    queryKey: [key],
    queryFn: async () => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`${url} → ${r.status}`);
      return r.json() as Promise<T>;
    },
    staleTime: 30_000,
    retry: 6,
    retryDelay: (n) => Math.min(1000 * 2 ** n, 5000),
    placeholderData: keepPreviousData,
  });
}
