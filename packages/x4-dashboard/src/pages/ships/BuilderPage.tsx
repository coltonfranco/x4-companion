import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Gauge, Shield, Cpu, MoveVertical, Wrench, Check } from "lucide-react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useSettings } from "../../lib/settingsStore";
import { PageLoaderPreset } from "../../components/layout/PageLoader";
import { getWeaponType } from "../../lib/formatters";
import type { FactionSummary } from "../../lib/types";
import { cn } from "../../lib/utils";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { ClearFiltersButton } from "../../components/ui/clear-filters-button";
import { SizeBadge, EquipmentMkBadge } from "../../components/game/ShipBadges";
import { FactionCombobox } from "../../components/game/FactionCombobox";
import { ShipImage } from "../../components/game/ShipImage";
import { Switch } from "../../components/ui/switch";
import { apiGet } from "../../lib/api";
import { VISIBLE_FACTIONS_PATH, VISIBLE_FACTIONS_QUERY_KEY } from "../../lib/factionQueries";
import { useKnownFactions } from "../../lib/useKnownFactions";
import { useFactionMap } from "../../lib/useFactionMap";
import { usePlayerLicences } from "../../lib/usePlayerLicences";
import type { EquipmentEvalContext, EquipmentItem, LoadoutOption, ShipDetail, ShipSummary } from "./lib/builderTypes";
import { applyLoadoutToCart, BASE_SORTS, CATEGORIES, CATEGORY_SORTS, dps, generateSlots, getCategoryStatus, isCompatibleWithShip, isObtainable } from "./lib/builderHelpers";
import { buildApproximatePresets } from "./lib/approximatePresets";
import { ShipSelector } from "./components/ShipSelector";
import { LoadoutSelector } from "./components/LoadoutSelector";
import { CartPanel } from "./components/CartPanel";
import { EquipmentCard } from "./components/EquipmentCard";
import { EquipmentSortSelect } from "./components/EquipmentSortSelect";
import { StatsFooter } from "./components/StatsFooter";
import { RANGE_CAP } from "./lib/builderHelpers";

// ═══════════════════════════════════════════════════════════════════════════════
// Page
// ═══════════════════════════════════════════════════════════════════════════════

