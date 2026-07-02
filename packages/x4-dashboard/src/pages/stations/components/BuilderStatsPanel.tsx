import type { Node } from "@xyflow/react";
import { HUDCard } from "../../../components/layout/HUDCard";
import { Currency } from "../../../components/game/Currency";
import type { ModuleDetail, ModuleSummary } from "../../../components/detail-panels/ModuleDetailPanel";
import type { ModuleNodeData } from "../lib/builderSettingsContext";

type AggregateMaterial = { name: string; amount: number; total: number; ware_id: string };

export function BuilderStatsPanel({
  nodes,
  moduleDetailsMap,
  cost,
  buildTime,
  aggregateMaterials,
}: {
  nodes: Node<ModuleNodeData>[];
  moduleDetailsMap: Map<string, ModuleDetail>;
  cost: number;
  buildTime: number;
  aggregateMaterials: AggregateMaterial[];
}) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6">
      <HUDCard className="p-4">
        <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">Summary</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Modules</span><span className="text-sm font-mono font-medium">{nodes.length}</span></div>
          <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Est. Cost</span><Currency value={cost} className="text-sm font-mono font-medium" /></div>
          <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Build Time</span><span className="text-sm font-mono font-medium">{buildTime >= 3600 ? `${(buildTime / 3600).toLocaleString(undefined, {maximumFractionDigits:1})}h` : buildTime >= 60 ? `${(buildTime / 60).toLocaleString(undefined, {maximumFractionDigits:1})}m` : `${buildTime}s`}</span></div>
        </div>
      </HUDCard>
      <HUDCard className="p-4">
        <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">Module List</h3>
        {nodes.length === 0 ? <p className="text-xs text-muted-foreground italic">No modules placed yet.</p> : (
          <div className="space-y-2">
            {Array.from(nodes.reduce((acc, node) => {
              const id = node.data.summary.module_id;
              if (!acc.has(id)) acc.set(id, { summary: node.data.summary, count: 0 });
              acc.get(id)!.count++;
              return acc;
            }, new Map<string, { summary: ModuleSummary, count: number }>()).values()).map(({ summary, count }) => {
              const detail = moduleDetailsMap.get(summary.module_id);
              return (
                <details key={summary.module_id} className="group">
                  <summary className="flex justify-between items-center text-xs border-b border-border/50 pb-2 cursor-pointer list-none"><span className="truncate pr-2 select-none group-open:text-primary">{summary.name}</span><span className="font-mono text-muted-foreground shrink-0 whitespace-nowrap">x {count}</span></summary>
                  <div className="py-2 pl-4 space-y-1 bg-muted/20 border-b border-border/50">
                    {detail?.construction_resources ? detail.construction_resources.map(res => <div key={res.ware_id} className="flex justify-between items-center text-xs text-muted-foreground"><span>{res.name}</span><span>{(res.amount * count).toLocaleString()}</span></div>) : <span className="text-xs text-muted-foreground">No resources listed</span>}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </HUDCard>

      <HUDCard className="p-4">
        <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">Total Materials</h3>
        {aggregateMaterials.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No materials.</p>
        ) : (
          <div className="space-y-1">
            {aggregateMaterials.map(res => (
              <div key={res.ware_id} className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">{res.name}</span>
                <div className="flex gap-3">
                  <span className="font-mono">{res.amount.toLocaleString()}</span>
                  <span className="font-mono text-muted-foreground w-16 text-right"><Currency value={res.total} /></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </HUDCard>
    </div>
  );
}
