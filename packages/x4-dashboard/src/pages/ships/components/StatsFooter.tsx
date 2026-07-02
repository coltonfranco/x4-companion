import { useQuery } from "@tanstack/react-query";
import { Crosshair, Info, MoveVertical, Shield, ShoppingCart } from "lucide-react";
import { formatStatValue } from "../../../lib/formatters";

import { apiGet } from "../../../lib/api";
import type { ClassMax, EquipmentItem, ShipDetail, SlotDef } from "../lib/builderTypes";
import { dps } from "../lib/builderHelpers";

function StatRow({ label, value, max, shipMax, unit, locked }: {
  label: string; value: number; max: number; shipMax?: number; unit?: string; locked?: boolean;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  // For locked (fixed) stats, use value as both fill and marker position
  const effectiveMax = locked ? value : shipMax;
  const markerPct = (max > 0 && effectiveMax != null) ? Math.max(0, Math.min(100, (effectiveMax / max) * 100)) : 0;

  const barColor =
    pct >= 66 ? "var(--success)" :
    pct >= 33 ? "var(--warning)" :
    "var(--danger)";

  return (
    <div className="flex items-center gap-3 py-1 group">
      <span className="w-24 shrink-0 text-xs uppercase font-bold tracking-wider text-muted-foreground group-hover:text-foreground transition-colors leading-tight">{label}</span>

      {/* Track: bright light-grey rail = open, fillable space */}
      <div className="flex-1 h-[4px] rounded-full relative" style={{ backgroundColor: "rgba(255,255,255,0.28)" }}>
        {/* Blocked zone: paints dark OVER the bright track right of wall = closed/off-limits */}
        {markerPct > 0 && markerPct < 100 && (
          <div className="absolute top-0 right-0 h-full rounded-r-full"
               style={{ width: `${100 - markerPct}%`, backgroundColor: "rgba(0,0,0,0.72)" }} />
        )}
        {/* Filled bar — solid stat color */}
        <div className="absolute top-0 left-0 h-full rounded-full transition-all duration-300 opacity-90 group-hover:opacity-100"
             style={{ width: `${pct}%`, backgroundColor: barColor }} />
        {/* Ship-max wall marker */}
        {markerPct > 0 && (
          <div
            className="absolute top-0 h-full w-[2px] bg-foreground/50 group-hover:bg-foreground/70 transition-colors z-10"
            style={{ left: `${markerPct}%` }}
            title={locked ? `${label} is fixed at ${value.toFixed(0)}${unit ? " " + unit : ""}` : `Ship max: ${shipMax?.toFixed(0)}${unit ? " " + unit : ""}`}
          />
        )}
      </div>

      <div className="w-16 shrink-0 flex justify-end items-baseline gap-1">
        <span className="font-mono text-xs text-foreground font-semibold">
          {formatStatValue(value)}
        </span>
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}

export function StatsFooter({ ship, cart, slots }: {
  ship: ShipDetail; cart: Record<string, EquipmentItem | null>; slots: SlotDef[];
}) {
  const engines = slots.filter(s => s.kind === "engine").map(s => cart[s.key]).filter((e): e is EquipmentItem => e != null);
  const thrusters = slots.filter(s => s.kind === "thruster").map(s => cart[s.key]).filter((e): e is EquipmentItem => e != null);
  const shields = slots.filter(s => s.kind === "shield").map(s => cart[s.key]).filter((e): e is EquipmentItem => e != null);
  const weapons = slots.filter(s => s.kind === "weapon" || s.kind === "turret").map(s => cart[s.key]).filter((e): e is EquipmentItem => e != null);

  const thrust = engines.length > 0 ? engines.reduce((sum, e) => sum + (e.engine_stats?.thrust_forward ?? 0), 0) : 0;
  const drag = ship.drag_forward;
  const speed = thrust && drag && drag > 0 ? thrust / drag : 0;

  const mass = ship.mass ?? 1;
  const acceleration = engines.length > 0 ? thrust / mass : 0;

  const travelMult = engines.length > 0 ? engines.reduce((sum, e) => sum + (e.engine_stats?.travel_thrust ?? 0), 0) / engines.length : 0;
  const boostMult = engines.length > 0 ? engines.reduce((sum, e) => sum + (e.engine_stats?.boost_thrust ?? 0), 0) / engines.length : 0;

  const travelSpeed = speed * travelMult;
  const boostSpeed = speed * boostMult;

  const shieldCap = shields.length > 0
    ? shields.reduce((s, sh) => s + (sh.shield_stats?.capacity ?? 0), 0)
    : 0;

  const shieldRecharge = shields.length > 0
    ? shields.reduce((s, sh) => s + (sh.shield_stats?.recharge_rate ?? 0), 0)
    : 0;

  const strafeThrust = thrusters.length > 0 ? thrusters.reduce((sum, e) => sum + (e.engine_stats?.thrust_strafe ?? 0), 0) : 0;
  const handlingMult = strafeThrust > 0 ? (strafeThrust / 1000) : 0;
  const pitch = (ship.pitch_max ?? 0) * handlingMult;
  const yaw = (ship.yaw_max ?? 0) * handlingMult;

  const totalDps = weapons.reduce((sum, w) => sum + (dps(w.weapon_stats) ?? 0), 0);
  const weaponRange = weapons.length > 0
    ? Math.min(30, Math.max(...weapons.map(w => (w.weapon_stats?.bullet_speed ?? 0) * (w.weapon_stats?.bullet_lifetime ?? 0) / 1000)))
    : 0;
  const weaponTurn = weapons.length > 0
    ? weapons.reduce((sum, w) => sum + (w.weapon_stats?.rotation_speed ?? 0), 0) / weapons.length
    : 0;

  const cid = ship.class_id || "s";

  const { data: cm } = useQuery<ClassMax>({
    queryKey: ["classMax", ship.class_id],
    queryFn: () => apiGet<ClassMax>(`/api/v1/ships/class-max?class_id=${ship.class_id}`),
    staleTime: 5 * 60_000,
  });

  if (!cm) return null;

  const maxSpeed  = cm.speed_max;
  const maxTravel = cm.travel_max;
  const maxBoost  = cm.boost_max;
  const maxAccel  = cm.accel_max;
  const maxHull   = cm.hull;
  const maxShield = cm.shield_capacity_max;
  const maxRegen  = cm.shield_recharge_max;
  const maxCargo  = cm.cargo_volume;
  const maxDps    = cm.dps_max;
  const maxRange  = cm.range_max;
  const maxCrew   = cm.crew_max;
  const maxMissile = cm.missile_max;

  return (
    <div className="bg-muted/10 border-t border-border/50 text-sm w-full shrink-0">
      <div className="px-4 py-2 flex items-center justify-between border-b border-border/30 bg-muted/20">
        <span className="text-xs text-muted-foreground uppercase tracking-widest font-semibold flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5" />
          Progress bars indicate % of absolute {cid.toUpperCase()}-class limit
        </span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4 p-4 pb-4">
        <div className="flex flex-col gap-1.5">
          <div className="text-xs font-bold text-foreground uppercase tracking-wider mb-1 flex items-center gap-2">
            <MoveVertical className="w-4 h-4 text-primary" /> Flight
          </div>
          <StatRow label="Top Speed" value={speed} max={maxSpeed} shipMax={ship.speed_max ?? undefined} unit="m/s" />
          <StatRow label="Travel" value={travelSpeed} max={maxTravel} shipMax={ship.travel_max ?? undefined} unit="m/s" />
          <StatRow label="Boost" value={boostSpeed} max={maxBoost} shipMax={ship.boost_max ?? undefined} unit="m/s" />
          <StatRow label="Accel" value={acceleration} max={maxAccel} shipMax={ship.accel_max ?? undefined} unit="m/s²" />
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1 pt-1 border-t border-border/30">
            <span>Pitch: <span className="font-semibold text-foreground">{Math.round(pitch)}°/s</span></span>
            <span>Yaw: <span className="font-semibold text-foreground">{Math.round(yaw)}°/s</span></span>
            <span>Strafe: <span className="font-semibold text-foreground">{Math.round(strafeThrust)}</span></span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="text-xs font-bold text-foreground uppercase tracking-wider mb-1 flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" /> Defense
          </div>
          <StatRow label="Hull" value={ship.hull ?? 0} max={maxHull} unit="HP" locked />
          <StatRow label="Shield" value={shieldCap} max={maxShield} shipMax={ship.shield_capacity_max ?? undefined} unit="MJ" />
          <StatRow label="Regen" value={shieldRecharge} max={maxRegen} shipMax={ship.shield_recharge_max ?? undefined} unit="MW/s" />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="text-xs font-bold text-foreground uppercase tracking-wider mb-1 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-primary" /> Logistics
          </div>
          <StatRow label="Cargo" value={ship.cargo_volume ?? 0} max={maxCargo} unit="m³" locked />
          <StatRow label="Crew" value={ship.people_capacity ?? 0} max={maxCrew} unit="ppl" locked />
          <StatRow label="Deployables" value={ship.deployable_storage ?? 0} max={100} unit="u" locked />
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1 pt-1 border-t border-border/30">
            <span>Drones: <span className="font-semibold text-foreground">{ship.drone_storage ?? 0}</span></span>
            <span>Flares: <span className="font-semibold text-foreground">{ship.countermeasure_storage ?? 0}</span></span>
            <span>Radar: <span className="font-semibold text-foreground">{((ship.radar_range ?? 0) / 1000).toFixed(0)}km</span></span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="text-xs font-bold text-foreground uppercase tracking-wider mb-1 flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-primary" /> Offense
          </div>
          <StatRow label="Weapon DPS" value={totalDps} max={maxDps} shipMax={ship.dps_max ?? undefined} unit="/s" />
          <StatRow label="Range" value={weaponRange} max={maxRange} shipMax={ship.range_max ?? undefined} unit="km" />
          <StatRow label="Missiles" value={ship.missile_storage ?? 0} max={maxMissile} unit="Ms" locked />
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1 pt-1 border-t border-border/30">
            <span>Weapon Turn: <span className="font-semibold text-foreground">{Math.round(weaponTurn)}°/s</span></span>
          </div>
        </div>
      </div>
      {(ship.dock_s + ship.dock_m + ship.dock_l + ship.dock_xl +
        ship.storage_s + ship.storage_m + ship.storage_l + ship.storage_xl) > 0 && (
        <div className="flex items-center justify-center gap-5 text-[11px] text-muted-foreground px-4 py-2 border-t border-border/30 bg-muted/10">
          <span className="uppercase tracking-wider font-semibold text-xs">Ship Storage</span>
          {(["s","m","l","xl"] as const).map((size) => {
            const dock = ship[`dock_${size}` as keyof typeof ship] as number ?? 0;
            const storage = ship[`storage_${size}` as keyof typeof ship] as number ?? 0;
            const val = storage > 0 ? storage : dock;
            return val > 0 ? (
              <span key={size}>{size.toUpperCase()}: <span className="font-semibold text-foreground">{val}</span></span>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}
