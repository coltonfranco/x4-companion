import {
  MapPin,
} from "lucide-react";
import { StatBar } from "../../../components/data-display/StatBar";
import type { FactionSummary } from "../../../lib/types";
import type { Mission, Bucket } from "../types";
import {
  typeColor,
  typeLabel,
  LevelBadge,
  StoryTag,
  STATUS_STYLES,
  SectionLabel,
  MissionFactionCluster,
  useMapExpand,
  RouteMapSection,
  processObjectives,
} from "./MissionViewParts";
import { MissionBriefingText } from "../lib/missionText";

type Props = {
  m: Mission;
  factionMap: Map<string, FactionSummary>;
  /**
   * Which bucket this mission is being viewed from. Passed by the caller rather
   * than inferred from `m.is_active` — that flag marks the player's single
   * pinned/tracked mission, not whether it's an active save mission vs. an offer.
   */
  bucket: Bucket;
};

// ── Bucket metadata ───────────────────────────────────────────────────────────

const BUCKET_META: Record<string, { label: string; color: string }> = {
  active: { label: "ACTIVE MISSION", color: "#34d399" },
  guild: { label: "GUILD & WAR", color: "#f5a524" },
  offer: { label: "AVAILABLE OFFER", color: "#7fb9d6" },
};

// ── Component ─────────────────────────────────────────────────────────────────

