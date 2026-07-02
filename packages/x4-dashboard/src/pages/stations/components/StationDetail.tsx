import type { Station } from "../types";
import { categoryLabel, fmtCr, statusOf, stationDisplayName } from "../lib/stationFormat";
import { StatusBadge, DetailStat, WorkforceValue, SectionLabel } from "./StationStatusBits";
import { ConstructionDetail } from "./ConstructionDetail";
import { ModulesList } from "./ModulesList";
import { OffersBlock } from "./OffersBlock";

export function StationDetail({
  s,
  sectorName,
  wareName,
}: {
  s: Station;
  sectorName: (id: string | null) => string;
  wareName: (id: string) => string;
}) {
  const st = statusOf(s);
  return (
    <div>
      <div className="border-b border-white/8 px-6 py-4" style={{ borderTop: `2px solid ${st.color}`, background: "linear-gradient(180deg,#0d1424,#0b1120)" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-[21px] font-semibold">{stationDisplayName(s)}</div>
            <div className="mt-1.5 text-[12px] text-muted-foreground">
              {categoryLabel(s.category)} · {sectorName(s.sector_id)}
            </div>
          </div>
          <StatusBadge s={s} />
        </div>
      </div>

      <div className="px-6 py-5">
        <div className="mb-5 grid grid-cols-4 gap-2.5">
          <DetailStat label="MODULES">
            {s.is_under_construction ? `${s.module_count ?? 0} / ${s.planned_module_count ?? "?"}` : (s.module_count ?? 0)}
          </DetailStat>
          <DetailStat label="WORKFORCE">
            <WorkforceValue s={s} />
          </DetailStat>
          <DetailStat label="PRODUCTIVITY">
            {s.workforce_bonus != null ? `${Math.round(s.workforce_bonus * 100)}%` : "—"}
          </DetailStat>
          <DetailStat label="BUDGET">
            {s.account_amount != null ? <span style={{ color: "#f0d98a" }}>{fmtCr(s.account_amount)}</span> : "—"}
          </DetailStat>
        </div>

        {s.is_under_construction && <ConstructionDetail stationId={s.station_id} wareName={wareName} />}

        <ModulesList stationId={s.station_id} />
        <div className="mt-5">
          <SectionLabel>TRADE</SectionLabel>
          <OffersBlock stationId={s.station_id} wareName={wareName} />
        </div>
      </div>
    </div>
  );
}
