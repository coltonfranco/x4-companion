import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../../lib/api";
import type { Construction } from "../types";
import { fmtNum } from "../lib/stationFormat";
import { SectionLabel } from "./StationStatusBits";

export function ConstructionDetail({ stationId, wareName }: { stationId: string; wareName: (id: string) => string }) {
  const { data } = useQuery<Construction>({
    queryKey: ["station-construction", stationId],
    queryFn: () => apiGet<Construction>(`/api/v1/stations/${encodeURIComponent(stationId)}/construction`),
    staleTime: 30_000,
  });
  if (!data) return null;
  return (
    <div className="mb-5">
      <SectionLabel>CONSTRUCTION</SectionLabel>
      <div className="grid grid-cols-[1.2fr_1fr] gap-4">
        <div>
          <div className="mb-1.5 font-mono text-[9.5px] tracking-[1px] text-muted-foreground">PLANNED MODULES</div>
          <div className="flex flex-col gap-1">
            {data.planned_modules.map((m) => (
              <div key={m.module_id} className="flex items-center justify-between rounded-md bg-white/[0.02] px-2.5 py-1.5 text-[12px]">
                <span className="truncate text-[#cdd5e3]">{m.name ?? m.macro}</span>
                <span className="font-mono text-[11px] text-muted-foreground">×{m.count}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1.5 font-mono text-[9.5px] tracking-[1px] text-muted-foreground">BILL OF MATERIALS</div>
          <div className="flex flex-col gap-1">
            {data.bill_of_materials.map((b) => (
              <div key={b.ware_id} className="flex items-center justify-between text-[12px]">
                <span className="truncate text-[#dfe6f0]">{b.name ?? wareName(b.ware_id)}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{fmtNum(b.amount)}</span>
              </div>
            ))}
            {data.bill_of_materials.length === 0 && <div className="text-[11.5px] text-muted-foreground">No recipe data.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
