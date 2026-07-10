import { cn } from "../../../lib/utils";
import { FactionBadge } from "../../../components/game/FactionBadge";
import { SizeBadge } from "../../../components/game/ShipBadges";
import type { ColumnGroup } from "../../../components/data-display/DataTable";
import {
  KIND_COLORS,
  moduleSizeToClassId,
  type ModuleSummary,
} from "../../../components/detail-panels/ModuleDetailPanel";
import type { FactionSummary } from "../../../lib/types";

export const SIZE_ORDER: Record<string, number> = {
  small: 1,
  medium: 2,
  large: 3,
  extralarge: 4,
};

export type SortKey =
  | "name" | "kind" | "size" | "dlc" | "makerrace"
  | "hull" | "storage_capacity" | "workforce_capacity"
  | "blueprint_price_avg" | "blueprint_price_max" | "build_time_sec" | "est_cost" | "production_rate"
  | "produces_ware_name" | "consumes_ware_name" | "consumption_rate"
  | "dock_s" | "dock_m" | "dock_l" | "dock_xl"
  | "hangar_s" | "hangar_m" | "snap_points"
  | "turrets_s" | "turrets_m" | "turrets_l" | "turrets_xl"
  | "shields_s" | "shields_m" | "shields_l" | "shields_xl";

export type GroupByKey = "none" | "kind" | "size" | "dlc" | "makerrace";

export type ColumnMeta = {
  key: string;
  label: string;
  sortKey?: SortKey;
  groupId: string;
  defaultVisible: boolean;
  align?: "left" | "right";
};

export const ALL_COLUMNS: ColumnMeta[] = [
  { key: "kind",      label: "Kind",      sortKey: "kind",          groupId: "classification", defaultVisible: true,  align: "left" },
  { key: "size",      label: "Size",      sortKey: "size",          groupId: "classification", defaultVisible: true,  align: "left" },
  { key: "makerrace", label: "Faction",   sortKey: "makerrace",     groupId: "classification", defaultVisible: true,  align: "left" },
  { key: "dlc",       label: "DLC",       sortKey: "dlc",           groupId: "classification", defaultVisible: false, align: "left" },
  { key: "hull",      label: "Hull",      sortKey: "hull",          groupId: "stats",   defaultVisible: true  },
  { key: "storage",   label: "Storage",   sortKey: "storage_capacity", groupId: "stats", defaultVisible: true  },
  { key: "workforce", label: "Workforce", sortKey: "workforce_capacity", groupId: "stats", defaultVisible: false },
  { key: "tur_s",     label: "Tur S",     sortKey: "turrets_s",    groupId: "slots-turrets", defaultVisible: false },
  { key: "tur_m",     label: "Tur M",     sortKey: "turrets_m",    groupId: "slots-turrets", defaultVisible: false },
  { key: "tur_l",     label: "Tur L",     sortKey: "turrets_l",    groupId: "slots-turrets", defaultVisible: false },
  { key: "tur_xl",    label: "Tur XL",    sortKey: "turrets_xl",   groupId: "slots-turrets", defaultVisible: false },
  { key: "shd_s",     label: "Shd S",     sortKey: "shields_s",    groupId: "slots-shields", defaultVisible: false },
  { key: "shd_m",     label: "Shd M",     sortKey: "shields_m",    groupId: "slots-shields", defaultVisible: false },
  { key: "shd_l",     label: "Shd L",     sortKey: "shields_l",    groupId: "slots-shields", defaultVisible: false },
  { key: "shd_xl",    label: "Shd XL",    sortKey: "shields_xl",   groupId: "slots-shields", defaultVisible: false },
  { key: "licence",   label: "Licence",   sortKey: undefined,       groupId: "unlock", defaultVisible: true,  align: "left" },
  { key: "price",     label: "Blueprint", sortKey: "blueprint_price_max", groupId: "unlock", defaultVisible: true  },
  // Build (optional — construction cost / time)
  { key: "build_time", label: "Build Time", sortKey: "build_time_sec", groupId: "build", defaultVisible: false },
  { key: "est_cost",  label: "Est. Cost",  sortKey: "est_cost",        groupId: "build", defaultVisible: false },
  // Docks (optional)
  { key: "dock_s_c",  label: "Dock S",  sortKey: "dock_s",  groupId: "docks", defaultVisible: false },
  { key: "dock_m_c",  label: "Dock M",  sortKey: "dock_m",  groupId: "docks", defaultVisible: false },
  { key: "dock_l_c",  label: "Dock L",  sortKey: "dock_l",  groupId: "docks", defaultVisible: false },
  { key: "dock_xl_c", label: "Dock XL", sortKey: "dock_xl", groupId: "docks", defaultVisible: false },
  { key: "hangar_s_c",label: "Hangar S",sortKey: "hangar_s", groupId: "docks", defaultVisible: false },
  { key: "hangar_m_c",label: "Hangar M",sortKey: "hangar_m", groupId: "docks", defaultVisible: false },
  { key: "snap_c",    label: "Snap Pts", sortKey: "snap_points", groupId: "docks", defaultVisible: false },
  // Production (optional)
  { key: "produces",   label: "Produces", sortKey: "produces_ware_name" as SortKey, groupId: "production", defaultVisible: false, align: "left" },
  { key: "prod_rate",  label: "Rate/hr",  sortKey: "production_rate",       groupId: "production", defaultVisible: false },
  { key: "consumes",   label: "Consumes", sortKey: "consumes_ware_name" as SortKey, groupId: "production", defaultVisible: false, align: "left" },
  { key: "cons_rate",  label: "Cons./hr", sortKey: "consumption_rate",      groupId: "production", defaultVisible: false },
];

export const DEFAULT_VISIBLE = new Set(
  ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key)
);
export const STORAGE_KEY = "modules-table-columns";

export const COLUMN_GROUPS: ColumnGroup[] = [
  { id: "classification", label: "Classification" },
  { id: "stats",          label: "Stats" },
  { id: "slots-turrets",  label: "Tur Slots" },
  { id: "slots-shields",  label: "Shd Slots" },
  { id: "unlock",         label: "Unlock" },
  { id: "build",          label: "Build" },
  { id: "docks",          label: "Docks" },
  { id: "production",     label: "Production" },
];

export function slotNum(n: number) {
  if (!n) return <span className="text-muted-foreground/40 text-xs">—</span>;
  return <span className="text-xs font-mono tabular-nums">{n}</span>;
}

export function GroupLabel({ groupBy, groupKey, factions, rows }: { groupBy: GroupByKey; groupKey: string; factions: Map<string, FactionSummary>; rows: ModuleSummary[] }) {
  if (groupBy === "kind") {
    const color = KIND_COLORS[rows[0]?.kind ?? ""] ?? "bg-muted";
    return <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-sm font-semibold", color)}>{groupKey}</span>;
  }
  if (groupBy === "size" && rows[0]?.size) {
    return <SizeBadge size={moduleSizeToClassId(rows[0].size)} />;
  }
  if (groupBy === "makerrace") {
    const faction = factions.get(rows[0]?.makerrace ?? "");
    if (faction) return <FactionBadge name={faction.name} color_hex={faction.color_hex} icon_url={faction.icon_url} faction_id={faction.faction_id} />;
  }
  return <span className="text-sm font-semibold text-foreground">{groupKey}</span>;
}
