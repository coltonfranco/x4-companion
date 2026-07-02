// Shared types for the diplomacy tabs.

export type BribeWare = {
  ware_id: string | null;
  ware_tags: string | null;
  amount: number | null;
};

export type DiploAction = {
  action_id: string;
  category: string | null;
  name: string | null;
  description: string | null;
  hidden: number;
  cost_influence: number | null;
  cost_money: number | null;
  success_chance: number | null;
  duration_sec: number | null;
  cooldown_sec: number | null;
  agent_type: string | null;
  agent_experience: number | null;
  risk: string | null;
  bribe_wares: BribeWare[];
};

export type DiploGift = { ware_id: string; faction_id: string };

export type AgentRank = {
  min_value: number;
  name: string | null;
  event_bonus: number | null;
  icon: string | null;
};

export type WareSummary = { ware_id: string; name: string; icon_url: string | null };
