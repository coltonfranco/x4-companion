import { useQuery } from "@tanstack/react-query";
import { StatBar } from "../../../components/data-display/StatBar";
import { PageLoaderPreset } from "../../../components/layout/PageLoader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { apiGet } from "../../../lib/api";
import type { AgentRank } from "../types";

export function DiplomacyRanksTab() {
  const { data: ranks = [], isLoading } = useQuery<AgentRank[]>({
    queryKey: ["diplo-ranks"],
    queryFn: () => apiGet<AgentRank[]>("/api/v1/diplomacy/agent-ranks"),
  });

  if (isLoading) return <PageLoaderPreset preset="factions" />;

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border/50 bg-muted/5">
        <p className="text-sm text-muted-foreground">
          Agent rank is determined by accumulated experience. Higher ranks
          improve diplomatic event outcomes via the event bonus multiplier.
        </p>
      </div>
      <div className="flex-1 p-4 overflow-auto">
        <Table className="text-xs">
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead>Rank</TableHead>
              <TableHead>Min XP</TableHead>
              <TableHead className="w-32">Event Bonus</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ranks.map((rank, i) => (
              <TableRow key={rank.min_value}>
                <TableCell className="font-medium">
                  {rank.icon ? (
                    <div className="flex items-center gap-2">
                      <img
                        src={`/static/icons/diplomacy/${rank.icon}.png`}
                        className="w-8 h-8 rounded"
                        alt=""
                      />
                      <span>{rank.name ?? `Rank ${i + 1}`}</span>
                    </div>
                  ) : (
                    (rank.name ?? `Rank ${i + 1}`)
                  )}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {rank.min_value}
                </TableCell>
                <TableCell>
                  <StatBar
                    value={(rank.event_bonus ?? 1) * 40}
                    max={100}
                    width={100}
                    height={6}
                    labelRight={`×${rank.event_bonus?.toFixed(1)}`}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
