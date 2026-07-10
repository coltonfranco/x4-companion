import { useMemo } from "react";
import { FactionBadge } from "./FactionBadge";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import type { FactionSummary } from "../../lib/types";

export interface MultiFactionBadgeProps {
  /** All faction IDs that own / can use this item. */
  ownerFactions: string[];
  /** Map of faction_id → FactionSummary for resolution. */
  factionMap: Map<string, FactionSummary>;
}

/**
 * "player" is a real faction_id in the game's own data — it's how a handful of
 * wares (drop/terraforming drones) that no NPC faction sells are tagged, since
 * they're only ever player-buildable. It resolves through the factions table
 * like any other id, but with the player's own custom empire name substituted
 * in (COALESCE(player.faction_name, factions.name) — see routes/factions.py),
 * which reads as "your company manufactures this" rather than "nobody does."
 * Never treat it as a real manufacturer for badge purposes.
 */
const NOT_A_MANUFACTURER = "player";

/**
 * Picks the single most-representative "primary" faction from a list of owners:
 *  1. Factions with the ``publicship`` tag (sell to the player).
 *  2. Among those, the base faction (faction_id == primary_race).
 *  3. Fallback: first publicship owner, or first owner overall.
 */
export function pickPrimary(
  ownerFactions: string[],
  factionMap: Map<string, FactionSummary>,
): string | null {
  const owners = ownerFactions.filter((fid) => fid !== NOT_A_MANUFACTURER);
  if (owners.length === 0) return null;

  const resolved = owners
    .map((fid) => factionMap.get(fid))
    .filter(Boolean) as FactionSummary[];

  if (resolved.length === 0) return owners[0] ?? null;

  const hasTag = (f: FactionSummary, tag: string) =>
    (f.tags ?? "").split(" ").includes(tag);

  // Prefer publicship factions, then base faction within those.
  const pubs = resolved.filter((f) => hasTag(f, "publicship"));
  if (pubs.length > 0) {
    const base = pubs.find((f) => f.faction_id === f.primary_race);
    return (base ?? pubs[0]).faction_id;
  }

  // No publicship owners — prefer the base faction if present.
  const base = resolved.find((f) => f.faction_id === f.primary_race);
  if (base) return base.faction_id;

  return resolved[0].faction_id;
}

export function MultiFactionBadge({
  ownerFactions,
  factionMap,
}: MultiFactionBadgeProps) {
  const owners = useMemo(
    () => ownerFactions.filter((fid) => fid !== NOT_A_MANUFACTURER),
    [ownerFactions],
  );
  const primaryFaction = useMemo(
    () => pickPrimary(owners, factionMap),
    [owners, factionMap],
  );

  const primary = primaryFaction
    ? factionMap.get(primaryFaction)
    : undefined;

  const badge = primary ? (
    <FactionBadge
      name={primary.name}
      color_hex={primary.color_hex}
      icon_url={primary.icon_url}
      faction_id={primary.faction_id}
    />
  ) : (
    <span className="text-muted-foreground text-xs">—</span>
  );

  const extraCount = owners.length > 1
    ? owners.length - (primaryFaction ? 1 : 0)
    : 0;

  if (extraCount <= 0) return badge;

  const allFactions = owners
    .map((fid) => factionMap.get(fid))
    .filter(Boolean) as FactionSummary[];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1 cursor-default">
          {badge}
          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground border border-border hover:bg-muted hover:text-foreground transition-colors cursor-default">
            +{extraCount}
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent className="flex flex-col gap-1.5 p-3 max-w-56 border border-border shadow-xl bg-popover text-popover-foreground"
      >
        {allFactions.map((f) => (
          <FactionBadge
            key={f.faction_id}
            name={f.name}
            color_hex={f.color_hex}
            icon_url={f.icon_url}
            faction_id={f.faction_id}
          />
        ))}
      </TooltipContent>
    </Tooltip>
  );
}
