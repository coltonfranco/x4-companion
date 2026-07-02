import type { FactionSummary } from "../../../lib/types";
import type { Mission } from "../types";
import {
  typeColor,
  STATUS_STYLES,
  SectionLabel,
  MissionFactionCluster,
  useMapExpand,
  RouteMapSection,
} from "./MissionViewParts";

export type SubStage = {
  mission: Mission;
  status: "done" | "current" | "next";
  typeLabel: string;
  destName: string;
};

type Props = {
  groupName: string | null;
  groupId: string;
  subStages: SubStage[];
  factionMap: Map<string, FactionSummary>;
};

export function AllRequiredGroupDetail({
  groupName,
  groupId,
  subStages,
  factionMap,
}: Props) {
  const routeMap = useMapExpand(null);
  if (routeMap.fullscreenView) return routeMap.fullscreenView;

  const title = groupName ?? groupId.replace(/_/g, " ");

  const firstFaction = subStages[0]?.mission.faction;
  const opposingFaction = subStages[0]?.mission.opposing_faction;

  const doneCount = subStages.filter((s) => s.status === "done").length;
  const progressPct =
    subStages.length > 0 ? Math.round((doneCount / subStages.length) * 100) : 0;

  // Summary text: combine all descriptions
  const summary =
    subStages
      .map((s) => s.mission.description)
      .filter(Boolean)
      .join(" ") || "Complete all stages to advance the campaign.";

  return (
    <div className="p-6 max-w-[760px] animate-in fade-in slide-in-from-right-2 duration-150">
      {/* Header */}
      <div
        className="text-[10px] tracking-[2px] font-mono uppercase mb-2"
        style={{ color: "#7fb9d6" }}
      >
        {title} · MULTI-STAGE
      </div>
      <h2 className="text-[26px] font-semibold leading-tight">{title}</h2>

      <div className="flex items-center gap-2 mt-2.5">
        <MissionFactionCluster
          faction={firstFaction}
          opposingFaction={opposingFaction}
          factionMap={factionMap}
          size="md"
        />
      </div>

      {/* Summary + progress */}
      <div
        className="flex items-center gap-3.5 mt-4 p-3.5 rounded-xl border"
        style={{
          background: "rgba(255,255,255,0.02)",
          borderColor: "rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex-1">
          <div
            className="text-[12.5px] leading-relaxed"
            style={{ color: "#aab4c6" }}
          >
            {summary}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div
            className="font-mono text-xl font-semibold"
            style={{ color: "#5cc8ec" }}
          >
            {doneCount} / {subStages.length}
          </div>
          <div
            className="text-[10px] tracking-[1px] font-mono uppercase"
            style={{ color: "#5a6680" }}
          >
            COMPLETE
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="h-[6px] rounded-full mt-2.5 overflow-hidden"
        style={{ background: "rgba(255,255,255,0.06)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${progressPct}%`,
            background: "linear-gradient(90deg, #3b9ae1, #34d399)",
          }}
        />
      </div>

      {/* All required to advance */}
      <SectionLabel>ALL REQUIRED TO ADVANCE</SectionLabel>

      <div className="flex flex-col gap-2">
        {subStages.map((s, i) => {
          const style = STATUS_STYLES[s.status];
          const mtypeColor = s.mission.type
            ? typeColor(s.mission.type)
            : undefined;

          return (
            <div
              key={s.mission.mission_id ?? i}
              className="flex items-center gap-3 p-3 rounded-[11px]"
              style={{
                background: style.rowBg,
                border: `1px solid ${style.rowBorder}`,
              }}
            >
              {/* Status dot */}
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center font-mono text-[11px] font-semibold shrink-0"
                style={{
                  border: `1.5px solid ${style.dotBorder}`,
                  background: style.dotBg,
                  color: style.dotFg,
                }}
              >
                {style.icon || `${i + 1}`}
              </div>

              <div className="flex-1 min-w-0">
                <div
                  className="text-[13.5px] font-semibold"
                  style={{ color: style.titleColor }}
                >
                  {s.mission.name}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className="text-[9px] font-semibold uppercase tracking-[0.3px] px-2 py-0.5 rounded-md"
                    style={{
                      background: mtypeColor
                        ? `${mtypeColor}18`
                        : "rgba(138,149,171,0.12)",
                      color: mtypeColor ?? "#8a95ab",
                    }}
                  >
                    {s.typeLabel}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {style.statusText}
                  </span>
                </div>
              </div>

              <div
                className="shrink-0 font-mono text-[11px]"
                style={{ color: "#7fb9d6" }}
              >
                ⌖ {s.destName}
              </div>
            </div>
          );
        })}
      </div>

      {/* Combined route */}
      <RouteMapSection
        label="COMBINED ROUTE"
        extra={
          <span className="text-[10.5px] text-muted-foreground">
            Tour of {subStages.length} sector{subStages.length !== 1 ? "s" : ""}
          </span>
        }
        targetSectorId={null}
        height={220}
        onExpand={routeMap.expand}
      />
    </div>
  );
}
