import { useEffect, useMemo, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import {
  ArrowLeftRight, ArrowUpRight, ArrowDownLeft, ChevronLeft, ChevronRight,
  AlertTriangle, RefreshCw,
} from "lucide-react";
import { Currency } from "../../components/game/Currency";
import { EntityIcon } from "../../components/game/EntityIcon";
import { PageLoaderPreset } from "../../components/layout/PageLoader";
import { PageSubtitle } from "../../components/ui/page-subtitle";
import { FilterBar } from "../../components/layout/FilterBar";
import { MultiSelect } from "../../components/ui/multi-select";
import { ClearFiltersButton } from "../../components/ui/clear-filters-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { formatTimeAgo } from "../../lib/formatters";
import { useSaveTime } from "../../lib/useSaveTime";
import { useJson } from "../../lib/useJson";
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../components/ui/tooltip";
import { FlowBarChart } from "./components/FlowBarChart";
import type { FlowBarDatum } from "./components/FlowBarChart";
import { TIME_RANGES } from "./components/NetWorthChart";
import type { Account, Trade, WarePnl } from "./types";

const PAGE_SIZE = 50;

const SHIP_GROUP_ORDER = ["Stations", "Trade Ships", "Other Ships"] as const;

function ownerGroup(a: Account): (typeof SHIP_GROUP_ORDER)[number] {
  if (a.kind === "station") return "Stations";
  return a.ship_role === "trade" ? "Trade Ships" : "Other Ships";
}

// ── Page ────────────────────────────────────────────────────────────────────────

export default function TransactionsPage() {
  const search = useSearch({ strict: false }) as { owner?: string; ware?: string };
  const [page, setPage] = useState(0);
  const [owner, setOwner] = useState<Set<string>>(() => new Set(search.owner ? [search.owner] : []));
  const [ware, setWare] = useState<Set<string>>(() => new Set(search.ware ? [search.ware] : []));
  // Historical ledger — default to showing everything, not a recent window.
  const [timeRange, setTimeRange] = useState<number>(Infinity);

  useEffect(() => setPage(0), [owner, ware, timeRange]);

  const currentTime = useSaveTime();
  const since = useMemo(
    () => (isFinite(timeRange) ? Math.max(0, currentTime - timeRange) : undefined),
    [timeRange, currentTime],
  );

  const { data: accounts = [] } = useJson<Account[]>("economy-accounts-filter", "/api/v1/economy/accounts?player_only=true");
  const { data: pnl = [] } = useJson<WarePnl[]>("economy-pnl-filter", "/api/v1/economy/pnl");

  const ownerOptions = useMemo(() => {
    const withGroup = accounts
      .filter((a) => a.kind === "ship" || a.kind === "station")
      .map((a) => ({ value: a.owner, label: a.name ?? a.owner, group: ownerGroup(a) }));
    return SHIP_GROUP_ORDER.flatMap((g) =>
      withGroup.filter((o) => o.group === g).sort((a, b) => a.label.localeCompare(b.label))
    );
  }, [accounts]);

  const wareOptions = useMemo(
    () => pnl
      .filter((p) => p.ware)
      .map((p) => ({
        value: p.ware as string,
        label: p.ware_name ?? (p.ware as string),
        node: (
          <div className="flex items-center gap-2">
            <EntityIcon src={p.icon_url} alt="" size={16} />
            <span>{p.ware_name ?? p.ware}</span>
          </div>
        ),
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [pnl],
  );

  const hasFilters = owner.size > 0 || ware.size > 0 || isFinite(timeRange);
  const clearFilters = () => { setOwner(new Set()); setWare(new Set()); setTimeRange(Infinity); };

  // Stable signatures for the filter sets so query keys/deps change only when
  // membership actually changes, not on every render.
  const ownerKey = useMemo(() => [...owner].sort().join(","), [owner]);
  const wareKey = useMemo(() => [...ware].sort().join(","), [ware]);

  const url = useMemo(() => {
    const params = new URLSearchParams({
      player_only: "true",
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    });
    owner.forEach((o) => params.append("owner", o));
    ware.forEach((w) => params.append("ware", w));
    if (since != null) params.set("since", String(since));
    return `/api/v1/economy/trades?${params.toString()}`;
  }, [page, owner, ware, since]);

  const { data: trades = [], isLoading, isError, error, refetch } = useJson<Trade[]>(
    `trades-page-${page}-${ownerKey}-${wareKey}-${since ?? ""}`,
    url,
  );

  // Commodity breakdown, scoped to the same ship/station + commodity + time window as
  // the table below (the "recent trades vs all transactions" pattern, but drillable).
  const chartUrl = useMemo(() => {
    const params = new URLSearchParams();
    owner.forEach((o) => params.append("owner", o));
    ware.forEach((w) => params.append("ware", w));
    if (since != null) params.set("since", String(since));
    return `/api/v1/economy/pnl?${params.toString()}`;
  }, [owner, ware, since]);

  const { data: chartPnl = [] } = useJson<WarePnl[]>(`transactions-pnl-${ownerKey}-${wareKey}-${since ?? ""}`, chartUrl);

  const chartData: FlowBarDatum[] = useMemo(
    () => [...chartPnl]
      .sort((a, b) => (Math.abs(b.sell_qty) + Math.abs(b.buy_qty)) - (Math.abs(a.sell_qty) + Math.abs(a.buy_qty)))
      .map((p, i) => ({
        key: p.ware ?? `row-${i}`,
        label: p.ware_name ?? p.ware ?? "Unknown",
        iconUrl: p.icon_url,
        positive: p.income,
        negative: p.spend,
        positiveQty: p.sell_qty,
        negativeQty: p.buy_qty,
      })),
    [chartPnl],
  );

  const hasMore = trades.length === PAGE_SIZE;

  if (isLoading) return <div className="p-6"><PageLoaderPreset preset="economy" /></div>;

  if (isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground gap-3 p-6">
        <AlertTriangle className="h-10 w-10 text-[var(--danger)] opacity-60" />
        <p className="text-sm font-semibold text-[var(--danger)]">Failed to load transactions</p>
        <p className="text-xs text-muted-foreground truncate max-w-md">{String(error)}</p>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded text-sm font-medium bg-[var(--danger)]/10 text-[var(--danger)] hover:bg-[var(--danger)]/20 transition-colors"
        >
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 shrink-0 border-b border-border">
        <h1 className="text-2xl font-bold flex items-center gap-2 tracking-tight">
          <ArrowLeftRight className="h-6 w-6 text-primary" /> Transactions
        </h1>
        <PageSubtitle>All player trade history</PageSubtitle>
      </div>

      {/* Filters */}
      <FilterBar>
        <MultiSelect
          options={ownerOptions}
          selected={owner}
          onChange={setOwner}
          placeholder="Ship / station..."
          className="h-8 text-xs text-muted-foreground bg-transparent w-52"
          searchable
        />
        <MultiSelect
          options={wareOptions}
          selected={ware}
          onChange={setWare}
          placeholder="Commodity..."
          className="h-8 text-xs text-muted-foreground bg-transparent w-52"
          searchable
        />
        <Select value={String(timeRange)} onValueChange={(v) => setTimeRange(Number(v))}>
          <SelectTrigger className="w-[110px] h-8 text-xs text-muted-foreground bg-transparent">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_RANGES.map((r) => (
              <SelectItem key={String(r.seconds)} value={String(r.seconds)}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters && <ClearFiltersButton onClick={clearFilters} />}
      </FilterBar>

      {/* Scrollable content: commodity breakdown (scoped to the filters above) + table */}
      <div className="flex-1 overflow-auto">
        <div className="p-6 pb-0">
          <FlowBarChart
            title="Trade by Commodity"
            data={chartData}
            defaultMode="gross"
            emptyText={hasFilters ? "No trades match these filters." : "No external trades recorded."}
          />
        </div>

        {trades.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            {hasFilters ? "No transactions match these filters." : "No transactions recorded yet."}
          </div>
        ) : (
          <table className="w-full text-sm mt-6">
            <thead className="sticky top-0 bg-card border-b border-border z-10">
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                <th className="text-left px-4 py-2 w-[1%] whitespace-nowrap">Dir</th>
                <th className="text-left px-2 py-2">Commodity</th>
                <th className="text-right px-2 py-2 w-[1%] whitespace-nowrap">Price</th>
                <th className="text-right px-2 py-2 w-[1%] whitespace-nowrap">Qty</th>
                <th className="text-right px-2 py-2 w-[1%] whitespace-nowrap">Total</th>
                <th className="text-left px-2 py-2">Counterparty</th>
                <th className="text-right px-4 py-2 w-[1%] whitespace-nowrap">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {trades.map((t, i) => {
                const sell = t.seller_is_player && !t.buyer_is_player;
                const buy = t.buyer_is_player && !t.seller_is_player;
                const internal = t.seller_is_player && t.buyer_is_player;
                const total = (t.price ?? 0) * (t.quantity ?? 0);
                const counterparty = t.seller_is_player ? t.buyer_name : t.seller_name;

                return (
                  <tr key={i} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-1.5">
                      <TooltipProvider>
                        <UiTooltip delayDuration={300}>
                          <TooltipTrigger asChild>
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold ${
                              sell ? "text-[var(--success)]" : buy ? "text-[var(--danger)]" : "text-muted-foreground"
                            }`}>
                              {sell ? <ArrowUpRight className="h-3.5 w-3.5" /> : buy ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowLeftRight className="h-3 w-3" />}
                              {internal ? "MOVE" : sell ? "SELL" : "BUY"}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs font-normal">
                            {internal ? "Internal transfer" : sell ? `Sold to ${counterparty ?? "NPC"}` : `Bought from ${counterparty ?? "NPC"}`}
                          </TooltipContent>
                        </UiTooltip>
                      </TooltipProvider>
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-2 truncate max-w-[200px]">
                        <EntityIcon src={t.icon_url} alt="" size={20} />
                        <span className="truncate">{t.ware_name ?? t.ware ?? "—"}</span>
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      <Currency value={t.price} icon={false} />
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-xs">
                      {(t.quantity ?? 0).toLocaleString()}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      <Currency value={internal ? null : sell ? total : -total} dynamicColor icon={false} />
                    </td>
                    <td className="px-2 py-1.5 text-xs text-muted-foreground truncate max-w-[180px]">
                      {counterparty ?? "—"}
                    </td>
                    <td className="px-4 py-1.5 text-right tabular-nums text-xs text-muted-foreground whitespace-nowrap">
                      {formatTimeAgo(t.time, currentTime)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {trades.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-border shrink-0 bg-muted/10">
          <span className="text-xs text-muted-foreground tabular-nums">
            {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + trades.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-default transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs tabular-nums px-2 min-w-[3ch] text-center">{page + 1}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore}
              className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-default transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
