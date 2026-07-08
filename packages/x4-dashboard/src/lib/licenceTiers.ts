import type { FactionLicence } from "./types";

export type LicenceTier = {
  /** Precursor licence_type gating this tier, or "__base__" for the ungated tier. */
  key: string;
  label: string;
  minRelation: number | null;
  items: FactionLicence[];
};

export type LicenceGrouping = {
  tiers: LicenceTier[];
  /** Licences with no relation requirement — one-off contracts (Envoy, Hyperion, etc.)
   *  rather than part of the standard access ladder. */
  other: FactionLicence[];
};

// Ceremony-style licences (e.g. "Friend of the Federation") act as gates for the next
// access tier rather than purchasable items themselves, so their own display name
// becomes that tier's header. A faction occasionally doesn't bother naming its own
// ceremony licence in game data even though items gated behind it are named — fall
// back to a generic label in that case.
const GATE_LABEL_FALLBACK: Record<string, string> = {
  ceremonyfriend: "Friend Tier",
  ceremonyally: "Ally Tier",
};

/**
 * Groups a faction's licence catalogue into relation-gated tiers plus a flat "other"
 * bucket, mirroring the game's own Licences screen: licences with no precursor form
 * the base "General Access" tier; anything gated behind a ceremony licence is nested
 * under that ceremony's own name; licences with no relation requirement are ungated
 * specials. Rows the game data gives no display name for are inherited placeholders
 * this faction doesn't actually offer, so they're dropped.
 */
export function groupFactionLicences(licences: FactionLicence[]): LicenceGrouping {
  const named = licences.filter((l): l is FactionLicence & { name: string } => !!l.name);
  const byType = new Map(named.map((l) => [l.licence_type, l]));
  const gateTypes = new Set(named.map((l) => l.precursor).filter((p): p is string => !!p));

  const other = named.filter((l) => l.min_relation == null);
  const tiered = named.filter((l) => l.min_relation != null && !gateTypes.has(l.licence_type));

  const groups = new Map<string, FactionLicence[]>();
  for (const l of tiered) {
    const key = l.precursor ?? "__base__";
    const bucket = groups.get(key);
    if (bucket) bucket.push(l);
    else groups.set(key, [l]);
  }

  const tiers: LicenceTier[] = [...groups.entries()].map(([key, items]) => {
    if (key === "__base__") {
      return { key, label: "General Access", minRelation: minOf(items), items };
    }
    const gate = byType.get(key);
    return {
      key,
      label: gate?.name ?? GATE_LABEL_FALLBACK[key] ?? key,
      minRelation: gate?.min_relation ?? minOf(items),
      items,
    };
  });

  tiers.sort((a, b) => (a.minRelation ?? -Infinity) - (b.minRelation ?? -Infinity));
  return { tiers, other };
}

function minOf(items: FactionLicence[]): number | null {
  const nums = items.map((i) => i.min_relation).filter((v): v is number => v != null);
  return nums.length ? Math.min(...nums) : null;
}
