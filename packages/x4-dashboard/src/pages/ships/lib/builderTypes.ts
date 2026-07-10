export type EngineStats = {
  thrust_forward: number | null; travel_thrust: number | null; boost_thrust: number | null; thrust_strafe: number | null;
  thrust_reverse?: number | null; travel_charge?: number | null; boost_duration?: number | null; mk?: number | null;
};
export type ShieldStats = {
  capacity: number | null; recharge_rate: number | null; recharge_delay?: number | null; mk?: number | null;
};
export type WeaponStats = {
  damage: number | null; reload_rate: number | null; bullet_amount: number | null;
  rotation_speed?: number | null; shield_damage?: number | null; hull_damage?: number | null;
  bullet_speed?: number | null; bullet_lifetime?: number | null; mk?: number | null;
};

export type ShipSummary = { ship_id: string; name: string; class_id: string; owner_factions: string[]; primary_faction: string | null; role: string | null; icon_url: string | null; image_url: string | null; price_avg: number | null; };
export type ShipDetail = ShipSummary & {
  ship_type: string | null;
  speed_max: number | null; travel_max: number | null; boost_max: number | null; accel_max: number | null;
  pitch_max: number | null; yaw_max: number | null; roll_max: number | null;
  shield_capacity_max: number | null; shield_recharge_max: number | null; radar_range: number | null;
  hull: number | null; cargo_volume: number | null; mass: number | null; drag_forward: number | null;
  dps_max: number | null; range_max: number | null;
  people_capacity: number | null; drone_storage: number | null; missile_storage: number | null;
  deployable_storage: number | null; countermeasure_storage: number | null;
  dock_s: number; dock_m: number; dock_l: number; dock_xl: number;
  storage_s: number; storage_m: number; storage_l: number; storage_xl: number;
  weapons_s: number; weapons_m: number; weapons_l: number; weapons_xl: number;
  turrets_s: number; turrets_m: number; turrets_l: number; turrets_xl: number;
  shields_s: number; shields_m: number; shields_l: number; shields_xl: number;
  engines_s: number; engines_m: number; engines_l: number; engines_xl: number;
};

export type EquipmentItem = {
  ware_id: string; name: string; kind: string; size: string | null; mk: number | null;
  compat_tags: string | null;
  compat_ship_name: string | null;
  owner_factions: string[]; price_min: number | null; price_avg: number | null; price_max: number | null;
  icon_url: string | null;
  restriction_licence: string | null;
  engine_stats: EngineStats | null; shield_stats: ShieldStats | null; weapon_stats: WeaponStats | null;
};

export type SlotDef = { key: string; kind: string; size: string; index: number };

export type LoadoutOptionItem = { kind: string; ware_id: string; quantity: number };
export type LoadoutOption = {
  loadout_id: string; name: string | null; description: string | null;
  source: "preset" | "custom" | "approx"; items: LoadoutOptionItem[];
};

export type ClassMax = {
  hull: number; speed_max: number; travel_max: number; boost_max: number; accel_max: number;
  shield_capacity_max: number; shield_recharge_max: number; cargo_volume: number;
  dps_max: number; range_max: number; crew_max: number; missile_max: number;
};

export type EquipmentEvalContext = { ship: ShipDetail | null; slots: SlotDef[] };

export type SortOption = { id: string; label: string; eval: (e: EquipmentItem, context?: EquipmentEvalContext) => number | string | null; desc?: boolean; };

export type StatDisplay = { label: string; value: number; max: number; isLog: boolean; format: (n: number) => string; color?: string };
