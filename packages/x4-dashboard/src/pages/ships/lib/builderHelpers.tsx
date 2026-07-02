import { Crosshair, Gauge, Shield, Aperture, MoveVertical, Cpu, ShoppingCart } from "lucide-react";
import { formatCompactNumber, getWeaponType } from "../../../lib/formatters";
import type { EquipmentItem, ShipDetail, SlotDef, SortOption, StatDisplay } from "./builderTypes";

export const RANGE_CAP: Record<string, number> = { xs: 5, s: 10, m: 15, l: 20, xl: 20 };

// ── Categories ─────────────────────────────────────────────────────────────────

export const CATEGORIES = [
  { id: "engine",   label: "Engines",   kind: "engine",   slotKey: "engines", icon: Gauge },
  { id: "thruster", label: "Thrusters", kind: "thruster", slotKey: "engines", icon: MoveVertical },
  { id: "shield",   label: "Shields",   kind: "shield",   slotKey: "shields", icon: Shield },
  { id: "weapon",   label: "Weapons",   kind: "weapon",   slotKey: "weapons", icon: Crosshair },
  { id: "turret",   label: "Turrets",   kind: "turret",   slotKey: "turrets", icon: Aperture },
  { id: "software",   label: "Software",    kind: "software",       slotKey: "software",       icon: Cpu },
  { id: "consumable", label: "Consumables", kind: "consumable",    slotKey: "consumable",    icon: ShoppingCart },
] as const;

// ── Slot helpers ───────────────────────────────────────────────────────────────

export function generateSlots(ship: ShipDetail): SlotDef[] {
  const slots: SlotDef[] = [];
  const shipSize = ship.class_id.replace("ship_", ""); // "xs", "s", "m", "l", "xl"

  for (const cat of CATEGORIES) {
    if (cat.kind === "thruster") {
      slots.push({ key: `thruster-${shipSize}-0`, kind: "thruster", size: shipSize, index: 0 });
      continue;
    }
    if (cat.kind === "software") {
      const softwareTypes = ["dock", "economy", "flightassist", "scannerlongrange", "scannermining", "scannerobject", "target", "trade"];
      for (let i = 0; i < softwareTypes.length; i++) {
        slots.push({ key: `software-${softwareTypes[i]}-0`, kind: "software", size: softwareTypes[i], index: i });
      }
      continue;
    }
    if (cat.kind === "consumable") {
      // Consumables have storage counts, not slot counts
      if ((ship.missile_storage ?? 0) > 0)
        slots.push({ key: "consumable-missile-0", kind: "missile", size: "missile", index: 0 });
      if ((ship.countermeasure_storage ?? 0) > 0)
        slots.push({ key: "consumable-countermeasure-0", kind: "countermeasure", size: "countermeasure", index: 0 });
      if ((ship.deployable_storage ?? 0) > 0)
        slots.push({ key: "consumable-deployable-0", kind: "deployable", size: "deployable", index: 0 });
      if ((ship.drone_storage ?? 0) > 0)
        slots.push({ key: "consumable-drone-0", kind: "drone", size: "drone", index: 0 });
      continue;
    }

    for (const size of ["s", "m", "l", "xl"] as const) {
      const key = `${cat.slotKey}_${size}` as keyof ShipDetail;
      const count = ship[key] as number ?? 0;
      for (let i = 0; i < count; i++)
        slots.push({ key: `${cat.kind}-${size}-${i}`, kind: cat.kind, size, index: i });
    }
  }
  return slots;
}

// ── Derived stats ──────────────────────────────────────────────────────────────

export const dps = (w: EquipmentItem["weapon_stats"]): number | null =>
  w?.damage == null ? null : Math.round(w.damage * (w.bullet_amount ?? 1) * (w.reload_rate ?? 1));

export function fmtStat(n: number | null | undefined): string {
  if (n == null) return "—";
  return formatCompactNumber(n, { base: (v) => v.toFixed(0) });
}

