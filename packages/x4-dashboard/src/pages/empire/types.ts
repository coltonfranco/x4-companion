// Shared types for the crew page.
import type { FactionSummary } from "../../lib/types";

export type RoleSkillWeight = {
  skill_ref: string;
  relevance: number;
};

export type RoleMeta = {
  role_id: string;
  name: string;
  tag: string;
  skills: RoleSkillWeight[];
};

export type NPCEntry = {
  id: string;
  name: string | null;
  code: string | null;
  macro: string | null;
  owner_faction: string | null;
  entity_type: string | null;
  entity_post: string | null;
  seed: string | null;
  connection: string | null;
  location_ship_id: string | null;
  location_station_id: string | null;
  location_ship_name: string | null;
  location_ship_code: string | null;
  location_ship_command: string | null;
  location_ship_command_name: string | null;
  location_ship_assignment: string | null;
  location_ship_assignment_name: string | null;
  ship_macro: string | null;
  location_ship_icon_url: string | null;
  location_station_name: string | null;
  location_station_code: string | null;
  location_sector_name: string | null;
  skill_piloting: number | null;
  skill_morale: number | null;
  skill_engineering: number | null;
  skill_management: number | null;
  skill_boarding: number | null;
  blackboard_json: string | null;
  employment: string;
  extra_json: string | null;
};

/** Enriched NPC with pre-computed display fields so COLUMNS renders are pure reads. */
export type EnrichedNPC = NPCEntry & {
  factionSummary?: FactionSummary;
  factionDisplay: string;
  factionId: string | null;
  gender: string | null;
  locationType: "Ship" | "Station" | "None";
  roleSkill: number | null;
};
