import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "../../../lib/utils";
import { StatBar } from "../../../components/data-display/StatBar";
import { Currency } from "../../../components/game/Currency";
import { fmtSeconds } from "../../../lib/wareFormat";
import { TableCell, TableRow } from "../../../components/ui/table";
import type { AgentRank, DiploAction } from "../types";
import { formatRisk, getRiskColors } from "../lib/diplomacyFormat";

export function DiplomacyActionRow({
  action,
}: {
  action: DiploAction & { requiredRank?: AgentRank | null };
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <TableRow
        className="cursor-pointer"
        onClick={() => setExpanded((e) => !e)}
      >
        <TableCell className="w-6 text-muted-foreground">
          {action.bribe_wares.length > 0 || action.description ? (
            expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )
          ) : null}
        </TableCell>
        <TableCell>
          <p className="font-medium text-sm">
            {action.name ?? action.action_id}
          </p>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2 capitalize">
            {action.category === "negotiation" && (
              <img
                src="/static/icons/diplomacy/diplomacy_negotiation.png"
                className="w-5 h-5"
                alt=""
              />
            )}
            {action.category === "espionage" && (
              <img
                src="/static/icons/diplomacy/diplomacy_espionage.png"
                className="w-5 h-5"
                alt=""
              />
            )}
            {action.category === "interference" && (
              <img
                src="/static/icons/diplomacy/diplomacy_interference.png"
                className="w-5 h-5"
                alt=""
              />
            )}
            {action.category}
          </div>
        </TableCell>
        <TableCell>
          {action.requiredRank ? (
            <div className="flex items-center gap-2">
              {action.requiredRank.icon && (
                <img
                  src={`/static/icons/diplomacy/${action.requiredRank.icon}.png`}
                  className="w-5 h-5 rounded-sm"
                  alt=""
                />
              )}
              <span className="text-xs font-medium">
                {action.requiredRank.name ?? `Rank`}
              </span>
            </div>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
        </TableCell>
        <TableCell>
          {action.risk && action.risk !== "none" && (
            <span
              className={cn(
                "inline-flex items-center border px-2 py-0.5 text-xs font-semibold capitalize whitespace-nowrap",
                getRiskColors(action.risk),
              )}
            >
              {formatRisk(action.risk)}
            </span>
          )}
        </TableCell>
        <TableCell>
          {action.success_chance != null ? (
            <StatBar
              value={action.success_chance}
              max={100}
              width={100}
              height={6}
              labelRight={`${action.success_chance}%`}
            />
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell>
          {action.cost_influence != null && action.cost_influence > 0 ? (
            <div className="flex items-center gap-1.5 text-primary font-medium">
              <span className="text-sm">{action.cost_influence}</span>
              <img
                src="/static/icons/diplomacy/diplomacy_influence.png"
                className="w-5 h-5"
                alt="Influence"
                title="Influence Cost"
              />
            </div>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
        </TableCell>
        <TableCell>
          {action.cost_money != null && action.cost_money > 0 ? (
            <Currency value={action.cost_money} className="text-sm" />
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground tabular-nums">
          {fmtSeconds(action.duration_sec)}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground tabular-nums">
          {fmtSeconds(action.cooldown_sec)}
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow className="bg-muted/10 hover:bg-muted/10">
          <TableCell colSpan={9} className="px-8 py-3">
            {action.description && (
              <p className="text-sm text-muted-foreground mb-2">
                {action.description}
              </p>
            )}
            <div className="flex flex-wrap gap-3 text-xs">
              {action.agent_experience != null && (
                <span className="text-muted-foreground">
                  Agent XP required:{" "}
                  <span className="font-medium text-foreground">
                    {action.agent_experience}
                  </span>
                </span>
              )}
              {action.bribe_wares.length > 0 && (
                <div>
                  <span className="text-muted-foreground mr-1">
                    Bribe wares:
                  </span>
                  {action.bribe_wares.map((bw, i) => (
                    <span key={i} className="font-medium text-foreground">
                      {bw.ware_id
                        ? `${bw.ware_id.replace(/_/g, " ")}${bw.amount ? ` ×${bw.amount}` : ""}`
                        : `[${bw.ware_tags} tag]`}
                      {i < action.bribe_wares.length - 1 ? ", " : ""}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
