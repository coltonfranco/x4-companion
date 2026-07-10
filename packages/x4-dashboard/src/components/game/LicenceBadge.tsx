import { FactionBadge } from "./FactionBadge";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { formatLicence } from "../../lib/formatters";
import { cn } from "../../lib/utils";
import type { FactionSummary } from "../../lib/types";

export interface LicenceBadgeProps {
  /** The licence type string (e.g. "militaryequipment"). */
  licence: string;
  /** Factions that require this licence. */
  ownerFactions: string[];
  /** Map of faction_id → FactionSummary. */
  factionMap: Map<string, FactionSummary>;
  /** Set of `${faction_id}:${licence_type}` the player holds. */
  licenceSet: Set<string>;
  /** Set of licence type strings that are "global" (held from any faction). */
  globalLicences?: Set<string>;
  /** Set of licence type strings the player holds from ANY faction (for global check). */
  licenceTypeSet?: Set<string>;
}

export function LicenceBadge({
  licence,
  ownerFactions,
  factionMap,
  licenceSet,
  globalLicences,
  licenceTypeSet,
}: LicenceBadgeProps) {
  const isGlobal = globalLicences?.has(licence) ?? false;
  const hasLicence = isGlobal
    ? (licenceTypeSet?.has(licence) ?? false)
    : ownerFactions.length === 0
      ? false
      : ownerFactions.some((fid) => licenceSet.has(`${fid}:${licence}`));

  const label = (
    <span
      className={cn(
        "text-xs cursor-default",
        hasLicence ? "text-emerald-400" : "text-red-400/80",
      )}
    >
      {formatLicence(licence)}
    </span>
  );

  // Global licences: no per-faction breakdown needed.
  if (isGlobal || ownerFactions.length === 0) return label;

  const factionStatuses = ownerFactions
    .map((fid) => ({
      faction: factionMap.get(fid),
      unlocked: licenceSet.has(`${fid}:${licence}`),
    }))
    .filter((s) => s.faction) as {
    faction: FactionSummary;
    unlocked: boolean;
  }[];

  if (factionStatuses.length === 0) return label;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{label}</TooltipTrigger>
      <TooltipContent className="flex flex-col gap-1.5 p-3 max-w-56 border border-border shadow-xl bg-popover text-popover-foreground"
      >
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
          {formatLicence(licence)} —{" "}
          {hasLicence ? "Unlocked" : "Locked"}
        </p>
        {factionStatuses.map(({ faction, unlocked }) => (
          <div key={faction.faction_id} className="flex items-center gap-2">
            <span
              className={cn(
                "text-xs shrink-0",
                unlocked ? "text-emerald-400" : "text-red-400/60",
              )}
            >
              {unlocked ? "✓" : "✗"}
            </span>
            <FactionBadge
              name={faction.name}
              color_hex={faction.color_hex}
              icon_url={faction.icon_url}
              faction_id={faction.faction_id}
            />
          </div>
        ))}
      </TooltipContent>
    </Tooltip>
  );
}
