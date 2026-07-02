import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Currency } from "../../components/game/Currency";
import { EntityIcon } from "../../components/game/EntityIcon";
import { FactionBadge } from "../../components/game/FactionBadge";
import { SizeBadge } from "../../components/game/ShipBadges";
import { cn } from "../../lib/utils";
import { PageLoaderPreset } from "../../components/layout/PageLoader";
import { PageSubtitle } from "../../components/ui/page-subtitle";
import { HUDCard } from "../../components/layout/HUDCard";
import { DataTable } from "../../components/data-display/DataTable";
import type { ColumnDef, RowGroup } from "../../components/data-display/DataTable";
import { useColumnVisibility } from "../../lib/useColumnVisibility";
import { apiGet } from "../../lib/api";
import { useFactionMap } from "../../lib/useFactionMap";
import { usePlayerLicences } from "../../lib/usePlayerLicences";
import { DetailDialog } from "../../components/ui/detail-dialog";
import {
  KIND_COLORS,
  KIND_LABELS,
  ModuleDetailPanel,
  isModuleLicenceLocked,
  licenceSourceLabel,
  moduleSizeToClassId,
  type ModuleSummary,
} from "../../components/detail-panels/ModuleDetailPanel";
import type { FactionSummary } from "../../lib/types";
import { formatDlc, formatLicence } from "../../lib/formatters";
import {
  ALL_COLUMNS,
  COLUMN_GROUPS,
  DEFAULT_VISIBLE,
  SIZE_ORDER,
  STORAGE_KEY,
  GroupLabel,
  slotNum,
  type GroupByKey,
  type SortKey,
} from "./lib/modulesColumns";
import { ModulesFilterBar } from "./components/ModulesFilterBar";

// ── Component ────────────────────────────────────────────────────────────────

