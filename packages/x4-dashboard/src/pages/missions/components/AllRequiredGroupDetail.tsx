import type { FactionSummary } from "../../../lib/types";
import type { Mission } from "../types";
import {
  typeColor,
  STATUS_STYLES,
  SectionLabel,
  MissionFactionCluster,
} from "./MissionViewParts";
import { MissionDetail } from "./MissionDetail";
import { MissionBriefingText } from "../lib/missionText";

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
  const title = groupName ?? groupId.replace(/_/g, " ");

  const firstFaction = subStages[0]?.mission.faction;
  const opposingFaction = subStages[0]?.mission.opposing_faction;

  // Some group members — typically a story arc's umbrella mission — carry no
  // objectives of their own: they're not a stage still to complete, just a
  // tracker for the overall arc (X4's save drops each prior stage entirely
  // once it's done, so there's no way to recover "N of M complete" from live
  // data). Split those out instead of rendering them as a fake pending stage.
  const actionableStages = subStages.filter((s) => s.mission.objectives.length > 0);
  const arcTracker = subStages.find((s) => s.mission.objectives.length === 0);

  const doneCount = actionableStages.filter((s) => s.status === "done").length;
  const progressPct =
    actionableStages.length > 0
      ? Math.round((doneCount / actionableStages.length) * 100)
      : 0;

  const briefingStage =
    actionableStages.find((s) => s.status === "current") ??
    actionableStages.find((s) => s.status !== "done") ??
    actionableStages[0] ??
    subStages[0];

  // With only one actionable stage left, there's nothing meaningful to
  // checklist — just show the arc context and the one real mission.
  const showChecklist = actionableStages.length > 1;

  return (
    <div className="animate-in fade-in slide-in-from-right-2 duration-150">
      <div className="p-6 pb-0 max-w-[760px]">
        {/* Header */}
        <div
          className="text-[10px] tracking-[2px] font-mono uppercase mb-2"
          style={{ color: "#7fb9d6" }}
        >
          {title} · STORY ARC
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

        {/* Arc-level context from the umbrella mission, if any */}
        {arcTracker?.mission.description && (
          <div
            className="mt-4 p-3.5 rounded-xl border text-[12.5px] leading-relaxed"
            style={{
              background: "rgba(255,255,255,0.02)",
              borderColor: "rgba(255,255,255,0.06)",
              color: "#aab4c6",
            }}
          >
            <MissionBriefingText text={arcTracker.mission.description} />
            {arcTracker.mission.rewardtext && (
              <div className="mt-2.5 text-[11px] text-muted-foreground">
                Arc reward:{" "}
                <span style={{ color: "#f0d98a" }}>{arcTracker.mission.rewardtext}</span>
              </div>
            )}
          </div>
        )}

        {showChecklist && (
          <>
            {/* Progress */}
            <div className="flex items-center gap-3 mt-4">
              <div
                className="flex-1 h-[6px] rounded-full overflow-hidden"
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
              <div
                className="font-mono text-[13px] font-semibold shrink-0"
                style={{ color: "#5cc8ec" }}
              >
                {doneCount} / {actionableStages.length} COMPLETE
              </div>
            </div>

            {/* All required to advance */}
            <SectionLabel>ALL REQUIRED TO ADVANCE</SectionLabel>

            <div className="flex flex-col gap-2">
              {actionableStages.map((s, i) => {
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
          </>
        )}

        <SectionLabel>{showChecklist ? "STAGE DETAIL" : "CURRENT MISSION"}</SectionLabel>
      </div>

      {/* Full detail (objectives, reward, briefing, map) for the current stage */}
      {briefingStage && (
        <MissionDetail
          m={briefingStage.mission}
          factionMap={factionMap}
          bucket="active"
        />
      )}
    </div>
  );
}
