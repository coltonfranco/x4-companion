import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Users, Ship, Building2 } from "lucide-react";
import { PageLoaderPreset } from "../../components/layout/PageLoader";
import { PageSubtitle } from "../../components/ui/page-subtitle";
import { HUDCard } from "../../components/layout/HUDCard";
import { DataTable } from "../../components/data-display/DataTable";
import type { ColumnDef } from "../../components/data-display/DataTable";
import type { FactionSummary } from "../../lib/types";
import { useSort } from "../../lib/useSort";
import { useColumnVisibility } from "../../lib/useColumnVisibility";
import { EntityIcon } from "../../components/game/EntityIcon";
import { ShipDetailPanel } from "../../components/detail-panels/ShipDetailPanel";
import { DetailDialog } from "../../components/ui/detail-dialog";
import { apiGet } from "../../lib/api";
import type { EnrichedNPC, NPCEntry, RoleMeta } from "./types";
import { COLUMN_GROUPS, DEFAULT_VISIBLE, ROLE_META, STORAGE_KEY, type GroupByKey } from "./lib/crewColumns";
import { formatMacro, getRoleSkill, locationLabel, resolveFaction, resolveGender, resolveLocationType, roleBadge } from "./lib/crewFormat";
import { SkillStars } from "./components/SkillStars";
import { CrewFilterBar } from "./components/CrewFilterBar";

// ── Page component ────────────────────────────────────────────────────────────

