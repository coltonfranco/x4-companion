import { useMemo } from "react";

// Licences held by ≤2 factions are treated as "global use" — you just need the
// licence type from any faction, not from the specific owner.
export function useGlobalLicences<T extends { restriction_licence?: string | null; owner_factions?: string[] }>(
  items: T[]
): Set<string> {
  return useMemo(() => {
    const count = new Map<string, Set<string>>();
    for (const item of items) {
      const lic = item.restriction_licence;
      if (lic && lic !== "generaluseship" && lic !== "generaluseequipment") {
        for (const fid of item.owner_factions || []) {
          if (!count.has(lic)) count.set(lic, new Set());
          count.get(lic)!.add(fid);
        }
      }
    }
    return new Set([...count].filter(([, fids]) => fids.size <= 2).map(([lic]) => lic));
  }, [items]);
}
