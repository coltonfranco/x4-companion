import type { DiploAction } from "../types";

export function getRiskColors(risk: string | null) {
  switch (risk) {
    case "veryhigh":
      return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    case "high":
      return "bg-destructive/20 text-destructive border-destructive/30";
    case "medium":
      return "bg-orange-500/20 text-orange-500 border-orange-500/30";
    case "low":
      return "bg-green-500/20 text-green-500 border-green-500/30";
    case "none":
    default:
      return "bg-muted text-muted-foreground border-transparent";
  }
}

export function formatRisk(risk: string | null) {
  if (risk === "veryhigh") return "Very high";
  if (!risk || risk === "none") return "None";
  return risk;
}

const RISK_ORDER: Record<string, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  veryhigh: 4,
};

// "risk" sorts by severity rank rather than alphabetically — a plain field
// accessor already covers this (unlike the multi-level tiebreaks on the
// trade catalog page), so no comparator override is needed here.
export const ACTION_SORT_ACCESSORS: Record<
  string,
  (a: DiploAction) => number | string | null
> = {
  name: (a) => a.name,
  category: (a) => a.category,
  agent_experience: (a) => a.agent_experience,
  risk: (a) => RISK_ORDER[a.risk ?? "none"] ?? 0,
  success_chance: (a) => a.success_chance,
  cost_influence: (a) => a.cost_influence,
  cost_money: (a) => a.cost_money,
  duration_sec: (a) => a.duration_sec,
  cooldown_sec: (a) => a.cooldown_sec,
};
