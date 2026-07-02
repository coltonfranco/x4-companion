import { useQuery } from "@tanstack/react-query";
import { Hammer } from "lucide-react";
import { apiGet } from "../../../lib/api";
import type { Construction, Station } from "../types";
import { fmtCr, fmtNum } from "../lib/stationFormat";

export function BuildBlock({ s, wareName }: { s: Station; wareName: (id: string) => string }) {
  const { data } = useQuery<Construction>({
    queryKey: ["station-construction", s.station_id],
    queryFn: () => apiGet<Construction>(`/api/v1/stations/${encodeURIComponent(s.station_id)}/construction`),
    staleTime: 30_000,
  });
  const buildPct = s.build_pct ?? 0;
  return (
    <div className="mx-4 mb-3 rounded-[10px] border border-[#5cc8ec]/20 bg-[#5cc8ec]/[0.06] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[#8fdcf3]">
          <Hammer className="h-3.5 w-3.5" /> Under construction
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">
          {s.module_count ?? 0} / {s.planned_module_count ?? "?"} modules
        </span>
      </div>
      <div className="mb-2 flex items-center gap-2.5">
        <div className="h-1.5 flex-1 overflow-hidden rounded-[5px] bg-white/[0.07]">
          <div className="h-full rounded-[5px]" style={{ width: `${buildPct}%`, background: "linear-gradient(90deg,#3b9ae1,#5cc8ec)" }} />
        </div>
        <span className="font-mono text-[11.5px] font-semibold text-[#8fdcf3]">{Math.round(buildPct)}%</span>
      </div>
      {data && data.bill_of_materials.length > 0 && (
        <>
          <div className="mb-1.5 font-mono text-[9.5px] tracking-[1px] text-muted-foreground">BILL OF MATERIALS</div>
          <div className="flex flex-col gap-1">
            {data.bill_of_materials.slice(0, 4).map((b) => (
              <div key={b.ware_id} className="flex items-center justify-between text-[11.5px]">
                <span className="text-[#dfe6f0]">{b.name ?? wareName(b.ware_id)}</span>
                <span className="font-mono text-muted-foreground">
                  {fmtNum(b.amount)}
                  {b.total != null && <span className="ml-2 text-[#a9966a]">{fmtCr(b.total)}</span>}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
