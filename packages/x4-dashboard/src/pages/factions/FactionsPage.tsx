import { useQuery } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useSettings } from "../../lib/settingsStore";
import type { FactionSummary } from '../../lib/types';
import { PageLoaderPreset } from "../../components/layout/PageLoader";
import { PageSubtitle } from "../../components/ui/page-subtitle";
import { HUDCard } from "../../components/layout/HUDCard";
import { useHasSave } from "../../lib/useHasSave";
import { FactionDetailPanel } from "./components/FactionDetailPanel";
import { StandingsView } from "./components/StandingsView";
import { MatrixView } from "./components/MatrixView";
import type { AllFactionRelation } from "./components/MatrixView";
import { apiGet } from "../../lib/api";
import { VISIBLE_FACTIONS_PATH, VISIBLE_FACTIONS_QUERY_KEY } from "../../lib/factionQueries";
import { useKnownFactions } from "../../lib/useKnownFactions";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FactionsPage() {
  const { hasSave } = useHasSave();
  const search = useSearch({ strict: false }) as { faction?: string };
  const [selectedFactionId, setSelectedFactionId] = useState<string | null>(search.faction ?? null);
  const [view, setView] = useState<"standings" | "matrix">("standings");
  const { settings } = useSettings();

  // Deep-link: ?faction=argon preselects (e.g. from the Empire reputation list).
  useEffect(() => {
    if (search.faction) setSelectedFactionId(search.faction);
  }, [search.faction]);

  const { data: knownFactions = {} } = useKnownFactions();

  const { data: factions = [], isLoading: factionsLoading } = useQuery<FactionSummary[]>({
    queryKey: VISIBLE_FACTIONS_QUERY_KEY,
    queryFn: () => apiGet<FactionSummary[]>(VISIBLE_FACTIONS_PATH),
  });

  const visibleFactions = useMemo(() => {
    if (!settings.fogOfWar) return factions;
    return factions.filter((f) => knownFactions[f.faction_id] !== false);
  }, [factions, knownFactions, settings.fogOfWar]);

  const { data: relations = [], isLoading: relationsLoading } = useQuery<AllFactionRelation[]>({
    queryKey: ["faction-relations", "visible"],
    queryFn: () => apiGet<AllFactionRelation[]>("/api/v1/faction-relations"),
  });

  const loading = factionsLoading || relationsLoading;

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-5 shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">Factions</h1>
        <PageSubtitle>
          {visibleFactions.length} factions · {relations.length} relation pairs
        </PageSubtitle>
      </div>

      <div className="flex-1 overflow-hidden px-6 pb-6 pt-4 flex flex-col">
        <HUDCard className="h-full">
          <div className="flex flex-1 min-h-0 relative z-10">
            {/* Sidebar */}
            <aside className="w-56 shrink-0 border-r border-border/50 overflow-y-auto bg-black/20">
          <p className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground border-b border-border">
            Factions
          </p>
          <ul className="py-2">
            {visibleFactions.map((f) => {
              const isActive = selectedFactionId === f.faction_id;
              return (
                <li
                  key={f.faction_id}
                  className={`flex items-center gap-2 px-4 py-2 text-sm cursor-pointer transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                  onClick={() => setSelectedFactionId(f.faction_id)}
                >
                  {f.icon_url ? (
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        flexShrink: 0,
                        backgroundColor: f.color_hex ?? "#888",
                        WebkitMaskImage: `url(${f.icon_url})`,
                        WebkitMaskSize: "contain",
                        WebkitMaskRepeat: "no-repeat",
                        WebkitMaskPosition: "center",
                        maskImage: `url(${f.icon_url})`,
                        maskSize: "contain",
                        maskRepeat: "no-repeat",
                        maskPosition: "center",
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        backgroundColor: f.color_hex ?? "#888",
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <span className="truncate">{f.name}</span>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0 flex flex-col">
          {loading ? (
            <PageLoaderPreset preset="factions" />
          ) : selectedFactionId ? (
            <FactionDetailPanel
              factionId={selectedFactionId}
              onClose={() => setSelectedFactionId(null)}
              hasSave={hasSave}
            />
          ) : (
            <>
              {/* View toggle */}
              <div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-muted/10 shrink-0">
                {(["standings", "matrix"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={`text-xs px-3 py-1.5 rounded transition-colors ${
                      view === v
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    }`}
                  >
                    {v === "standings" ? "Standings" : "Relation Matrix"}
                  </button>
                ))}
              </div>

              {view === "standings" ? (
                <StandingsView onSelectFaction={setSelectedFactionId} hasSave={hasSave} factions={factions} />
              ) : (
                <MatrixView
                  factions={visibleFactions}
                  relations={relations}
                  onSelectFaction={setSelectedFactionId}
                  hasSave={hasSave}
                />
              )}
            </>
          )}
        </div>
          </div>
        </HUDCard>
      </div>
    </div>
  );
}
