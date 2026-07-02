export type LogEntry = {
  id: number;
  time: number;
  title: string;
  text: string;
  category: string;
  subcategory: string;
  faction: string | null;
  faction_name: string | null;
  faction_color: string | null;
  extra_json: string | null;
};

export type CategoryInfo = {
  key: string;
  label: string;
  subcategories: { key: string; label: string }[];
};
