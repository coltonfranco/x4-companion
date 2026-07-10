import { ShipClassBadge, ShipTypeBadge } from "../../../components/game/ShipBadges";
import type { ColumnGroup } from "../../../components/data-display/DataTable";
import type { FactionSummary } from "../../../lib/types";

export type ShipSummary = {
  ship_id: string;
  name: string;
  dlc: string | null;
  class_id: string;
  owner_factions: string[];
  primary_faction?: string | null;
  role: string | null;
  ship_type: string | null;
  hull: number | null;
  shield_capacity_max: number | null;
  cargo_volume: number | null;
  dps_max: number | null;
  speed_min: number | null;
  speed_max: number | null;
  travel_max: number | null;
  boost_max: number | null;
  accel_max: number | null;
  shield_recharge_max: number | null;
  radar_range: number | null;
  range_max: number | null;
  icon_url: string | null;
  image_url: string | null;
  people_capacity: number | null;
  missile_storage: number | null;
  drone_storage: number | null;
  countermeasure_storage: number | null;
  deployable_storage: number | null;
  dock_s: number;
  dock_m: number;
  dock_l: number;
  dock_xl: number;
  storage_s: number;
  storage_m: number;
  storage_l: number;
  storage_xl: number;
  weapons_s: number;
  weapons_m: number;
  weapons_l: number;
  weapons_xl: number;
  turrets_s: number;
  turrets_m: number;
  turrets_l: number;
  turrets_xl: number;
  shields_s: number;
  shields_m: number;
  shields_l: number;
  shields_xl: number;
  engines_s: number;
  engines_m: number;
  engines_l: number;
  engines_xl: number;
  price_avg: number | null;
  chassis_price_min: number | null;
  chassis_price_avg: number | null;
  chassis_price_max: number | null;
  blueprint_price_min: number | null;
  blueprint_price_avg: number | null;
  blueprint_price_max: number | null;
  is_owned: boolean;
  restriction_licence: string | null;
  has_blueprint: boolean;
  is_obtainable: boolean;
  can_be_captured: boolean;
};

export const CLASSES = ["XS", "S", "M", "L", "XL"] as const;

export const MAX_SPEED = 12_000;
export const MAX_TRAVEL = 50_000;
export const MAX_BOOST = 25_000;
export const MAX_ACCEL = 500;
export const MAX_HULL = 800_000;
export const MAX_SHIELD = 2_500_000;
export const MAX_SHIELD_RECHARGE = 10_000;
export const MAX_CARGO = 60_000;
export const MAX_RANGE = 30;
export const MAX_RADAR = 40_000;

// ── Column metadata (for visibility MultiSelect) ─────────────────────────────

export type ColumnMeta = {
  key: string;
  label: string;
  sortKey?: string;
  groupId: string;
  defaultVisible: boolean;
  align?: "left" | "right";
};

