import { useState } from "react";
import {
  Shield,
  Target,
  Building2,
  ScrollText,
  Swords,
  RefreshCw,
} from "lucide-react";
import { formatTimeAgo, formatCompactNumber } from "../../../lib/formatters";
import { Pill } from "../../../components/ui/pill";
import { FactionBadge } from "../../../components/game/FactionBadge";
import { EmbeddedMap } from "./EmbeddedMap";
import type { FactionSummary } from "../../../lib/types";
import {
  DIFFICULTY_LABEL,
  LEVEL_COLORS,
  TYPE_COLORS,
  type Difficulty,
  type MissionType,
  type MissionObjective,
} from "../types";
import { missionTextPlain } from "../lib/missionText";

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

// ── Objective processing ──────────────────────────────────────────────────────

/**
 * The save's top-level `mission.is_active` flag marks whichever single mission
 * the player has pinned as "active" in the in-game log — not whether the
 * mission has been started or has open work. Real progress lives on each
 * objective's own `is_active`/progress fields, which this derives from.
 */

export type ProcessedObjective = {
  step: number;
  text: string | null;
  target_name: string | null;
  target_sector_id: string | null;
  status: "done" | "current" | "next";
  progress_current: number | null;
  progress_max: number | null;
  type: string | null;
};

function parseProgress(s: string | null): {
  current: number;
  max: number;
  cleanText: string;
} | null {
  if (!s) return null;
  const match = s.match(/\(\s*(\d+)\s*\/\s*(\d+)\s*\)/);
  if (match) {
    return {
      current: parseInt(match[1], 10),
      max: parseInt(match[2], 10),
      cleanText: s.replace(match[0], "").trim(),
    };
  }
  return null;
}

export function processObjectives(objectives: MissionObjective[]): {
  steps: ProcessedObjective[];
  activeStep: number;
} {
  const parsed = objectives.map((obj) => {
    let text = obj.text;
    let progress_current = obj.progress_current;
    let progress_max = obj.progress_max;

    // Try to parse progress from text fields
    if (progress_current == null || progress_max == null) {
      const p = parseProgress(text);
      if (p) {
        progress_current = p.current;
        progress_max = p.max;
        text = p.cleanText;
      }
    }

    return { ...obj, text, progress_current, progress_max };
  });

  // Normalize step numbers
  const maxStep = Math.max(0, ...parsed.map((o) => o.step ?? 0));
  parsed.forEach((o) => {
    if (o.step == null || o.step === 0) {
      o.step = maxStep > 0 ? maxStep + 1 : 1;
    }
  });

  const sorted = [...parsed].sort((a, b) => (a.step ?? 0) - (b.step ?? 0));

  // Determine active step
  const activeStep =
    sorted.find((o) => o.is_active)?.step ??
    Math.max(0, ...sorted.map((o) => o.step ?? 0));

  // Deduplicate
  const seen = new Map<string, number>();
  sorted.forEach((o, i) => {
    const sig = `${o.type}|${(o.text ?? "").toLowerCase()}|${(o.target_name ?? "").toLowerCase()}`;
    seen.set(sig, i);
  });
  const deduped = sorted.filter((o, i) => {
    const sig = `${o.type}|${(o.text ?? "").toLowerCase()}|${(o.target_name ?? "").toLowerCase()}`;
    return seen.get(sig) === i;
  });

  const steps: ProcessedObjective[] = deduped.map((o) => {
    const step = o.step ?? 0;
    const isComplete =
      (activeStep > 0 && step < activeStep) ||
      (o.progress_current != null &&
        o.progress_max != null &&
        o.progress_max > 0 &&
        o.progress_current >= o.progress_max);
    const isActive = !isComplete && o.is_active;
    const status: ProcessedObjective["status"] = isComplete
      ? "done"
      : isActive
        ? "current"
        : "next";

    return {
      step,
      text: missionTextPlain(o.text),
      target_name: o.target_name,
      target_sector_id: o.target_sector_id,
      status,
      progress_current: o.progress_current,
      progress_max: o.progress_max,
      type: o.type,
    };
  });

  return { steps, activeStep };
}

