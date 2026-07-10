import React, { useCallback, useState, useMemo, useEffect, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  Connection,
  ConnectionMode,
  ReactFlowProvider,
  useReactFlow,
  reconnectEdge,
  ConnectionLineType,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useQuery, useQueries } from "@tanstack/react-query";
import {
  KIND_COLORS,
  ModuleDetailPanel,
  isModuleLicenceLocked,
  type ModuleDetail,
  type ModuleSummary,
} from "../../components/detail-panels/ModuleDetailPanel";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../components/ui/tooltip";
import { FactionSummary } from "../../lib/types";
import { DetailDialog } from "../../components/ui/detail-dialog";
import { PageSubtitle } from "../../components/ui/page-subtitle";
import { EntityIcon } from "../../components/game/EntityIcon";
import { Currency } from "../../components/game/Currency";
import { ContextMenu } from "./components/StationBuilderContextMenu";
import { useUndoRedo, useClipboard } from "./hooks/useStationBuilderEditing";
import { SearchInput } from "../../components/ui/search-input";
import { cn, toErrorMessage } from "../../lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Switch } from "../../components/ui/switch";
import { Plus, Settings, Undo, Redo, Save, FolderOpen, FilePlus2, Trash2, Loader2, DownloadCloud, Wand2, Route } from "lucide-react";
import { useBlocker } from "@tanstack/react-router";
import { Button } from "../../components/ui/button";
import { ClearFiltersButton } from "../../components/ui/clear-filters-button";
import { apiGet } from "../../lib/api";
import { VISIBLE_FACTIONS_PATH, VISIBLE_FACTIONS_QUERY_KEY } from "../../lib/factionQueries";
import { usePlayerLicences } from "../../lib/usePlayerLicences";
import {
  serializeNodes,
  serializeEdges,
  designSignature,
  computeLockReason,
  fetchBuilderStation,
  useBuilderStationList,
  useBuilderStationMutations,
  usePlayerStations,
  fetchStationLayout,
  useConstructionPlans,
  fetchConstructionPlanLayout,
  layoutToDesign,
  autoLayoutGraph,
  autoRouteHandles,
  type BuilderStationDetail,
  type BuilderStationInput,
  type NodeAlignment,
} from "./lib/stationBuilderPersistence";
import { BuilderSettingsContext, useBuilderSettings, type ModuleNodeData } from "./lib/builderSettingsContext";
import { ModuleNodeComponent } from "./components/ModuleNodeComponent";
import { ModuleEdgeComponent } from "./components/ModuleEdgeComponent";
import { LoadDesignDialog } from "./components/LoadDesignDialog";
import { ImportDesignDialog } from "./components/ImportDesignDialog";
import { SaveAsDialog } from "./components/SaveAsDialog";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { UnsavedChangesDialog } from "./components/UnsavedChangesDialog";
import { BuilderStatsPanel } from "./components/BuilderStatsPanel";

const nodeTypes = {
  moduleNode: ModuleNodeComponent,
};
const edgeTypes = {
  moduleEdge: ModuleEdgeComponent,
};

