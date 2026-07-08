import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useSettings } from "../../lib/settingsStore";
import { SizeFilterGroup } from "../../components/game/SizeFilterGroup";
import { PageTabs, PageTab } from "../../components/ui/page-tabs";

import { PageLoaderPreset } from "../../components/layout/PageLoader";
import { PageSubtitle } from "../../components/ui/page-subtitle";
import { HUDCard } from "../../components/layout/HUDCard";
import { FilterBar } from "../../components/layout/FilterBar";
import { SearchInput } from "../../components/ui/search-input";
import { EquipmentFilterBar } from "./components/EquipmentFilterBar";
import { EquipmentTable } from "./components/EquipmentTable";
import { CATEGORIES, SIZE_ORDER } from "./lib/equipmentCategories";
import { getWeaponType } from "../../lib/formatters";
import type { FactionSummary } from "../../lib/types";
import { DetailDialog } from "../../components/ui/detail-dialog";
import { apiGet } from "../../lib/api";
import { VISIBLE_FACTIONS_PATH, VISIBLE_FACTIONS_QUERY_KEY } from "../../lib/factionQueries";
import { useKnownFactions } from "../../lib/useKnownFactions";
import { usePlayerLicences } from "../../lib/usePlayerLicences";
import { useGlobalLicences } from "../../lib/useGlobalLicences";
import {
  EquipmentDetailPanel,
  type Equipment,
} from "../../components/detail-panels/EquipmentDetailPanel";

// ── Page ────────────────────────────────────────────────────────────────────────

