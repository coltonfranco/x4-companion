import { useQuery } from "@tanstack/react-query";

import { apiGet } from "./api";
import type { FactionLicence } from "./types";

/** The full licence catalogue (or one faction's slice) — static game data, so it's
 *  cached far longer than anything save-derived. */
export function useFactionLicences(factionId?: string) {
  return useQuery<FactionLicence[]>({
    queryKey: factionId ? ["faction-licences", factionId] : ["faction-licences", "all"],
    queryFn: () =>
      apiGet<FactionLicence[]>(factionId ? `/api/v1/licences?faction_id=${factionId}` : "/api/v1/licences"),
    staleTime: 300_000,
  });
}