export const ALL_COLUMNS: ColumnMeta[] = [
  // Classification
  { key: "type",    label: "Type",    sortKey: "role",               groupId: "classification", defaultVisible: true,  align: "left" },
  { key: "class",   label: "Class",   sortKey: "class_id",           groupId: "classification", defaultVisible: true,  align: "left" },
  { key: "faction", label: "Faction", sortKey: "faction_id",         groupId: "classification", defaultVisible: true,  align: "left" },
  { key: "licence", label: "Licence", sortKey: "restriction_licence", groupId: "acquisition", defaultVisible: true, align: "left" },
  { key: "chassis", label: "Chassis", sortKey: "chassis_price_avg", groupId: "acquisition", defaultVisible: false },
  { key: "price",  label: "Blueprint",  sortKey: "blueprint_price_max", groupId: "acquisition", defaultVisible: true  },
  // Flight
  { key: "speed",  label: "Speed",  sortKey: "speed_max",  groupId: "flight",  defaultVisible: true  },
  { key: "travel", label: "Travel", sortKey: "travel_max", groupId: "flight",  defaultVisible: true  },
  { key: "boost",  label: "Boost",  sortKey: "boost_max",  groupId: "flight",  defaultVisible: false },
  { key: "accel",  label: "Accel",  sortKey: "accel_max",  groupId: "flight",  defaultVisible: false },
  // Defense
  { key: "hull",   label: "Hull",   sortKey: "hull",                groupId: "defense", defaultVisible: true  },
  { key: "shield", label: "Shield", sortKey: "shield_capacity_max", groupId: "defense", defaultVisible: true  },
  { key: "regen",  label: "Regen",  sortKey: "shield_recharge_max", groupId: "defense", defaultVisible: false },
  // Logi
  { key: "cargo",  label: "Cargo",  sortKey: "cargo_volume", groupId: "logi", defaultVisible: false },
  { key: "radar",  label: "Radar",  sortKey: "radar_range",  groupId: "logi", defaultVisible: false },
  // Offense
  { key: "dps",   label: "DPS",       sortKey: "dps_max",   groupId: "offense", defaultVisible: true  },
  { key: "range", label: "Wpn Range", sortKey: "range_max", groupId: "offense", defaultVisible: false },
  // Capacity
  { key: "crew",        label: "Crew",        sortKey: "people_capacity",        groupId: "capacity", defaultVisible: false },
  { key: "missiles",    label: "Missiles",    sortKey: "missile_storage",        groupId: "capacity", defaultVisible: false },
  { key: "drones",      label: "Drones",      sortKey: "drone_storage",          groupId: "capacity", defaultVisible: false },
  { key: "flares",      label: "Flares",      sortKey: "countermeasure_storage", groupId: "capacity", defaultVisible: false },
  { key: "deployables", label: "Deployables", sortKey: "deployable_storage",     groupId: "capacity", defaultVisible: false },
  { key: "dock_s", label: "S Dock",     sortKey: "dock_s",    groupId: "capacity", defaultVisible: false },
  { key: "dock_m", label: "M Dock",     sortKey: "dock_m",    groupId: "capacity", defaultVisible: false },
  { key: "bay_s",  label: "S Ship Cap", sortKey: "storage_s", groupId: "capacity", defaultVisible: false },
  { key: "bay_m",  label: "M Ship Cap", sortKey: "storage_m", groupId: "capacity", defaultVisible: false },
  // Value (Removed old price since it's now blueprint)
  // Slot groups
  { key: "wpn_s",  label: "Wpn S",  sortKey: "weapons_s",  groupId: "slots-weapons", defaultVisible: false },
  { key: "wpn_m",  label: "Wpn M",  sortKey: "weapons_m",  groupId: "slots-weapons", defaultVisible: false },
  { key: "wpn_l",  label: "Wpn L",  sortKey: "weapons_l",  groupId: "slots-weapons", defaultVisible: false },
  { key: "wpn_xl", label: "Wpn XL", sortKey: "weapons_xl", groupId: "slots-weapons", defaultVisible: false },
  { key: "tur_s",  label: "Tur S",  sortKey: "turrets_s",  groupId: "slots-turrets", defaultVisible: false },
  { key: "tur_m",  label: "Tur M",  sortKey: "turrets_m",  groupId: "slots-turrets", defaultVisible: false },
  { key: "tur_l",  label: "Tur L",  sortKey: "turrets_l",  groupId: "slots-turrets", defaultVisible: false },
  { key: "tur_xl", label: "Tur XL", sortKey: "turrets_xl", groupId: "slots-turrets", defaultVisible: false },
  { key: "shd_s",  label: "Shd S",  sortKey: "shields_s",  groupId: "slots-shields", defaultVisible: false },
  { key: "shd_m",  label: "Shd M",  sortKey: "shields_m",  groupId: "slots-shields", defaultVisible: false },
  { key: "shd_l",  label: "Shd L",  sortKey: "shields_l",  groupId: "slots-shields", defaultVisible: false },
  { key: "shd_xl", label: "Shd XL", sortKey: "shields_xl", groupId: "slots-shields", defaultVisible: false },
  { key: "eng_s",  label: "Eng S",  sortKey: "engines_s",  groupId: "slots-engines", defaultVisible: false },
  { key: "eng_m",  label: "Eng M",  sortKey: "engines_m",  groupId: "slots-engines", defaultVisible: false },
  { key: "eng_l",  label: "Eng L",  sortKey: "engines_l",  groupId: "slots-engines", defaultVisible: false },
  { key: "eng_xl", label: "Eng XL", sortKey: "engines_xl", groupId: "slots-engines", defaultVisible: false },
];

