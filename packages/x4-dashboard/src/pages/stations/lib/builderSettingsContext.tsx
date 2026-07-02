import React from "react";
import type { Edge, Node, Position } from "@xyflow/react";
import type { ModuleSummary } from "../../../components/detail-panels/ModuleDetailPanel";
import type { NodeAlignment } from "./stationBuilderPersistence";

export type ModuleNodeData = {
  summary: ModuleSummary;
  onClickDetail: () => void;
  onRemove?: () => void;
  lockReason?: string;
  handlePositions?: Record<string, { left?: string, top?: string, pos: Position }>;
};

export const BuilderSettingsContext = React.createContext<{
  gridMode: boolean;
  setGridMode: (v: boolean) => void;
  nodeAlignment: NodeAlignment;
  setNodeAlignment: (v: NodeAlignment) => void;
  takeSnapshot?: (nodes: Node<ModuleNodeData>[], edges: Edge[]) => void;
}>({ gridMode: false, setGridMode: () => {}, nodeAlignment: 'distributed', setNodeAlignment: () => {} });

export const useBuilderSettings = () => React.useContext(BuilderSettingsContext);

export const selectedCountSelector = (s: any) => s.nodes.filter((n: any) => n.selected).length + s.edges.filter((e: any) => e.selected).length;
