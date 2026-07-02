import { formatCompactNumber } from "../../../lib/formatters";
import type { Station } from "../types";

const CATEGORY_LABEL: Record<string, string> = {
  factory: "Factory",
  headquarters: "Headquarters",
  shipyard: "Shipyard",
  wharf: "Wharf",
  equipmentdock: "Equipment Dock",
  tradestation: "Trade Station",
  defence: "Defence Station",
  piratebase: "Pirate Base",
};
export const categoryLabel = (c: string | null) => (c ? (CATEGORY_LABEL[c] ?? c) : "Station");

const STATUS = {
  building: { color: "#5cc8ec", label: "BUILDING" },
  operational: { color: "#34d399", label: "OPERATIONAL" },
} as const;
export const statusOf = (s: Station) => (s.is_under_construction ? STATUS.building : STATUS.operational);

export function fmtNum(n: number): string {
  return formatCompactNumber(n, { trim: true, base: (v) => String(Math.round(v)) });
}
export const fmtCr = (n: number) => `${fmtNum(n)} Cr`;
export const pct = (cur: number | null, cap: number | null) =>
  cur != null && cap != null && cap > 0 ? Math.round((cur / cap) * 100) : null;

function isRealName(name: string | null): name is string {
  return !!name && !name.startsWith("{");
}
export function stationDisplayName(s: Station): string {
  if (isRealName(s.name)) return s.name;
  if (s.code) return s.code;
  return categoryLabel(s.category);
}
