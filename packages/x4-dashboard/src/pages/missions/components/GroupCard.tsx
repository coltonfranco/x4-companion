import { FactionBadge } from "../../../components/game/FactionBadge";
import { MissionListCard } from "./CardShell";
import type { FactionSummary } from "../../../lib/types";
import type { Mission } from "../types";
import { typeLabel, deriveMissionStageStatus } from "./MissionViewParts";

export type GroupKind = "choice" | "all";

type Props = {
  kind: GroupKind;
  groupId: string;
  groupName: string | null;
  missions: Mission[];
  factionMap: Map<string, FactionSummary>;
  isSelected: boolean;
  onClick: () => void;
};

/** Derive group kind from the mission group. Heuristic:
 *  - If missions in the group have different factions, it's likely a choice fork.
 *  - Otherwise it's an all-required sequence.
 */
export function deriveGroupKind(missions: Mission[]): GroupKind {
  const factions = new Set(
    missions.map((m) => m.faction).filter(Boolean),
  );
  return factions.size > 1 ? "choice" : "all";
}

export function GroupCard({
  kind,
  groupId,
  groupName,
  missions,
  factionMap,
  isSelected,
  onClick,
}: Props) {
  // Use the first mission's faction for display
  const primaryMission = missions[0];
  const factionObj = primaryMission?.faction
    ? factionMap.get(primaryMission.faction)
    : undefined;

  const isChoice = kind === "choice";
  const edgeColor = isChoice ? "#d79be8" : "#3b9ae1";
  const tagBg = isChoice
    ? "rgba(200,121,224,0.14)"
    : "rgba(92,200,236,0.14)";
  const tagColor = isChoice ? "#d79be8" : "#7fb9d6";

  // Some group members — typically a story arc's umbrella mission — carry no
  // objectives of their own and aren't a real stage still to complete; exclude
  // them from the stage count/list so they don't look like a second pending task.
  const actionableMissions = missions.filter((m) => m.objectives.length > 0);
  const stageMissions = isChoice
    ? missions
    : actionableMissions.length > 0
      ? actionableMissions
      : missions;

  const tag = isChoice
    ? `CHOICE · ${stageMissions.length} PATHS`
    : `ALL REQUIRED · ${stageMissions.length} STAGES`;

  const isStory = missions.some((m) => m.is_story);

  const title = groupName ?? groupId.replace(/_/g, " ");
  const subtitle = isChoice
    ? "Pick one path"
    : "All stages required";
  const stageStatus = new Map(
    missions.map((m) => [m.mission_id, deriveMissionStageStatus(m.objectives)]),
  );
  const previewStages = [...stageMissions]
    .sort(
      (a, b) =>
        Number(stageStatus.get(b.mission_id) === "current") -
        Number(stageStatus.get(a.mission_id) === "current"),
    )
    .slice(0, 4);

  return (
    <MissionListCard
      onClick={onClick}
      isSelected={isSelected}
      dotColor={isChoice ? "#d79be8" : "#7fb9d6"}
      edgeColor={edgeColor}
      alwaysShowEdge
      bg="rgba(255,255,255,0.018)"
      unselectedBorder="rgba(255,255,255,0.09)"
      title={title}
      subtitle={subtitle}
      trailing={
        <span className="font-mono text-[13px] font-semibold" style={{ color: edgeColor }}>
          {isChoice ? "⑂" : "⛓"}
        </span>
      }
      badges={
        <>
          <span
            className="text-[9px] font-semibold uppercase tracking-[0.3px] px-2 py-0.5 rounded-[5px]"
            style={{ background: tagBg, color: tagColor }}
          >
            {tag}
          </span>
          <span
            className="text-[9px] font-semibold uppercase tracking-[0.3px] px-2 py-0.5 rounded-[5px]"
            style={{
              background: "rgba(138,149,171,0.12)",
              color: "#8a95ab",
            }}
          >
            {isChoice ? "BRANCHING" : "SEQUENCE"}
          </span>
          {isStory && (
            <span
              className="text-[9px] font-semibold uppercase tracking-[0.3px] px-2 py-0.5 rounded-[5px]"
              style={{
                background: "rgba(200,121,224,0.14)",
                color: "#d79be8",
              }}
            >
              ✦ STORY
            </span>
          )}
          {factionObj && (
            <span className="text-[10px]">
              <FactionBadge
                name={factionObj.name}
                color_hex={factionObj.color_hex}
                icon_url={factionObj.icon_url}
                faction_id={factionObj.faction_id}
                size="sm"
              />
            </span>
          )}
          {!factionObj && primaryMission?.faction && (
            <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
              ◈ {primaryMission.faction}
            </span>
          )}
        </>
      }
      details={
        <div className="mt-3 space-y-1.5 border-t border-white/5 pt-2.5">
          {previewStages.map((mission, index) => {
            const isCurrent = stageStatus.get(mission.mission_id) === "current";
            return (
              <div key={mission.mission_id ?? index} className="flex items-center gap-2 text-[11px]">
                <span
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border font-mono text-[9px]"
                  style={{
                    borderColor: isCurrent ? "rgba(92,200,236,0.6)" : "rgba(255,255,255,0.14)",
                    color: isCurrent ? "#5cc8ec" : "#7a8499",
                    background: isCurrent ? "rgba(92,200,236,0.12)" : "transparent",
                  }}
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-foreground/85">
                  {mission.name ?? "Unnamed stage"}
                </span>
                <span
                  className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] uppercase"
                  style={{
                    background: isCurrent ? "rgba(92,200,236,0.12)" : "rgba(255,255,255,0.04)",
                    color: isCurrent ? "#7fb9d6" : "#7a8499",
                  }}
                >
                  {isCurrent ? "In progress" : typeLabel(mission.type ?? "Mission")}
                </span>
              </div>
            );
          })}
          {stageMissions.length > previewStages.length && (
            <div className="pl-6 text-[10.5px] text-muted-foreground">
              +{stageMissions.length - previewStages.length} more stage
              {stageMissions.length - previewStages.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      }
    />
  );
}
