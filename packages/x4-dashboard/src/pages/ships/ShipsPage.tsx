import React, { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useSettings } from "../../lib/settingsStore";
import { Info, Wrench } from "lucide-react";
import { EntityIcon } from "../../components/game/EntityIcon";
import { FactionBadge } from "../../components/game/FactionBadge";
import { MultiFactionBadge, pickPrimary } from "../../components/game/MultiFactionBadge";
import { LicenceBadge } from "../../components/game/LicenceBadge";
import { StatBar } from "../../components/data-display/StatBar";
import { Currency } from "../../components/game/Currency";
import { classShort, formatLicence, formatDlc } from "../../lib/formatters";
import { cn } from "../../lib/utils";
import type { FactionSummary } from "../../lib/types";
import { ShipClassBadge, ShipTypeBadge } from "../../components/game/ShipBadges";
import { Button } from "../../components/ui/button";
import { ShipDetailPanel } from "../../components/detail-panels/ShipDetailPanel";
import { DetailDialog } from "../../components/ui/detail-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip";
import { PageLoaderPreset } from "../../components/layout/PageLoader";
import { PageSubtitle } from "../../components/ui/page-subtitle";
import { HUDCard } from "../../components/layout/HUDCard";
import { DataTable } from "../../components/data-display/DataTable";
import type { ColumnDef } from "../../components/data-display/DataTable";
import { useRowGroups } from "../../lib/useRowGroups";
import { useColumnVisibility } from "../../lib/useColumnVisibility";
import { apiGet } from "../../lib/api";
import { VISIBLE_FACTIONS_PATH, VISIBLE_FACTIONS_QUERY_KEY } from "../../lib/factionQueries";
import { useKnownFactions } from "../../lib/useKnownFactions";
import { useFactionMap } from "../../lib/useFactionMap";
import { usePlayerLicences } from "../../lib/usePlayerLicences";
import { useGlobalLicences } from "../../lib/useGlobalLicences";
import {
  COLUMN_GROUPS,
  DEFAULT_VISIBLE,
  MAX_ACCEL, MAX_BOOST, MAX_CARGO, MAX_HULL, MAX_RADAR, MAX_RANGE, MAX_SHIELD,
  MAX_SHIELD_RECHARGE, MAX_SPEED, MAX_TRAVEL,
  STORAGE_KEY,
  renderGroupHeaderContent,
  type GroupByKey,
  type ShipSummary,
  type SortKey,
} from "./lib/shipsColumns";
import { ShipsFilterBar } from "./components/ShipsFilterBar";