export default function EquipmentPage() {
  const [catId, setCatId] = useState("engine");
  const [size, setSize] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [factionFilter, setFactionFilter] = useState("all");
  const [mkFilter, setMkFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [obtainableOnly, setObtainableOnly] = useState(true);
  const { settings } = useSettings();

  const { data: knownFactions = {} } = useKnownFactions();

  const { data: playerLicences = [] } = usePlayerLicences();

  const playerLicenceSet = useMemo(() => {
    const set = new Set<string>();
    for (const l of playerLicences)
      set.add(`${l.faction_id}:${l.licence_type}`);
    return set;
  }, [playerLicences]);

  const { data: rawItems = [], isLoading } = useQuery<Equipment[]>({
    queryKey: ["equipment"],
    queryFn: () =>
      apiGet<any>("/api/v1/equipment?limit=2000").then((d) =>
        Array.isArray(d) ? d : []
      ),
    staleTime: 5 * 60_000,
  });

  const items = useMemo(() => {
    if (!settings.fogOfWar) return rawItems;
    return rawItems.filter(
      (e) => e.faction_id == null || knownFactions[e.faction_id] !== false
    );
  }, [rawItems, knownFactions, settings.fogOfWar]);

  const { data: factions = [] } = useQuery<FactionSummary[]>({
    queryKey: VISIBLE_FACTIONS_QUERY_KEY,
    queryFn: () => apiGet<FactionSummary[]>(VISIBLE_FACTIONS_PATH),
  });

  const globalLicences = useGlobalLicences(items);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const cat of CATEGORIES)
      c[cat.id] = items.filter((e) => cat.match(e.kind)).length;
    return c;
  }, [items]);

  const category = CATEGORIES.find((c) => c.id === catId) ?? CATEGORIES[0];
  const inCategory = useMemo(
    () => items.filter((e) => category.match(e.kind)),
    [items, category]
  );

  const isLinear = size !== null;

  const globalMaxima = useMemo(() => {
    const m: Record<string, number> = {};
    for (const col of category.metrics) {
      m[col.key] = Math.max(1, ...inCategory.map((e) => col.get(e) ?? 0));
    }
    return m;
  }, [category.metrics, inCategory]);

  const perSizeMaxima = useMemo(() => {
    const m: Record<string, Record<string, number>> = {};
    for (const item of inCategory) {
      if (!item.size) continue;
      if (!m[item.size]) m[item.size] = {};
      for (const col of category.metrics) {
        const v = col.get(item) ?? 0;
        if (v > (m[item.size][col.key] ?? 0)) m[item.size][col.key] = v;
      }
    }
    return m;
  }, [category.metrics, inCategory]);

  const sizes = useMemo(
    () =>
      [
        ...new Set(
          inCategory.map((e) => e.size).filter((s): s is string => !!s)
        ),
      ].sort((a, b) => (SIZE_ORDER[a] ?? 9) - (SIZE_ORDER[b] ?? 9)),
    [inCategory]
  );

  const shortToFullFaction = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of factions) {
      if (f.short_name) map.set(f.short_name.toLowerCase(), f.faction_id);
      map.set(f.faction_id.substring(0, 3), f.faction_id);
      map.set(f.faction_id, f.faction_id);
    }
    return map;
  }, [factions]);

  const availableFactions = useMemo(() => {
    const scoped = inCategory.filter((e) => (size ? e.size === size : true));
    const set = new Set(
      scoped
        .map((i) =>
          i.faction_id
            ? (shortToFullFaction.get(i.faction_id) ?? i.faction_id)
            : null
        )
        .filter(Boolean) as string[]
    );
    return Array.from(set).sort();
  }, [inCategory, size, shortToFullFaction]);

  const availableMks = useMemo(() => {
    const scoped = inCategory.filter((e) => (size ? e.size === size : true));
    const set = new Set(scoped.map((i) => i.mk).filter(Boolean) as number[]);
    return Array.from(set).sort((a, b) => a - b);
  }, [inCategory, size]);

  const availableTypes = useMemo(() => {
    if (!["weapon", "turret"].includes(category.id)) return [];
    const scoped = inCategory.filter((e) => (size ? e.size === size : true));
    const set = new Set(scoped.map((i) => getWeaponType(i.name)));
    return Array.from(set).sort();
  }, [inCategory, size, category.id]);

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return inCategory.filter((e) => {
      if (size && e.size !== size) return false;
      if (needle && !e.name.toLowerCase().includes(needle)) return false;
      if (factionFilter !== "all") {
        const resolved = e.faction_id
          ? (shortToFullFaction.get(e.faction_id) ?? e.faction_id)
          : null;
        if (resolved !== factionFilter) return false;
      }
      if (mkFilter !== "all" && e.mk?.toString() !== mkFilter) return false;
      if (typeFilter !== "all" && ["weapon", "turret"].includes(category.id)) {
        if (getWeaponType(e.name) !== typeFilter) return false;
      }
      if (obtainableOnly) {
        const resolvedId = e.faction_id
          ? (shortToFullFaction.get(e.faction_id) ?? e.faction_id)
          : null;
        const isGen =
          e.restriction_licence === "generaluseequipment" ||
          e.restriction_licence === "generaluseship";
        if (
          !(
            !e.restriction_licence ||
            isGen ||
            (resolvedId && playerLicenceSet.has(`${resolvedId}:${e.restriction_licence}`))
          )
        )
          return false;
      }
      return true;
    });
  }, [
    inCategory,
    size,
    search,
    factionFilter,
    mkFilter,
    typeFilter,
    category.id,
    shortToFullFaction,
    obtainableOnly,
    playerLicenceSet,
  ]);

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 pt-5">
        <h1 className="text-2xl font-bold tracking-tight">Equipment</h1>
        <PageSubtitle>
          Compare ship parts — pick a category and size, ranked by the stat that
          matters.
        </PageSubtitle>
        <PageTabs>
          {CATEGORIES.filter((c) => counts[c.id] > 0).map((c) => (
            <PageTab
              key={c.id}
              active={c.id === catId}
              onClick={() => {
                setCatId(c.id);
                setSize(null);
                setFactionFilter("all");
                setMkFilter("all");
                setTypeFilter("all");
              }}
            >
              {c.label}{" "}
              <span className="text-xs text-muted-foreground ml-1">
                {counts[c.id]}
              </span>
            </PageTab>
          ))}
        </PageTabs>
      </div>

      <FilterBar>
        <SearchInput
          placeholder="Search parts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-48"
        />
        {sizes.length > 0 && (
          <SizeFilterGroup values={sizes} selected={size} onChange={setSize} allLabel="All sizes" />
        )}
        {/* TODO: inline EquipmentFilterBar contents directly into FilterBar children */}
        <EquipmentFilterBar
          categoryKind={category.id}
          availableFactions={availableFactions}
          factions={factions}
          factionFilter={factionFilter}
          setFactionFilter={setFactionFilter}
          availableMks={availableMks}
          mkFilter={mkFilter}
          setMkFilter={setMkFilter}
          availableTypes={availableTypes}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          showObtainableOnly={true}
          obtainableOnly={obtainableOnly}
          setObtainableOnly={setObtainableOnly}
          showSort={false}
        />
      </FilterBar>

      <div className="flex-1 overflow-hidden px-6 pb-6 pt-2 flex flex-col min-h-0">
        <HUDCard className="h-full">
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <PageLoaderPreset preset="equipment" />
            ) : shown.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No parts match.
              </p>
            ) : (
              <EquipmentTable
                category={category}
                items={shown}
                factions={factions}
                onSelect={setSelectedEquipment}
                globalMaxima={globalMaxima}
                perSizeMaxima={perSizeMaxima}
                isLinear={isLinear}
                globalLicences={globalLicences}
              />
            )}
          </div>
        </HUDCard>
      </div>

      <DetailDialog
        open={selectedEquipment !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedEquipment(null);
        }}
        title={selectedEquipment?.name ?? "Equipment details"}
        description={`Detailed stats for ${selectedEquipment?.name}`}
      >
        {selectedEquipment && (
          <EquipmentDetailPanel
            item={selectedEquipment}
            factions={factions}
          />
        )}
      </DetailDialog>
    </div>
  );
}