export default function BuilderPage() {
  const { ship_id } = useSearch({ from: "/ships/builder" });
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [selectedShipId, setSelectedShipId] = useState<string | undefined>(ship_id);
  const [activeCategory, setActiveCategory] = useState<string>("engine");
  const [cart, setCart] = useState<Record<string, EquipmentItem | null>>({});
  const [selectedLoadoutId, setSelectedLoadoutId] = useState<string>("");
  const [factionFilter, setFactionFilter] = useState<string>("all");
  const [mkFilter, setMkFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortFilter, setSortFilter] = useState<string>("");
  const [obtainableOnly, setObtainableOnly] = useState<boolean>(false);
  const [buyableOnly, setBuyableOnly] = useState<boolean>(false);
  const [buildableOnly, setBuildableOnly] = useState<boolean>(false);

  const { data: knownFactions = {} } = useKnownFactions();

  const { data: playerLicences = [] } = usePlayerLicences();

  const playerLicenceSet = useMemo(() => {
    const set = new Set<string>();
    for (const l of playerLicences) set.add(`${l.faction_id}:${l.licence_type}`);
    return set;
  }, [playerLicences]);

  const { data: allShips = [] } = useQuery<ShipSummary[]>({
    queryKey: ["ships"], queryFn: () => apiGet<ShipSummary[]>("/api/v1/ships?limit=2000"),
  });

  // Filter ships by known factions when fog of war is on
  const ships = useMemo(() => {
    if (!settings.fogOfWar) return allShips;
    return allShips.filter(s => s.owner_factions?.length === 0 || s.owner_factions?.some(fid => knownFactions[fid] !== false));
  }, [allShips, knownFactions, settings.fogOfWar]);
  const { data: shipDetail, isLoading: isShipLoading } = useQuery<ShipDetail>({
    queryKey: ["ship", selectedShipId],
    queryFn: () => apiGet<ShipDetail>(`/api/v1/ships/${selectedShipId}`),
    enabled: !!selectedShipId,
  });
  const { data: loadoutOptions = [] } = useQuery<LoadoutOption[]>({
    queryKey: ["ship", "loadout-options", selectedShipId],
    queryFn: () => apiGet<LoadoutOption[]>(`/api/v1/ships/${selectedShipId}/loadout-options`),
    enabled: !!selectedShipId,
  });
  const { data: equipment = [] } = useQuery<EquipmentItem[]>({
    queryKey: ["equipment"],
    queryFn: () => apiGet<any>("/api/v1/equipment?limit=2000").then(d => {
      if (!Array.isArray(d)) return [];
      const items = d.filter((e: any) => {
        const id = e.ware_id.toLowerCase();
        return !(id.includes('xen_') || id.includes('kha_') || id.includes('yacht_01') || id.includes('battleship_01'));
      }).map((e: any) => {
        if (e.kind === "software") {
          e.size = e.ware_id.replace(/^software_/, '').replace(/mk\d+$/, '');
          const mkMatch = e.ware_id.match(/mk(\d+)$/);
          if (mkMatch) e.mk = parseInt(mkMatch[1]);
        }
        return e as EquipmentItem;
      });

      const uniqueItems = new Map<string, EquipmentItem>();
      for (const item of items) {
        const existing = uniqueItems.get(item.name);
        if (!existing || ((item.price_avg ?? 0) < (existing.price_avg ?? 0))) {
          uniqueItems.set(item.name, item);
        }
      }
      return Array.from(uniqueItems.values());
    }),
    staleTime: 5 * 60_000,
  });
  const { data: factions = [] } = useQuery<FactionSummary[]>({
    queryKey: VISIBLE_FACTIONS_QUERY_KEY, queryFn: () => apiGet<FactionSummary[]>(VISIBLE_FACTIONS_PATH),
  });

  const factionMap = useFactionMap(factions);
  const slots = useMemo(() => shipDetail ? generateSlots(shipDetail) : [], [shipDetail]);
  const equipmentEvalContext = useMemo<EquipmentEvalContext>(
    () => ({ ship: shipDetail ?? null, slots }),
    [shipDetail, slots],
  );

  const approximatePresets = useMemo(
    () => shipDetail ? buildApproximatePresets(shipDetail, slots, equipment, playerLicenceSet) : [],
    [shipDetail, slots, equipment, playerLicenceSet],
  );
  const allLoadoutOptions = useMemo(
    () => [...loadoutOptions, ...approximatePresets],
    [loadoutOptions, approximatePresets],
  );


  // ── Per-size maxima from all equipment (stable, ignores filters) ────────────
  const equipmentMaxima = useMemo(() => {
    const m: Record<string, Record<string, Record<string, number>>> = {};
    for (const item of equipment) {
      if (!item.size) continue;
      const sz = item.size.toLowerCase();
      if (!m[item.kind]) m[item.kind] = {};
      if (!m[item.kind][sz]) m[item.kind][sz] = {};
      const cur = m[item.kind][sz];
      if (item.engine_stats) {
        const e = item.engine_stats;
        if (e.thrust_forward) cur.thrust = Math.max(cur.thrust ?? 0, e.thrust_forward);
        if (e.travel_thrust) cur.travel = Math.max(cur.travel ?? 0, e.travel_thrust);
        if (e.boost_thrust) cur.boost = Math.max(cur.boost ?? 0, e.boost_thrust);
        if (e.thrust_strafe) cur.strafe = Math.max(cur.strafe ?? 0, e.thrust_strafe);
      }
      if (item.shield_stats) {
        const s = item.shield_stats;
        if (s.capacity) cur.capacity = Math.max(cur.capacity ?? 0, s.capacity);
        if (s.recharge_rate) cur.recharge = Math.max(cur.recharge ?? 0, s.recharge_rate);
      }
      if (item.weapon_stats) {
        const w = item.weapon_stats;
        const d = dps(w);
        if (d) cur.dps = Math.max(cur.dps ?? 0, d);
        const rawRange = w.bullet_speed && w.bullet_lifetime ? (w.bullet_speed * w.bullet_lifetime) / 1000 : 0;
        if (rawRange > 0) {
          const cappedRange = Math.min(rawRange, RANGE_CAP[sz] || 20);
          cur.range = Math.max(cur.range ?? 0, cappedRange);
        }
        if (w.rotation_speed) cur.rotation = Math.max(cur.rotation ?? 0, w.rotation_speed);
      }
    }
    return m;
  }, [equipment]);

  useEffect(() => {
    if (shipDetail) {
      const fresh: Record<string, EquipmentItem | null> = {};
      for (const s of generateSlots(shipDetail)) fresh[s.key] = null;
      setCart(fresh);
      setSelectedLoadoutId("");
    }
  }, [shipDetail]);

  const category = CATEGORIES.find(c => c.id === activeCategory) ?? CATEGORIES[0];

  const availableFactions = useMemo(() => {
    if (!shipDetail) return [];
    const sizes = new Set(slots.filter(s => s.kind === category.kind).map(s => s.size));
    const items = equipment.filter(e => e.kind === category.kind && e.size != null && sizes.has(e.size));
    const set = new Set<string>();
    for (const i of items) { for (const fid of i.owner_factions) set.add(fid); }
    return Array.from(set).sort();
  }, [equipment, category, shipDetail, slots]);

  const availableMks = useMemo(() => {
    if (!shipDetail) return [];
    const sizes = new Set(slots.filter(s => s.kind === category.kind).map(s => s.size));
    const items = equipment.filter(e => e.kind === category.kind && e.size != null && sizes.has(e.size));
    const set = new Set(items.map(i => i.mk).filter(Boolean) as number[]);
    return Array.from(set).sort((a, b) => a - b);
  }, [equipment, category, shipDetail, slots]);

  const availableTypes = useMemo(() => {
    if (!shipDetail || !["weapon", "turret"].includes(category.kind)) return [];
    const sizes = new Set(slots.filter(s => s.kind === category.kind).map(s => s.size));
    const items = equipment.filter(e => e.kind === category.kind && e.size != null && sizes.has(e.size));
    const set = new Set(items.map(i => getWeaponType(i.name)));
    return Array.from(set).sort();
  }, [equipment, category, shipDetail, slots]);

  const compatibleEquipment = useMemo(() => {
    if (!shipDetail) return [];
    const sizes = new Set(slots.filter(s => s.kind === category.kind).map(s => s.size));
    let items: EquipmentItem[];
    if (category.kind === "consumable") {
      // Consumables span multiple equipment kinds
      const kinds = new Set(slots.filter(s => sizes.has(s.kind)).map(s => s.kind));
      items = equipment.filter(e => kinds.has(e.kind));
    } else if (category.kind === "software") {
      items = equipment.filter(e => e.kind === "software");
    } else {
      items = equipment.filter(e => e.kind === category.kind && e.size != null && sizes.has(e.size));
    }
    // Exclusive equipment: only show if the current ship matches the compat tag
    if (shipDetail) {
      items = items.filter(e => isCompatibleWithShip(e, shipDetail.ship_id));
    }

    // Fog of war: hide equipment from unknown factions
    if (settings.fogOfWar) {
      items = items.filter(e => e.owner_factions?.length === 0 || e.owner_factions?.some(fid => knownFactions[fid] !== false));
    }
    if (factionFilter !== "all") {
      items = items.filter(e => e.owner_factions?.includes(factionFilter));
    }
    if (mkFilter !== "all") {
      items = items.filter(e => e.mk?.toString() === mkFilter);
    }
    if (typeFilter !== "all" && ["weapon", "turret"].includes(category.kind)) {
      items = items.filter(e => getWeaponType(e.name) === typeFilter);
    }

    if (obtainableOnly) {
      const shipFid = shipDetail?.owner_factions?.[0];
      items = items.filter(e => isObtainable(e, playerLicenceSet, shipFid));
    }
    if (buyableOnly) {
      items = items.filter(e => {
        if (e.price_avg == null) return false;
        const restricted = e.restriction_licence && e.restriction_licence !== "generaluseequipment" && e.restriction_licence !== "generaluseship";
        if (restricted) {
          const shipFid = shipDetail?.owner_factions?.[0];
          return isObtainable(e, playerLicenceSet, shipFid);
        }
        return true;
      });
    }
    if (buildableOnly) {
      items = []; // equipment blueprints not tracked yet
    }

    const validSorts = [...(CATEGORY_SORTS[category.kind] || []), ...BASE_SORTS];
    const defaultSortId = ["weapon", "turret"].includes(category.kind) ? "type_asc" : "price_asc";
    const activeSort = validSorts.find(s => s.id === sortFilter) || validSorts.find(s => s.id === defaultSortId) || BASE_SORTS[0];

    items.sort((a, b) => {
      const valA = activeSort.eval(a, equipmentEvalContext);
      const valB = activeSort.eval(b, equipmentEvalContext);
      if (typeof valA === "string" && typeof valB === "string") {
        return activeSort.desc ? valB.localeCompare(valA) : valA.localeCompare(valB);
      }
      const numA = Number(valA);
      const numB = Number(valB);
      return activeSort.desc ? numB - numA : numA - numB;
    });

    return items;
  }, [equipment, category, shipDetail, slots, factionFilter, mkFilter, typeFilter, sortFilter, obtainableOnly, buyableOnly, buildableOnly, settings.fogOfWar, knownFactions, playerLicenceSet, equipmentEvalContext]);

  const totalCost = useMemo(() => {
    let t = shipDetail?.price_avg ?? 0;
    for (const s of slots) {
      const it = cart[s.key];
      if (it?.price_avg) t += it.price_avg;
    }
    return t;
  }, [cart, slots, shipDetail]);

  const handleAdd = (k: string, i: EquipmentItem) => setCart(p => ({ ...p, [k]: i }));
  const handleRemove = (k: string) => setCart(p => ({ ...p, [k]: null }));
  const handleClearAll = () => setCart(p => { const f = { ...p }; for (const k of Object.keys(f)) f[k] = null; return f; });
  const handleApplyLoadout = (loadoutId: string) => {
    const option = allLoadoutOptions.find(o => o.loadout_id === loadoutId);
    if (!option) return;
    setSelectedLoadoutId(loadoutId);
    setCart(applyLoadoutToCart(slots, equipment, option.items));
  };
  const handleShipSelect = (id: string) => {
    setSelectedShipId(id);
    navigate({ to: "/ships/builder", search: { ship_id: id } });
    setFactionFilter("all");
    setMkFilter("all");
    setTypeFilter("all");
    setSortFilter("");
    setObtainableOnly(false);
    setSelectedLoadoutId("");
  };

  const shipFaction = shipDetail?.primary_faction
    ? factionMap.get(shipDetail.primary_faction)
    : undefined;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-b border-border bg-card/30 shrink-0">
        <h1 className="text-lg font-bold">Ship Builder</h1>
        <ShipSelector ships={ships} selectedId={selectedShipId} onSelect={handleShipSelect} />
        <LoadoutSelector value={selectedLoadoutId} options={allLoadoutOptions} onChange={handleApplyLoadout} disabled={!shipDetail} />
        <div className="flex-1" />
      </div>

      {isShipLoading ? (
        <PageLoaderPreset preset="builder" />
      ) : shipDetail ? (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Main row: cards | cart */}
          <div className="flex-1 min-h-0 flex">

            {/* Center column: Tabs/Filters + Cards */}
            <div className="flex-1 flex flex-col min-w-0 bg-muted/5">

              {/* Tabs and Filters */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0 gap-4 flex-wrap">
                <Tabs value={activeCategory} onValueChange={(v) => { setActiveCategory(v); setFactionFilter("all"); setMkFilter("all"); setTypeFilter("all"); setSortFilter(""); }}>
                  <TabsList className="w-full flex bg-transparent p-0 border-b border-border/50 rounded-none h-10">
                    {CATEGORIES.map(cat => {
                      const catSlots = slots.filter(s => s.kind === cat.kind);
                      if (catSlots.length === 0) return null;
                      const Icon = cat.icon;
                      const status = getCategoryStatus(cat.kind, catSlots, cart);
                      const colorClass =
                        status === "full" ? "text-success" :
                        status === "partial" ? "text-warning" :
                        status === "missing" ? "text-destructive" : "opacity-50";

                      return (
                        <TabsTrigger key={cat.id} value={cat.id} className="flex-1 flex gap-2 items-center text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none hover:bg-muted/50 transition-colors">
                          <Icon className={cn("w-4 h-4 transition-colors", status !== "full" && "group-data-[state=active]:text-primary", colorClass)} />
                          <span className="hidden xl:inline">{cat.label}</span>
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                </Tabs>

                <div className="flex items-center gap-3">
                  {(factionFilter !== "all" || mkFilter !== "all" || typeFilter !== "all" || sortFilter !== "" || obtainableOnly || buyableOnly || buildableOnly) && (
                    <ClearFiltersButton
                      onClick={() => { setFactionFilter("all"); setMkFilter("all"); setTypeFilter("all"); setSortFilter(""); setObtainableOnly(false); setBuyableOnly(false); setBuildableOnly(false); }}
                    />
                  )}

                  <div className="flex items-center gap-2 px-2 shrink-0">
                    <Switch id="obtainable-only" checked={obtainableOnly} onCheckedChange={setObtainableOnly} />
                    <label htmlFor="obtainable-only" className="text-xs text-muted-foreground cursor-pointer">Obtainable</label>
                    <Switch id="buyable-only" checked={buyableOnly} onCheckedChange={setBuyableOnly} />
                    <label htmlFor="buyable-only" className="text-xs text-muted-foreground cursor-pointer">Buyable</label>
                    <Switch id="buildable-only" checked={buildableOnly} onCheckedChange={setBuildableOnly} />
                    <label htmlFor="buildable-only" className="text-xs text-muted-foreground cursor-pointer">Buildable</label>
                    <label htmlFor="obtainable-only" className="text-xs font-medium text-muted-foreground cursor-pointer select-none">
                      Obtainable Only
                    </label>
                  </div>

                  <EquipmentSortSelect
                    value={sortFilter}
                    onChange={setSortFilter}
                    sortOptions={CATEGORY_SORTS[category.kind] ?? []}
                    baseSorts={BASE_SORTS}
                    defaultSortId={["weapon", "turret"].includes(category.kind) ? "type_asc" : "price_asc"}
                  />

                  {["weapon", "turret"].includes(category.kind) && (
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger className="w-[140px] h-9 text-xs border border-border hover:border-primary/50 transition-colors focus:border-primary">
                        <SelectValue placeholder="All Types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        {availableTypes.map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  <Select value={mkFilter} onValueChange={setMkFilter}>
                    <SelectTrigger className="w-[120px] h-9 text-xs border border-border hover:border-primary/50 transition-colors focus:border-primary">
                      <SelectValue placeholder="All Mks" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Mks</SelectItem>
                      {availableMks.map(mk => (
                        <SelectItem key={mk} value={mk.toString()}>
                          <div className="flex items-center py-0.5"><EquipmentMkBadge mk={mk} className="px-1.5 py-0 rounded text-xs" /></div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <FactionCombobox
                    factions={factions.filter(f => availableFactions.includes(f.faction_id))}
                    value={factionFilter}
                    onChange={setFactionFilter}
                    className="w-[180px]"
                    disabled={availableFactions.length === 0}
                  />
                </div>
              </div>

              <div className="px-4 py-2 bg-muted/20 border-b border-border text-[11px] flex items-center gap-2 shrink-0">
                {activeCategory === "engine" && (
                  slots.some(s => s.kind === "engine" && cart[s.key] != null)
                    ? <><Check className="w-3.5 h-3.5 text-success" /> <span className="text-muted-foreground">Engine requirements <span className="font-semibold text-success">met</span> for flight.</span></>
                    : <><Gauge className="w-3.5 h-3.5 text-warning" /> <span className="text-muted-foreground">At least one engine is <span className="font-semibold text-foreground">required</span> for flight.</span></>
                )}
                {activeCategory === "thruster" && (
                  slots.some(s => s.kind === "thruster" && cart[s.key] != null)
                    ? <><Check className="w-3.5 h-3.5 text-success" /> <span className="text-muted-foreground">Thruster requirements <span className="font-semibold text-success">met</span> for maneuverability.</span></>
                    : <><MoveVertical className="w-3.5 h-3.5 text-warning" /> <span className="text-muted-foreground">A thruster is <span className="font-semibold text-foreground">required</span> for maneuverability.</span></>
                )}
                {activeCategory === "software" && (
                  slots.filter(s => s.kind === "software").every(s => cart[s.key] != null)
                    ? <><Check className="w-3.5 h-3.5 text-success" /> <span className="text-muted-foreground">All required software systems are <span className="font-semibold text-success">installed</span>.</span></>
                    : <><Cpu className="w-3.5 h-3.5 text-warning" /> <span className="text-muted-foreground">A Docking Computer, Flight Assist, Long Range Scanner, and Object Scanner are <span className="font-semibold text-foreground">required</span>.</span></>
                )}
                {["shield", "weapon", "turret"].includes(activeCategory) && <><Shield className="w-3.5 h-3.5 text-muted-foreground" /> <span className="text-muted-foreground">Select components to equip.</span></>}
              </div>

              {/* Equipment cards */}
              <div className="flex-1 overflow-y-auto p-4 min-h-0">
                {compatibleEquipment.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-12 text-center">No compatible {category.label.toLowerCase()} for this ship with current filters.</p>
                ) : activeCategory === "software" ? (
                  <div className="space-y-8">
                    {Array.from(new Set(compatibleEquipment.map(e => e.size).filter(Boolean) as string[])).sort().map(subcat => {
                      const subcatItems = compatibleEquipment.filter(e => e.size === subcat);
                      const subcatNames: Record<string, string> = {
                        dock: "Docking Computer", economy: "Economy Analytics", flightassist: "Flight Assist",
                        scannerlongrange: "Long Range Scanner", scannermining: "Mining Scanner",
                        scannerobject: "Object Scanner", target: "Targeting Computer", trade: "Trading Computer"
                      };
                      return (
                        <div key={subcat} className="space-y-3">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold">{subcatNames[subcat] ?? subcat}</h3>
                            {(subcat === "dock" || subcat === "scannerlongrange" || subcat === "scannerobject" || subcat === "flightassist") && (
                              cart[`software-${subcat}-0`] ? (
                                <span className="text-xs bg-success/10 text-success px-1.5 py-0.5 rounded font-medium border border-success/20">Equipped</span>
                              ) : (
                                <span className="text-xs bg-destructive/10 text-destructive px-1.5 py-0.5 rounded font-medium border border-destructive/20">Required</span>
                              )
                            )}
                          </div>
                          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(max(200px, calc(12.5% - 12px)), 1fr))" }}>
                            {subcatItems.map(item => <EquipmentCard key={item.ware_id} item={item} slots={slots} cart={cart} onAdd={handleAdd} onRemove={handleRemove} factionMap={factionMap} playerLicenceSet={playerLicenceSet} shipFactionId={shipDetail?.owner_factions[0] ?? null} maxima={equipmentMaxima[item.kind]?.[item.size?.toLowerCase() ?? '']} evalContext={equipmentEvalContext} />)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(max(200px, calc(12.5% - 12px)), 1fr))" }}>
                    {compatibleEquipment.map(item => (
                      <EquipmentCard key={item.ware_id} item={item} slots={slots} cart={cart} onAdd={handleAdd} onRemove={handleRemove} factionMap={factionMap} playerLicenceSet={playerLicenceSet} shipFactionId={shipDetail?.owner_factions[0] ?? null} maxima={equipmentMaxima[item.kind]?.[item.size?.toLowerCase() ?? '']} evalContext={equipmentEvalContext} />
                    ))}
                  </div>
                )}
              </div>

              {/* Stats footer */}
              <StatsFooter ship={shipDetail} cart={cart} slots={slots} />
            </div>

            {/* Ship info + Cart (right) */}
            <div className="w-[280px] shrink-0 border-l border-border flex flex-col bg-card relative z-20 shadow-[-4px_0_15px_rgba(0,0,0,0.05)]">
              {/* Ship image — large */}
              <div className="p-3 border-b border-border bg-muted/5 shrink-0">
                <div className="relative group">
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary/40 pointer-events-none" />
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary/40 pointer-events-none" />
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary/40 pointer-events-none" />
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary/40 pointer-events-none" />
                  <ShipImage
                    imageUrl={shipDetail.image_url}
                    iconUrl={shipDetail.icon_url}
                    name={shipDetail.name}
                    role={shipDetail.role}
                    classId={shipDetail.class_id}
                    className="aspect-[4/3] p-2"
                  />
                </div>
                <div className="mt-2 text-center">
                  <p className="text-sm font-bold leading-tight">{shipDetail.name}</p>
                  <div className="flex items-center justify-center gap-3 mt-2 flex-wrap">
                    <SizeBadge size={shipDetail.class_id} />
                    {shipFaction && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: shipFaction.color_hex ?? 'var(--muted-foreground)' }} />
                        <span className="text-xs font-bold text-foreground uppercase tracking-widest">
                          {shipFaction.name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Cart */}
              <div className="flex-1 min-h-0 overflow-hidden">
                <CartPanel
                  slots={slots} cart={cart}
                  onRemove={handleRemove} onClear={handleClearAll}
                  totalCost={totalCost}
                  onSelectCategory={setActiveCategory}
                  shipDetail={shipDetail}
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <Wrench className="w-12 h-12 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">Select a ship to start building</p>
          </div>
        </div>
      )}
    </div>
  );
}