export default function ShipsPage() {
  const { location } = useRouterState();
  const { settings } = useSettings();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [selectedFactions, setSelectedFactions] = useState<Set<string>>(new Set());
  const [selectedDlcs, setSelectedDlcs] = useState<Set<string>>(new Set());
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [selectedSubTypes, setSelectedSubTypes] = useState<Set<string>>(new Set());
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [obtainableOnly, setObtainableOnly] = useState(true);
  const [buyableOnly, setBuyableOnly] = useState(false);
  const [buildableOnly, setBuildableOnly] = useState(false);
  const [selectedShip, setSelectedShip] = useState<ShipSummary | null>(null);
  const [sortCol, setSortCol] = useState<SortKey>("name");
  const [sortDesc, setSortDesc] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupByKey>("none");
  const [visibleColumns, setVisibleColumns] = useColumnVisibility(
    STORAGE_KEY,
    DEFAULT_VISIBLE
  );

  React.useEffect(() => {
    if (location.pathname !== "/ships") setSelectedShip(null);
  }, [location.pathname]);

  const isLinear = selectedClass !== null;

  const { data: ships = [], isLoading } = useQuery<ShipSummary[]>({
    queryKey: ["ships"],
    queryFn: () => apiGet<ShipSummary[]>("/api/v1/ships?limit=2000"),
  });

  const { data: factions = [] } = useQuery<FactionSummary[]>({
    queryKey: VISIBLE_FACTIONS_QUERY_KEY,
    queryFn: () => apiGet<FactionSummary[]>(VISIBLE_FACTIONS_PATH),
  });

  const { data: knownFactions = {} } = useKnownFactions();

  const { data: playerLicences = [] } = usePlayerLicences();

  const factionMap = useFactionMap(factions);
  const licenceSet = useMemo(
    () => new Set(playerLicences.map((l) => `${l.faction_id}:${l.licence_type}`)),
    [playerLicences]
  );
  const licenceTypeSet = useMemo(
    () => new Set(playerLicences.map((l) => l.licence_type)),
    [playerLicences]
  );

  const globalLicences = useGlobalLicences(ships);

  const filtered = ships.filter((s) => {
    if (settings.fogOfWar && s.owner_factions?.length > 0 && s.owner_factions.every((fid) => knownFactions[fid] === false))
      return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()))
      return false;
    if (selectedClass && classShort(s.class_id) !== selectedClass) return false;
    if (
      selectedFactions.size > 0 &&
      (!s.owner_factions?.length || !s.owner_factions.some((fid) => selectedFactions.has(fid)))
    )
      return false;
    if (selectedTypes.size > 0 && (!s.role || !selectedTypes.has(s.role)))
      return false;
    if (
      selectedTypes.size > 0 &&
      selectedSubTypes.size > 0 &&
      (!s.ship_type || !selectedSubTypes.has(s.ship_type))
    )
      return false;
    const dlcKey = s.dlc || "base_game";
    if (selectedDlcs.size > 0 && !selectedDlcs.has(dlcKey)) return false;
    if (ownedOnly && !s.is_owned) return false;
    if (obtainableOnly && !s.is_obtainable) return false;
    if (buyableOnly) {
      if (s.chassis_price_avg == null) return false;
      const lic = s.restriction_licence;
      const restricted = lic && lic !== "generaluseship" && lic !== "generaluseequipment";
      if (restricted) {
        const hasLic = globalLicences.has(lic)
          ? licenceTypeSet.has(lic)
          : s.owner_factions?.some((fid) => licenceSet.has(`${fid}:${lic}`));
        if (!hasLic) return false;
      }
    }
    if (buildableOnly && !s.has_blueprint) return false;
    return true;
  });

  // Per-class maxima for linear scaling — computed from ALL ships of the selected
  // class (ignoring role/faction/search) so the ceiling stays stable while filtering.
  const classShips = isLinear
    ? ships.filter((s) => classShort(s.class_id) === selectedClass)
    : [];
  const classMaxSpeed  = isLinear ? Math.max(...classShips.map((s) => s.speed_max ?? 0), 1) : 0;
  const classMaxTravel = isLinear ? Math.max(...classShips.map((s) => s.travel_max ?? 0), 1) : 0;
  const classMaxBoost  = isLinear ? Math.max(...classShips.map((s) => s.boost_max ?? 0), 1) : 0;
  const classMaxAccel  = isLinear ? Math.max(...classShips.map((s) => s.accel_max ?? 0), 1) : 0;
  const classMaxHull   = isLinear ? Math.max(...classShips.map((s) => s.hull ?? 0), 1) : 0;
  const classMaxShield = isLinear ? Math.max(...classShips.map((s) => s.shield_capacity_max ?? 0), 1) : 0;
  const classMaxShieldRecharge = isLinear ? Math.max(...classShips.map((s) => s.shield_recharge_max ?? 0), 1) : 0;
  const classMaxCargo  = isLinear ? Math.max(...classShips.map((s) => s.cargo_volume ?? 0), 1) : 0;
  const classMaxDps    = isLinear ? Math.max(...classShips.map((s) => s.dps_max ?? 0), 1) : 0;
  const classMaxRange  = isLinear ? Math.max(...classShips.map((s) => s.range_max ?? 0), 1) : 0;
  const classMaxRadar  = isLinear ? Math.max(...classShips.map((s) => s.radar_range ?? 0), 1) : 0;

  // Resolve primary_faction client-side for sort / group-by (component owns this logic).
  const withPrimary = useMemo(
    () =>
      filtered.map((s) => ({
        ...s,
        primary_faction: pickPrimary(s.owner_factions, factionMap),
      })),
    [filtered, factionMap],
  );

  const sorted = [...withPrimary].sort((a, b) => {
    // "faction_id" sort resolves via primary_faction (the ship's design faction).
    const aVal = sortCol === "faction_id" ? a.primary_faction ?? null : a[sortCol];
    const bVal = sortCol === "faction_id" ? b.primary_faction ?? null : b[sortCol];
    if (aVal === null && bVal !== null) return sortDesc ? 1 : -1;
    if (aVal !== null && bVal === null) return sortDesc ? -1 : 1;
    if (aVal === null && bVal === null) return 0;
    if (typeof aVal === "string" && typeof bVal === "string") {
      if (sortCol === "restriction_licence") {
        const fmt = (v: string) =>
          v === "generaluseship" || v === "generaluseequipment" ? "" : formatLicence(v);
        return sortDesc
          ? fmt(bVal).localeCompare(fmt(aVal))
          : fmt(aVal).localeCompare(fmt(bVal));
      }
      return sortDesc ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
    }
    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortDesc ? bVal - aVal : aVal - bVal;
    }
    return 0;
  });

  const handleSort = (key: SortKey) => {
    if (sortCol === key) setSortDesc(!sortDesc);
    else { setSortCol(key); setSortDesc(false); }
  };

  const hasFilters =
    search ||
    selectedClass !== null ||
    selectedFactions.size > 0 ||
    selectedDlcs.size > 0 ||
    selectedTypes.size > 0 ||
    (selectedTypes.size > 0 && selectedSubTypes.size > 0) ||
    ownedOnly ||
    !obtainableOnly ||
    buyableOnly ||
    buildableOnly;

  // ── DataTable columns (memoized — render fns close over stat scaling values) ──

  const columns = useMemo<ColumnDef<ShipSummary>[]>(() => {
    function numCell(val: number | null | undefined) {
      if (val == null || val === 0)
        return <span className="text-muted-foreground text-xs">—</span>;
      return (
        <span className="text-xs font-mono tabular-nums">
          {val.toLocaleString()}
        </span>
      );
    }

    function statBar(
      raw: number | null | undefined,
      maxConst: number,
      classMax: number,
      label: string
    ) {
      if (raw == null || raw === 0)
        return <span className="text-muted-foreground text-xs">—</span>;
      return (
        <StatBar
          value={isLinear ? raw : Math.log10(raw + 1)}
          max={isLinear ? classMax : Math.log10(maxConst + 1)}
          labelRight={label}
        />
      );
    }

    return [
      // ── Name (no groupId → rowSpan=2 in grouped header) ──
      {
        key: "name",
        label: "Name",
        sortKey: "name",
        align: "left",
        alwaysVisible: true,
        render: (ship) => (
          <span className="font-medium">
            {ship.name}
            {!ship.can_be_captured && (
              <span
                className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-500/15 text-red-400 border border-red-500/30"
                title="This ship can never be captured or owned by the player."
              >
                NPC Only
              </span>
            )}
          </span>
        ),
      },
      // ── Classification ──
      {
        key: "type",
        label: "Type",
        sortKey: "role",
        groupId: "classification",
        align: "left",
        render: (ship) =>
          ship.role || ship.ship_type ? (
            <ShipTypeBadge role={ship.role} subtype={ship.ship_type} className="text-xs" />
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          ),
      },
      {
        key: "class",
        label: "Class",
        sortKey: "class_id",
        groupId: "classification",
        align: "left",
        render: (ship) => (
          <ShipClassBadge class_id={ship.class_id} className="text-sm" />
        ),
      },
      {
        key: "faction",
        label: "Faction",
        sortKey: "faction_id",
        groupId: "classification",
        align: "left",
        render: (ship) => (
          <MultiFactionBadge
            ownerFactions={ship.owner_factions}
            factionMap={factionMap}
          />
        ),
      },
      {
        key: "licence",
        label: "Licence",
        sortKey: "restriction_licence",
        groupId: "acquisition",
        align: "left",
        render: (ship) => {
          const lic = ship.restriction_licence;
          if (!lic || lic === "generaluseship" || lic === "generaluseequipment")
            return <span className="text-muted-foreground text-xs">—</span>;
          return (
            <LicenceBadge
              licence={lic}
              ownerFactions={ship.owner_factions ?? []}
              factionMap={factionMap}
              licenceSet={licenceSet}
              licenceTypeSet={licenceTypeSet}
              globalLicences={globalLicences}
            />
          );
        },
      },
      {
        key: "chassis",
        label: "Chassis",
        sortKey: "chassis_price_avg",
        groupId: "acquisition",
        align: "right",
        render: (ship) => (
          <span className="text-xs tabular-nums">
            {ship.chassis_price_avg != null ? <Currency value={ship.chassis_price_avg} /> : <span className="text-muted-foreground">—</span>}
          </span>
        ),
      },
      {
        key: "price",
        label: "Blueprint",
        sortKey: "blueprint_price_max",
        groupId: "acquisition",
        align: "right",
        render: (ship) => {
          if (ship.has_blueprint) {
            return (
              <span className="inline-flex items-center gap-1.5 text-xs">
                <span className="text-emerald-400" title={ship.blueprint_price_max ? `Blueprint owned · ${ship.blueprint_price_max.toLocaleString()} Cr` : "Blueprint owned"}>✓</span>
              </span>
            );
          }
          const lic = ship.restriction_licence;
          const hasRestriction = lic && lic !== "generaluseship" && lic !== "generaluseequipment";
          const hasLicence = !hasRestriction || (globalLicences.has(lic) ? licenceTypeSet.has(lic) : ship.owner_factions?.length > 0 ? ship.owner_factions.some((fid) => licenceSet.has(`${fid}:${lic}`)) : false);
          const licenceLocked = !hasLicence;

          if (ship.blueprint_price_max && !licenceLocked) {
            return (
              <span className="inline-flex items-center gap-1.5 text-xs">
                <span className="text-amber-400/80" title="Blueprint available for purchase">⊕</span>
                <Currency value={ship.blueprint_price_max} />
              </span>
            );
          }

          const isFreeDefault = !ship.blueprint_price_max && !licenceLocked && ship.is_obtainable;
          if (isFreeDefault) {
            return (
              <span className="inline-flex items-center gap-1.5 text-xs">
                <span className="text-emerald-400/60" title="No blueprint required">—</span>
              </span>
            );
          }
          const reason = !ship.blueprint_price_max ? "Blueprint unobtainable" : "Blueprint locked behind licence";
          return (
            <span className="inline-flex items-center gap-1.5 text-xs">
              <span className="text-red-400/80" title={reason}>✗</span>
              {ship.blueprint_price_max ? <Currency value={ship.blueprint_price_max} /> : <span className="text-muted-foreground">—</span>}
            </span>
          );
        },
      },
      // ── Flight ──
      {
        key: "speed",
        label: "Speed",
        sortKey: "speed_max",
        groupId: "flight",
        align: "right",
        render: (ship) =>
          statBar(ship.speed_max, MAX_SPEED, classMaxSpeed, `${ship.speed_max?.toFixed(0) ?? "—"} m/s`),
      },
      {
        key: "travel",
        label: "Travel",
        sortKey: "travel_max",
        groupId: "flight",
        align: "right",
        render: (ship) =>
          statBar(ship.travel_max, MAX_TRAVEL, classMaxTravel, `${ship.travel_max?.toFixed(0) ?? "—"} m/s`),
      },
      {
        key: "boost",
        label: "Boost",
        sortKey: "boost_max",
        groupId: "flight",
        align: "right",
        render: (ship) =>
          statBar(ship.boost_max, MAX_BOOST, classMaxBoost, `${ship.boost_max?.toFixed(0) ?? "—"} m/s`),
      },
      {
        key: "accel",
        label: "Accel",
        sortKey: "accel_max",
        groupId: "flight",
        align: "right",
        render: (ship) =>
          statBar(ship.accel_max, MAX_ACCEL, classMaxAccel, `${ship.accel_max?.toFixed(1) ?? "—"} m/s²`),
      },
      // ── Defense ──
      {
        key: "hull",
        label: "Hull",
        sortKey: "hull",
        groupId: "defense",
        align: "right",
        render: (ship) =>
          statBar(ship.hull, MAX_HULL, classMaxHull, `${ship.hull?.toLocaleString() ?? "—"} HP`),
      },
      {
        key: "shield",
        label: "Shield",
        sortKey: "shield_capacity_max",
        groupId: "defense",
        align: "right",
        render: (ship) =>
          statBar(
            ship.shield_capacity_max,
            MAX_SHIELD,
            classMaxShield,
            `${ship.shield_capacity_max?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? "—"} MJ`
          ),
      },
      {
        key: "regen",
        label: "Regen",
        sortKey: "shield_recharge_max",
        groupId: "defense",
        align: "right",
        render: (ship) =>
          statBar(
            ship.shield_recharge_max,
            MAX_SHIELD_RECHARGE,
            classMaxShieldRecharge,
            `${ship.shield_recharge_max?.toFixed(0) ?? "—"} MW/s`
          ),
      },
      // ── Logi ──
      {
        key: "cargo",
        label: "Cargo",
        sortKey: "cargo_volume",
        groupId: "logi",
        align: "right",
        render: (ship) =>
          statBar(ship.cargo_volume, MAX_CARGO, classMaxCargo, ship.cargo_volume?.toLocaleString() ?? "—"),
      },
      {
        key: "radar",
        label: "Radar",
        sortKey: "radar_range",
        groupId: "logi",
        align: "right",
        render: (ship) =>
          statBar(
            ship.radar_range,
            MAX_RADAR,
            classMaxRadar,
            `${ship.radar_range != null ? (ship.radar_range / 1000).toFixed(0) : "—"} km`
          ),
      },
      // ── Offense ──
      {
        key: "dps",
        label: "DPS",
        sortKey: "dps_max",
        groupId: "offense",
        align: "right",
        render: (ship) =>
          statBar(
            ship.dps_max,
            50000,
            classMaxDps,
            ship.dps_max?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? "—"
          ),
      },
      {
        key: "range",
        label: "Wpn Range",
        sortKey: "range_max",
        groupId: "offense",
        align: "right",
        render: (ship) =>
          statBar(
            ship.range_max,
            MAX_RANGE,
            classMaxRange,
            `${ship.range_max?.toFixed(1) ?? "—"} km`
          ),
      },
      // ── Capacity ──
      {
        key: "crew",
        label: "Crew",
        sortKey: "people_capacity",
        groupId: "capacity",
        align: "right",
        render: (ship) => numCell(ship.people_capacity),
      },
      {
        key: "missiles",
        label: "Missiles",
        sortKey: "missile_storage",
        groupId: "capacity",
        align: "right",
        render: (ship) => numCell(ship.missile_storage),
      },
      {
        key: "drones",
        label: "Drones",
        sortKey: "drone_storage",
        groupId: "capacity",
        align: "right",
        render: (ship) => numCell(ship.drone_storage),
      },
      {
        key: "flares",
        label: "Flares",
        sortKey: "countermeasure_storage",
        groupId: "capacity",
        align: "right",
        render: (ship) => numCell(ship.countermeasure_storage),
      },
      {
        key: "deployables",
        label: "Deployables",
        sortKey: "deployable_storage",
        groupId: "capacity",
        align: "right",
        render: (ship) => numCell(ship.deployable_storage),
      },
      {
        key: "dock_s",
        label: "S Dock",
        sortKey: "dock_s",
        groupId: "capacity",
        align: "right",
        render: (ship) => numCell(ship.dock_s),
      },
      {
        key: "dock_m",
        label: "M Dock",
        sortKey: "dock_m",
        groupId: "capacity",
        align: "right",
        render: (ship) => numCell(ship.dock_m),
      },
      {
        key: "bay_s",
        label: "S Ship Cap",
        sortKey: "storage_s",
        groupId: "capacity",
        align: "right",
        render: (ship) => numCell(ship.storage_s),
      },
      {
        key: "bay_m",
        label: "M Ship Cap",
        sortKey: "storage_m",
        groupId: "capacity",
        align: "right",
        render: (ship) => numCell(ship.storage_m),
      },
      // ── Slot columns ──
      ...([
        ["wpn_s",  "Wpn S",  "weapons_s",  "slots-weapons"],
        ["wpn_m",  "Wpn M",  "weapons_m",  "slots-weapons"],
        ["wpn_l",  "Wpn L",  "weapons_l",  "slots-weapons"],
        ["wpn_xl", "Wpn XL", "weapons_xl", "slots-weapons"],
        ["tur_s",  "Tur S",  "turrets_s",  "slots-turrets"],
        ["tur_m",  "Tur M",  "turrets_m",  "slots-turrets"],
        ["tur_l",  "Tur L",  "turrets_l",  "slots-turrets"],
        ["tur_xl", "Tur XL", "turrets_xl", "slots-turrets"],
        ["shd_s",  "Shd S",  "shields_s",  "slots-shields"],
        ["shd_m",  "Shd M",  "shields_m",  "slots-shields"],
        ["shd_l",  "Shd L",  "shields_l",  "slots-shields"],
        ["shd_xl", "Shd XL", "shields_xl", "slots-shields"],
        ["eng_s",  "Eng S",  "engines_s",  "slots-engines"],
        ["eng_m",  "Eng M",  "engines_m",  "slots-engines"],
        ["eng_l",  "Eng L",  "engines_l",  "slots-engines"],
        ["eng_xl", "Eng XL", "engines_xl", "slots-engines"],
      ] as const).map(
        ([key, label, statKey, groupId]): ColumnDef<ShipSummary> => ({
          key,
          label,
          sortKey: statKey,
          groupId,
          align: "right",
          render: (ship) => numCell(ship[statKey as keyof ShipSummary] as number),
        })
      ),
    ];
  }, [
    isLinear,
    classMaxSpeed, classMaxTravel, classMaxBoost, classMaxAccel,
    classMaxHull, classMaxShield, classMaxShieldRecharge,
    classMaxCargo, classMaxDps, classMaxRange, classMaxRadar,
    factionMap, globalLicences, licenceSet, licenceTypeSet,
  ]);

  // ── Row groups (when groupBy != "none") ──────────────────────────────────────

  const rowGroupKeyFn = useCallback(
    (ship: ShipSummary): string => {
      if (groupBy === "dlc") return formatDlc(ship.dlc || "base_game");
      if (groupBy === "class_id") return classShort(ship.class_id);
      if (groupBy === "role")
        return ship.role ? ship.role.charAt(0).toUpperCase() + ship.role.slice(1) : "Unknown";
      if (groupBy === "ship_type")
        return ship.ship_type
          ? ship.ship_type.charAt(0).toUpperCase() + ship.ship_type.slice(1)
          : "Unknown";
      if (groupBy === "faction_id") {
        const fid = ship.primary_faction;
        return fid
          ? factionMap.get(fid)?.name || fid
          : "No Faction";
      }
      return "";
    },
    [groupBy, factionMap]
  );

  const rowGroupSortFn = useCallback(
    (a: string, b: string) => {
      if (groupBy === "class_id") {
        const order = ["XS", "S", "M", "L", "XL"];
        return order.indexOf(a) - order.indexOf(b);
      }
      return a.localeCompare(b);
    },
    [groupBy]
  );

  const rowGroupLabelFn = useCallback(
    (key: string, groupRows: ShipSummary[]) =>
      renderGroupHeaderContent(groupBy, key, groupRows[0], factions),
    [groupBy, factions]
  );

  const rowGroups = useRowGroups(
    sorted,
    groupBy !== "none",
    rowGroupKeyFn,
    rowGroupLabelFn,
    rowGroupSortFn
  );

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5">
        <h1 className="text-2xl font-bold tracking-tight">Ships</h1>
        <PageSubtitle className="flex items-center">
          <span>
            {ships.length} ships in catalog
            {filtered.length !== ships.length && ` · ${filtered.length} matching`}
          </span>
        </PageSubtitle>
      </div>

      <ShipsFilterBar
        ships={ships}
        factions={factions}
        search={search} setSearch={setSearch}
        selectedClass={selectedClass} setSelectedClass={setSelectedClass} isLinear={isLinear}
        selectedFactions={selectedFactions} setSelectedFactions={setSelectedFactions}
        selectedTypes={selectedTypes} setSelectedTypes={setSelectedTypes}
        selectedSubTypes={selectedSubTypes} setSelectedSubTypes={setSelectedSubTypes}
        selectedDlcs={selectedDlcs} setSelectedDlcs={setSelectedDlcs}
        ownedOnly={ownedOnly} setOwnedOnly={setOwnedOnly}
        obtainableOnly={obtainableOnly} setObtainableOnly={setObtainableOnly}
        buyableOnly={buyableOnly} setBuyableOnly={setBuyableOnly}
        buildableOnly={buildableOnly} setBuildableOnly={setBuildableOnly}
        hasFilters={!!hasFilters}
        onClear={() => {
          setSearch("");
          setSelectedClass(null);
          setSelectedFactions(new Set());
          setSelectedDlcs(new Set());
          setSelectedTypes(new Set());
          setSelectedSubTypes(new Set());
          setOwnedOnly(false);
          setObtainableOnly(true);
          setBuyableOnly(false);
          setBuildableOnly(false);
        }}
        visibleColumns={visibleColumns} setVisibleColumns={setVisibleColumns}
        groupBy={groupBy} setGroupBy={setGroupBy}
      />

      <div className="flex-1 overflow-hidden px-6 pb-6 pt-2 flex flex-col min-h-0">
        <HUDCard className="h-full">
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <PageLoaderPreset preset="ships" />
            ) : (
              <DataTable
                key={groupBy}
                columns={columns}
                columnGroups={COLUMN_GROUPS}
                rows={rowGroups ? undefined : sorted}
                rowGroups={rowGroups}
                getRowKey={(ship) => ship.ship_id}
                sortKey={sortCol}
                sortDir={sortDesc ? "desc" : "asc"}
                onSortChange={(k) => handleSort(k as SortKey)}
                visibleColumns={visibleColumns}
                onRowClick={setSelectedShip}
                onRowHover={(ship) =>
                  queryClient.prefetchQuery({
                    queryKey: ["ship", ship.ship_id],
                    queryFn: () => apiGet(`/api/v1/ships/${ship.ship_id}`),
                    staleTime: 5 * 60_000,
                  })
                }
                rowPrefix={(ship) => (
                  <EntityIcon src={ship.icon_url} alt={ship.name} size={28} />
                )}
                rowSuffix={(ship) => (
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    title="Build loadout"
                    asChild
                  >
                    <Link
                      to="/ships/builder"
                      search={{ ship_id: ship.ship_id }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Wrench className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                )}
                suffixHeader={
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center cursor-help">
                        <Info className="h-3.5 w-3.5 text-sky-400/80 hover:text-sky-400 transition-colors" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent
                      side="left"
                      className="max-w-64 text-xs leading-relaxed"
                    >
                      <p>
                        Stat bars show each ship&rsquo;s{" "}
                        <strong>theoretical maximum</strong> with the best
                        available equipment for its class.
                      </p>
                      {isLinear ? (
                        <p className="mt-1">
                          Currently <strong>linear</strong> &mdash; comparing
                          ships within the selected class.
                        </p>
                      ) : (
                        <p className="mt-1">
                          Currently <strong>logarithmic</strong> &mdash;
                          comparing across all classes.
                        </p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                }
                rowClassName="h-14"
                emptyMessage="No ships match your filters."
              />
            )}
          </div>
        </HUDCard>
      </div>

      <DetailDialog
        open={selectedShip !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedShip(null);
        }}
        title={selectedShip?.name ?? "Ship details"}
        description={`Detailed stats for ${selectedShip?.name}`}
      >
        {selectedShip && (
          <ShipDetailPanel
            shipId={selectedShip.ship_id}
            factions={factions}
          />
        )}
      </DetailDialog>
    </div>
  );
}