/**
 * Whether a mission still has open work, derived from its objectives rather than
 * the unreliable top-level `is_active` flag. A mission with no extracted
 * objectives is treated as "current" (in progress) rather than "done" or
 * "locked" — its mere presence in the save means it's already unlocked.
 */
export function deriveMissionStageStatus(
  objectives: MissionObjective[],
): "done" | "current" {
  if (objectives.length === 0) return "current";
  const { steps } = processObjectives(objectives);
  return steps.length > 0 && steps.every((s) => s.status === "done")
    ? "done"
    : "current";
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

// ── Route map (expand-to-fullscreen embedded map) ───────────────────────────────

/**
 * Owns the expanded/collapsed state for a route map. Callers early-return
 * `fullscreenView` (when non-null) as the *entire* page's render — the fullscreen
 * map replaces everything else, matching how each call site worked before this was
 * extracted — then render `<RouteMapSection onExpand={expand} .../>` for the
 * collapsed view.
 */
export function useMapExpand(targetSectorId: string | null) {
  const [expanded, setExpanded] = useState(false);
  const expand = () => setExpanded(true);
  const collapse = () => setExpanded(false);
  const fullscreenView = expanded ? (
    <EmbeddedMap targetSectorId={targetSectorId} fullscreen onBack={collapse} />
  ) : null;
  return { expanded, expand, collapse, fullscreenView };
}

/** The collapsed `SectionLabel` + embedded map pair shared by every route-map section. */
export function RouteMapSection({
  label,
  extra,
  targetSectorId,
  height,
  onExpand,
}: {
  label: React.ReactNode;
  extra?: React.ReactNode;
  targetSectorId: string | null;
  height: number;
  onExpand: () => void;
}) {
  return (
    <>
      <SectionLabel
        extra={extra}
      >
        {label}
      </SectionLabel>

      <EmbeddedMap targetSectorId={targetSectorId} onExpand={onExpand} height={height} />
    </>
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

// ── Faction cluster (primary [vs opposing]) ─────────────────────────────────────

/**
 * Renders a mission/offer's faction (as a badge, or a "◈ id" fallback when it isn't
 * in `factionMap`) and, if present, "vs <opposing faction>". At `size="sm"` the
 * opposing side also renders as a `FactionBadge`; at `size="md"` it renders as plain
 * colored text — matching each call site's original inline styling.
 */
export function MissionFactionCluster({
  faction,
  opposingFaction,
  factionMap,
  size,
  showFallback = false,
}: {
  faction: string | null | undefined;
  opposingFaction: string | null | undefined;
  factionMap: Map<string, FactionSummary>;
  size: "sm" | "md";
  showFallback?: boolean;
}) {
  const factionObj = faction ? factionMap.get(faction) : undefined;
  const opposingObj = opposingFaction ? factionMap.get(opposingFaction) : undefined;
  const textClass = size === "sm" ? "text-[10px]" : "text-[11px]";

  const primaryBadge = factionObj && (
    <FactionBadge
      name={factionObj.name}
      color_hex={factionObj.color_hex}
      icon_url={factionObj.icon_url}
      faction_id={factionObj.faction_id}
      size={size}
    />
  );

  return (
    <>
      {primaryBadge && size === "sm" ? <span className={textClass}>{primaryBadge}</span> : primaryBadge}
      {showFallback && !factionObj && faction && (
        <span className={`${textClass} uppercase tracking-wide font-semibold text-muted-foreground`}>
          ◈ {faction}
        </span>
      )}
      {opposingObj && (
        <>
          <span className={`${textClass} text-muted-foreground`}>vs</span>
          {size === "sm" ? (
            <FactionBadge
              name={opposingObj.name}
              color_hex={opposingObj.color_hex}
              icon_url={opposingObj.icon_url}
              faction_id={opposingObj.faction_id}
              size={size}
            />
          ) : (
            <span className="font-semibold" style={{ color: opposingObj.color_hex ?? "#f87171" }}>
              {opposingObj.name}
            </span>
          )}
        </>
      )}
    </>
  );
}
