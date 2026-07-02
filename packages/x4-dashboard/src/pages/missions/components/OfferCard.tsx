import { MapPin, User } from "lucide-react";
import { MissionListCard } from "./CardShell";
import type { FactionSummary } from "../../../lib/types";
import type { MissionOffer } from "../types";
import {
  typeColor,
  typeLabel,
  fmtCredits,
  LevelBadge,
  RepeatableTag,
  RunToggleButton,
  MissionFactionCluster,
} from "./MissionViewParts";

type Props = {
  o: MissionOffer;
  factionMap: Map<string, FactionSummary>;
  isSelected: boolean;
  isInRun: boolean;
  onClick: () => void;
  onToggleRun?: () => void;
};

export function OfferCard({ o, factionMap, isSelected, isInRun, onClick, onToggleRun }: Props) {
  const mtypeColor = o.type ? typeColor(o.type) : undefined;
  const mtLabel = o.type ? typeLabel(o.type) : null;

  const hasReward = o.reward_credits != null || o.rewardtext != null;
  const rewardDisplay = o.reward_credits != null
    ? fmtCredits(o.reward_credits)
    : o.rewardtext ?? null;

  return (
    <MissionListCard
      onClick={onClick}
      isSelected={isSelected}
      opacityClassName="opacity-80 hover:opacity-100"
      dotColor={mtypeColor ?? "#8a95ab"}
      title={o.name}
      subtitle={
        o.actor_name && (
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {o.actor_name}
          </span>
        )
      }
      trailing={
        <>
          {hasReward && (
            <div className="font-mono text-[13px] font-semibold tabular-nums" style={{ color: "var(--gold)" }}>
              {rewardDisplay}
            </div>
          )}
          {o.distance != null && (
            <div className="font-mono text-[10px] text-muted-foreground mt-1">
              ⤳ {o.distance} jump{o.distance !== 1 ? "s" : ""}
            </div>
          )}
        </>
      }
      badges={
        <>
          {mtLabel && mtypeColor && (
            <span
              className="text-[9px] font-semibold uppercase tracking-[0.3px] px-2 py-0.5 rounded-[5px]"
              style={{ background: `${mtypeColor}18`, color: mtypeColor }}
            >
              {mtLabel}
            </span>
          )}
          <LevelBadge level={o.level} />
          {o.is_repeatable && <RepeatableTag />}
          <MissionFactionCluster
            faction={o.faction}
            opposingFaction={o.opposing_faction}
            factionMap={factionMap}
            size="sm"
            showFallback
          />
          {o.station_name && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <MapPin className="w-2.5 h-2.5" />
              {o.station_name}
            </span>
          )}
        </>
      }
      trailingButton={
        onToggleRun && <RunToggleButton isInRun={isInRun} onToggleRun={onToggleRun} />
      }
    />
  );
}