const THRUST_MAX: Record<string, number> = { xs: 500, s: 1000, m: 2500, l: 6000, xl: 15000 };
const TRAVEL_MAX: Record<string, number> = { xs: 25, s: 25, m: 20, l: 50, xl: 50 };
const BOOST_MAX: Record<string, number> = { xs: 10, s: 10, m: 10, l: 10, xl: 10 };
const STRAFE_MAX: Record<string, number> = { xs: 200, s: 600, m: 1500, l: 2000, xl: 3500 };

const SHIELD_MAX: Record<string, number> = { xs: 500, s: 1600, m: 10000, l: 70000, xl: 170000 };
const RECHARGE_MAX: Record<string, number> = { xs: 100, s: 250, m: 100, l: 450, xl: 900 };

const DPS_MAX: Record<string, number> = { xs: 200, s: 400, m: 1200, l: 3000, xl: 3000 };
const ROTATION_MAX: Record<string, number> = { xs: 250, s: 200, m: 250, l: 100, xl: 50 };

export const BASE_SORTS: SortOption[] = [
  { id: "price_asc", label: "Cost", eval: e => e.price_avg ?? 0 },
  { id: "price_desc", label: "Cost (Highest)", eval: e => e.price_avg ?? 0, desc: true },
  { id: "mk_desc", label: "Mark", eval: e => e.mk ?? 0, desc: true },
  { id: "name_asc", label: "Name", eval: e => e.name },
];

export const CATEGORY_SORTS: Record<string, SortOption[]> = {
  engine: [
    { id: "thrust_desc", label: "Thrust", eval: e => e.engine_stats?.thrust_forward ?? 0, desc: true },
    { id: "travel_desc", label: "Travel Thrust", eval: e => e.engine_stats?.travel_thrust ?? 0, desc: true },
    { id: "boost_desc", label: "Boost Thrust", eval: e => e.engine_stats?.boost_thrust ?? 0, desc: true },
  ],
  thruster: [
    { id: "strafe_desc", label: "Strafe Thrust", eval: e => e.engine_stats?.thrust_strafe ?? 0, desc: true },
  ],
  shield: [
    { id: "cap_desc", label: "Capacity", eval: e => e.shield_stats?.capacity ?? 0, desc: true },
    { id: "rech_desc", label: "Recharge", eval: e => e.shield_stats?.recharge_rate ?? 0, desc: true },
  ],
  weapon: [
    { id: "type_asc", label: "Type", eval: e => getWeaponType(e.name) },
    { id: "dps_desc", label: "DPS", eval: e => dps(e.weapon_stats) ?? 0, desc: true },
    { id: "range_desc", label: "Range", eval: e => (e.weapon_stats?.bullet_speed ?? 0) * (e.weapon_stats?.bullet_lifetime ?? 0), desc: true },
  ],
  turret: [
    { id: "type_asc", label: "Type", eval: e => getWeaponType(e.name) },
    { id: "dps_desc", label: "DPS", eval: e => dps(e.weapon_stats) ?? 0, desc: true },
    { id: "range_desc", label: "Range", eval: e => (e.weapon_stats?.bullet_speed ?? 0) * (e.weapon_stats?.bullet_lifetime ?? 0), desc: true },
  ],
};

