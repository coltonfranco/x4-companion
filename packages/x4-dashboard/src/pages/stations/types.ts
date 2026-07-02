// Types mirror /api/v1/stations rollup + sub-endpoints

export type Station = {
  station_id: string;
  code: string | null;
  name: string | null;
  macro: string | null;
  owner_faction: string | null;
  sector_id: string | null;
  category: string | null;
  is_player_owned: boolean;
  is_under_construction: boolean;
  build_pct: number | null;
  module_count: number | null;
  planned_module_count: number | null;
  account_amount: number | null;
  workforce_current: number | null;
  workforce_capacity: number | null;
  workforce_bonus: number | null;
  production_product: string | null;
};

export type Offer = { ware_id: string; side: "buy" | "sell"; price: number; quantity: number };

export type PlannedModule = { module_id: string; macro: string | null; name: string | null; kind: string | null; count: number };

export type BuildMaterial = { ware_id: string; name: string | null; amount: number; price_avg: number | null; total: number | null };

export type Construction = {
  station_id: string;
  is_under_construction: boolean;
  build_pct: number | null;
  module_count: number | null;
  planned_module_count: number | null;
  planned_modules: PlannedModule[];
  bill_of_materials: BuildMaterial[];
};

export type Sector = { sector_id: string; name: string | null };

export type Ware = { ware_id: string; name: string | null };

export type StationModuleRow = {
  module_id: string;
  macro: string | null;
  name: string | null;
  kind: string | null;
  size: string | null;
  produces_ware_id: string | null;
  count: number;
  construction_pct: number | null;
};
