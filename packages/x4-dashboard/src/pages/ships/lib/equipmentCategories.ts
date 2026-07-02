import { fmtNum } from "../../../lib/wareFormat";
import { equipmentDps, equipmentRangeM, type Equipment } from "../../../components/detail-panels/EquipmentDetailPanel";

export type MetricCol = {
  key: string;
  label: string;
  get: (e: Equipment) => number | null;
  fmt: (n: number) => string;
  primary?: boolean;
};

export type Category = {
  id: string;
  label: string;
  match: (kind: string) => boolean;
  metrics: MetricCol[];
};

const km = (m: number) => `${(m / 1000).toFixed(1)}km`;

export const CATEGORIES: Category[] = [
  {
    id: "engine",
    label: "Engines",
    match: (k) => k === "engine",
    metrics: [
      { key: "thrust", label: "Thrust", primary: true, get: (e) => e.engine_stats?.thrust_forward ?? null, fmt: (n) => fmtNum(Math.round(n)) + " N" },
      { key: "travel", label: "Travel", get: (e) => e.engine_stats?.travel_thrust ?? null, fmt: (n) => `${n.toFixed(1)}×` },
      { key: "boost", label: "Boost", get: (e) => e.engine_stats?.boost_thrust ?? null, fmt: (n) => `${n.toFixed(1)}×` },
    ],
  },
  {
    id: "thruster",
    label: "Thrusters",
    match: (k) => k === "thruster",
    metrics: [
      { key: "strafe", label: "Strafe", primary: true, get: (e) => e.engine_stats?.thrust_strafe ?? null, fmt: (n) => fmtNum(Math.round(n)) },
      { key: "forward", label: "Forward", get: (e) => e.engine_stats?.thrust_forward ?? null, fmt: (n) => fmtNum(Math.round(n)) },
    ],
  },
  {
    id: "shield",
    label: "Shields",
    match: (k) => k === "shield",
    metrics: [
      { key: "capacity", label: "Capacity", primary: true, get: (e) => e.shield_stats?.capacity ?? null, fmt: (n) => `${fmtNum(Math.round(n))} MJ` },
      { key: "recharge", label: "Recharge", get: (e) => e.shield_stats?.recharge_rate ?? null, fmt: (n) => `${Math.round(n)}/s` },
      { key: "delay", label: "Delay", get: (e) => e.shield_stats?.recharge_delay ?? null, fmt: (n) => `${n.toFixed(1)}s` },
    ],
  },
  {
    id: "weapon",
    label: "Weapons",
    match: (k) => k === "weapon",
    metrics: [
      { key: "dps", label: "DPS", primary: true, get: (e) => equipmentDps(e.weapon_stats), fmt: (n) => fmtNum(n) },
      { key: "range", label: "Range", get: (e) => equipmentRangeM(e.weapon_stats), fmt: km },
      { key: "rotation", label: "Rotation", get: (e) => e.weapon_stats?.rotation_speed ?? null, fmt: (n) => `${Math.round(n)}°/s` },
    ],
  },
  {
    id: "turret",
    label: "Turrets",
    match: (k) => k === "turret",
    metrics: [
      { key: "dps", label: "DPS", primary: true, get: (e) => equipmentDps(e.weapon_stats), fmt: (n) => fmtNum(n) },
      { key: "range", label: "Range", get: (e) => equipmentRangeM(e.weapon_stats), fmt: km },
      { key: "rotation", label: "Rotation", get: (e) => e.weapon_stats?.rotation_speed ?? null, fmt: (n) => `${Math.round(n)}°/s` },
    ],
  },
  {
    id: "missile",
    label: "Missiles",
    match: (k) => k === "missile",
    metrics: [
      { key: "damage", label: "Damage", primary: true, get: (e) => e.weapon_stats?.damage ?? null, fmt: (n) => fmtNum(Math.round(n)) },
      { key: "speed", label: "Speed", get: (e) => e.weapon_stats?.bullet_speed ?? null, fmt: (n) => `${Math.round(n)} m/s` },
      { key: "reload", label: "Reload", get: (e) => e.weapon_stats?.reload_rate ?? null, fmt: (n) => `${n.toFixed(1)}/s` },
    ],
  },
  {
    id: "consumable",
    label: "Consumables",
    match: (k) => ["countermeasure", "deployable", "drone"].includes(k),
    metrics: [],
  },
  {
    id: "software",
    label: "Software",
    match: (k) => k === "software",
    metrics: [],
  },
  {
    id: "other",
    label: "Other",
    match: (k) =>
      !["engine", "thruster", "shield", "weapon", "turret", "missile", "countermeasure", "deployable", "drone", "software"].includes(k),
    metrics: [],
  },
];

export const SIZE_ORDER: Record<string, number> = { xs: 0, s: 1, m: 2, l: 3, xl: 4 };