export function getEquipmentStats(item: EquipmentItem, maxima?: Record<string, number>): { bars: StatDisplay[], texts: string[] } {
  const size = item.size?.toLowerCase() || 's';
  const bars: StatDisplay[] = [];
  const texts: string[] = [];

  if (item.kind === "engine" && item.engine_stats) {
    const e = item.engine_stats;
    if (e.thrust_forward) bars.push({ label: "Thrust", value: e.thrust_forward, max: maxima?.thrust ?? THRUST_MAX[size] ?? 6000, isLog: false, format: n => fmtStat(n) + " N" });
    if (e.travel_thrust) bars.push({ label: "Travel", value: e.travel_thrust, max: maxima?.travel ?? TRAVEL_MAX[size] ?? 25, isLog: false, format: n => `${n.toFixed(1)}×`, color: "#3b82f6" });
    if (e.boost_thrust) bars.push({ label: "Boost", value: e.boost_thrust, max: maxima?.boost ?? BOOST_MAX[size] ?? 10, isLog: false, format: n => `${n.toFixed(1)}×`, color: "#f97316" });
  }
  else if (item.kind === "thruster" && item.engine_stats) {
    const e = item.engine_stats;
    if (e.thrust_strafe) bars.push({ label: "Strafe", value: e.thrust_strafe, max: maxima?.strafe ?? STRAFE_MAX[size] ?? 1000, isLog: false, format: n => fmtStat(n) + " N", color: "#14b8a6" });
    if (e.thrust_forward) bars.push({ label: "Forward", value: e.thrust_forward, max: maxima?.thrust ?? THRUST_MAX[size] ?? 1000, isLog: false, format: n => fmtStat(n) + " N" });
  }
  else if (item.kind === "shield" && item.shield_stats) {
    const s = item.shield_stats;
    if (s.capacity) bars.push({ label: "Capacity", value: s.capacity, max: maxima?.capacity ?? SHIELD_MAX[size] ?? 20000, isLog: false, format: n => fmtStat(n) + " MJ" });
    if (s.recharge_rate) bars.push({ label: "Recharge", value: s.recharge_rate, max: maxima?.recharge ?? RECHARGE_MAX[size] ?? 1000, isLog: false, format: n => `${fmtStat(n)}/s`, color: "#06b6d4" });
    if (s.recharge_delay) texts.push(`${s.recharge_delay.toFixed(1)}s delay`);
  }
  else if ((item.kind === "weapon" || item.kind === "turret") && item.weapon_stats) {
    const w = item.weapon_stats;
    const d = dps(w);
    if (d) bars.push({ label: "DPS", value: d, max: maxima?.dps ?? DPS_MAX[size] ?? 2000, isLog: false, format: fmtStat });

    const rawRange = w.bullet_speed && w.bullet_lifetime ? (w.bullet_speed * w.bullet_lifetime) / 1000 : 0;
    if (rawRange > 0) {
      const rangeMax = maxima?.range ?? RANGE_CAP[size] ?? 20;
      bars.push({ label: "Range", value: Math.min(rawRange, rangeMax), max: rangeMax, isLog: false, format: n => `${n.toFixed(1)}km`, color: "#a855f7" });
    }
    if (w.rotation_speed) bars.push({ label: "Rotation", value: w.rotation_speed, max: maxima?.rotation ?? ROTATION_MAX[size] ?? 200, isLog: false, format: n => `${n.toFixed(0)}°/s`, color: "#10b981" });
  }
  else if (item.kind === "missile" && item.weapon_stats) {
    const w = item.weapon_stats;
    if (w.damage) texts.push(`${fmtStat(w.damage)} dmg`);
    if (w.reload_rate) texts.push(`${w.reload_rate.toFixed(1)}/s reload`);
    if (w.bullet_speed) texts.push(`${fmtStat(w.bullet_speed)} m/s`);
  }
  return { bars, texts };
}

// ── Shopping cart status ──────────────────────────────────────────────────────

export function getCategoryStatus(kind: string, slots: SlotDef[], cart: Record<string, EquipmentItem | null>) {
  const equippedCount = slots.filter(s => cart[s.key]).length;
  const isRequired = kind === "engine" || kind === "thruster" || kind === "software";

  if (kind === "software") {
    const hasDock = slots.some(s => s.size === "dock" && cart[s.key]);
    const hasLongRangeScanner = slots.some(s => s.size === "scannerlongrange" && cart[s.key]);
    const hasObjectScanner = slots.some(s => s.size === "scannerobject" && cart[s.key]);
    const hasFlightAssist = slots.some(s => s.size === "flightassist" && cart[s.key]);

    const meetsMinimum = hasDock && hasLongRangeScanner && hasObjectScanner && hasFlightAssist;
    if (!meetsMinimum) return "missing";
    if (equippedCount === slots.length) return "full";
    return "partial";
  }

  if (slots.length === 0) return "none";
  if (equippedCount === slots.length) return "full";
  if (equippedCount > 0) return "partial";
  return isRequired ? "missing" : "empty";
}

export function playerHasLicence(licenceSet: Set<string>, licenceType: string, factionId?: string | null) {
  if (!licenceType) return false;
  if (factionId && licenceSet.has(`${factionId}:${licenceType}`)) return true;
  for (const key of licenceSet) {
    if (key.endsWith(`:${licenceType}`)) return true;
  }
  return false;
}
