export const ROLE_META: Record<string, { label: string; color: string }> = {
  aipilot:  { label: "Captain",  color: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
  defence:  { label: "Defence",  color: "bg-red-500/15 text-red-400 border-red-500/30" },
  engineer: { label: "Engineer", color: "bg-slate-500/5 text-slate-500/70 border-slate-500/10" },
  manager:  { label: "Manager",  color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  trader:   { label: "Trader",   color: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  marine:   { label: "Marine",   color: "bg-orange-500/5 text-orange-600/50 border-orange-500/10" },
};

export type ColumnMeta = {
  key: string;
  label: string;
  sortKey?: string;
  groupId: string;
  defaultVisible: boolean;
  align?: "left" | "right";
};

export const ALL_COLUMNS: ColumnMeta[] = [
  // Identity
  { key: "name", label: "Name", sortKey: "name", groupId: "identity", defaultVisible: true, align: "left" },
  { key: "role", label: "Role", sortKey: "role", groupId: "identity", defaultVisible: true, align: "left" },

  // Current Role
  { key: "command", label: "Command", sortKey: "command", groupId: "current-role", defaultVisible: true, align: "left" },
  { key: "role_skill", label: "Role Skill", sortKey: "role_skill", groupId: "current-role", defaultVisible: true, align: "left" },

  // Skills
  { key: "skill_piloting", label: "Piloting", sortKey: "skill_piloting", groupId: "skills", defaultVisible: false, align: "left" },
  { key: "skill_morale", label: "Morale", sortKey: "skill_morale", groupId: "skills", defaultVisible: false, align: "left" },
  { key: "skill_engineering", label: "Engineering", sortKey: "skill_engineering", groupId: "skills", defaultVisible: false, align: "left" },
  { key: "skill_management", label: "Management", sortKey: "skill_management", groupId: "skills", defaultVisible: false, align: "left" },
  { key: "skill_boarding", label: "Boarding", sortKey: "skill_boarding", groupId: "skills", defaultVisible: false, align: "left" },

  // Location
  { key: "workplace", label: "Workplace", sortKey: "workplace", groupId: "location", defaultVisible: true, align: "left" },
  { key: "sector", label: "Sector", sortKey: "sector", groupId: "location", defaultVisible: true, align: "left" },
];

export const DEFAULT_VISIBLE = new Set(ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key));
export const STORAGE_KEY = "crew-table-columns";

export const COLUMN_GROUPS = [
  { id: "identity", label: "Identity" },
  { id: "current-role", label: "Current Role" },
  { id: "skills", label: "Skills Breakout" },
  { id: "location", label: "Location" },
];

export const GROUP_BY_OPTIONS = [
  { key: "none", label: "None" },
  { key: "role", label: "Role" },
  { key: "workplace", label: "Workplace" },
  { key: "sector", label: "Sector" },
] as const;

export type GroupByKey = (typeof GROUP_BY_OPTIONS)[number]["key"];
