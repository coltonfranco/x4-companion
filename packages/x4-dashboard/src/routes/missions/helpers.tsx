import {
  Shield,
  Target,
  Building2,
  ScrollText,
  Swords,
  RefreshCw,
} from "lucide-react";
import { formatTimeAgo, formatCompactNumber } from "../../lib/formatters";
import { Pill } from "../../components/ui/pill";
import {
  DIFFICULTY_LABEL,
  LEVEL_COLORS,
  TYPE_COLORS,
  type Difficulty,
  type MissionType,
} from "./types";

// ── Labels ────────────────────────────────────────────────────────────────────

export function levelLabel(level: string | null): string | null {
  if (!level) return null;
  return DIFFICULTY_LABEL[level as Difficulty] ?? level;
}

export function typeColor(t: MissionType): string {
  return TYPE_COLORS[t] ?? "#94a3b8";
}

export function typeLabel(t: MissionType): string {
  return t
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^[a-z]/, (c) => c.toUpperCase());
}

// ── Objective type labels ─────────────────────────────────────────────────────

const OBJ_TYPE_LABEL: Record<string, string> = {
  acquire_crew: "Acquire Crew",
  await: "Await",
  build_module: "Build Module",
  claim: "Claim",
  custom: "Objective",
  deliver: "Deliver",
  dockat: "Dock At",
  flyto: "Fly To",
  investigate: "Investigate",
  kill: "Kill",
  talkto: "Talk To",
  unlock: "Unlock",
};

export function objTypeLabel(t: string | null): string {
  if (!t) return "";
  return (
    OBJ_TYPE_LABEL[t] ??
    t.replace(/_/g, " ").replace(/^[a-z]/, (c) => c.toUpperCase())
  );
}

// ── Formatting ────────────────────────────────────────────────────────────────

export function fmtTime(
  missionTime: string | null | undefined,
  nowSec: number | null,
): string | null {
  if (!missionTime || nowSec == null) return null;
  const t = parseFloat(missionTime);
  if (isNaN(t) || nowSec <= t) return null;
  return formatTimeAgo(t, nowSec) || null;
}

export function fmtItemRef(
  encyclopediaItem: string | null | undefined,
): string | null {
  if (!encyclopediaItem) return null;
  return encyclopediaItem
    .replace(/^inv_/, "")
    .replace(/^ship_/, "")
    .replace(/_/g, " ")
    .replace(/[0-9]+$/, "")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function fmtCredits(n: number): string {
  const compact = formatCompactNumber(n, {
    mDecimals: 2,
    decimals: 1,
    trim: true,
    base: (v) => v.toLocaleString(),
  });
  return `${compact} Cr`;
}

// ── Tag / badge components ────────────────────────────────────────────────────

export function LevelBadge({ level }: { level: string | null }) {
  const label = levelLabel(level);
  if (!label) return null;
  const color = LEVEL_COLORS[level as Difficulty] ?? "var(--text-muted)";
  return <Pill label={label} color={color} bg={`${color}18`} />;
}

export function StoryTag() {
  return <Pill label="✦ STORY" color="#d79be8" bg="rgba(200,121,224,0.14)" />;
}

export function RepeatableTag() {
  return (
    <Pill
      label="Repeatable"
      color="#7dd3fc"
      border="1px solid rgba(125,211,252,0.35)"
      icon={<RefreshCw className="w-3 h-3" />}
    />
  );
}

export function TypeIcon({ type }: { type: string | null }) {
  if (!type) return <Target className="w-4 h-4 text-muted-foreground" />;
  const iconMap: Record<string, typeof Target> = {
    plot: ScrollText,
    build: Building2,
    destroy: Swords,
    fight: Swords,
    kill: Swords,
    board: Swords,
    protect: Shield,
    escort: Shield,
  };
  const Icon = iconMap[type] ?? Target;
  return <Icon className="w-4 h-4 text-muted-foreground" />;
}

// ── Status dot style map ──────────────────────────────────────────────────────

export const STATUS_STYLES = {
  done: {
    icon: "✓",
    dotBorder: "#34d399",
    dotBg: "rgba(52,211,153,0.16)",
    dotFg: "#34d399",
    titleColor: "#7a8499",
    rowBg: "rgba(255,255,255,0.015)",
    rowBorder: "rgba(255,255,255,0.05)",
    statusText: "Completed",
  },
  current: {
    icon: "●",
    dotBorder: "#5cc8ec",
    dotBg: "rgba(92,200,236,0.16)",
    dotFg: "#5cc8ec",
    titleColor: "#eef2f8",
    rowBg: "rgba(92,200,236,0.05)",
    rowBorder: "rgba(92,200,236,0.18)",
    statusText: "In progress",
  },
  next: {
    icon: "",
    dotBorder: "rgba(255,255,255,0.18)",
    dotBg: "transparent",
    dotFg: "#5a6680",
    titleColor: "#cdd5e3",
    rowBg: "rgba(255,255,255,0.015)",
    rowBorder: "rgba(255,255,255,0.05)",
    statusText: "Locked",
  },
} as const;

export function getStatusStyle(status: keyof typeof STATUS_STYLES) {
  return STATUS_STYLES[status];
}

// ── Section label ─────────────────────────────────────────────────────────────

/**
 * The recurring "▸ LABEL ⋯⋯⋯" divider header used throughout mission detail views.
 * `extra` renders between the label and the divider (e.g. a step count); `after`
 * renders past the divider, on the far right (e.g. an Expand button).
 */
export function SectionLabel({
  children,
  extra,
  after,
}: {
  children: React.ReactNode;
  extra?: React.ReactNode;
  after?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 mt-6 mb-3">
      <span
        className="text-[11px] tracking-[1.5px] font-mono uppercase"
        style={{ color: "#7a8499" }}
      >
        ▸ {children}
      </span>
      {extra}
      <div className="flex-1 h-px bg-border/40" />
      {after}
    </div>
  );
}

// ── Stat tile ──────────────────────────────────────────────────────────────────

export type StatTileTint = {
  bg: string;
  border: string;
  labelColor: string;
  /** Value text color. Omit to fall back to the default foreground color. */
  valueColor?: string;
};

export function StatTile({
  label,
  value,
  tint,
}: {
  label: string;
  value: React.ReactNode;
  tint: StatTileTint;
}) {
  return (
    <div
      className="flex-1 p-3.5 rounded-xl border"
      style={{ background: tint.bg, borderColor: tint.border }}
    >
      <div
        className="text-[9.5px] tracking-[1.5px] font-mono uppercase"
        style={{ color: tint.labelColor }}
      >
        {label}
      </div>
      <div
        className={`font-mono text-xl font-semibold mt-1.5${tint.valueColor ? "" : " text-foreground"}`}
        style={tint.valueColor ? { color: tint.valueColor } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

// ── Run toggle button ─────────────────────────────────────────────────────────

export function RunToggleButton({
  isInRun,
  onToggleRun,
}: {
  isInRun: boolean;
  onToggleRun: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggleRun();
      }}
      className="absolute right-2.5 bottom-2.5 w-6 h-6 rounded-md flex items-center justify-center text-[13px] transition-colors hover:brightness-125"
      style={{
        background: isInRun ? "rgba(52,211,153,0.14)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${isInRun ? "rgba(52,211,153,0.4)" : "rgba(255,255,255,0.1)"}`,
        color: isInRun ? "#34d399" : "#7a8499",
      }}
      title={isInRun ? "In Run" : "Add to Run"}
    >
      {isInRun ? "✓" : "＋"}
    </button>
  );
}
