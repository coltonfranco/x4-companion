// Shared types for the trade overview page (mirror /api/v1/economy/* + /player).

export type Account = {
  owner: string; name: string | null; kind: "station" | "ship" | "account";
  faction: string | null; is_player: boolean; ship_role: string | null;
  net_worth: number | null; net_worth_assets: number | null;
  live_cash: number | null;
  account_amount: number | null; account_min: number | null; account_max: number | null;
  latest_time: number | null; event_count: number;
};

export type WarePnl = {
  ware: string | null; ware_name: string | null; icon_url: string | null;
  income: number; spend: number; net: number; sell_count: number; buy_count: number;
  sell_qty: number; buy_qty: number;
};

export type Trade = {
  time: number; ware: string | null; ware_name: string | null; icon_url: string | null;
  price: number | null; quantity: number | null; buyer_name: string | null; buyer_is_player: boolean;
  seller_name: string | null; seller_is_player: boolean;
};

export type WareMarket = {
  ware_id: string; ware_name: string | null; net_demand: number;
  price_index: number | null; classification: "shortage" | "balanced" | "surplus";
  buy_qty: number; sell_qty: number;
};

export type Player = { name: string | null; credits: number | null };

export type NetWorthBreakdown = {
  cash: number;
  station_accounts: number;
  ship_hulls: number;
  ship_equipment: number;
  station_modules: number;
  inventory: number;
  total: number;
};
