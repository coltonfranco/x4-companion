import { ProductionChain } from "../commerce/ProductionChain";
import { EntityIcon } from "../game/EntityIcon";
import { FactionBadge } from "../game/FactionBadge";
import { EquipmentMkBadge, ShipClassBadge, ShipTypeBadge } from "../game/ShipBadges";
import type { FactionSummary } from "../../lib/types";
import { fmtNum } from "../../lib/wareFormat";

export type EngineStats = {
  mk: number | null;
  thrust_forward: number | null;
  thrust_reverse: number | null;
  thrust_strafe: number | null;
  travel_thrust: number | null;
  travel_charge: number | null;
  boost_thrust: number | null;
  boost_duration: number | null;
};

export type ShieldStats = {
  mk: number | null;
  capacity: number | null;
  recharge_rate: number | null;
  recharge_delay: number | null;
};

export type WeaponStats = {
  class_id: string | null;
  size: string | null;
  mk: number | null;
  rotation_speed: number | null;
  damage: number | null;
  shield_damage: number | null;
  hull_damage: number | null;
  reload_rate: number | null;
  bullet_speed: number | null;
  bullet_lifetime: number | null;
  bullet_amount: number | null;
};

export type Equipment = {
  ware_id: string;
  name: string;
  kind: string;
  size: string | null;
  mk: number | null;
  compat_tags: string | null;
  compat_ship_name: string | null;
  faction_id: string | null;
  restriction_licence: string | null;
  price_min: number | null;
  price_avg: number | null;
  price_max: number | null;
  icon_url: string | null;
  has_production: boolean;
  engine_stats: EngineStats | null;
  shield_stats: ShieldStats | null;
  weapon_stats: WeaponStats | null;
};

export const equipmentDps = (w: WeaponStats | null): number | null =>
  w?.damage == null
    ? null
    : Math.round(w.damage * (w.bullet_amount ?? 1) * (w.reload_rate ?? 1));

export const equipmentRangeM = (w: WeaponStats | null): number | null => {
  if (w?.bullet_speed == null || w?.bullet_lifetime == null) return null;
  const r = w.bullet_speed * w.bullet_lifetime;
  return r > 50_000 ? null : Math.round(r);
};

const km = (m: number) => `${(m / 1000).toFixed(1)}km`;

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium tabular-nums">{value}</span>
    </div>
  );
}

function FullStats({ item }: { item: Equipment }) {
  const e = item.engine_stats;
  const s = item.shield_stats;
  const w = item.weapon_stats;
  const rows: [string, string][] = [];
  if (e)
    rows.push(
      ["Forward thrust", fmtNum(e.thrust_forward, " N")],
      ["Reverse thrust", fmtNum(e.thrust_reverse, " N")],
      ["Strafe thrust", fmtNum(e.thrust_strafe, " N")],
      ["Travel thrust", fmtNum(e.travel_thrust, "x")],
      ["Travel charge", fmtNum(e.travel_charge, " s")],
      ["Boost thrust", fmtNum(e.boost_thrust, "x")],
      ["Boost duration", fmtNum(e.boost_duration, " s")]
    );
  if (s)
    rows.push(
      ["Capacity", fmtNum(s.capacity, " MJ")],
      ["Recharge rate", fmtNum(s.recharge_rate, " MJ/s")],
      ["Recharge delay", fmtNum(s.recharge_delay, " s")]
    );
  if (w)
    rows.push(
      ["Class", w.class_id ?? "-"],
      ["DPS", fmtNum(equipmentDps(w))],
      ["Range", equipmentRangeM(w) != null ? km(equipmentRangeM(w)!) : "-"],
      ["Rotation", fmtNum(w.rotation_speed, "deg/s")],
      ["Reload rate", fmtNum(w.reload_rate, "/s")],
      ["Damage", fmtNum(w.damage)],
      ["Shield damage", fmtNum(w.shield_damage)],
      ["Hull damage", fmtNum(w.hull_damage)],
      ["Projectiles", fmtNum(w.bullet_amount)]
    );
  return (
    <div className="space-y-4">
      {rows.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Metrics
          </p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-3">
            {rows.map(([label, value]) => (
              <StatRow key={label} label={label} value={value} />
            ))}
          </div>
        </div>
      )}
      {item.has_production && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Build chain
          </p>
          <ProductionChain wareId={item.ware_id} />
        </div>
      )}
      {rows.length === 0 && !item.has_production && (
        <p className="text-xs italic text-muted-foreground">
          No detailed stats extracted for this part.
        </p>
      )}
    </div>
  );
}

export function EquipmentDetailPanel({
  item,
  factions,
}: {
  item: Equipment;
  factions: FactionSummary[];
}) {
  const faction = item.faction_id
    ? factions.find((f) => f.faction_id === item.faction_id)
    : undefined;

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-col sm:flex-row gap-6">
        <div className="shrink-0 flex items-center justify-center w-32 h-32 bg-muted/10 rounded-xl p-2 border border-border/50 shadow-inner relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_0%,transparent_70%)]" />
          <EntityIcon
            src={item.icon_url}
            alt={item.name}
            size={100}
            className="relative drop-shadow-[0_0_12px_rgba(0,0,0,0.6)]"
          />
        </div>

        <div className="flex-1 flex flex-col justify-center min-w-0">
          <h2
            className="text-2xl font-bold tracking-tight truncate"
            title={item.name}
          >
            {item.name}
          </h2>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <ShipTypeBadge role={item.kind} className="px-2.5 py-0.5 text-xs" />
            <EquipmentMkBadge mk={item.mk} className="px-2.5 py-0.5 text-xs tracking-wider" />
            {item.size && (
              <ShipClassBadge class_id={item.size} className="px-2.5 py-0.5 text-xs tracking-wider" />
            )}
            {faction && (
              <FactionBadge
                name={faction.name}
                color_hex={faction.color_hex}
                icon_url={faction.icon_url}
                faction_id={faction.faction_id}
              />
            )}
          </div>
        </div>
      </div>
      <div className="pt-4 border-t border-border/50">
        <FullStats item={item} />
      </div>
    </div>
  );
}
