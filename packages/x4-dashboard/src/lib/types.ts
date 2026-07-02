// Shared cross-page domain types. Types scoped to a single feature (the universe map,
// a page's own view models, etc.) belong next to that feature instead of here.

export type FactionSummary = {
  faction_id: string;
  name: string;
  color_hex: string | null;
  icon_url?: string | null;
  short_name?: string | null;
  primary_race?: string | null;
};