function StationBuilderContent() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<ModuleNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [search, setSearch] = useState("");
  const [filterKind, setFilterKind] = useState("all");
  const [filterReady, setFilterReady] = useState(false);
  const [selectedDetailId, setSelectedDetailId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{title: string, desc: string, type?: 'error'|'success'|'info'} | null>(null);
  const showToast = (title: string, desc: string, type: 'error'|'success'|'info' = 'error') => {
    setToastMsg({ title, desc, type });
    setTimeout(() => setToastMsg(null), 3000);
  };
  const lastMousePos = useRef<{ x: number, y: number }>({ x: 0, y: 0 });
  const { screenToFlowPosition, getViewport } = useReactFlow();
  const { gridMode, setGridMode, nodeAlignment, setNodeAlignment } = useBuilderSettings();

  const { takeSnapshot, undo, redo, canUndo, canRedo } = useUndoRedo<ModuleNodeData>();
  const { copy, paste, hasClipboard } = useClipboard<ModuleNodeData>();
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, type: 'node' | 'pane' | 'edge', nodeId?: string, edgeId?: string } | null>(null);

  const { data: modules = [], isLoading } = useQuery<ModuleSummary[]>({
    queryKey: ["modules"],
    queryFn: () => apiGet<ModuleSummary[]>("/api/v1/modules?limit=2000"),
    staleTime: 10 * 60_000,
  });

  const { data: factions = [] } = useQuery<FactionSummary[]>({
    queryKey: VISIBLE_FACTIONS_QUERY_KEY,
    queryFn: () => apiGet<FactionSummary[]>(VISIBLE_FACTIONS_PATH),
    staleTime: 10 * 60_000,
  });

  const { data: playerLicences = [] } = usePlayerLicences();

  const licenceSet = useMemo(() => new Set(playerLicences.map((l) => `${l.faction_id}:${l.licence_type}`)), [playerLicences]);
  const anyLicenceSet = useMemo(() => new Set(playerLicences.map((l) => l.licence_type)), [playerLicences]);

  const uniqueKinds = useMemo(() => {
    const kinds = new Set(modules.map(m => m.kind).filter(Boolean));
    return Array.from(kinds).sort();
  }, [modules]);

  const filteredModules = useMemo(() => {
    return modules.filter(m => {
      if (!m.is_obtainable) return false;
      if (m.is_obtainable && m.est_cost == null) return false; // Hide sub-components
      if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterKind !== "all" && m.kind !== filterKind) return false;
      if (filterReady) {
        const licenceLocked = isModuleLicenceLocked(m.makerrace, m.restriction_licence, licenceSet, anyLicenceSet);
        const isFreeDefault = !m.blueprint_price_max && m.is_obtainable;
        if (licenceLocked || (!m.has_blueprint && !isFreeDefault)) return false;
      }
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [modules, search, filterKind, filterReady, licenceSet, anyLicenceSet]);

  useEffect(() => {
    setNodes(nds => nds.map(n => {
      const lockReason = computeLockReason(n.data.summary, licenceSet, anyLicenceSet);
      if (n.data.lockReason !== lockReason) {
        return { ...n, data: { ...n.data, lockReason } };
      }
      return n;
    }));
  }, [licenceSet, anyLicenceSet, setNodes]);

  const uniqueModuleIds = useMemo(() => Array.from(new Set(nodes.map(n => n.data.summary.module_id))), [nodes]);
  const moduleDetailsQueries = useQueries({
    queries: uniqueModuleIds.map(id => ({
      queryKey: ["module", id],
      queryFn: () => apiGet<any>(`/api/v1/modules/${id}`),
      staleTime: 10 * 60_000,
    }))
  });

  const moduleDetailsMap = useMemo(() => {
    const map = new Map<string, ModuleDetail>();
    moduleDetailsQueries.forEach(q => {
      if (q.data) map.set(q.data.module_id, q.data);
    });
    return map;
  }, [moduleDetailsQueries]);

  // --- Save / load / delete (appdata.db) ---
  const DEFAULT_NAME = "Untitled Station";
  const [currentStationId, setCurrentStationId] = useState<string | null>(null);
  const [stationName, setStationName] = useState(DEFAULT_NAME);
  const [savedSignature, setSavedSignature] = useState(() => designSignature([], [], DEFAULT_NAME));
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  // When the current design was imported from an in-game station, its station_id — recorded
  // as provenance on the fork created by the first save. Cleared on New/load of a saved design.
  const [importSourceRef, setImportSourceRef] = useState<string | null>(null);
  // Name prompt for "Save" (no current id) and "Save As".
  const [nameDialog, setNameDialog] = useState<{ asNew: boolean; draft: string } | null>(null);
  // Generic confirm (discard unsaved work, delete a design).
  const [confirmState, setConfirmState] = useState<{ title: string; desc: string; confirmLabel: string; destructive?: boolean; onConfirm: () => void } | null>(null);

  const stationList = useBuilderStationList();
  const playerStations = usePlayerStations();
  const constructionPlans = useConstructionPlans();
  const { create, update, remove } = useBuilderStationMutations();
  const saving = create.isPending || update.isPending;

  const currentSignature = useMemo(() => designSignature(nodes, edges, stationName), [nodes, edges, stationName]);
  const isDirty = currentSignature !== savedSignature;

  // Run `action` immediately when clean; otherwise gate it behind a discard confirm.
  const guardDirty = useCallback((action: () => void) => {
    if (!isDirty) { action(); return; }
    setConfirmState({
      title: "Discard unsaved changes?",
      desc: "You have unsaved changes to this station design. Continue and lose them?",
      confirmLabel: "Discard",
      destructive: true,
      onConfirm: action,
    });
  }, [isDirty]);

  const persistDesign = useCallback(async (name: string, asNew: boolean) => {
    const body: BuilderStationInput = {
      name,
      grid_mode: gridMode,
      nodes: serializeNodes(nodes),
      edges: serializeEdges(edges),
    };
    try {
      let id = currentStationId;
      if (!asNew && currentStationId) {
        await update.mutateAsync({ id: currentStationId, body });
      } else {
        // First save of a fresh/imported design → create. Carry provenance when forking
        // an in-game station so the new row records where it came from.
        if (importSourceRef) {
          body.source_kind = "imported";
          body.source_ref = importSourceRef;
        }
        const created = await create.mutateAsync(body);
        id = created.id;
      }
      setCurrentStationId(id);
      setStationName(name);
      setSavedSignature(designSignature(nodes, edges, name));
      showToast("Saved", `Saved "${name}".`, "success");
    } catch (err) {
      showToast("Save failed", toErrorMessage(err));
    }
  }, [nodes, edges, gridMode, currentStationId, importSourceRef, create, update]);

  const handleSave = useCallback(() => {
    if (currentStationId) persistDesign(stationName, false);
    else setNameDialog({ asNew: false, draft: stationName });
  }, [currentStationId, stationName, persistDesign]);

  const clearCanvas = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setCurrentStationId(null);
    setImportSourceRef(null);
    setStationName(DEFAULT_NAME);
    setSavedSignature(designSignature([], [], DEFAULT_NAME));
  }, [setNodes, setEdges]);

  // `imported` designs aren't yet in appdata: they load with no current id (so the first save
  // forks them) and stay dirty so the user is nudged to save. Saved designs load as clean.
  const loadDesign = useCallback((detail: BuilderStationDetail, opts?: { imported?: boolean }) => {
    const moduleMap = new Map(modules.map((m) => [m.module_id, m]));
    const dropped: string[] = [];
    const loadedNodes: Node<ModuleNodeData>[] = [];
    for (const nd of detail.nodes) {
      const summary = moduleMap.get(nd.module_id);
      if (!summary) { dropped.push(nd.module_id); continue; }
      const nodeId = nd.node_id;
      loadedNodes.push({
        id: nodeId,
        type: "moduleNode",
        position: { x: nd.pos_x, y: nd.pos_y },
        data: {
          summary,
          onClickDetail: () => setSelectedDetailId(summary.module_id),
          lockReason: computeLockReason(summary, licenceSet, anyLicenceSet),
          handlePositions: nd.handle_positions ? JSON.parse(nd.handle_positions) : undefined,
          onRemove: () => {
            setNodes((nds) => nds.filter((n) => n.id !== nodeId));
            setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
          },
        },
      });
    }
    const validIds = new Set(loadedNodes.map((n) => n.id));
    const loadedEdges: Edge[] = detail.edges
      .filter((e) => validIds.has(e.source) && validIds.has(e.target))
      .map((e) => ({
        id: e.edge_id,
        source: e.source,
        target: e.target,
        sourceHandle: e.source_handle ?? undefined,
        targetHandle: e.target_handle ?? undefined,
        type: "moduleEdge",
      }));
    setNodes(loadedNodes);
    setEdges(loadedEdges);
    setGridMode(detail.grid_mode);
    setStationName(detail.name);
    if (opts?.imported) {
      // Not persisted yet: no current id (next save forks), provenance recorded, kept dirty.
      setCurrentStationId(null);
      setImportSourceRef(detail.source_ref ?? null);
      setSavedSignature(designSignature([], [], detail.name));
      const skipped = dropped.length ? ` (${dropped.length} non-buildable part(s) skipped)` : "";
      showToast("Imported", `Imported "${detail.name}". Save to keep an editable copy.${skipped}`, "success");
    } else {
      setCurrentStationId(detail.id);
      setImportSourceRef(null);
      setSavedSignature(designSignature(loadedNodes, loadedEdges, detail.name));
      if (dropped.length) {
        showToast("Loaded with warnings", `${dropped.length} module(s) no longer in the catalog were skipped.`, "info");
      } else {
        showToast("Loaded", `Loaded "${detail.name}".`, "success");
      }
    }
  }, [modules, licenceSet, anyLicenceSet, setNodes, setEdges, setGridMode]);

  const handleSelectToLoad = useCallback(async (id: string) => {
    try {
      const detail = await fetchBuilderStation(id);
      setLoadDialogOpen(false);
      guardDirty(() => loadDesign(detail));
    } catch (err) {
      showToast("Load failed", toErrorMessage(err));
    }
  }, [guardDirty, loadDesign]);

  const handleSelectToImport = useCallback(async (stationId: string, stationName: string) => {
    try {
      const layout = await fetchStationLayout(stationId);
      if (layout.length === 0) {
        showToast("Nothing to import", "This station has no captured module layout yet.", "info");
        return;
      }
      const snapByModule = new Map(modules.map((m) => [m.module_id, m.snap_points ?? 0]));
      const design = layoutToDesign(layout, `${stationName} (imported)`, stationId, snapByModule, nodeAlignment);
      setImportDialogOpen(false);
      guardDirty(() => loadDesign(design, { imported: true }));
    } catch (err) {
      showToast("Import failed", toErrorMessage(err));
    }
  }, [guardDirty, loadDesign, modules, nodeAlignment]);

  const handleSelectToImportPlan = useCallback(async (planId: string, planName: string) => {
    try {
      const layout = await fetchConstructionPlanLayout(planId);
      if (layout.length === 0) {
        showToast("Nothing to import", "This construction plan has no modules.", "info");
        return;
      }
      const snapByModule = new Map(modules.map((m) => [m.module_id, m.snap_points ?? 0]));
      const design = layoutToDesign(layout, `${planName} (imported)`, planId, snapByModule, nodeAlignment);
      setImportDialogOpen(false);
      guardDirty(() => loadDesign(design, { imported: true }));
    } catch (err) {
      showToast("Import failed", toErrorMessage(err));
    }
  }, [guardDirty, loadDesign, modules, nodeAlignment]);

  const handleDeleteCurrent = useCallback(() => {
    if (!currentStationId) return;
    setConfirmState({
      title: "Delete this design?",
      desc: `Permanently delete "${stationName}". This cannot be undone.`,
      confirmLabel: "Delete",
      destructive: true,
      onConfirm: async () => {
        try {
          await remove.mutateAsync(currentStationId);
          clearCanvas();
          showToast("Deleted", "Design deleted.", "success");
        } catch (err) {
          showToast("Delete failed", toErrorMessage(err));
        }
      },
    });
  }, [currentStationId, stationName, remove, clearCanvas]);

  const handleAutoLayout = useCallback(() => {
    if (nodes.length === 0) return;
    setConfirmState({
      title: "Auto-Layout Graph?",
      desc: "This will completely reorganize your modules and overwrite your manual layout. Proceed?",
      confirmLabel: "Auto-Layout",
      destructive: true,
      onConfirm: () => {
        takeSnapshot(nodes, edges);
        const { nodes: nextNodes, edges: nextEdges } = autoLayoutGraph(nodes, edges, nodeAlignment);
        setNodes(nextNodes);
        setEdges(nextEdges);
        showToast("Auto-Layout Complete", "Your modules have been reorganized.", "success");
      },
    });
  }, [nodes, edges, nodeAlignment, takeSnapshot, setNodes, setEdges]);

  const handleAutoRoute = useCallback(() => {
    if (nodes.length === 0) return;
    takeSnapshot(nodes, edges);
    const { nodes: nextNodes, edges: nextEdges } = autoRouteHandles(nodes, edges, nodeAlignment);
    setNodes(nextNodes);
    setEdges(nextEdges);
    showToast("Auto-Route Complete", "Connections optimized based on current positions.", "success");
  }, [nodes, edges, nodeAlignment, takeSnapshot, setNodes, setEdges]);

  // Block in-app navigation and tab close while there are unsaved changes.
  const blocker = useBlocker({
    shouldBlockFn: () => isDirty,
    enableBeforeUnload: () => isDirty,
    withResolver: true,
  });

  const onConnect = useCallback((params: Connection) => {
    if (params.source === params.target) return;
    const alreadyConnected = edges.some(e => 
      (e.source === params.source && e.target === params.target) || 
      (e.source === params.target && e.target === params.source)
    );
    if (alreadyConnected) {
      showToast("Connection Failed", "These modules are already connected.");
      return;
    }
    const visited = new Set<string>();
    const q = [params.source];
    visited.add(params.source);
    let hasCycle = false;
    while (q.length > 0) {
      const curr = q.shift()!;
      if (curr === params.target) {
        hasCycle = true;
        break;
      }
      edges.forEach(e => {
        if (e.source === curr && !visited.has(e.target)) {
          visited.add(e.target);
          q.push(e.target);
        }
        if (e.target === curr && !visited.has(e.source)) {
          visited.add(e.source);
          q.push(e.source);
        }
      });
    }
    if (hasCycle) {
      showToast("Connection Failed", "Cyclic connections are not allowed. The station must be a tree structure.");
      return;
    }
    const sourceNode = nodes.find(n => n.id === params.source);
    const targetNode = nodes.find(n => n.id === params.target);
    const sourceEdgesCount = edges.filter(e => e.source === params.source || e.target === params.source).length;
    const targetEdgesCount = edges.filter(e => e.source === params.target || e.target === params.target).length;
    
    if (sourceNode && sourceEdgesCount >= (sourceNode.data.summary.snap_points || 0)) {
      showToast("Connection Failed", `${sourceNode.data.summary.name} has no available snap points.`);
      return;
    }
    if (targetNode && targetEdgesCount >= (targetNode.data.summary.snap_points || 0)) {
      showToast("Connection Failed", `${targetNode.data.summary.name} has no available snap points.`);
      return;
    }
    
    const sourceEdges = edges.filter(e => e.source === params.source && e.sourceHandle === params.sourceHandle);
    const targetEdges = edges.filter(e => e.target === params.target && e.targetHandle === params.targetHandle);
    const targetSourceEdges = edges.filter(e => e.source === params.target && e.sourceHandle === params.sourceHandle);
    const sourceTargetEdges = edges.filter(e => e.target === params.source && e.targetHandle === params.sourceHandle);
    if (sourceEdges.length > 0 || targetEdges.length > 0 || targetSourceEdges.length > 0 || sourceTargetEdges.length > 0) return;
    takeSnapshot(nodes, edges);
    setEdges((eds) => {
       const newEds = addEdge({ ...params, type: 'moduleEdge' }, eds);
       return newEds;
    });
  }, [edges, setEdges, nodes, takeSnapshot]);

  const onReconnect = useCallback((oldEdge: Edge, newConnection: Connection) => {
    takeSnapshot(nodes, edges);
    setEdges((els) => reconnectEdge(oldEdge, newConnection, els));
  }, [nodes, edges, setEdges, takeSnapshot]);

  const onNodeDragStart = useCallback((_event: React.MouseEvent | MouseEvent | TouchEvent, _node: Node, _nodes: Node<ModuleNodeData>[]) => {
    takeSnapshot(nodes, edges);
  }, [nodes, edges, takeSnapshot]);

  const onNodesDelete = useCallback(() => {
    takeSnapshot(nodes, edges);
  }, [nodes, edges, takeSnapshot]);

  const onEdgesDelete = useCallback(() => {
    takeSnapshot(nodes, edges);
  }, [nodes, edges, takeSnapshot]);

  const onPaneContextMenu = useCallback((e: React.MouseEvent | MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'pane' });
  }, []);

  const onSelectionContextMenu = useCallback((e: React.MouseEvent | MouseEvent, _nodes: Node[]) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'pane' });
  }, []);

  const onNodeContextMenu = useCallback((e: React.MouseEvent | MouseEvent, node: Node) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'node', nodeId: node.id });
  }, []);

  const onEdgeContextMenu = useCallback((e: React.MouseEvent | MouseEvent, edge: Edge) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'edge', edgeId: edge.id });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 's' || e.key === 'S') {
          e.preventDefault();
          handleSave();
        } else if (e.key === 'c' || e.key === 'C') {
          copy(nodes, edges);
          showToast("Copied", "Copied selected modules", "success");
        } else if (e.key === 'v' || e.key === 'V') {
          const targetPos = screenToFlowPosition({ x: lastMousePos.current.x, y: lastMousePos.current.y });
          const pasted = paste(targetPos);
          if (pasted) {
            takeSnapshot(nodes, edges);
            const newNodes = [...nodes, ...pasted.newNodes];
            const newEdges = [...edges, ...pasted.newEdges];
            setNodes(newNodes);
            setEdges(newEdges);
          }
        } else if (e.key === 'z' || e.key === 'Z') {
          if (e.shiftKey) {
            const state = redo(nodes, edges);
            if (state) { setNodes(state.nodes); setEdges(state.edges); }
          } else {
            const state = undo(nodes, edges);
            if (state) { setNodes(state.nodes); setEdges(state.edges); }
          }
        } else if (e.key === 'y' || e.key === 'Y') {
          const state = redo(nodes, edges);
          if (state) { setNodes(state.nodes); setEdges(state.edges); }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, edges, copy, paste, undo, redo, takeSnapshot, handleSave]);

  const onDragStart = (event: React.DragEvent, module: ModuleSummary) => {
    event.dataTransfer.setData("application/reactflow", JSON.stringify(module));
    event.dataTransfer.effectAllowed = "move";

    const dragEl = document.createElement('div');
    dragEl.className = "w-32 h-32 bg-[#0a0a0a] border border-border rounded-md shadow-lg flex flex-col items-center justify-center p-2 text-foreground font-sans text-sm";
    dragEl.style.position = 'absolute';
    dragEl.style.top = '-1000px';
    dragEl.style.left = '-1000px';
    
    if (module.icon_url) {
      const img = document.createElement('img');
      img.src = module.icon_url;
      // EntityIcon has style for w-12 h-12 object-contain etc
      img.style.width = '48px';
      img.style.height = '48px';
      img.style.objectFit = 'contain';
      img.style.marginBottom = '8px';
      dragEl.appendChild(img);
    }
    
    const nameSpan = document.createElement('span');
    nameSpan.className = "text-xs font-medium text-center line-clamp-2 max-w-[100px]";
    nameSpan.style.display = '-webkit-box';
    nameSpan.style.webkitLineClamp = '2';
    nameSpan.style.webkitBoxOrient = 'vertical';
    nameSpan.style.overflow = 'hidden';
    nameSpan.innerText = module.name;
    dragEl.appendChild(nameSpan);

    if (module.kind) {
      const kindSpan = document.createElement('span');
      // Resolve kind color class
      const kindClass = KIND_COLORS[module.kind.toLowerCase()] || "bg-muted";
      kindSpan.className = `mt-1 px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider border ${kindClass}`;
      kindSpan.innerText = module.kind;
      dragEl.appendChild(kindSpan);
    }

    document.body.appendChild(dragEl);
    event.dataTransfer.setDragImage(dragEl, 64, 64);
    
    // Clean up the drag image when the drag operation ends.
    // Using dragend (instead of setTimeout(0)) keeps the element alive long
    // enough for desktop WebViews (Tauri/Electron) to capture the drag image.
    const cleanup = () => {
      if (document.body.contains(dragEl)) {
        document.body.removeChild(dragEl);
      }
    };
    event.currentTarget.addEventListener('dragend', cleanup, { once: true });
  };

  const onDragOver = useCallback((event: React.DragEvent) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }, []);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const moduleDataStr = event.dataTransfer.getData("application/reactflow");
    if (!moduleDataStr) return;
    const moduleData = JSON.parse(moduleDataStr) as ModuleSummary;
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    position.x -= 64; // center the drop point (128px wide)
    position.y -= 64; // center the drop point (128px tall)
    const lockReason = computeLockReason(moduleData, licenceSet, anyLicenceSet);

    let dropX = position.x;
    let dropY = position.y;
    
    if (gridMode) {
      dropX = Math.round(dropX / 16) * 16;
      dropY = Math.round(dropY / 16) * 16;
    }

    const id = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const newNode: Node<ModuleNodeData> = {
      id,
      type: 'moduleNode',
      position: { x: dropX, y: dropY },
      data: { 
        summary: moduleData, 
        onClickDetail: () => setSelectedDetailId(moduleData.module_id), 
        lockReason,
        onRemove: () => {
          takeSnapshot(nodes, edges);
          setNodes((nds) => nds.filter((n) => n.id !== id));
          setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
        }
      },
    };
    takeSnapshot(nodes, edges);
    setNodes((nds) => nds.concat(newNode));
  }, [nodes, edges, setNodes, setEdges, gridMode, anyLicenceSet, licenceSet, takeSnapshot]);

  const stats = useMemo(() => {
    let cost = 0, buildTime = 0, workforce_need = 0, workforce_max = 0, hull = 0, total_production = 0, total_consumption = 0;
    let docking_s = 0, docking_m = 0, docking_l = 0, docking_xl = 0;
    const waresProduced = new Map<string, number>();
    const waresConsumed = new Map<string, number>();

    nodes.forEach(n => {
      const s = n.data.summary;
      cost += s.est_cost || 0;
      buildTime += s.build_time_sec || 0;
      workforce_max += s.workforce_capacity || 0;
      hull += s.hull || 0;
      total_production += s.production_rate || 0;
      total_consumption += s.consumption_rate || 0;
      docking_s += s.dock_s || 0; docking_m += s.dock_m || 0; docking_l += s.dock_l || 0; docking_xl += s.dock_xl || 0;
      
      if (s.produces_ware_name && s.production_rate) {
         waresProduced.set(s.produces_ware_name, (waresProduced.get(s.produces_ware_name) || 0) + s.production_rate);
      }
      const detail = moduleDetailsMap.get(s.module_id);
      if (detail?.production_inputs) {
        detail.production_inputs.forEach(input => {
          waresConsumed.set(input.name, (waresConsumed.get(input.name) || 0) + input.rate_per_hour);
        });
      }
    });

    return { 
      cost, buildTime, workforce_need, workforce_max, hull, total_production, total_consumption, docking_s, docking_m, docking_l, docking_xl,
      waresProduced: Array.from(waresProduced.entries()).map(([name, rate]) => ({ name, rate })).sort((a,b) => b.rate - a.rate),
      waresConsumed: Array.from(waresConsumed.entries()).map(([name, rate]) => ({ name, rate })).sort((a,b) => b.rate - a.rate),
    };
  }, [nodes, moduleDetailsMap]);

  const aggregateMaterials = useMemo(() => {
    const mats = new Map<string, { name: string, amount: number, total: number, ware_id: string }>();
    nodes.forEach(n => {
      const detail = moduleDetailsMap.get(n.data.summary.module_id);
      if (detail?.construction_resources) {
        detail.construction_resources.forEach(res => {
          if (!mats.has(res.ware_id)) mats.set(res.ware_id, { name: res.name, amount: 0, total: 0, ware_id: res.ware_id });
          const existing = mats.get(res.ware_id)!;
          existing.amount += res.amount;
          existing.total += res.total;
        });
      }
    });
    return Array.from(mats.values()).sort((a, b) => b.total - a.total);
  }, [nodes, moduleDetailsMap]);

  const selectedModuleSummary = modules.find(m => m.module_id === selectedDetailId);

  const onAddModuleToMap = useCallback((e: React.MouseEvent, moduleData: ModuleSummary) => {
    e.stopPropagation();
    const lockReason = computeLockReason(moduleData, licenceSet, anyLicenceSet);

    const { x, y, zoom } = getViewport();
    let dropX = -x / zoom + (window.innerWidth / 3) / zoom - 64;
    let dropY = -y / zoom + (window.innerHeight / 2) / zoom - 64;

    let overlapping = true;
    while (overlapping) {
      overlapping = nodes.some(n => Math.abs(n.position.x - dropX) < 130 && Math.abs(n.position.y - dropY) < 130);
      if (overlapping) {
        dropX += 140;
        if (dropX > -x / zoom + (window.innerWidth / 3) / zoom + 500) {
          dropX = -x / zoom + (window.innerWidth / 3) / zoom - 64;
          dropY += 140;
        }
      }
    }

    if (gridMode) {
      dropX = Math.round(dropX / 16) * 16;
      dropY = Math.round(dropY / 16) * 16;
    }

    const id = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newNode: Node<ModuleNodeData> = {
      id,
      type: 'moduleNode',
      position: { x: dropX, y: dropY },
      data: { 
        summary: moduleData, 
        onClickDetail: () => setSelectedDetailId(moduleData.module_id), 
        lockReason,
        onRemove: () => {
          setNodes(nds => nds.filter(n => n.id !== id));
          setEdges(eds => eds.filter(e => e.source !== id && e.target !== id));
        }
      },
    };
    setNodes((nds) => nds.concat(newNode));
  }, [setNodes, setEdges, licenceSet, anyLicenceSet, getViewport, nodes]);

  return (
    <div 
      className="flex flex-col h-full bg-background overflow-hidden"
      onPointerMove={(e) => { lastMousePos.current = { x: e.clientX, y: e.clientY }; }}
    >
      <style>{`
        .react-flow__controls-button { background-color: hsl(var(--card)); border-bottom: 1px solid hsl(var(--border)); fill: hsl(var(--foreground)); }
        .react-flow__controls-button:hover { background-color: hsl(var(--muted)); }
        details > summary { list-style: none; }
        details > summary::-webkit-details-marker { display: none; }
      `}</style>

      {toastMsg && (
        <div className={cn(
          "absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-md shadow-xl border animate-in slide-in-from-top-4 fade-in duration-200",
          toastMsg.type === 'success' ? "bg-emerald-500 text-white border-emerald-600" :
          toastMsg.type === 'info' ? "bg-blue-500 text-white border-blue-600" :
          "bg-destructive text-destructive-foreground border-destructive-foreground/20"
        )}>
          <div className="font-semibold text-sm">{toastMsg.title}</div>
          <div className="text-xs opacity-90">{toastMsg.desc}</div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 border-r border-border bg-card flex flex-col h-full shrink-0">
          <div className="px-6 py-4 flex-none border-b border-border bg-card">
            <h1 className="text-2xl font-bold tracking-tight">Station Builder</h1>
            <PageSubtitle>Design and prototype station layouts</PageSubtitle>
          </div>
          <div className="p-4 border-b border-border space-y-3">
            <SearchInput placeholder="Search modules..." value={search} onChange={e => setSearch(e.target.value)} />
            <Select value={filterKind} onValueChange={setFilterKind}>
              <SelectTrigger className="w-full h-8 text-xs"><SelectValue placeholder="All Kinds" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Kinds</SelectItem>
                {uniqueKinds.map(k => (
                  <SelectItem key={k as string} value={k as string}>
                    <span className={cn("px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider border", KIND_COLORS[(k as string).toLowerCase()] || "bg-muted")}>{k}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 justify-between">
              <div className="flex items-center gap-2">
                <Switch checked={filterReady} onCheckedChange={setFilterReady} />
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="text-xs font-medium text-muted-foreground cursor-help underline decoration-dotted underline-offset-2">Ready to Build</TooltipTrigger>
                    <TooltipContent><p className="max-w-[200px] text-xs">Shows only modules where you have the appropriate license and blueprint unlocked and can use the component for station building.</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              {(filterKind !== "all" || filterReady || search !== "") && (
                <ClearFiltersButton onClick={() => { setFilterKind("all"); setFilterReady(false); setSearch(""); }} />
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {isLoading ? (
              <div className="space-y-4 p-4">{[...Array(6)].map((_, i) => <div key={i} className="h-16 bg-muted/20 animate-pulse rounded" />)}</div>
            ) : filteredModules.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground p-4 mt-8">No modules match your current filters.</div>
            ) : (
              <div className="space-y-2">
                {filteredModules.map(m => (
                  <div key={m.module_id} onClick={() => setSelectedDetailId(m.module_id)} draggable onDragStart={(e) => onDragStart(e, m)} className="flex items-center gap-3 p-2 rounded border border-border bg-muted/30 hover:bg-muted cursor-grab active:cursor-grabbing transition-colors">
                    {m.icon_url ? <EntityIcon src={m.icon_url} alt={m.name} size={32} className="shrink-0" /> : <div className="w-8 h-8 shrink-0 bg-background rounded" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between items-start">
                        <div className="text-sm font-medium truncate pr-2" title={m.name}>{m.name}</div>
                        <button onClick={(e) => onAddModuleToMap(e, m)} className="text-muted-foreground hover:bg-primary hover:text-primary-foreground rounded transition-colors p-1 -mr-1 shrink-0" title="Add to Map"><Plus className="w-4 h-4" /></button>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <div className={cn("px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider border", m.kind ? (KIND_COLORS[m.kind.toLowerCase()] || "bg-muted") : "bg-muted")}>{m.kind || "Unknown"}</div>
                        <Currency value={m.est_cost} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0">
<div className="flex-1 relative bg-[#0a0a0a] flex flex-col z-0">
            <ReactFlow 
               nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} 
               onConnect={onConnect} onReconnect={onReconnect} onDrop={onDrop} onDragOver={onDragOver} 
               onNodeDragStart={onNodeDragStart} onPaneContextMenu={onPaneContextMenu} onNodeContextMenu={onNodeContextMenu} onEdgeContextMenu={onEdgeContextMenu}
               onSelectionContextMenu={onSelectionContextMenu}
               onNodesDelete={onNodesDelete} onEdgesDelete={onEdgesDelete} deleteKeyCode={['Backspace', 'Delete']}
               multiSelectionKeyCode={['Shift', 'Control', 'Meta']} selectionKeyCode={['Shift']}
               onMoveStart={() => setContextMenu(null)}
               connectionLineType={gridMode ? ConnectionLineType.SmoothStep : ConnectionLineType.Bezier}
               nodeTypes={nodeTypes} edgeTypes={edgeTypes} connectionMode={ConnectionMode.Loose} defaultViewport={{ x: 0, y: 0, zoom: 1 }} snapToGrid={gridMode} snapGrid={[16, 16]} proOptions={{ hideAttribution: true }}>
              <Background color="#3f3f46" gap={16} offset={[8, 8]} />
              <Controls />
              <MiniMap 
                nodeColor={() => '#10b981'} 
                maskColor="transparent" 
                className="!bg-[#0a0a0a] border border-border !rounded-lg overflow-hidden shadow-2xl !opacity-100" 
                style={{ backgroundColor: '#0a0a0a' }}
              />
              <Panel position="top-right" className="bg-card border border-border rounded-md shadow-lg p-3 min-w-[200px] z-50">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                  <Settings className="w-3.5 h-3.5" /> Settings
                </h3>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <label htmlFor="grid-mode" className="text-xs">Grid Mode</label>
                    <Switch id="grid-mode" checked={gridMode} onCheckedChange={setGridMode} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs">Node Alignment</label>
                    <Select value={nodeAlignment} onValueChange={setNodeAlignment}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="Alignment" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="distributed" className="text-xs">Equally Distributed</SelectItem>
                        <SelectItem value="right" className="text-xs">Left to Right</SelectItem>
                        <SelectItem value="bottom" className="text-xs">Top Down</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2 pt-2 border-t border-border mt-1">
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="sm" className="h-7 text-xs w-full justify-start gap-2" onClick={handleAutoLayout}>
                            <Wand2 className="w-3.5 h-3.5" /> Auto-Layout
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-[200px]">
                          <p>Reorganizes all modules into a neat tree structure based on your selected alignment.</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="sm" className="h-7 text-xs w-full justify-start gap-2" onClick={handleAutoRoute}>
                            <Route className="w-3.5 h-3.5" /> Auto-Route
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-[200px]">
                          <p>Recalculates connections to use the shortest paths without moving any modules.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </Panel>
            </ReactFlow>
            {nodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-background/80 px-6 py-4 rounded-lg border border-border text-center backdrop-blur-sm">
                  <p className="text-muted-foreground font-medium">Drag modules here to start building</p>
                  <p className="text-xs text-muted-foreground mt-1">Connect modules by dragging from empty snap points</p>
                </div>
              </div>
            )}
            {contextMenu && (
              <ContextMenu
                x={contextMenu.x}
                y={contextMenu.y}
                type={contextMenu.type}
                canUndo={canUndo}
                canRedo={canRedo}
                hasClipboard={hasClipboard}
                selectedCount={
                  contextMenu.type === 'pane' 
                    ? nodes.filter(n => n.selected).length
                    : contextMenu.type === 'node' 
                      ? (nodes.find(n => n.id === contextMenu.nodeId)?.selected ? nodes.filter(n => n.selected).length : 1) 
                      : undefined
                }
                onClose={() => setContextMenu(null)}
                onCopy={() => { copy(nodes, edges, contextMenu.type === 'node' ? contextMenu.nodeId : undefined); showToast("Copied", "Copied selected modules", "success"); }}
                onPaste={() => {
                   const targetPos = screenToFlowPosition({ x: contextMenu.x, y: contextMenu.y });
                   const pasted = paste(targetPos);
                   if (pasted) {
                     takeSnapshot(nodes, edges);
                     const newNodes = [...nodes, ...pasted.newNodes];
                     const newEdges = [...edges, ...pasted.newEdges];
                     setNodes(newNodes);
                     setEdges(newEdges);
                   }
                }}
                onUndo={() => { const s = undo(nodes, edges); if(s){ setNodes(s.nodes); setEdges(s.edges); } }}
                onRedo={() => { const s = redo(nodes, edges); if(s){ setNodes(s.nodes); setEdges(s.edges); } }}
                onViewDetails={() => {
                   if (contextMenu.nodeId) {
                     const n = nodes.find(n => n.id === contextMenu.nodeId);
                     if (n) setSelectedDetailId(n.data.summary.module_id);
                   }
                }}
                onDelete={() => {
                   if (contextMenu.type === 'node' && contextMenu.nodeId) {
                     takeSnapshot(nodes, edges);
                     const isSelected = nodes.find(n => n.id === contextMenu.nodeId)?.selected;
                     const idsToDelete = new Set(isSelected ? nodes.filter(n => n.selected).map(n => n.id) : [contextMenu.nodeId]);
                     setNodes(nds => nds.filter(n => !idsToDelete.has(n.id)));
                     setEdges(eds => eds.filter(e => !idsToDelete.has(e.source) && !idsToDelete.has(e.target)));
                   } else if (contextMenu.type === 'pane') {
                     takeSnapshot(nodes, edges);
                     const idsToDelete = new Set(nodes.filter(n => n.selected).map(n => n.id));
                     setNodes(nds => nds.filter(n => !idsToDelete.has(n.id)));
                     setEdges(eds => eds.filter(e => !idsToDelete.has(e.source) && !idsToDelete.has(e.target) && !e.selected));
                   } else if (contextMenu.type === 'edge' && contextMenu.edgeId) {
                     takeSnapshot(nodes, edges);
                     setEdges(eds => eds.filter(e => e.id !== contextMenu.edgeId));
                   }
                }}
              />
            )}
            
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
              <div className="flex items-center gap-1 bg-card border border-border shadow-md rounded p-1">
                 <button
                    onClick={() => { const s = undo(nodes, edges); if(s){ setNodes(s.nodes); setEdges(s.edges); } }}
                    disabled={!canUndo}
                    className={cn("p-1.5 rounded transition-colors", canUndo ? "hover:bg-muted cursor-pointer" : "opacity-50 cursor-not-allowed")}
                    title="Undo (Ctrl+Z)"
                 >
                    <Undo className="w-4 h-4" />
                 </button>
                 <button
                    onClick={() => { const s = redo(nodes, edges); if(s){ setNodes(s.nodes); setEdges(s.edges); } }}
                    disabled={!canRedo}
                    className={cn("p-1.5 rounded transition-colors", canRedo ? "hover:bg-muted cursor-pointer" : "opacity-50 cursor-not-allowed")}
                    title="Redo (Ctrl+Y)"
                 >
                    <Redo className="w-4 h-4" />
                 </button>
              </div>

              <div className="flex items-center gap-1 bg-card border border-border shadow-md rounded p-1">
                <div className="flex items-center gap-1.5 px-2 max-w-[200px]" title={stationName}>
                  <span className="text-xs font-medium truncate">{stationName}</span>
                  {importSourceRef && !currentStationId && (
                    <span className="text-[9px] uppercase tracking-wider px-1 py-0.5 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30 shrink-0" title="Imported from a save — Save creates an editable copy">imported</span>
                  )}
                  {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Unsaved changes" />}
                </div>
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={handleSave} disabled={saving} title="Save (Ctrl+S)">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span className="ml-1">Save</span>
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setNameDialog({ asNew: true, draft: `${stationName} copy` })} disabled={saving || nodes.length === 0} title="Save as a new design">
                  Save As
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setLoadDialogOpen(true)} title="Load a saved design">
                  <FolderOpen className="w-3.5 h-3.5" /><span className="ml-1">Load</span>
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setImportDialogOpen(true)} title="Import an existing in-game station">
                  <DownloadCloud className="w-3.5 h-3.5" /><span className="ml-1">Import</span>
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => guardDirty(clearCanvas)} title="New / clear canvas">
                  <FilePlus2 className="w-3.5 h-3.5" /><span className="ml-1">New</span>
                </Button>
                {currentStationId && (
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" onClick={handleDeleteCurrent} title="Delete this design">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
          <div className="h-14 bg-card border-t border-border flex flex-wrap items-center px-6 gap-8 shrink-0 relative z-10 text-xs shadow-lg overflow-x-auto">
            <div className="flex flex-col"><span className="text-muted-foreground uppercase font-bold tracking-wider mb-0.5 text-[10px]">Total Hull</span><span className="font-mono text-sm">{stats.hull.toLocaleString()}</span></div>
            <div className="flex flex-col"><span className="text-muted-foreground uppercase font-bold tracking-wider mb-0.5 text-[10px]">Workforce (Max / Need)</span><span className="font-mono text-sm">{stats.workforce_max} / {stats.workforce_need}</span></div>
            <div className="flex flex-col">
              <span className="text-muted-foreground uppercase font-bold tracking-wider mb-0.5 text-[10px]">Prod / Cons (hr)</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="font-mono text-sm cursor-help underline decoration-dotted underline-offset-2">
                      {stats.total_production.toLocaleString(undefined, {maximumFractionDigits:1})} / {stats.total_consumption.toLocaleString(undefined, {maximumFractionDigits:1})}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs space-y-2 min-w-[200px]">
                      <div>
                        <span className="font-bold text-green-400">Produced:</span>
                        {stats.waresProduced.length === 0 ? <div className="text-muted-foreground italic">None</div> : stats.waresProduced.map(w => <div key={w.name} className="flex justify-between"><span>{w.name}</span><span className="font-mono">{w.rate.toLocaleString(undefined, {maximumFractionDigits:1})}/hr</span></div>)}
                      </div>
                      <div>
                        <span className="font-bold text-red-400">Consumed:</span>
                        {stats.waresConsumed.length === 0 ? <div className="text-muted-foreground italic">None</div> : stats.waresConsumed.map(w => <div key={w.name} className="flex justify-between"><span>{w.name}</span><span className="font-mono">{w.rate.toLocaleString(undefined, {maximumFractionDigits:1})}/hr</span></div>)}
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex flex-col"><span className="text-muted-foreground uppercase font-bold tracking-wider mb-0.5 text-[10px]">Docking (S/M)</span><span className="font-mono text-sm">{stats.docking_s} / {stats.docking_m}</span></div>
            <div className="flex flex-col"><span className="text-muted-foreground uppercase font-bold tracking-wider mb-0.5 text-[10px]">Docking (L/XL)</span><span className="font-mono text-sm">{stats.docking_l} / {stats.docking_xl}</span></div>
          </div>
        </div>

        <div className="w-80 border-l border-border bg-card flex flex-col h-full shrink-0 relative z-10">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-bold">Shopping Cart</h2>
            <p className="text-xs text-muted-foreground">Ephemeral V1 Layout</p>
          </div>
          <BuilderStatsPanel
            nodes={nodes}
            moduleDetailsMap={moduleDetailsMap}
            cost={stats.cost}
            buildTime={stats.buildTime}
            aggregateMaterials={aggregateMaterials}
          />
        </div>
      </div>

      <DetailDialog
        open={selectedDetailId !== null}
        onOpenChange={(open) => { if (!open) setSelectedDetailId(null); }}
        title={selectedModuleSummary?.name ?? "Module details"}
        description={`Detailed stats for ${selectedModuleSummary?.name ?? "the selected module"}`}
        contentClassName="sm:max-w-2xl md:max-w-3xl min-h-[50vh] max-h-[90vh] overflow-y-auto"
      >
        {selectedModuleSummary && (
          <ModuleDetailPanel
            moduleId={selectedModuleSummary.module_id}
            summary={selectedModuleSummary}
            factions={factions}
            licenceSet={licenceSet}
            anyLicenceSet={anyLicenceSet}
          />
        )}
      </DetailDialog>

      {/* Load a saved design */}
      <LoadDesignDialog
        open={loadDialogOpen}
        onOpenChange={setLoadDialogOpen}
        isLoading={stationList.isLoading}
        designs={stationList.data}
        currentStationId={currentStationId}
        onSelect={handleSelectToLoad}
        onDeleteRequest={(design) => setConfirmState({
          title: "Delete this design?",
          desc: `Permanently delete "${design.name}". This cannot be undone.`,
          confirmLabel: "Delete",
          destructive: true,
          onConfirm: async () => {
            try {
              await remove.mutateAsync(design.id);
              if (design.id === currentStationId) clearCanvas();
              showToast("Deleted", "Design deleted.", "success");
            } catch (err) {
              showToast("Delete failed", toErrorMessage(err));
            }
          },
        })}
      />

      {/* Import an existing in-game station or construction plan */}
      <ImportDesignDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        isLoading={playerStations.isLoading}
        stations={playerStations.data}
        onSelectStation={handleSelectToImport}
        plansLoading={constructionPlans.isLoading}
        plans={constructionPlans.data}
        onSelectPlan={handleSelectToImportPlan}
      />

      {/* Name prompt for Save (new) / Save As */}
      <SaveAsDialog
        nameDialog={nameDialog}
        onOpenChange={(open) => { if (!open) setNameDialog(null); }}
        onDraftChange={(draft) => setNameDialog((d) => (d ? { ...d, draft } : d))}
        onSubmit={(name, asNew) => { setNameDialog(null); persistDesign(name, asNew); }}
        saving={saving}
      />

      {/* Generic confirm (discard / delete) */}
      <ConfirmDialog
        confirmState={confirmState}
        onOpenChange={(open) => { if (!open) setConfirmState(null); }}
        onConfirm={() => { const c = confirmState; setConfirmState(null); c?.onConfirm(); }}
      />

      {/* Unsaved-changes navigation guard */}
      <UnsavedChangesDialog
        isBlocked={blocker.status === "blocked"}
        onReset={() => { if (blocker.status === "blocked") blocker.reset(); }}
        onProceed={() => { if (blocker.status === "blocked") blocker.proceed(); }}
      />
    </div>
  );
}

export default function StationBuilderPage() {
  const [gridMode, setGridMode] = useState(true);
  const [nodeAlignment, setNodeAlignmentState] = useState<NodeAlignment>(() => {
    try {
      const saved = localStorage.getItem('builder_node_alignment');
      return (saved as NodeAlignment) || 'distributed';
    } catch {
      return 'distributed';
    }
  });

  const setNodeAlignment = useCallback((v: NodeAlignment) => {
    setNodeAlignmentState(v);
    try {
      localStorage.setItem('builder_node_alignment', v);
    } catch {}
  }, []);

  return (
    <BuilderSettingsContext.Provider value={{ gridMode, setGridMode, nodeAlignment, setNodeAlignment }}>
      <ReactFlowProvider>
        <StationBuilderContent />
      </ReactFlowProvider>
    </BuilderSettingsContext.Provider>
  );
}
