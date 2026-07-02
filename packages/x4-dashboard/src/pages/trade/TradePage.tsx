import { useMemo } from "react";
import { TrendingUp, AlertTriangle, RefreshCw } from "lucide-react";
import { PageLoaderPreset } from "../../components/layout/PageLoader";
import { PageSubtitle } from "../../components/ui/page-subtitle";
import { NetWorthChart } from "./components/NetWorthChart";
import type { NetWorthPoint } from "./components/NetWorthChart";
import { useSaveTime } from "../../lib/useSaveTime";
import { useJson } from "../../lib/useJson";
import type { Account, NetWorthBreakdown, Player, Trade, WareMarket, WarePnl } from "./types";
import { TradeKpiRow } from "./components/TradeKpiRow";
import { PnlByCommodity } from "./components/PnlByCommodity";
import { MarketPulse } from "./components/MarketPulse";
import { RecentTrades } from "./components/RecentTrades";
import { AccountsPanel } from "./components/AccountsPanel";

// ── Page ─────────────────────────────────────────────────────────────────────────

export default function TradeOverviewPage() {
  const { data: player, isLoading: playerLoading } = useJson<Player>("player-credits", "/api/v1/player");
  const { data: accounts = [], isLoading: acctLoading, isError: acctErr, error: acctErrMsg, refetch: refetchAcct } = useJson<Account[]>("economy-accounts", "/api/v1/economy/accounts?player_only=true");
  const { data: networth = [], isLoading: nwLoading, isError: nwErr, error: nwErrMsg, refetch: refetchNw } = useJson<NetWorthPoint[]>("economy-networth", "/api/v1/economy/networth?player_only=true");
  const { data: pnl = [], isLoading: pnlLoading, isError: pnlErr, error: pnlErrMsg, refetch: refetchPnl } = useJson<WarePnl[]>("economy-pnl", "/api/v1/economy/pnl");
  const { data: trades = [], isLoading: tradesLoading, isError: tradesErr, error: tradesErrMsg, refetch: refetchTrades } = useJson<Trade[]>("economy-trades-recent", "/api/v1/economy/trades?player_only=true&limit=40");
  const { data: market = [], isLoading: marketLoading, isError: marketErr, error: marketErrMsg, refetch: refetchMarket } = useJson<WareMarket[]>("economy-market", "/api/v1/economy/wares?sort=net_demand&limit=400");
  const { data: netWorthBreakdown, isLoading: nwBreakdownLoading, isError: nwBreakdownErr, error: nwBreakdownErrMsg, refetch: refetchNwBreakdown } = useJson<NetWorthBreakdown>("economy-networth-current", "/api/v1/economy/networth/current");

  const isLoading = playerLoading || acctLoading || nwLoading || pnlLoading || tradesLoading || marketLoading || nwBreakdownLoading;

  const errors = useMemo(() => {
    const e: { key: string; msg: string }[] = [];
    if (acctErr && acctErrMsg) e.push({ key: "accounts", msg: String(acctErrMsg) });
    if (nwErr && nwErrMsg) e.push({ key: "networth", msg: String(nwErrMsg) });
    if (pnlErr && pnlErrMsg) e.push({ key: "pnl", msg: String(pnlErrMsg) });
    if (tradesErr && tradesErrMsg) e.push({ key: "trades", msg: String(tradesErrMsg) });
    if (marketErr && marketErrMsg) e.push({ key: "market", msg: String(marketErrMsg) });
    if (nwBreakdownErr && nwBreakdownErrMsg) e.push({ key: "networth-breakdown", msg: String(nwBreakdownErrMsg) });
    return e;
  }, [acctErr, acctErrMsg, nwErr, nwErrMsg, pnlErr, pnlErrMsg, tradesErr, tradesErrMsg, marketErr, marketErrMsg, nwBreakdownErr, nwBreakdownErrMsg]);

  // Credit balance = the player's master account (kind='account', the faction-level
  // aggregate tracked by the economylog). Falls back to the old net_worth sort if absent.
  const masterAccount = useMemo(
    () => accounts.find((a) => a.kind === "account" && a.net_worth != null)
        ?? [...accounts].filter((a) => a.net_worth != null).sort((a, b) => (b.net_worth ?? 0) - (a.net_worth ?? 0))[0],
    [accounts],
  );

  // Empire value from the comprehensive backend calculation
  const empireValue = netWorthBreakdown?.total ?? 0;

  const creditSeries = useMemo(
    () => networth
      .filter((p) => p.owner === masterAccount?.owner && p.v != null && p.type != null)
      .sort((a, b) => a.time - b.time),
    [networth, masterAccount],
  );

  const totals = useMemo(() => {
    const income = pnl.reduce((s, p) => s + p.income, 0);
    const spend = pnl.reduce((s, p) => s + p.spend, 0);
    const tradeCount = pnl.reduce((s, p) => s + p.sell_count + p.buy_count, 0);
    return { income, spend, net: income - spend, volume: income + spend, tradeCount };
  }, [pnl]);

  const maxAbsNet = useMemo(() => Math.max(1, ...pnl.map((p) => Math.abs(p.net))), [pnl]);

  const currentTime = useSaveTime();

  const shortages = useMemo(() => market.filter((m) => m.classification === "shortage").slice(0, 6), [market]);
  const surpluses = useMemo(
    () => market.filter((m) => m.classification === "surplus").sort((a, b) => a.net_demand - b.net_demand).slice(0, 6),
    [market],
  );

  const { stationAccounts, shipAccounts, otherAccounts, totalVisibleAccounts } = useMemo(() => {
    const stations = accounts
      .filter((a) => a.kind === "station")
      .sort((a, b) => (b.account_amount ?? 0) - (a.account_amount ?? 0));
    const ships = accounts
      .filter((a) => a.kind === "ship" && ((a.net_worth ?? 0) > 0 || (a.live_cash ?? 0) > 0))
      .sort((a, b) => (b.live_cash ?? b.net_worth ?? 0) - (a.live_cash ?? a.net_worth ?? 0));
    const others = accounts
      .filter((a) => a.kind !== "station" && a.kind !== "ship")
      .sort((a, b) => (b.net_worth ?? 0) - (a.net_worth ?? 0));
    return {
      stationAccounts: stations,
      shipAccounts: ships,
      otherAccounts: others,
      totalVisibleAccounts: stations.length + ships.length + others.length,
    };
  }, [accounts]);

  if (isLoading) return <div className="p-6"><PageLoaderPreset preset="economy" /></div>;

  if (errors.length > 0) {
    const retryAll = () => {
      if (acctErr) refetchAcct();
      if (nwErr) refetchNw();
      if (pnlErr) refetchPnl();
      if (tradesErr) refetchTrades();
      if (marketErr) refetchMarket();
      if (nwBreakdownErr) refetchNwBreakdown();
    };
    return (
      <div className="flex flex-col h-full">
        <Header />
        <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground gap-3 p-6">
          <AlertTriangle className="h-10 w-10 text-[var(--danger)] opacity-60" />
          <p className="text-sm font-semibold text-[var(--danger)]">API errors — check server logs</p>
          <div className="text-xs space-y-1 max-w-md mb-2">
            {errors.map((e) => (
              <div key={e.key} className="flex gap-2">
                <span className="font-mono text-[var(--danger)] shrink-0">{e.key}</span>
                <span className="text-muted-foreground truncate">{e.msg}</span>
              </div>
            ))}
          </div>
          <button
            onClick={retryAll}
            className="inline-flex items-center gap-2 px-4 py-2 rounded text-sm font-medium bg-[var(--danger)]/10 text-[var(--danger)] hover:bg-[var(--danger)]/20 transition-colors"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </div>
      </div>
    );
  }

  const allEmpty = accounts.length === 0 && pnl.length === 0 && market.length === 0 && trades.length === 0;

  if (allEmpty) {
    return (
      <div className="flex flex-col h-full">
        <Header />
        <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground gap-3">
          <TrendingUp className="h-12 w-12 opacity-30" />
          <p className="text-sm max-w-md text-center">
            No economy history yet. Ingest a save (or restart the API server after updating) to populate your finances.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header />
      <div className="flex-1 overflow-auto px-6 py-5 space-y-5">
        <TradeKpiRow player={player} empireValue={empireValue} netWorthBreakdown={netWorthBreakdown} totals={totals} />

        {/* Credit balance over time */}
        <NetWorthChart
          data={creditSeries}
          title="Credit Balance Over Time"
          subtitle={player?.name ? <span className="text-xs text-muted-foreground">{player.name}</span> : undefined}
        />

        {/* P&L by commodity + Market pulse */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <PnlByCommodity pnl={pnl} maxAbsNet={maxAbsNet} />
          <MarketPulse shortages={shortages} surpluses={surpluses} />
        </div>

        {/* Recent trades + Accounts */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <RecentTrades trades={trades} currentTime={currentTime} />
          <AccountsPanel
            stationAccounts={stationAccounts}
            shipAccounts={shipAccounts}
            otherAccounts={otherAccounts}
            totalVisibleAccounts={totalVisibleAccounts}
          />
        </div>
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="px-6 pt-5 pb-3 shrink-0 border-b border-border">
      <h1 className="text-2xl font-bold flex items-center gap-2 tracking-tight">
        <TrendingUp className="h-6 w-6 text-primary" /> Economic Overview
      </h1>
      <PageSubtitle>Faction finances &amp; system economy</PageSubtitle>
    </div>
  );
}
