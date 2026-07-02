import { useMemo } from "react";
import { getMkGradientClass, formatLicence } from "../../../lib/formatters";
import { cn } from "../../../lib/utils";
import { useSort } from "../../../lib/useSort";
import { Currency } from "../../../components/game/Currency";
import { FactionBadge } from "../../../components/game/FactionBadge";
import { EquipmentMkBadge, ShipClassBadge } from "../../../components/game/ShipBadges";
import { StatBar } from "../../../components/data-display/StatBar";
import { EntityIcon } from "../../../components/game/EntityIcon";
import { DataTable } from "../../../components/data-display/DataTable";
import type { ColumnDef } from "../../../components/data-display/DataTable";
import type { FactionSummary } from "../../../lib/types";
import { useFactionMap } from "../../../lib/useFactionMap";
import { usePlayerLicences } from "../../../lib/usePlayerLicences";
import type { Equipment } from "../../../components/detail-panels/EquipmentDetailPanel";
import type { Category } from "../lib/equipmentCategories";

export function EquipmentTable({
  category,
  items,
  factions,
  onSelect,
  globalMaxima,
  perSizeMaxima,
  isLinear,
  globalLicences,
}: {
  category: Category;
  items: Equipment[];
  factions: FactionSummary[];
  onSelect: (item: Equipment) => void;
  globalMaxima: Record<string, number>;
  perSizeMaxima: Record<string, Record<string, number>>;
  isLinear: boolean;
  globalLicences: Set<string>;
}) {
  const metrics = category.metrics;

  const { data: playerLicences = [] } = usePlayerLicences();

  const licenceSet = useMemo(
    () => new Set(playerLicences.map((l) => `${l.faction_id}:${l.licence_type}`)),
    [playerLicences]
  );
  const licenceTypeSet = useMemo(
    () => new Set(playerLicences.map((l) => l.licence_type)),
    [playerLicences]
  );

  const factionMap = useFactionMap(factions);
  const shortFactionMap = useMemo(() => {
    const m = new Map(factionMap);
    for (const f of factions) {
      if (f.short_name) m.set(f.short_name.toLowerCase(), f);
    }
    return m;
  }, [factions, factionMap]);

  const accessors = useMemo(() => {
    const acc: Record<string, (e: Equipment) => number | string | null> = {
      name: (e) => e.name,
      mk: (e) => e.mk,
      price: (e) => e.price_avg,
    };
    for (const m of metrics) acc[m.key] = m.get;
    return acc;
  }, [metrics]);

  const primaryKey = metrics.find((m) => m.primary)?.key ?? "name";
  const { sorted, key, dir, toggle } = useSort(items, accessors, {
    key: primaryKey,
    dir: primaryKey === "name" ? "asc" : "desc",
  });

  const columns = useMemo<ColumnDef<Equipment>[]>(
    () => [
      {
        key: "name",
        label: "Name",
        sortKey: "name",
        align: "left",
        render: (e) => (
          <span className="font-medium text-xs">
            {e.name}
            {e.compat_tags && (
              <span
                className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30"
                title={`Exclusive to ${e.compat_ship_name ?? "a specific ship hull"}`}
              >
                Exclusive
              </span>
            )}
          </span>
        ),
      },
      {
        key: "size",
        label: "Size",
        align: "left",
        className: "w-32",
        render: (e) =>
          e.size ? (
            <ShipClassBadge class_id={e.size} className="text-xs px-1.5 py-0" />
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        key: "mk",
        label: "Mk",
        sortKey: "mk",
        align: "left",
        className: "w-12",
        render: (e) =>
          e.mk != null ? (
            <EquipmentMkBadge mk={e.mk} className="text-xs px-1.5 py-0" />
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        key: "faction",
        label: "Faction",
        align: "left",
        className: "w-40",
        render: (e) => {
          const faction = e.faction_id
            ? (shortFactionMap.get(e.faction_id.toLowerCase()) ??
               factionMap.get(e.faction_id))
            : undefined;
          return faction ? (
            <FactionBadge
              name={faction.name}
              color_hex={faction.color_hex}
              icon_url={faction.icon_url}
              faction_id={faction.faction_id}
            />
          ) : (
            <span className="text-xs uppercase text-muted-foreground">
              {e.faction_id ?? "—"}
            </span>
          );
        },
      },
      {
        key: "licence",
        label: "Licence",
        align: "left",
        className: "w-36",
        render: (e) => {
          const lic = e.restriction_licence;
          if (!lic || lic === "generaluseship" || lic === "generaluseequipment") {
            return <span className="text-muted-foreground">—</span>;
          }
          const hasLicence = globalLicences.has(lic)
            ? licenceTypeSet.has(lic)
            : e.faction_id
            ? licenceSet.has(`${e.faction_id}:${lic}`)
            : false;
          return (
            <span
              className={cn(
                "cursor-default text-xs",
                hasLicence ? "text-success" : "text-destructive"
              )}
              title={
                hasLicence
                  ? `You have the ${formatLicence(lic)} licence.`
                  : `Requires ${formatLicence(lic)} licence — you do not have it.`
              }
            >
              {formatLicence(lic)}
            </span>
          );
        },
      },
      ...metrics.map(
        (m): ColumnDef<Equipment> => ({
          key: m.key,
          label: m.label,
          sortKey: m.key,
          align: "right",
          className: "w-32",
          render: (e) => {
            const raw = m.get(e);
            if (raw == null)
              return <span className="text-xs text-muted-foreground">—</span>;
            const sizeMax =
              isLinear && e.size
                ? (perSizeMaxima[e.size]?.[m.key] ?? globalMaxima[m.key])
                : globalMaxima[m.key];
            return (
              <StatBar
                value={isLinear ? raw : Math.log10(raw + 1)}
                max={
                  isLinear ? sizeMax : Math.log10(globalMaxima[m.key] + 1)
                }
                label={m.fmt(raw)}
              />
            );
          },
        })
      ),
      {
        key: "price",
        label: "Price",
        sortKey: "price",
        align: "right",
        className: "w-24",
        render: (e) =>
          e.price_avg != null ? (
            <Currency value={e.price_avg} />
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      metrics,
      isLinear,
      globalMaxima,
      perSizeMaxima,
      factionMap,
      shortFactionMap,
      licenceSet,
      licenceTypeSet,
      globalLicences,
    ]
  );

  return (
    <DataTable
      columns={columns}
      rows={sorted}
      getRowKey={(e) => e.ware_id}
      sortKey={key}
      sortDir={dir}
      onSortChange={(k) => toggle(k, k === "name" ? "asc" : "desc")}
      onRowClick={onSelect}
      rowPrefix={(e) => (
        <div
          className={cn(
            "w-10 h-10 flex items-center justify-center rounded-lg border",
            getMkGradientClass(e.mk)
          )}
        >
          <EntityIcon src={e.icon_url} alt={e.name} size={32} />
        </div>
      )}
      emptyMessage="No parts match."
    />
  );
}
