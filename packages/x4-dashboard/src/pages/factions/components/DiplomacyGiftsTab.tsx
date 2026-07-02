import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { EntityIcon } from "../../../components/game/EntityIcon";
import { FactionBadge } from "../../../components/game/FactionBadge";
import { useFactionMap } from "../../../lib/useFactionMap";
import type { FactionSummary } from "../../../lib/types";
import { PageLoaderPreset } from "../../../components/layout/PageLoader";
import { apiGet } from "../../../lib/api";
import type { DiploGift, WareSummary } from "../types";

export function DiplomacyGiftsTab() {
  const { data: gifts = [], isLoading: giftsLoading } = useQuery<DiploGift[]>({
    queryKey: ["diplo-gifts"],
    queryFn: () => apiGet<DiploGift[]>("/api/v1/diplomacy/gifts"),
  });

  const { data: factions = [] } = useQuery<FactionSummary[]>({
    queryKey: ["factions"],
    queryFn: () => apiGet<FactionSummary[]>("/api/v1/factions"),
  });

  const { data: wares = [] } = useQuery<WareSummary[]>({
    queryKey: ["wares"],
    queryFn: () => apiGet<WareSummary[]>("/api/v1/wares?limit=2000"),
  });

  const factionMap = useFactionMap(factions);
  const wareMap = useMemo(
    () => new Map(wares.map((w) => [w.ware_id, w])),
    [wares],
  );

  // Group gifts by faction
  const byFaction = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const g of gifts) {
      if (!map.has(g.faction_id)) map.set(g.faction_id, []);
      map.get(g.faction_id)!.push(g.ware_id);
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      const nameA = factionMap.get(a)?.name ?? a;
      const nameB = factionMap.get(b)?.name ?? b;
      return nameA.localeCompare(nameB);
    });
  }, [gifts, factionMap]);

  if (giftsLoading) return <PageLoaderPreset preset="factions" />;

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border/50 bg-muted/5">
        <p className="text-sm text-muted-foreground">
          Preferred gift items per faction. Giving these wares via the bribe
          system yields a positive relation bonus.
        </p>
      </div>
      <div className="flex-1 p-4 overflow-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {byFaction.map(([factionId, wareIds]) => {
            const faction = factionMap.get(factionId);
            return (
              <div
                key={factionId}
                className="rounded-md border border-border p-3"
              >
                <div className="mb-2">
                  {faction ? (
                    <FactionBadge
                      name={faction.name}
                      color_hex={faction.color_hex}
                      icon_url={faction.icon_url}
                      size="md"
                      faction_id={faction.faction_id}
                    />
                  ) : (
                    <span className="text-sm font-medium">{factionId}</span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  {wareIds.map((wareId) => {
                    const ware = wareMap.get(wareId);
                    return (
                      <div key={wareId} className="flex items-center gap-2">
                        <EntityIcon
                          src={ware?.icon_url ?? null}
                          alt={wareId}
                          size={18}
                        />
                        <span className="text-sm">
                          {ware?.name ??
                            wareId.replace(/^inv_/, "").replace(/_/g, " ")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
