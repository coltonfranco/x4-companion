import { useQuery, type UseQueryResult } from "@tanstack/react-query";

/**
 * Raw-fetch + retry/backoff query hook for the trade pages' hand-rolled error
 * banners. Uses `fetch` directly (not `apiGet`) so the thrown message embeds
 * the url + status for display — `apiGet`'s generic message would lose that
 * detail. Tolerates the ~1s window during desktop-shell startup where uvicorn
 * isn't bound yet, so the first paint self-heals without a reload.
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
  });
}