export default function ModulesPage() {
  const [search, setSearch] = useState("");
  const [selectedKind, setSelectedKind] = useState("all");
  const [selectedSize, setSelectedSize] = useState("all");
  const [selectedFactions, setSelectedFactions] = useState<Set<string>>(new Set());
  const [sortCol, setSortCol] = useState<SortKey>("name");
  const [sortDesc, setSortDesc] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupByKey>("none");
  const [availabilityFilter, setAvailabilityFilter] = useState<string>("all");
  const [obtainableOnly, setObtainableOnly] = useState(false);
  const [selectedModule, setSelectedModule] = useState<ModuleSummary | null>(null);
  const [visibleColumns, setVisibleColumns] = useColumnVisibility(
    STORAGE_KEY,
    DEFAULT_VISIBLE
  );

  const { data: modules = [], isLoading } = useQuery<ModuleSummary[]>({
    queryKey: ["modules"],
    queryFn: () =>
      apiGet<any>("/api/v1/modules?limit=2000").then((d) =>
        Array.isArray(d) ? d : []
      ),
    staleTime: 10 * 60_000,
  });

  const { data: factions = [] } = useQuery<FactionSummary[]>({
    queryKey: ["factions"],
    queryFn: () => apiGet<FactionSummary[]>("/api/v1/factions"),
    staleTime: Infinity,
  });

  const { data: playerLicences = [] } = usePlayerLicences();

  const factionMap = useFactionMap(factions);
  const licenceSet = useMemo(
    () => new Set(playerLicences.map((l) => `${l.faction_id}:${l.licence_type}`)),
    [playerLicences]
  );
  const anyLicenceSet = useMemo(
    () => new Set(playerLicences.map((l) => l.licence_type)),
    [playerLicences]
  );

  const kinds = useMemo(
    () => [...new Set(modules.map((m) => m.kind).filter(Boolean) as string[])].sort(),
    [modules]
  );
  const sizes = useMemo(
    () =>
      [...new Set(modules.map((m) => m.size).filter(Boolean) as string[])].sort(
        (a, b) => (SIZE_ORDER[a] ?? 99) - (SIZE_ORDER[b] ?? 99)
      ),
    [modules]
  );
  // Derive available factions from makerrace
  const availableFactions = useMemo(() => {
    const seen = new Set<string>();
    modules.forEach((m) => {
      if (m.makerrace) seen.add(m.makerrace);
    });
    return [...seen].sort();
  }, [modules]);

  const filtered = modules.filter((m) => {
    if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (selectedKind !== "all" && m.kind !== selectedKind) return false;
    if (selectedSize === "none" && m.size !== null) return false;
    if (selectedSize !== "all" && selectedSize !== "none" && m.size !== selectedSize) return false;
    if (selectedFactions.size > 0 && !selectedFactions.has(m.makerrace || "__none__"))
      return false;
    if (obtainableOnly && !m.is_obtainable) return false;
    if (availabilityFilter !== "all") {
      const licenceLocked = isModuleLicenceLocked(m.makerrace, m.restriction_licence, licenceSet, anyLicenceSet);
      const isFreeDefault = !m.blueprint_price_avg && m.is_obtainable;
      if (availabilityFilter === "locked" && !licenceLocked) return false;
      if (availabilityFilter === "ready" && (licenceLocked || (!m.has_blueprint && !isFreeDefault))) return false;
      if (availabilityFilter === "purchasable" && (licenceLocked || m.has_blueprint || !m.blueprint_price_avg)) return false;
      if (availabilityFilter === "unavailable" && (licenceLocked || m.has_blueprint || m.blueprint_price_avg || m.is_obtainable)) return false;
    }
    if (m.is_obtainable && m.est_cost == null) return false; // sub-components: dock areas, PHQ asteroid, etc.
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const aVal = a[sortCol as keyof ModuleSummary];
    const bVal = b[sortCol as keyof ModuleSummary];
    if (aVal === null && bVal !== null) return sortDesc ? 1 : -1;
    if (aVal !== null && bVal === null) return sortDesc ? -1 : 1;
    if (aVal === null && bVal === null) return 0;
    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortDesc ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
    }
    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortDesc ? bVal - aVal : aVal - bVal;
    }
    return 0;
  });

  const handleSort = (key: string) => {
    const sk = key as SortKey;
    if (sortCol === sk) setSortDesc(!sortDesc);
    else {
      setSortCol(sk);
      setSortDesc(sk === "blueprint_price_avg" || sk === "hull");
    }
  };

  // Column visibility options for MultiSelect
  const columnOptions = useMemo(
    () =>
      ALL_COLUMNS.filter((c) => !(c as any).alwaysVisible).map((c) => ({
        value: c.key,
        label: c.label,
        group: c.groupId,
      })),
    []
  );

  // ── Row groups (when groupBy != "none") ──
  const rowGroups = useMemo((): RowGroup<ModuleSummary>[] | undefined => {
    if (groupBy === "none") return undefined;
    const groups = new Map<string, ModuleSummary[]>();
    for (const m of sorted) {
      let key: string;
      if (groupBy === "dlc") key = formatDlc(m.dlc || "base_game");
      else if (groupBy === "kind") key = KIND_LABELS[m.kind ?? ""] ?? m.kind ?? "—";
      else if (groupBy === "size") key = m.size ?? "—";
      else if (groupBy === "makerrace") key = m.makerrace ?? "—";
      else key = "—";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(m);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, rows]) => ({ key, label: <GroupLabel groupBy={groupBy} groupKey={key} factions={factionMap} rows={rows} />, rows }));
  }, [sorted, groupBy, factionMap]);

  // ── Columns ──
  const columns = useMemo<ColumnDef<ModuleSummary>[]>(
    () => [
      {
        key: "name",
        label: "Name",
        sortKey: "name",
        align: "left",
        alwaysVisible: true,
        render: (m) => (
          <div className="flex items-center gap-2">
            {m.icon_url ? (
              <EntityIcon src={m.icon_url} alt={m.name} size={24} className="shrink-0" />
            ) : (
              <div className="w-6 h-6 shrink-0" />
            )}
            <span className="font-medium">{m.name}</span>
            {!m.is_obtainable && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-500/15 text-red-400 border border-red-500/30"
                title="This module cannot be obtained or built by the player.">
                NPC Only
              </span>
            )}
          </div>
        ),
      },
      {
        key: "kind",
        label: "Kind",
        sortKey: "kind",
        groupId: "classification",
        align: "left",
        render: (m) => {
          const color = KIND_COLORS[m.kind ?? ""] ?? "bg-muted text-muted-foreground border-border";
          return (
            <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border", color)}>
              {KIND_LABELS[m.kind ?? ""] ?? m.kind ?? "—"}
            </span>
          );
        },
      },
      {
        key: "size",
        label: "Size",
        sortKey: "size",
        groupId: "classification",
        align: "left",
        render: (m) => m.size ? <SizeBadge size={moduleSizeToClassId(m.size)} /> : <span className="text-xs text-muted-foreground">—</span>,
      },
      {
        key: "makerrace",
        label: "Faction",
        sortKey: "makerrace",
        groupId: "classification",
        align: "left",
        render: (m) => {
          const faction = m.makerrace ? factionMap.get(m.makerrace) : undefined;
          return faction ? (
            <FactionBadge name={faction.name} color_hex={faction.color_hex} icon_url={faction.icon_url} faction_id={faction.faction_id} />
          ) : (
            <span className="text-xs text-muted-foreground capitalize">{m.makerrace ?? "—"}</span>
          );
        },
      },
      {
        key: "dlc",
        label: "DLC",
        sortKey: "dlc",
        groupId: "classification",
        align: "left",
        render: (m) => (
          <span className={cn("text-xs", m.dlc ? "text-amber-300/80" : "text-muted-foreground")}>
            {formatDlc(m.dlc)}
          </span>
        ),
      },
      {
        key: "hull",
        label: "Hull",
        sortKey: "hull",
        groupId: "stats",
        align: "right",
        render: (m) =>
          m.hull ? (
            <span className="text-xs font-mono tabular-nums">{m.hull.toLocaleString()}</span>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          ),
      },
      {
        key: "storage",
        label: "Storage",
        sortKey: "storage_capacity" as SortKey,
        groupId: "stats",
        align: "right",
        render: (m) =>
          m.storage_capacity ? (
            <span className="text-xs font-mono tabular-nums">{m.storage_capacity.toLocaleString()}</span>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          ),
      },
      {
        key: "workforce",
        label: "Workforce",
        sortKey: "workforce_capacity" as SortKey,
        groupId: "stats",
        align: "right",
        render: (m) =>
          m.workforce_capacity ? (
            <span className="text-xs font-mono tabular-nums">{m.workforce_capacity.toLocaleString()}</span>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          ),
      },
      { key: "tur_s",  label: "S",  sortKey: "turrets_s" as SortKey,  groupId: "slots-turrets", align: "right", render: (m) => slotNum(m.turrets_s) },
      { key: "tur_m",  label: "M",  sortKey: "turrets_m" as SortKey,  groupId: "slots-turrets", align: "right", render: (m) => slotNum(m.turrets_m) },
      { key: "tur_l",  label: "L",  sortKey: "turrets_l" as SortKey,  groupId: "slots-turrets", align: "right", render: (m) => slotNum(m.turrets_l) },
      { key: "tur_xl", label: "XL", sortKey: "turrets_xl" as SortKey, groupId: "slots-turrets", align: "right", render: (m) => slotNum(m.turrets_xl) },
      { key: "shd_s",  label: "S",  sortKey: "shields_s" as SortKey,  groupId: "slots-shields", align: "right", render: (m) => slotNum(m.shields_s) },
      { key: "shd_m",  label: "M",  sortKey: "shields_m" as SortKey,  groupId: "slots-shields", align: "right", render: (m) => slotNum(m.shields_m) },
      { key: "shd_l",  label: "L",  sortKey: "shields_l" as SortKey,  groupId: "slots-shields", align: "right", render: (m) => slotNum(m.shields_l) },
      { key: "shd_xl", label: "XL", sortKey: "shields_xl" as SortKey, groupId: "slots-shields", align: "right", render: (m) => slotNum(m.shields_xl) },
      {
        key: "licence",
        label: "Licence",
        sortKey: undefined,
        groupId: "unlock",
        align: "left",
        render: (m) => {
          const lic = m.restriction_licence;
          if (!lic) return <span className="text-muted-foreground text-xs">—</span>;
          const hasLicence = !isModuleLicenceLocked(m.makerrace, lic, licenceSet, anyLicenceSet);
          return (
            <span className={cn("text-xs cursor-default", hasLicence ? "text-emerald-400" : "text-red-400/80")}
              title={hasLicence ? `Licence owned (${formatLicence(lic)} from ${licenceSourceLabel(m.makerrace)})` : `Licence locked (requires ${formatLicence(lic)} from ${licenceSourceLabel(m.makerrace)})`}>
              {formatLicence(lic)}
            </span>
          );
        },
      },
      {
        key: "price",
        label: "Blueprint",
        sortKey: "blueprint_price_avg" as SortKey,
        groupId: "unlock",
        align: "right",
        render: (m) => {
          if (m.has_blueprint) {
            return (
              <span className="inline-flex items-center gap-1.5 text-xs">
                <span className="text-emerald-400" title={m.blueprint_price_avg ? `Blueprint owned · ${m.blueprint_price_avg.toLocaleString()} Cr` : "Blueprint owned"}>✓</span>
              </span>
            );
          }
          const licenceLocked = isModuleLicenceLocked(m.makerrace, m.restriction_licence, licenceSet, anyLicenceSet);
          if (m.blueprint_price_avg && !licenceLocked) {
            return (
              <span className="inline-flex items-center gap-1.5 text-xs">
                <span className="text-amber-400/80" title="Blueprint available for purchase">⊕</span>
                <Currency value={m.blueprint_price_avg} />
              </span>
            );
          }
          const isFreeDefault = !m.blueprint_price_avg && !licenceLocked && m.is_obtainable;
          if (isFreeDefault) {
            return (
              <span className="inline-flex items-center gap-1.5 text-xs">
                <span className="text-emerald-400/60" title="No blueprint required">—</span>
              </span>
            );
          }
          const reason = !m.blueprint_price_avg ? "Blueprint unobtainable" : "Blueprint locked behind licence";
          return (
            <span className="inline-flex items-center gap-1.5 text-xs">
              <span className="text-red-400/80" title={reason}>✗</span>
              {m.blueprint_price_avg ? <Currency value={m.blueprint_price_avg} /> : <span className="text-muted-foreground">—</span>}
            </span>
          );
        },
      },
      // ── Build ──
      {
        key: "build_time",
        label: "Build",
        sortKey: "build_time_sec" as SortKey,
        groupId: "build",
        align: "right",
        render: (m) =>
          m.build_time_sec != null ? (
            <span className="text-xs font-mono tabular-nums">
              {m.build_time_sec >= 60
                ? `${Math.floor(m.build_time_sec / 60)}m ${Math.round(m.build_time_sec % 60)}s`
                : `${m.build_time_sec.toFixed(0)}s`}
            </span>
          ) : <span className="text-muted-foreground text-xs">—</span>,
      },
      {
        key: "est_cost",
        label: "Est. Cost",
        sortKey: "est_cost" as SortKey,
        groupId: "build",
        align: "right",
        render: (m) =>
          m.est_cost != null ? <Currency value={m.est_cost} /> : <span className="text-muted-foreground text-xs">—</span>,
      },
      // ── Docks ──
      { key: "dock_s_c",  label: "S",  sortKey: "dock_s" as SortKey,  groupId: "docks", align: "right", render: (m) => slotNum(m.dock_s) },
      { key: "dock_m_c",  label: "M",  sortKey: "dock_m" as SortKey,  groupId: "docks", align: "right", render: (m) => slotNum(m.dock_m) },
      { key: "dock_l_c",  label: "L",  sortKey: "dock_l" as SortKey,  groupId: "docks", align: "right", render: (m) => slotNum(m.dock_l) },
      { key: "dock_xl_c", label: "XL", sortKey: "dock_xl" as SortKey, groupId: "docks", align: "right", render: (m) => slotNum(m.dock_xl) },
      { key: "hangar_s_c",label: "H S", sortKey: "hangar_s" as SortKey, groupId: "docks", align: "right", render: (m) => slotNum(m.hangar_s) },
      { key: "hangar_m_c",label: "H M", sortKey: "hangar_m" as SortKey, groupId: "docks", align: "right", render: (m) => slotNum(m.hangar_m) },
      { key: "snap_c",    label: "Snap", sortKey: "snap_points" as SortKey, groupId: "docks", align: "right", render: (m) => slotNum(m.snap_points) },
      // ── Production ──
      {
        key: "produces",
        label: "Produces",
        sortKey: "produces_ware_name" as SortKey,
        groupId: "production",
        align: "left",
        render: (m) =>
          m.produces_ware_name ? (
            <span className="text-xs">{m.produces_ware_name}</span>
          ) : <span className="text-muted-foreground text-xs">—</span>,
      },
      {
        key: "prod_rate",
        label: "Rate/hr",
        sortKey: "production_rate" as SortKey,
        groupId: "production",
        align: "right",
        render: (m) =>
          m.production_rate != null ? (
            <span className="text-xs font-mono tabular-nums">{Math.round(m.production_rate * 3600).toLocaleString()}</span>
          ) : <span className="text-muted-foreground text-xs">—</span>,
      },
      {
        key: "consumes",
        label: "Consumes",
        sortKey: "consumes_ware_name" as SortKey,
        groupId: "production",
        align: "left",
        render: (m) =>
          m.consumes_ware_name ? (
            <span className="text-xs">{m.consumes_ware_name}</span>
          ) : <span className="text-muted-foreground text-xs">—</span>,
      },
      {
        key: "cons_rate",
        label: "Cons./hr",
        sortKey: "consumption_rate" as SortKey,
        groupId: "production",
        align: "right",
        render: (m) =>
          m.consumption_rate != null ? (
            <span className="text-xs font-mono tabular-nums">{Math.round(m.consumption_rate).toLocaleString()}</span>
          ) : <span className="text-muted-foreground text-xs">—</span>,
      },
    ],
    [licenceSet, anyLicenceSet, factionMap]
  );

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 py-5">
        <h1 className="text-2xl font-bold tracking-tight">Station Modules</h1>
        <PageSubtitle>
          {modules.length} buildable modules · hull, storage, turret &amp; shield hardpoints, blueprint prices
        </PageSubtitle>
      </div>

      <ModulesFilterBar
        search={search} setSearch={setSearch}
        selectedKind={selectedKind} setSelectedKind={setSelectedKind} kinds={kinds}
        selectedSize={selectedSize} setSelectedSize={setSelectedSize} sizes={sizes}
        selectedFactions={selectedFactions} setSelectedFactions={setSelectedFactions}
        availableFactions={availableFactions} factionMap={factionMap}
        availabilityFilter={availabilityFilter} setAvailabilityFilter={setAvailabilityFilter}
        obtainableOnly={obtainableOnly} setObtainableOnly={setObtainableOnly}
        columnOptions={columnOptions} visibleColumns={visibleColumns} setVisibleColumns={setVisibleColumns}
        groupBy={groupBy} setGroupBy={setGroupBy}
      />

      <div className="flex-1 overflow-hidden px-6 pb-6 pt-2 flex flex-col min-h-0">
        <HUDCard className="h-full">
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <PageLoaderPreset preset="trade" />
            ) : (
              <DataTable
                columns={columns}
                columnGroups={COLUMN_GROUPS}
                rows={sorted}
                rowGroups={rowGroups}
                getRowKey={(m) => m.module_id}
                sortKey={sortCol}
                sortDir={sortDesc ? "desc" : "asc"}
                onSortChange={(k) => handleSort(k)}
                visibleColumns={visibleColumns}
                onRowClick={(m) => setSelectedModule(m)}
                emptyMessage="No modules match your filters."
              />
            )}
          </div>
        </HUDCard>
      </div>

      <DetailDialog
        open={selectedModule !== null}
        onOpenChange={(open) => { if (!open) setSelectedModule(null); }}
        title={selectedModule?.name ?? "Module details"}
        description={`Detailed stats for ${selectedModule?.name}`}
        contentClassName="sm:max-w-2xl md:max-w-3xl min-h-[50vh] max-h-[90vh] overflow-y-auto"
      >
        {selectedModule && <ModuleDetailPanel moduleId={selectedModule.module_id} summary={selectedModule} factions={factions} licenceSet={licenceSet} anyLicenceSet={anyLicenceSet} />}
      </DetailDialog>
    </div>
  );
}
