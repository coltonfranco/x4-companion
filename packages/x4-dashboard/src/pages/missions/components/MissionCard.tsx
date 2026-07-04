import { MapPin } from "lucide-react";
import { MissionListCard } from "./CardShell";

import type { FactionSummary } from "../../../lib/types";
import type { Mission } from "../types";
import {
  typeColor,
  typeLabel,
  fmtTime,
  LevelBadge,
  StoryTag,
  MissionFactionCluster,
} from "./MissionViewParts";

type Props = {
  m: Mission;
  factionMap: Map<string, FactionSummary>;
  nowSec: number | null;
  isSelected: boolean;
  onClick: () => void;
};

export function MissionCard({ m, factionMap, nowSec, isSelected, onClick }: Props) {
  const mtypeColor = m.type ? typeColor(m.type) : undefined;
  const mtLabel = m.type ? typeLabel(m.type) : null;
  const relativeTime = fmtTime(m.time, nowSec);

  return (
    <MissionListCard
      onClick={onClick}
      isSelected={isSelected}
      dotColor={mtypeColor ?? "#8a95ab"}
      title={m.name}
      subtitle={
        m.caption ? (
          <><UserLabel /> {m.caption}</>
        ) : m.group_name ? (
          `${m.group_name} · Mission`
        ) : null
      }
      trailing={
        relativeTime ? (
          <div className="font-mono text-[10px] text-muted-foreground">
            {relativeTime}
          </div>
        ) : null
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
          <LevelBadge level={m.level} />
          {m.is_story && <StoryTag />}
          <MissionFactionCluster
            faction={m.faction}
            opposingFaction={m.opposing_faction}
            factionMap={factionMap}
            size="sm"
            showFallback
          />
          {m.group_name && (
            <span
              className="text-[9px] font-semibold uppercase tracking-[0.3px] px-2 py-0.5 rounded-[5px]"
              style={{
                background: "rgba(250,204,21,0.12)",
                color: "var(--gold)",
              }}
            >
              {m.group_name}
            </span>
          )}
          {m.associated_entity_name && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <MapPin className="w-2.5 h-2.5" />
              {m.associated_entity_name}
            </span>
          )}
        </>
      }
    />
  );
}

/** Inline user icon for the subtitle line. */
function UserLabel() {
  return (
    <svg
      className="inline-block w-3 h-3 text-muted-foreground mr-0.5 align-[-1px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
