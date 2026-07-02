import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../../lib/api";
import type { StationModuleRow } from "../types";
import { SectionLabel } from "./StationStatusBits";

export function ModulesList({ stationId }: { stationId: string }) {
  const { data: mods = [] } = useQuery<StationModuleRow[]>({
    queryKey: ["station-modules", stationId],
    queryFn: () => apiGet<StationModuleRow[]>(`/api/v1/stations/${encodeURIComponent(stationId)}/modules`),
    staleTime: 30_000,
  });
  if (mods.length === 0) return null;
  return (
    <div>
      <SectionLabel>MODULES</SectionLabel>
      <div className="flex flex-wrap gap-1.5">
        {mods.map((m) => (
          <span key={m.module_id} className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.07] bg-white/[0.02] px-2.5 py-1 text-[11px] text-[#cdd5e3]">
            {m.name ?? m.macro}
            {m.count > 1 && <span className="font-mono text-muted-foreground">×{m.count}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
