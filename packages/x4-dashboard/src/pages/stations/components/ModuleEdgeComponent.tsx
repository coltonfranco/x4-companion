import {
  BaseEdge, EdgeLabelRenderer, getBezierPath, getSmoothStepPath, useReactFlow, useStore,
  type EdgeProps,
} from "@xyflow/react";
import { X } from "lucide-react";
import { useBuilderSettings, selectedCountSelector } from "../lib/builderSettingsContext";

export function ModuleEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
}: EdgeProps) {
  const { gridMode } = useBuilderSettings();

  const pathParams = {
    sourceX,
    sourceY,
    sourcePosition,
    targetPosition,
    targetX,
    targetY,
    borderRadius: 16,
  };

  const [edgePath, labelX, labelY] = gridMode
    ? getSmoothStepPath(pathParams)
    : getBezierPath(pathParams);

  const { setEdges } = useReactFlow();
  const selectedCount = useStore(selectedCountSelector);
  const showDelete = selected && selectedCount === 1;

  const onEdgeClick = (evt: React.MouseEvent) => {
    evt.stopPropagation();
    setEdges((edges) => edges.filter((e) => e.id !== id));
  };

  const edgeStyle = {
    ...style,
    stroke: selected ? '#3b82f6' : '#10b981',
    strokeWidth: selected ? 4 : 2,
  };

  return (
    <g>
      <BaseEdge path={edgePath} style={{ ...edgeStyle, strokeWidth: 16, stroke: 'transparent', cursor: 'pointer' }} interactionWidth={0} />
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={edgeStyle} interactionWidth={0} />
      {showDelete && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <button
              className="w-4 h-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow-md hover:scale-110"
              onClick={onEdgeClick}
              title="Delete Connection"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </g>
  );
}