export function MissionDetail({ m, factionMap, bucket }: Props) {
  const mtypeColor = m.type ? typeColor(m.type) : undefined;
  const mtLabel = m.type ? typeLabel(m.type) : null;
  const bucketMeta = BUCKET_META[bucket] ?? BUCKET_META.offer;

  // Process objectives
  const { steps } = processObjectives(m.objectives);
  const currentStep = steps.find((s) => s.status === "current");
  const hasObjectives = steps.length > 0;

  // Gather map data: find target sector from objectives or associated entity
  const mapSectorId =
    currentStep?.target_sector_id ??
    m.associated_entity_sector_id ??
    null;

  const routeMap = useMapExpand(mapSectorId);
  if (routeMap.fullscreenView) return routeMap.fullscreenView;

  return (
    <div className="p-6 max-w-[760px] animate-in fade-in slide-in-from-right-2 duration-150">
      {/* Bucket label */}
      <div
        className="text-[10px] tracking-[2px] font-mono uppercase mb-2"
        style={{ color: bucketMeta.color }}
      >
        {bucketMeta.label}
      </div>

      {/* Title */}
      <h2 className="text-[26px] font-semibold leading-tight">{m.name}</h2>

      {/* Badges */}
      <div className="flex items-center gap-2 mt-2.5 flex-wrap">
        {mtLabel && mtypeColor && (
          <span
            className="text-[9.5px] font-semibold uppercase tracking-[0.4px] px-2.5 py-1 rounded-md"
            style={{ background: `${mtypeColor}18`, color: mtypeColor }}
          >
            {mtLabel}
          </span>
        )}
        <LevelBadge level={m.level} />
        {m.is_story && <StoryTag />}
        <MissionFactionCluster
          faction={m.faction}
          opposingFaction={m.opposing_faction}
          factionMap={factionMap}
          size="md"
          showFallback
        />
      </div>

      {/* Giver */}
      {m.caption && (
        <div className="text-[12px] text-muted-foreground mt-2.5">
          ⌖ Offered by <span className="text-foreground/70">{m.caption}</span>
        </div>
      )}

      {/* DO THIS NEXT (active only) */}
      {bucket === "active" && currentStep && (
        <div
          className="flex items-center gap-3 mt-4 p-3.5 rounded-xl border"
          style={{
            background: "rgba(92,200,236,0.08)",
            borderColor: "rgba(92,200,236,0.22)",
          }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[15px] shrink-0"
            style={{ background: "rgba(92,200,236,0.16)", color: "#5cc8ec" }}
          >
            ➤
          </div>
          <div className="flex-1 min-w-0">
            <div
              className="text-[9.5px] tracking-[1.5px] font-mono uppercase"
              style={{ color: "#7fb9d6" }}
            >
              DO THIS NEXT
            </div>
            <div className="text-sm font-semibold text-foreground mt-1">
              {currentStep.text || `Step ${currentStep.step}`}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-mono text-[13px] font-semibold" style={{ color: "#5cc8ec" }}>
              {currentStep.target_name ?? "—"}
            </div>
            <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
              {mapSectorId ? "on site" : "on site"}
            </div>
          </div>
        </div>
      )}

      {/* Reward + Briefing */}
      <div className="flex gap-3.5 mt-4">
        {/* Reward card */}
        <div
          className="w-[178px] shrink-0 p-3.5 rounded-xl border"
          style={{
            background: "rgba(240,217,138,0.06)",
            borderColor: "rgba(240,217,138,0.18)",
          }}
        >
          <div
            className="text-[9.5px] tracking-[1.5px] font-mono uppercase"
            style={{ color: "#a9966a" }}
          >
            REWARD
          </div>
          <div
            className="font-mono text-[21px] font-semibold mt-1.5 leading-tight"
            style={{ color: "#f0d98a" }}
          >
            {m.reward_credits != null
              ? m.reward_credits.toLocaleString()
              : m.rewardtext ?? "—"}
          </div>
          <div className="text-[11px] mt-1" style={{ color: "#8a8161" }}>
            {m.reward_credits != null ? "credits" : m.rewardtext ? "reward item" : "reputation & standing"}
          </div>
        </div>

        {/* Briefing card */}
        <div
          className="flex-1 min-w-0 p-3.5 rounded-xl border"
          style={{
            background: "rgba(255,255,255,0.02)",
            borderColor: "rgba(255,255,255,0.06)",
          }}
        >
          <div
            className="text-[9.5px] tracking-[1.5px] font-mono uppercase"
            style={{ color: "#7a8499" }}
          >
            BRIEFING
          </div>
          <div
            className="text-[12.5px] mt-1.5 leading-relaxed"
            style={{ color: "#aab4c6" }}
          >
            <MissionBriefingText text={m.description} />
          </div>
        </div>
      </div>

      {/* Objectives */}
      {hasObjectives && (
        <>
          <SectionLabel
            extra={
              <span className="text-[10.5px] text-muted-foreground">
                · {steps.length} step{steps.length !== 1 ? "s" : ""}
              </span>
            }
          >
            OBJECTIVES
          </SectionLabel>

          <div className="flex flex-col gap-0.5">
            {steps.map((step, i) => {
              const style = STATUS_STYLES[step.status];
              const hasProgress =
                step.progress_current != null && step.progress_max != null;

              return (
                <div
                  key={`step-${i}`}
                  className="flex items-start gap-3 p-3 rounded-[10px]"
                  style={{
                    background: style.rowBg,
                    border: `1px solid ${style.rowBorder}`,
                  }}
                >
                  {/* Status dot */}
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 mt-0.5"
                    style={{
                      border: `1.5px solid ${style.dotBorder}`,
                      background: style.dotBg,
                      color: style.dotFg,
                    }}
                  >
                    {style.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div
                      className="text-[13.5px] font-medium"
                      style={{
                        color: style.titleColor,
                        textDecoration:
                          step.status === "done" ? "line-through" : "none",
                      }}
                    >
                      {step.text || `Step ${step.step}`}
                    </div>
                    {step.target_name && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <MapPin className="w-3 h-3 text-muted-foreground/60" />
                        <span className="text-[11px] text-muted-foreground">
                          {step.target_name}
                        </span>
                      </div>
                    )}
                    {hasProgress && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <StatBar
                          value={step.progress_current!}
                          max={step.progress_max!}
                          height={4}
                          className="w-16"
                        />
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {step.progress_current}/{step.progress_max}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Route map */}
      {mapSectorId && (
        <RouteMapSection
          label="ROUTE"
          extra={
            <span className="text-[10.5px] text-muted-foreground">
              Target: {mapSectorId}
            </span>
          }
          targetSectorId={mapSectorId}
          height={220}
          onExpand={routeMap.expand}
        />
      )}
    </div>
  );
}
