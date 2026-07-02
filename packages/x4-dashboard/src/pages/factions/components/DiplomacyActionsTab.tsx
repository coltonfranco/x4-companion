import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { cn } from "../../../lib/utils";
import { SortHeader } from "../../../components/ui/sort-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { PageLoaderPreset } from "../../../components/layout/PageLoader";
import { FilterBar } from "../../../components/layout/FilterBar";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { apiGet } from "../../../lib/api";
import { useSort } from "../../../lib/useSort";
import type { AgentRank, DiploAction } from "../types";
import { ACTION_SORT_ACCESSORS, getRiskColors } from "../lib/diplomacyFormat";
import { DiplomacyActionRow } from "./DiplomacyActionRow";

export function DiplomacyActionsTab() {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedRisk, setSelectedRisk] = useState("all");
  const [selectedRank, setSelectedRank] = useState("all");

  const { data: actions = [], isLoading: actionsLoading } = useQuery<
    DiploAction[]
  >({
    queryKey: ["diplo-actions"],
    queryFn: () =>
      apiGet<DiploAction[]>("/api/v1/diplomacy/actions?include_hidden=true"),
  });

  const { data: ranks = [], isLoading: ranksLoading } = useQuery<AgentRank[]>({
    queryKey: ["diplo-ranks"],
    queryFn: () => apiGet<AgentRank[]>("/api/v1/diplomacy/agent-ranks"),
  });

  const isLoading = actionsLoading || ranksLoading;

  const actionsWithRanks = useMemo(() => {
    return actions.map((action) => {
      let requiredRank = null;
      if (action.agent_experience != null && ranks.length > 0) {
        requiredRank = ranks[0];
        for (const r of ranks) {
          if (r.min_value <= action.agent_experience) {
            requiredRank = r;
          }
        }
      }
      return { ...action, requiredRank };
    });
  }, [actions, ranks]);

  const filtered = actionsWithRanks.filter(
    (a) =>
      (selectedCategory === "all" || a.category === selectedCategory) &&
      (selectedRisk === "all" || (a.risk ?? "none") === selectedRisk) &&
      (selectedRank === "all" ||
        (a.requiredRank ? a.requiredRank.min_value.toString() : "none") ===
          selectedRank),
  );

  const {
    sorted,
    key: sortKey,
    dir: sortDir,
    toggle,
  } = useSort(filtered, ACTION_SORT_ACCESSORS, { key: "name", dir: "asc" });

  // Every column defaults to ascending on first click, matching the previous
  // hand-rolled handleSort.
  function handleSort(key: keyof DiploAction) {
    toggle(key, "asc");
  }

  return (
    <div className="flex flex-col h-full">
      <FilterBar className="flex-nowrap">
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <div className="flex items-center gap-2">All categories</div>
            </SelectItem>
            <SelectItem value="negotiation">
              <div className="flex items-center gap-2">
                <img
                  src="/static/icons/diplomacy/diplomacy_negotiation.png"
                  className="w-4 h-4"
                  alt=""
                />
                Negotiation
              </div>
            </SelectItem>
            <SelectItem value="espionage">
              <div className="flex items-center gap-2">
                <img
                  src="/static/icons/diplomacy/diplomacy_espionage.png"
                  className="w-4 h-4"
                  alt=""
                />
                Espionage
              </div>
            </SelectItem>
            <SelectItem value="interference">
              <div className="flex items-center gap-2">
                <img
                  src="/static/icons/diplomacy/diplomacy_interference.png"
                  className="w-4 h-4"
                  alt=""
                />
                Interference
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
        <Select value={selectedRisk} onValueChange={setSelectedRisk}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All risks" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <div className="py-0.5">All risks</div>
            </SelectItem>
            <SelectItem value="none">
              <span
                className={cn(
                  "inline-flex items-center border px-2 py-0.5 text-xs font-semibold capitalize whitespace-nowrap",
                  getRiskColors("none"),
                )}
              >
                None
              </span>
            </SelectItem>
            <SelectItem value="low">
              <span
                className={cn(
                  "inline-flex items-center border px-2 py-0.5 text-xs font-semibold capitalize whitespace-nowrap",
                  getRiskColors("low"),
                )}
              >
                Low
              </span>
            </SelectItem>
            <SelectItem value="medium">
              <span
                className={cn(
                  "inline-flex items-center border px-2 py-0.5 text-xs font-semibold capitalize whitespace-nowrap",
                  getRiskColors("medium"),
                )}
              >
                Medium
              </span>
            </SelectItem>
            <SelectItem value="high">
              <span
                className={cn(
                  "inline-flex items-center border px-2 py-0.5 text-xs font-semibold capitalize whitespace-nowrap",
                  getRiskColors("high"),
                )}
              >
                High
              </span>
            </SelectItem>
            <SelectItem value="veryhigh">
              <span
                className={cn(
                  "inline-flex items-center border px-2 py-0.5 text-xs font-semibold capitalize whitespace-nowrap",
                  getRiskColors("veryhigh"),
                )}
              >
                Very high
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
        <Select value={selectedRank} onValueChange={setSelectedRank}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All ranks" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <div className="py-0.5">All ranks</div>
            </SelectItem>
            <SelectItem value="none">
              <div className="py-0.5 text-muted-foreground">
                No rank required
              </div>
            </SelectItem>
            {ranks.map((r, i) => (
              <SelectItem key={r.min_value} value={r.min_value.toString()}>
                <div className="flex items-center gap-2">
                  {r.icon && (
                    <img
                      src={`/static/icons/diplomacy/${r.icon}.png`}
                      className="w-4 h-4 rounded-sm"
                      alt=""
                    />
                  )}
                  {r.name ?? `Rank ${i + 1}`}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          {sorted.length} actions
        </span>
      </FilterBar>

      {isLoading ? (
        <PageLoaderPreset preset="factions" />
      ) : (
        <div className="flex-1 overflow-auto p-4">
          <Table className="text-xs">
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-6" />
                <SortHeader
                  label="Action"
                  className="min-w-[200px]"
                  active={sortKey === "name"}
                  dir={sortDir}
                  onClick={() => handleSort("name")}
                />
                <SortHeader
                  label="Category"
                  className="w-36"
                  active={sortKey === "category"}
                  dir={sortDir}
                  onClick={() => handleSort("category")}
                />
                <SortHeader
                  label="Rank"
                  className="w-40"
                  active={sortKey === "agent_experience"}
                  dir={sortDir}
                  onClick={() => handleSort("agent_experience")}
                />
                <SortHeader
                  label="Risk"
                  className="w-36"
                  active={sortKey === "risk"}
                  dir={sortDir}
                  onClick={() => handleSort("risk")}
                />
                <SortHeader
                  label="Success"
                  className="w-36"
                  active={sortKey === "success_chance"}
                  dir={sortDir}
                  onClick={() => handleSort("success_chance")}
                />
                <SortHeader
                  label="Influence"
                  className="w-32"
                  active={sortKey === "cost_influence"}
                  dir={sortDir}
                  onClick={() => handleSort("cost_influence")}
                />
                <SortHeader
                  label="Credits"
                  className="w-36"
                  active={sortKey === "cost_money"}
                  dir={sortDir}
                  onClick={() => handleSort("cost_money")}
                />
                <SortHeader
                  label="Duration"
                  className="w-32"
                  active={sortKey === "duration_sec"}
                  dir={sortDir}
                  onClick={() => handleSort("duration_sec")}
                />
                <SortHeader
                  label="Cooldown"
                  className="w-32"
                  active={sortKey === "cooldown_sec"}
                  dir={sortDir}
                  onClick={() => handleSort("cooldown_sec")}
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((a) => (
                <DiplomacyActionRow key={a.action_id} action={a} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
