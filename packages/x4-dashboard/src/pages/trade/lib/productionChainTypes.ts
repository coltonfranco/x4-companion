// Types mirror /api/v1/economy/production-chain

export type ChainInput = { ware_id: string; amount: number };

export type ChainRecipe = {
  method: string;
  time_sec: number;
  amount: number;
  workforce: number | null;
  inputs: ChainInput[];
};

export type ProducerModule = { module_id: string; name: string | null; makerrace: string | null; production_method: string | null };

export type ChainNode = {
  ware_id: string;
  name: string;
  group_id: string | null;
  category: string;
  group_tier: number | null;
  depth: number;
  price_min: number | null;
  price_avg: number | null;
  price_max: number | null;
  icon_url: string | null;
  market_avg: number | null;
  sell_qty: number | null;
  buy_qty: number | null;
  net_demand: number | null;
  empire_production: number | null;
  empire_consumption: number | null;
  recipes: Record<string, ChainRecipe>;
  producer_modules: ProducerModule[];
};

export type ChainResponse = {
  nodes: ChainNode[];
  methods: string[];
  has_market: boolean;
  has_empire: boolean;
};

export type Overlay = "market" | "empire" | "price";

export type WareOfferRow = {
  station_id: string;
  station_name: string | null;
  station_code: string | null;
  owner_faction: string | null;
  sector_id: string | null;
  side: string;
  price: number;
  quantity: number;
};

export type SectorRow = { sector_id: string; name: string | null };
