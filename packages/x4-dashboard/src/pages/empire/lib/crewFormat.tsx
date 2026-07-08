import { cn } from "../../../lib/utils";
import { prettyId } from "../../../lib/wareFormat";
import type { EnrichedNPC, NPCEntry, RoleMeta } from "../types";
import { ROLE_META } from "./crewColumns";

export function getRoleSkill(npc: NPCEntry, rolesMap: Map<string, RoleMeta>): number | null {
  const role = rolesMap.get(npc.entity_post || "");
  if (!role || !role.skills.length) return null;

  let totalWeight = 0;
  let weightedSum = 0;

  for (const s of role.skills) {
    let stat = 0;
    if (s.skill_ref === "piloting") stat = npc.skill_piloting || 0;
    else if (s.skill_ref === "morale") stat = npc.skill_morale || 0;
    else if (s.skill_ref === "engineering") stat = npc.skill_engineering || 0;
    else if (s.skill_ref === "management") stat = npc.skill_management || 0;
    else if (s.skill_ref === "boarding") stat = npc.skill_boarding || 0;

    weightedSum += stat * s.relevance;
    totalWeight += s.relevance;
  }

  if (totalWeight === 0) return null;
  return weightedSum / totalWeight;
}

export function roleBadge(post: string | null, rolesMap: Map<string, RoleMeta>) {
  if (!post) return null;
  const known = ROLE_META[post];
  const dynamic = rolesMap.get(post);
  const label = dynamic?.name || known?.label || post;
  const color = known?.color ?? "bg-muted/50 text-muted-foreground border-border";
  return (
    <span
      className={cn(
        "px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border",
        color
      )}
    >
      {label}
    </span>
  );
}

export function resolveFaction(
  ownerFaction: string | null,
  factionNames: Record<string, string>,
): string {
  if (!ownerFaction) return "Unknown";
  if (ownerFaction === "player") return factionNames["player"] || "Player";
  return factionNames[ownerFaction] || ownerFaction.charAt(0).toUpperCase() + ownerFaction.slice(1);
}

export function resolveGender(macro: string | null): string | null {
  if (!macro) return null;
  const m = macro.match(/character_\w+_(male|female)/i);
  if (!m) return null;
  const g = m[1].toLowerCase();
  return g === "male" ? "M" : g === "female" ? "F" : null;
}

export function resolveLocationType(npc: NPCEntry): "Ship" | "Station" | "None" {
  if (npc.location_ship_id) return "Ship";
  if (npc.location_station_id) return "Station";
  return "None";
}

export function locationLabel(npc: EnrichedNPC): string {
  const sName = npc.location_ship_name;
  const sCode = npc.location_ship_code;
  const stName = npc.location_station_name;
  const stCode = npc.location_station_code;
  if (sName && sCode) return `${sName} (${sCode})`;
  if (sName) return sName;
  if (npc.location_ship_id) return "Ship";
  if (stName && stCode) return `${stName} (${stCode})`;
  if (stName) return stName;
  if (npc.location_station_id) return "Station";
  return "—";
}

export function formatMacro(macro: string | null): string {
  if (!macro) return "Unknown Crew";
  let m = macro.replace(/^character_/, "").replace(/_macro$/, "");
  m = m.replace(/_\d+$/, ""); // remove _01, _02
  m = m.replace(/_(cau|asi|afr|latin)/g, ""); // remove race variants
  return prettyId(m);
}
