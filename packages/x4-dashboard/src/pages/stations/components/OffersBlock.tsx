import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../../lib/api";
import type { Offer } from "../types";
import { fmtCr, fmtNum } from "../lib/stationFormat";

function OfferList({ title, color, offers, wareName }: { title: string; color: string; offers: Offer[]; wareName: (id: string) => string }) {
  return (
    <div className="mt-1">
      <div className="mb-1.5 font-mono text-[9.5px] tracking-[1px]" style={{ color }}>
        {title}
      </div>
      <div className="flex flex-col gap-1">
        {offers.slice(0, 6).map((o) => (
          <div key={`${o.side}-${o.ware_id}`} className="flex items-center justify-between text-[12px]">
            <span className="truncate text-[#cdd5e3]">{wareName(o.ware_id)}</span>
            <span className="flex flex-none items-center gap-3 font-mono text-[10.5px]">
              <span className="text-muted-foreground">{fmtNum(o.quantity)}</span>
              <span style={{ color: "#f0d98a" }}>{fmtCr(o.price)}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OffersBlock({ stationId, wareName }: { stationId: string; wareName: (id: string) => string }) {
  const { data: offers, isLoading } = useQuery<Offer[]>({
    queryKey: ["station-offers", stationId],
    queryFn: () => apiGet<Offer[]>(`/api/v1/stations/${encodeURIComponent(stationId)}/offers`),
    staleTime: 15_000,
  });
  if (isLoading) return <div className="px-4 pb-4 text-[11.5px] text-muted-foreground">Loading…</div>;
  const sells = (offers ?? []).filter((o) => o.side === "sell");
  const buys = (offers ?? []).filter((o) => o.side === "buy");
  if (sells.length === 0 && buys.length === 0)
    return <div className="px-4 pb-4 text-[11.5px] text-muted-foreground">No trade offers.</div>;
  return (
    <div className="px-4 pb-4">
      {sells.length > 0 && <OfferList title="SELLING" color="#34d399" offers={sells} wareName={wareName} />}
      {buys.length > 0 && <OfferList title="BUYING" color="#5cc8ec" offers={buys} wareName={wareName} />}
    </div>
  );
}
