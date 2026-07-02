import { memo, useCallback, useMemo } from "react";
import { Position, useReactFlow, useStore, type Node, type NodeProps } from "@xyflow/react";
import { AlertCircle, X } from "lucide-react";
import { KIND_COLORS } from "../../../components/detail-panels/ModuleDetailPanel";
import { EntityIcon } from "../../../components/game/EntityIcon";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../components/ui/tooltip";
import { cn } from "../../../lib/utils";
import { useBuilderSettings, selectedCountSelector, type ModuleNodeData } from "../lib/builderSettingsContext";
import { DraggableHandle } from "./DraggableHandle";

export const ModuleNodeComponent = memo(({ id: _id, data, selected }: NodeProps<Node<ModuleNodeData>>) => {
  const { summary, lockReason } = data;
  const snapPoints = summary.snap_points || 0;
  const selectedCount = useStore(selectedCountSelector);
  const showDelete = selected && selectedCount === 1;
  const { setNodes, setEdges, getNodes, getEdges } = useReactFlow();
  const { takeSnapshot, nodeAlignment } = useBuilderSettings();

  const handleRemove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (takeSnapshot) {
      takeSnapshot(getNodes() as Node<ModuleNodeData>[], getEdges());
    }
    setNodes((ns) => ns.filter((n) => n.id !== _id));
    setEdges((es) => es.filter((e) => e.source !== _id && e.target !== _id));
  }, [_id, setNodes, setEdges, takeSnapshot, getNodes, getEdges]);

  const allDefaultHandles = useMemo(() => {
    const handlesRecord: Record<string, { pos: Position, left?: string, top?: string }> = {};
    for (let i = 0; i < snapPoints; i++) {
      let pos = Position.Top;
      let offset = 50;

      if (nodeAlignment === 'right') {
        if (i === 0) {
          pos = Position.Left;
          offset = 50;
        } else {
          pos = Position.Right;
          const countOnSide = snapPoints - 1;
          offset = countOnSide === 1 ? 50 : (100 / (countOnSide + 1)) * i;
        }
      } else if (nodeAlignment === 'bottom') {
        if (i === 0) {
          pos = Position.Top;
          offset = 50;
        } else {
          pos = Position.Bottom;
          const countOnSide = snapPoints - 1;
          offset = countOnSide === 1 ? 50 : (100 / (countOnSide + 1)) * i;
        }
      } else {
        const side = i % 4;
        const countOnSide = Math.ceil((snapPoints - side) / 4);
        const indexOnSide = Math.floor(i / 4);
        offset = countOnSide === 1 ? 50 : (100 / (countOnSide + 1)) * (indexOnSide + 1);

        pos = Position.Top;
        if (side === 1) pos = Position.Right;
        if (side === 2) pos = Position.Bottom;
        if (side === 3) pos = Position.Left;
      }

      handlesRecord[`p-${i}`] = {
        pos,
        left: (pos === Position.Top || pos === Position.Bottom) ? `${offset}%` : undefined,
        top: (pos === Position.Left || pos === Position.Right) ? `${offset}%` : undefined
      };
    }
    return handlesRecord;
  }, [snapPoints, nodeAlignment]);

  const handles = Object.entries(allDefaultHandles).map(([id, handleData]) => (
    <DraggableHandle
      key={id}
      id={id}
      defaultPos={handleData.pos}
      defaultLeft={handleData.left}
      defaultTop={handleData.top}
      allDefaultHandles={allDefaultHandles}
    />
  ));

  return (
    <div
      className={cn("relative group w-32 h-32 bg-card border rounded-md shadow flex flex-col items-center justify-center p-2 cursor-pointer transition-colors", selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/50")}
    >
      {showDelete && (
        <button
          onClick={handleRemove}
          className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center transition-opacity z-50 hover:scale-110 nodrag nopan"
          title="Remove module"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}

      {handles}
      {summary.icon_url && <EntityIcon src={summary.icon_url} alt={summary.name} size={48} className="mb-2" />}
      <span className="text-xs font-medium text-center line-clamp-2 max-w-[100px]">{summary.name}</span>
      {summary.kind && (
        <span className={cn("mt-1 px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider border", KIND_COLORS[summary.kind.toLowerCase()] || "bg-muted")}>
          {summary.kind}
        </span>
      )}
      {lockReason && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="absolute top-1 left-1 bg-background/80 rounded-full p-0.5 cursor-help z-10">
                <AlertCircle className="w-4 h-4 text-amber-500" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs max-w-[200px]">{lockReason}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
});
