import type { Station } from "../types";
import { categoryLabel, fmtCr, stationDisplayName } from "../lib/stationFormat";
import { StatusBadge, MiniStat, WorkforceValue } from "./StationStatusBits";
import { BuildBlock } from "./BuildBlock";
import { OffersBlock } from "./OffersBlock";
import { statusOf } from "../lib/stationFormat";

export function StationCard({
  s,
  sectorName,
  wareName,
  expanded,
  onToggle,
}: {
  s: Station;
  sectorName: (id: string | null) => string;
  wareName: (id: string) => string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const st = statusOf(s);
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-white/8 bg-[#0b1120]/70" style={{ borderTop: `2px solid ${st.color}` }}>
      <div className="px-4 pb-3 pt-3.5">
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0">
            <div className="truncate text-[15.5px] font-semibold">{stationDisplayName(s)}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {categoryLabel(s.category)} · {sectorName(s.sector_id)}
            </div>
          </div>
          <StatusBadge s={s} />
        </div>
      </div>

      {s.is_under_construction && <BuildBlock s={s} wareName={wareName} />}

      <div className="mx-4 grid grid-cols-2 gap-px overflow-hidden rounded-[9px] bg-white/5">
        <MiniStat label="MODULES">
          {s.is_under_construction ? `${s.module_count ?? 0} / ${s.planned_module_count ?? "?"}` : (s.module_count ?? 0)}
        </MiniStat>
        <MiniStat label="WORKFORCE">
          <WorkforceValue s={s} />
        </MiniStat>
        <MiniStat label="PRODUCTION">
          {s.production_product ? (
            <span className="text-[12px]">{wareName(s.production_product)}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </MiniStat>
        <MiniStat label="BUDGET">
          {s.account_amount != null ? <span style={{ color: "#f0d98a" }}>{fmtCr(s.account_amount)}</span> : <span className="text-muted-foreground">—</span>}
        </MiniStat>
      </div>

      <button onClick={onToggle} className="mt-3 flex items-center justify-between border-t border-white/[0.05] px-4 py-2.5 text-left">
        <span className="text-[11.5px] text-muted-foreground">
          {expanded ? "Hide trade" : "Producing & trading"}
        </span>
        <span className="text-[11px] text-[#5cc8ec]">{expanded ? "▾" : "▸"}</span>
      </button>
      {expanded && <OffersBlock stationId={s.station_id} wareName={wareName} />}
    </div>
  );
}