export default function CrewPage() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [groupBy, setGroupBy] = useState<GroupByKey>("none");
  const [visibleColumns, setVisibleColumns] = useColumnVisibility(STORAGE_KEY, DEFAULT_VISIBLE);
  const [selectedShipId, setSelectedShipId] = useState<string | null>(null);

  const { data: npcs = [], isLoading } = useQuery<NPCEntry[]>({
    queryKey: ["npcs", "player"],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("owner", "player");
      params.set("limit", "2000");
      return apiGet<NPCEntry[]>(`/api/v1/npcs?${params}`);
    },
  });

  // Static lookup tables — fetched once, cached indefinitely.
  const { data: factions = [] } = useQuery<FactionSummary[]>({
    queryKey: ["factions"],
    queryFn: () => apiGet<FactionSummary[]>("/api/v1/factions"),
    staleTime: Infinity,
  });

  // Build lookup maps from the static reference data.
  const { factionNames, factionMap } = useMemo(() => {
    const factionNames: Record<string, string> = {};
    const factionMap = new Map<string, FactionSummary>();
    for (const f of factions) {
      factionNames[f.faction_id] = f.name || f.faction_id;
      factionMap.set(f.faction_id, f);
    }
    return { factionNames, factionMap };
  }, [factions]);

  const { data: rolesList = [] } = useQuery<RoleMeta[]>({
    queryKey: ["roles"],
    queryFn: () => apiGet<RoleMeta[]>("/api/v1/roles"),
    staleTime: Infinity,
  });

  const rolesMap = useMemo(() => {
    const m = new Map<string, RoleMeta>();
    for (const r of rolesList) {
      m.set(r.role_id, r);
    }
    return m;
  }, [rolesList]);

  // Enrich NPCs with pre-computed display fields (faction, gender, location type).
  // This is a stable derivation — the COLUMNS render functions just read fields.
  const enrichedNpcs = useMemo<EnrichedNPC[]>(
    () =>
      npcs.map((npc) => ({
        ...npc,
        factionSummary: npc.owner_faction ? factionMap.get(npc.owner_faction) : undefined,
        factionDisplay: resolveFaction(npc.owner_faction, factionNames),
        factionId: npc.owner_faction,
        gender: resolveGender(npc.macro),
        locationType: resolveLocationType(npc),
        roleSkill: getRoleSkill(npc, rolesMap),
      })),
    [npcs, factionNames, factionMap, rolesMap],
  );

  let filtered = enrichedNpcs.filter(n => n.entity_type !== "crowd");
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter((n) =>
      n.name?.toLowerCase().includes(q) ||
      n.code?.toLowerCase().includes(q)
    );
  }
  if (roleFilter !== "all") {
    filtered = filtered.filter((n) => n.entity_post === roleFilter);
  }

  const { sorted, key, dir, toggle } = useSort(
    filtered,
    {
      name:             (n) => n.name ?? n.code ?? "",
      role:             (n) => n.entity_post ?? "",
      faction:          (n) => n.factionDisplay,
      gender:           (n) => n.gender ?? "",
      skill_piloting:   (n) => n.skill_piloting ?? -1,
      skill_morale:     (n) => n.skill_morale ?? -1,
      skill_engineering:(n) => n.skill_engineering ?? -1,
      skill_management: (n) => n.skill_management ?? -1,
      skill_boarding:   (n) => n.skill_boarding ?? -1,
      role_skill:       (n) => n.roleSkill ?? -1,
      code:             (n) => n.code ?? "",
      seed:             (n) => n.seed ?? "",
      workplace:        (n) => locationLabel(n),
      command:          (n) => n.location_ship_assignment_name ?? n.location_ship_command_name ?? n.location_ship_command ?? "",
      sector:           (n) => n.location_sector_name ?? "",
    },
    { key: "name", dir: "asc" },
  );

  // ── Group-by ──────────────────────────────────────────────────────────────

  const rowGroups = useMemo(() => {
    if (groupBy === "none") return undefined;

    const groups: Record<string, EnrichedNPC[]> = {};
    for (const npc of sorted) {
      let key = "";
      if (groupBy === "role") {
        key = npc.entity_post
          ? (rolesMap.get(npc.entity_post)?.name ?? ROLE_META[npc.entity_post]?.label ?? npc.entity_post)
          : "No Role";
      } else if (groupBy === "workplace") {
        key = locationLabel(npc);
      } else if (groupBy === "sector") {
        key = npc.location_sector_name || "Unknown Sector";
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(npc);
    }

    const orderedKeys = Object.keys(groups).sort((a, b) => {
      // Put "No Role", "Unknown", "None" last
      const aLow = a === "No Role" || a === "Unknown" || a === "None";
      const bLow = b === "No Role" || b === "Unknown" || b === "None";
      if (aLow && !bLow) return 1;
      if (!aLow && bLow) return -1;
      return a.localeCompare(b);
    });

    return orderedKeys.map((k) => ({
      key: k,
      label: (
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {k}
        </span>
      ),
      rows: groups[k],
    }));
  }, [sorted, groupBy]);

  // ── Column Implementation ───────────────────────────────────────────────────

  const columns = useMemo<ColumnDef<EnrichedNPC>[]>(() => {
    const all: ColumnDef<EnrichedNPC>[] = [
      {
        key: "name",
        label: "Name",
        sortKey: "name",
        align: "left",
        render: (npc) => {
          const displayName = npc.name || formatMacro(npc.macro);
          return (
            <div className="flex items-center gap-1.5 font-medium">
              {displayName}
              {npc.employment === "owned" && (
                <span className="shrink-0 px-1 py-0 rounded text-[9px] font-semibold uppercase bg-primary/10 text-primary">
                  Own
                </span>
              )}
            </div>
          );
        },
      },
      {
        key: "role",
        label: "Role",
        sortKey: "role",
        align: "left",
        render: (npc) => roleBadge(npc.entity_post, rolesMap),
      },
      {
        key: "command",
        label: "Command",
        sortKey: "command",
        align: "left",
        render: (npc) => (
          <span className="text-muted-foreground capitalize text-xs">
            {npc.location_ship_assignment_name || npc.location_ship_command_name || npc.location_ship_command || "—"}
          </span>
        ),
      },
      {
        key: "role_skill",
        label: "Role Skill",
        sortKey: "role_skill",
        align: "left",
        render: (npc) => <SkillStars value={npc.roleSkill} />,
      },
      {
        key: "skill_piloting",
        label: "Piloting",
        sortKey: "skill_piloting",
        align: "left",
        render: (npc) => <SkillStars value={npc.skill_piloting} />,
      },
      {
        key: "skill_morale",
        label: "Morale",
        sortKey: "skill_morale",
        align: "left",
        render: (npc) => <SkillStars value={npc.skill_morale} />,
      },
      {
        key: "skill_engineering",
        label: "Engineering",
        sortKey: "skill_engineering",
        align: "left",
        render: (npc) => <SkillStars value={npc.skill_engineering} />,
      },
      {
        key: "skill_management",
        label: "Management",
        sortKey: "skill_management",
        align: "left",
        render: (npc) => <SkillStars value={npc.skill_management} />,
      },
      {
        key: "skill_boarding",
        label: "Boarding",
        sortKey: "skill_boarding",
        align: "left",
        render: (npc) => <SkillStars value={npc.skill_boarding} />,
      },
      {
        key: "workplace",
        label: "Workplace",
        sortKey: "workplace",
        align: "left",
        render: (npc) => {
          const sName = npc.location_ship_name;
          const sCode = npc.location_ship_code;
          const stName = npc.location_station_name;
          const stCode = npc.location_station_code;

          let display = "—";
          if (sName && sCode) display = `${sName} (${sCode})`;
          else if (sName) display = sName;
          else if (npc.location_ship_id) display = "Ship";
          else if (stName && stCode) display = `${stName} (${stCode})`;
          else if (stName) display = stName;
          else if (npc.location_station_id) display = "Station";

          return (
            <span className="text-muted-foreground flex items-center gap-1.5">
              {npc.location_ship_id ? (
                <>
                  {npc.location_ship_icon_url ? (
                    <EntityIcon src={npc.location_ship_icon_url} alt={sName || "Ship"} size={16} />
                  ) : (
                    <Ship className="h-3.5 w-3.5" />
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedShipId(npc.ship_macro ?? null)}
                    className="truncate max-w-[160px] text-left hover:text-primary hover:underline transition-colors bg-transparent border-0 p-0 text-inherit"
                    title={`${display} — click for details`}
                  >
                    {display}
                  </button>
                </>
              ) : npc.location_station_id ? (
                <>
                  <Building2 className="h-3.5 w-3.5" />
                  <span className="truncate max-w-[160px]" title={display}>
                    {display}
                  </span>
                </>
              ) : (
                "—"
              )}
            </span>
          );
        },
      },
      {
        key: "sector",
        label: "Sector",
        sortKey: "sector",
        align: "left",
        render: (npc) => (
          <span className="text-muted-foreground truncate max-w-[140px]" title={npc.location_sector_name || "Unknown Sector"}>
            {npc.location_sector_name || "—"}
          </span>
        ),
      },
    ];
    return all.filter(c => visibleColumns.has(c.key));
  }, [visibleColumns]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) return <PageLoaderPreset preset="crew" />;

  return (
    <>
      <div className="flex flex-col h-full">
      <div className="px-6 pt-5 shrink-0">
        <h1 className="text-2xl font-bold flex items-center gap-2 tracking-tight">
          <Users className="h-6 w-6 text-primary" /> Crew
        </h1>
        <PageSubtitle>{filtered.length} personnel</PageSubtitle>
      </div>

      <CrewFilterBar
        search={search}
        setSearch={setSearch}
        roleFilter={roleFilter}
        setRoleFilter={setRoleFilter}
        groupBy={groupBy}
        setGroupBy={setGroupBy}
        visibleColumns={visibleColumns}
        setVisibleColumns={setVisibleColumns}
      />

      <div className="flex-1 overflow-hidden px-6 pb-6 pt-2 min-h-0">
        <HUDCard className="h-full flex flex-col">
          <div className="flex-1 overflow-auto">
            <DataTable
              key={groupBy}
              columns={columns}
              columnGroups={COLUMN_GROUPS}
              rows={rowGroups ? undefined : sorted}
              rowGroups={rowGroups}
              getRowKey={(n) => n.id}
              sortKey={key}
              sortDir={dir}
              onSortChange={(k) => toggle(k, "asc")}
              emptyState={
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                  <Users className="h-10 w-10 opacity-30" />
                  <p className="text-sm">No crew found.</p>
                  <p className="text-xs">
                    Activate a save and re-ingest to populate crew data.
                  </p>
                </div>
              }
            />
          </div>
        </HUDCard>
      </div>
    </div>
    <DetailDialog
      open={selectedShipId !== null}
      onOpenChange={(open) => { if (!open) setSelectedShipId(null); }}
      title="Ship Details"
      description="Detailed stats for the selected ship"
    >
      {selectedShipId && <ShipDetailPanel shipId={selectedShipId} factions={factions} />}
    </DetailDialog>
    </>
  );
}
