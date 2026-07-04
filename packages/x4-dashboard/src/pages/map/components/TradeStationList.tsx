// Per-station breakdown for the currently selected trade ware: every live station
// buying or selling it, sorted by price/quantity, so you don't have to click through
// stations one at a time to find the best deal.

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpDown, Star } from "lucide-react";

import { apiGet } from "../../../lib/api";
import { Currency } from "../../../components/game/Currency";

type WareOfferRow = {
  station_id: string;
  station_name: string | null;
  sector_id: string | null;
  side: "buy" | "sell";
  price: number;
  quantity: number;
};

type SortKey = "price" | "quantity";

export function TradeStationList({
  wareId,
  side,
  onSideChange,
  sectorName,
  onSelectStation,
  currentSectorId,
}: {
  wareId: string;
  side: "sell" | "buy";
  onSideChange: (s: "sell" | "buy") => void;
  sectorName: (id: string | null) => string;
  onSelectStation: (stationId: string) => void;
  currentSectorId?: string | null;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("quantity");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data: offers = [], isLoading } = useQuery<WareOfferRow[]>({
    queryKey: ["economy", "wares", wareId, "stations"],
    queryFn: () =>
      apiGet<WareOfferRow[]>(
        `/api/v1/economy/wares/${encodeURIComponent(wareId)}/stations`,
      ),
  });

  const currentSectorLower = currentSectorId?.toLowerCase() ?? null;

  const rows = useMemo(() => {
    const filtered = offers.filter((o) => o.side === side);
    return [...filtered].sort((a, b) => {
      // Offers in the sector currently under view are pinned above the rest — with a
      // universe-wide list sorted by quantity, a sector's own offers can otherwise sit
      // dozens of rows deep and read as "no sellers here" even when they exist.
      const aHere = currentSectorLower != null && a.sector_id?.toLowerCase() === currentSectorLower;
      const bHere = currentSectorLower != null && b.sector_id?.toLowerCase() === currentSectorLower;
      if (aHere !== bHere) return aHere ? -1 : 1;

      // Out-of-stock offers (nothing currently to buy/sell) always sink to the bottom,
      // regardless of sort direction — they're not an actionable deal right now.
      if (a.quantity === 0 && b.quantity !== 0) return 1;
      if (b.quantity === 0 && a.quantity !== 0) return -1;
      const v = sortKey === "price" ? a.price - b.price : a.quantity - b.quantity;
      return sortDir === "asc" ? v : -v;
    });
  }, [offers, side, sortKey, sortDir, currentSectorLower]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "price" ? (side === "sell" ? "asc" : "desc") : "desc");
    }
  };

  const SortHeader = ({ label, k, w }: { label: string; k: SortKey; w: string }) => (
    <button
      onClick={() => toggleSort(k)}
      className={`flex items-center gap-0.5 ${w} justify-end shrink-0 transition-colors ${
        sortKey === k ? "text-[#c4ccda]" : "hover:text-[#c4ccda]"
      }`}
    >
      {label}
      <ArrowUpDown className="w-2.5 h-2.5" />
    </button>
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-[3px] p-[3px] bg-white/5 rounded-[8px]">
        {(
          [
            ["sell", "Buy from (sellers)"],
            ["buy", "Sell to (buyers)"],
          ] as [typeof side, string][]
        ).map(([s, label]) => (
          <button
            key={s}
            onClick={() => onSideChange(s)}
            className={`flex-1 text-[11px] px-2 py-1 rounded-[6px] transition-colors ${
              side === s
                ? "bg-primary/20 text-white border border-primary/40"
                : "text-[#8a97ad] border border-transparent hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-[11px] text-[#6b7890] py-1">Loading stations…</p>
      ) : rows.length === 0 ? (
        <p className="text-[11px] text-[#6b7890] py-1 italic">No live offers found.</p>
      ) : (
        <>
          <div className="flex items-center gap-2 px-2 text-[10px] tracking-[0.6px] text-[#6b7890]">
            <span className="flex-1">STATION</span>
            <SortHeader label="PRICE" k="price" w="w-16" />
            <SortHeader label="QTY" k="quantity" w="w-14" />
          </div>
          <div className="flex flex-col gap-[2px] max-h-[220px] overflow-y-auto no-scrollbar pr-1">
            {rows.map((o) => {
              const outOfStock = o.quantity === 0;
              const isHere = currentSectorLower != null && o.sector_id?.toLowerCase() === currentSectorLower;
              return (
                <button
                  key={o.station_id}
                  onClick={() => onSelectStation(o.station_id)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-[6px] text-left hover:bg-white/5 transition-colors group ${
                    outOfStock ? "opacity-45" : ""
                  } ${isHere ? "bg-primary/10 border border-primary/30" : ""}`}
                >
                  {isHere && (
                    <Star className="w-3 h-3 shrink-0 text-primary fill-primary" />
                  )}
                  <span className="flex-1 min-w-0">
                    <span className="block text-[12px] text-[#e7edf6] truncate group-hover:text-white">
                      {o.station_name ?? o.station_id}
                    </span>
                    <span className="block text-[10px] text-[#6b7890] truncate">
                      {sectorName(o.sector_id)}
                      {outOfStock ? " · Out of stock" : ""}
                    </span>
                  </span>
                  <span className="w-16 text-right shrink-0">
                    <Currency value={o.price} icon={false} className="text-[12px]" />
                  </span>
                  <span className="w-14 text-right text-[11px] text-[#9aa6ba] tabular-nums shrink-0">
                    {o.quantity.toLocaleString()}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