export const DEFAULT_VISIBLE = new Set(
  ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key)
);
export const STORAGE_KEY = "ships-table-columns";

// ── Column groups (in mockup display order) ───────────────────────────────────

export const COLUMN_GROUPS: ColumnGroup[] = [
  { id: "classification", label: "Classification" },
  { id: "acquisition",    label: "Acquisition" },
  { id: "flight",         label: "Flight" },
  { id: "defense",        label: "Defense" },
  { id: "logi",           label: "Logi" },
  { id: "offense",        label: "Offense" },
  { id: "capacity",       label: "Capacity" },
  { id: "slots-weapons",  label: "Wpn Slots" },
  { id: "slots-turrets",  label: "Tur Slots" },
  { id: "slots-shields",  label: "Shd Slots" },
  { id: "slots-engines",  label: "Eng Slots" },
];

export function renderGroupHeaderContent(
  groupBy: string,
  groupKey: string,
  sampleShip: ShipSummary,
  factions: FactionSummary[]
) {
  if (groupBy === "class_id") {
    return <ShipClassBadge class_id={sampleShip.class_id} className="text-xs" />;
  }
  if (groupBy === "role" && sampleShip.role) {
    return <ShipTypeBadge role={sampleShip.role} className="text-xs px-2 py-0.5" />;
  }
  if (groupBy === "ship_type" && sampleShip.ship_type) {
    return (
      <ShipTypeBadge
        role={sampleShip.role}
        subtype={sampleShip.ship_type}
        className="text-xs px-2 py-0.5"
      />
    );
  }
  if (groupBy === "faction_id" && sampleShip.primary_faction) {
    const faction = factions.find((f) => f.faction_id === sampleShip.primary_faction);
    if (faction) {
      return (
        <div className="flex items-center gap-2">
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              backgroundColor: faction.color_hex ?? "#888",
              flexShrink: 0,
            }}
          />
          <span className="font-medium text-sm text-foreground">
            {faction.name}
          </span>
        </div>
      );
    }
  }
  return (
    <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
      {groupKey}
    </span>
  );
}

export type SortKey =
  | "name" | "class_id" | "faction_id" | "restriction_licence"
  | "speed_max" | "travel_max" | "boost_max" | "accel_max"
  | "hull" | "shield_capacity_max" | "shield_recharge_max"
  | "cargo_volume" | "dps_max" | "range_max" | "radar_range"
  | "chassis_price_avg" | "price_avg" | "blueprint_price_max" | "role" | "ship_type"
  | "people_capacity" | "missile_storage" | "drone_storage"
  | "countermeasure_storage" | "deployable_storage"
  | "dock_s" | "dock_m" | "dock_l" | "dock_xl"
  | "storage_s" | "storage_m" | "storage_l" | "storage_xl"
  | "weapons_s" | "weapons_m" | "weapons_l" | "weapons_xl"
  | "turrets_s" | "turrets_m" | "turrets_l" | "turrets_xl"
  | "shields_s" | "shields_m" | "shields_l" | "shields_xl"
  | "engines_s" | "engines_m" | "engines_l" | "engines_xl";

export type GroupByKey = "none" | "class_id" | "role" | "ship_type" | "faction_id" | "dlc";
