export const VISIBLE_FACTIONS_QUERY_KEY = ["factions", "visible"] as const;
export const ALL_FACTIONS_QUERY_KEY = ["factions", "all"] as const;

export const VISIBLE_FACTIONS_PATH = "/api/v1/factions";
export const ALL_FACTIONS_PATH = "/api/v1/factions?include_hidden=true";
