import { useCallback, useEffect, useRef, useState } from "react";
import { Handle, Position, useNodeId, useNodeConnections, useReactFlow, useUpdateNodeInternals, useStore, type Node } from "@xyflow/react";
import { GripHorizontal } from "lucide-react";
import { useBuilderSettings, selectedCountSelector, type ModuleNodeData } from "../lib/builderSettingsContext";

export function DraggableHandle({ id, defaultPos, defaultLeft, defaultTop, allDefaultHandles }: { id: string, defaultPos: Position, defaultLeft?: string, defaultTop?: string, allDefaultHandles: Record<string, { pos: Position, left?: string, top?: string }> }) {
  const nodeId = useNodeId();
  const { getNode, getNodes, getEdges, updateNodeData } = useReactFlow();
  const { gridMode, takeSnapshot } = useBuilderSettings();
  const defaultHandlesRef = useRef(allDefaultHandles);
  useEffect(() => { defaultHandlesRef.current = allDefaultHandles; }, [allDefaultHandles]);
  const sourceConnections = useNodeConnections({ handleId: id, handleType: 'source' });
  const targetConnections = useNodeConnections({ handleId: id, handleType: 'target' });
  const isConnected = sourceConnections.length > 0 || targetConnections.length > 0;

  const node = getNode(nodeId!) as Node<ModuleNodeData>;
  const handlePos = node?.data?.handlePositions?.[id];
  const isSelected = node?.selected;
  const selectedCount = useStore(selectedCountSelector);
  const showMoveHandle = isSelected && selectedCount === 1;

  const [localPos, setLocalPos] = useState(handlePos || { left: defaultLeft, top: defaultTop, pos: defaultPos });

  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => {
    updateNodeInternals(nodeId!);
  }, [localPos, nodeId, updateNodeInternals]);

  useEffect(() => {
    if (handlePos) setLocalPos(handlePos);
  }, [handlePos]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    if (takeSnapshot) {
      takeSnapshot(getNodes() as Node<ModuleNodeData>[], getEdges());
    }

    const onPointerMove = (moveEv: PointerEvent) => {
      const nodeEl = target.closest('.react-flow__node');
      if (!nodeEl) return;
      const rect = nodeEl.getBoundingClientRect();
      const x = moveEv.clientX - rect.left;
      const y = moveEv.clientY - rect.top;
      const width = rect.width;
      const height = rect.height;

      const cx = width / 2;
      const cy = height / 2;
      const dx = x - cx;
      const dy = y - cy;

      if (dx === 0 && dy === 0) return;

      let tLeft = Infinity, tRight = Infinity, tTop = Infinity, tBottom = Infinity;
      if (dx !== 0) {
        const t1 = -cx / dx;
        const t2 = (width - cx) / dx;
        if (t1 > 0) tLeft = t1;
        if (t2 > 0) tRight = t2;
      }
      if (dy !== 0) {
        const t1 = -cy / dy;
        const t2 = (height - cy) / dy;
        if (t1 > 0) tTop = t1;
        if (t2 > 0) tBottom = t2;
      }

      const tMin = Math.min(tLeft, tRight, tTop, tBottom);
      let ix = cx + tMin * dx;
      let iy = cy + tMin * dy;

      let percentX = (ix / width) * 100;
      let percentY = (iy / height) * 100;

      let pos = Position.Top;
      if (tMin === tTop) pos = Position.Top;
      else if (tMin === tBottom) pos = Position.Bottom;
      else if (tMin === tLeft) pos = Position.Left;
      else if (tMin === tRight) pos = Position.Right;

      let val = pos === Position.Top || pos === Position.Bottom ? percentX : percentY;

      const currentData = getNode(nodeId!)?.data as ModuleNodeData;
      const combinedHandles: Record<string, any> = { ...defaultHandlesRef.current, ...(currentData?.handlePositions || {}) };

      const occupied = Object.entries(combinedHandles)
        .filter(([k, v]) => k !== id && v.pos === pos)
        .map(([_, v]) => pos === Position.Top || pos === Position.Bottom ? parseFloat(v.left || '50') : parseFloat(v.top || '50'));

      const step = gridMode ? 12.5 : 8;
      const threshold = gridMode ? 1 : 8;
      let targetVal = val;

      if (gridMode) {
         const nearestSnap = Math.round(val / 12.5) * 12.5;
         targetVal = nearestSnap;

         if (occupied.some(o => Math.abs(targetVal - o) < threshold)) {
             let dir = val >= nearestSnap ? 1 : -1;

             let searchVal = nearestSnap + dir * step;
             let found = false;
             while(searchVal >= 0 && searchVal <= 100) {
                 if (!occupied.some(o => Math.abs(searchVal - o) < threshold)) {
                     targetVal = searchVal;
                     found = true;
                     break;
                 }
                 searchVal += dir * step;
             }

             if (!found) {
                 dir = -dir;
                 searchVal = nearestSnap + dir * step;
                 while(searchVal >= 0 && searchVal <= 100) {
                     if (!occupied.some(o => Math.abs(searchVal - o) < threshold)) {
                         targetVal = searchVal;
                         break;
                     }
                     searchVal += dir * step;
                 }
             }
         }
      } else {
         let searchRadius = 0;
         targetVal = val;
         while (searchRadius <= 100) {
             if (val + searchRadius <= 100 && !occupied.some(o => Math.abs((val + searchRadius) - o) < threshold)) {
                 targetVal = val + searchRadius; break;
             }
             if (val - searchRadius >= 0 && searchRadius > 0 && !occupied.some(o => Math.abs((val - searchRadius) - o) < threshold)) {
                 targetVal = val - searchRadius; break;
             }
             searchRadius += step;
         }
      }

      let newPos: any = { pos };
      if (pos === Position.Top || pos === Position.Bottom) {
        newPos.top = pos === Position.Top ? '0%' : '100%';
        newPos.left = `${targetVal}%`;
      } else {
        newPos.left = pos === Position.Left ? '0%' : '100%';
        newPos.top = `${targetVal}%`;
      }

      setLocalPos(newPos);
    };

    const onPointerUp = (upEv: PointerEvent) => {
      target.releasePointerCapture(upEv.pointerId);
      target.removeEventListener('pointermove', onPointerMove);
      target.removeEventListener('pointerup', onPointerUp);

      setLocalPos((curr) => {
        const currentData = getNode(nodeId!)?.data as ModuleNodeData;
        updateNodeData(nodeId!, {
          handlePositions: { ...(currentData.handlePositions || {}), [id]: curr }
        });
        return curr;
      });
    };

    target.addEventListener('pointermove', onPointerMove);
    target.addEventListener('pointerup', onPointerUp);
  }, [id, nodeId, getNode, updateNodeData, gridMode]);

  return (
    <div
      className="absolute z-50 group flex items-center justify-center translate-x-[-50%] translate-y-[-50%]"
      style={{
        left: localPos.left ?? (localPos.pos === Position.Left ? '0%' : localPos.pos === Position.Right ? '100%' : '50%'),
        top: localPos.top ?? (localPos.pos === Position.Top ? '0%' : localPos.pos === Position.Bottom ? '100%' : '50%'),
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {showMoveHandle && (
        <div
          className="w-5 h-5 bg-background/80 backdrop-blur rounded shadow-sm border border-border flex items-center justify-center cursor-move absolute opacity-0 group-hover:opacity-100 transition-opacity nodrag nopan"
          style={{
            [localPos.pos === Position.Top ? 'bottom' : localPos.pos === Position.Bottom ? 'top' : localPos.pos === Position.Left ? 'right' : 'left']: '14px',
          }}
          onPointerDown={onPointerDown}
        >
          <GripHorizontal className="w-3 h-3 text-muted-foreground" />
        </div>
      )}
      <Handle
        type="source"
        position={localPos.pos}
        id={id}
        style={{ width: '12px', height: '12px', background: isConnected ? '#10b981' : 'hsl(var(--background))', border: '2px solid #10b981' }}
        isConnectable={true}
      />
    </div>
  );
}
