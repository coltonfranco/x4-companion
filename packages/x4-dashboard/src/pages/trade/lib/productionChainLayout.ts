import { WARE_GROUP_HEX, TIER_HEX } from "../../../lib/constants";
import type { ChainNode, Overlay } from "./productionChainTypes";

export const groupHex = (g: string | null) => (g && WARE_GROUP_HEX[g]) || "#8b93ad";

export const hexA = (hex: string, a: number) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

export const fmt = (n: number) => {
  const r = Math.round(n);
  const a = Math.abs(r);
  if (a >= 1e6) return (r / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (a >= 1e3) return (r / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
  return "" + r;
};

// Layout constants (px). Mirrors the mockup's column ladder.
export const LAY = { HEAD: 56, ROWH: 36, NODEH: 30, COLW: 300, GAP: 94, PADX: 16, PADY: 12 };
export const DEPTH_LABEL = ["Tier 1", "Tier 2", "Tier 3", "Tier 4", "Tier 5", "Tier 6"];
export const tierHex = (d: number) => TIER_HEX[d] ?? TIER_HEX[TIER_HEX.length - 1];

// A ware consumed by at least this many others is a "utility" (energy cells, water) —
// its edges are suppressed so they don't cut across the whole grid.
const UTILITY_THRESHOLD = 12;

// The signed "balance" each overlay surfaces (positive = surplus/green).
export function overlayValue(n: ChainNode, overlay: Overlay): number | null {
  if (overlay === "price") return n.market_avg ?? n.price_avg;
  if (overlay === "empire") {
    if (n.empire_production == null && n.empire_consumption == null) return null;
    return (n.empire_production ?? 0) - (n.empire_consumption ?? 0);
  }
  if (n.sell_qty == null && n.buy_qty == null) return null;
  return (n.sell_qty ?? 0) - (n.buy_qty ?? 0); // supply − demand
}

export function balanceColor(v: number, scale: number): string {
  if (v > scale) return "var(--success)";
  if (v < -scale) return "var(--danger)";
  return "var(--warning)";
}

export type ProductionEdge = {
  d: string;
  stroke: string;
  width: number;
  a: string;
  b: string;
  util: boolean;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type ProductionLayout = {
  cols: ChainNode[][];
  pos: Map<string, { x: number; y: number; d: number }>;
  edges: ProductionEdge[];
  chartW: number;
  chartH: number;
  inputsOf: Map<string, string[]>;
  consumersOf: Map<string, string[]>;
  allConsumersOf: Map<string, string[]>;
  utility: Set<string>;
  recipeFor: (n: ChainNode) => ChainNode["recipes"][string] | null;
  byId: Map<string, ChainNode>;
};

/**
 * Pure column-ladder layout for the production chain graph: buckets wares into
 * depth columns, computes node positions, and generates bezier edge paths for
 * the active recipe per node (honoring per-node method overrides).
 */
export function buildProductionLayout(
  nodes: ChainNode[],
  nodeMethods: Record<string, string>
): ProductionLayout {
  const byId = new Map(nodes.map((n) => [n.ware_id, n]));

  // Column buckets by depth; sort within a column by group tier then name.
  const maxDepth = nodes.reduce((m, n) => Math.max(m, n.depth), 0);
  const cols: ChainNode[][] = Array.from({ length: maxDepth + 1 }, () => []);
  nodes.forEach((n) => cols[n.depth].push(n));
  cols.forEach((c) =>
    c.sort(
      (a, b) =>
        (a.group_tier ?? 99) - (b.group_tier ?? 99) || a.name.localeCompare(b.name)
    )
  );

  const colX = (d: number) => LAY.PADX + d * (LAY.COLW + LAY.GAP);
  const pos = new Map<string, { x: number; y: number; d: number }>();
  cols.forEach((c, d) =>
    c.forEach((n, i) =>
      pos.set(n.ware_id, { x: colX(d), y: LAY.PADY + LAY.HEAD + i * LAY.ROWH, d })
    )
  );

  const maxLen = cols.reduce((m, c) => Math.max(m, c.length), 0);
  const chartW = LAY.PADX * 2 + (maxDepth + 1) * LAY.COLW + maxDepth * LAY.GAP;
  const chartH = LAY.PADY * 2 + LAY.HEAD + maxLen * LAY.ROWH + 8;

  // "Utility" inputs (energy cells, water, …) feed almost everything; their long
  // cross-grid edges are pure noise. Flag them by how many wares consume them (using
  // the stable default recipe) and skip their edges/chain unless one is itself focused.
  const consumerCount = new Map<string, number>();
  nodes.forEach((n) => {
    const r = n.recipes["default"];
    r?.inputs.forEach((inp) =>
      consumerCount.set(inp.ware_id, (consumerCount.get(inp.ware_id) ?? 0) + 1)
    );
  });
  const utility = new Set(
    [...consumerCount].filter(([, c]) => c >= UTILITY_THRESHOLD).map(([w]) => w)
  );

  // Edges for the selected method (the graph defaults to "default").
  const recipeFor = (n: ChainNode) => {
    const explicit = nodeMethods[n.ware_id];
    if (explicit && n.recipes[explicit]) return n.recipes[explicit];
    if (n.recipes["default"]) return n.recipes["default"];
    const methods = Object.keys(n.recipes);
    return methods.length > 0 ? n.recipes[methods[0]] : null;
  };
  const edges: ProductionEdge[] = [];
  // Adjacency for chain traversal: inputsOf[b] = wares consumed to make b;
  // consumersOf[a] = wares that consume a. Kept complete (incl. utilities) so the
  // sidebar can list them; the graph traversal filters utilities out separately.
  const inputsOf = new Map<string, string[]>();
  const consumersOf = new Map<string, string[]>();
  const allConsumersOf = new Map<string, string[]>();

  nodes.forEach((n) => {
    // Track ALL potential consumers regardless of active recipe for the sidebar
    Object.values(n.recipes).forEach((r) => {
      r.inputs.forEach((inp) => {
        const arr = allConsumersOf.get(inp.ware_id) ?? allConsumersOf.set(inp.ware_id, []).get(inp.ware_id)!;
        if (!arr.includes(n.ware_id)) arr.push(n.ware_id);
      });
    });

    const r = recipeFor(n);
    if (!r) return;
    const pb = pos.get(n.ware_id)!;

    const utilInputs = r.inputs.filter((inp) => utility.has(inp.ware_id));
    const utilCount = utilInputs.length;
    let utilIndex = 0;

    r.inputs.forEach((inp) => {
      const pa = pos.get(inp.ware_id);
      if (!pa) return; // input is not a commodity node — no edge
      (inputsOf.get(n.ware_id) ?? inputsOf.set(n.ware_id, []).get(n.ware_id)!).push(inp.ware_id);
      (consumersOf.get(inp.ware_id) ?? consumersOf.set(inp.ware_id, []).get(inp.ware_id)!).push(n.ware_id);

      const isUtil = utility.has(inp.ware_id);
      let yOffset = 0;
      if (isUtil) {
        const regularCount = r.inputs.length - utilCount;
        if (regularCount > 0) {
          if (utilCount === 1) {
            yOffset = 6;
          } else if (utilCount === 2) {
            yOffset = utilIndex === 0 ? -6 : 6;
          } else {
            yOffset = -8 + utilIndex * 8;
          }
        } else {
          if (utilCount > 1) {
            const spacing = 8;
            const startY = -((utilCount - 1) * spacing) / 2;
            yOffset = startY + utilIndex * spacing;
          }
        }
        utilIndex++;
      }

      const x1 = pa.x + LAY.COLW;
      const y1 = pa.y + LAY.NODEH / 2;
      const x2 = pb.x;
      const y2 = pb.y + LAY.NODEH / 2 + yOffset;
      const mx = (x1 + x2) / 2;
      const width = 1.8;
      edges.push({
        d: `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`,
        stroke: groupHex(byId.get(inp.ware_id)?.group_id ?? null),
        width,
        a: inp.ware_id,
        b: n.ware_id,
        util: isUtil,
        x1,
        y1,
        x2,
        y2,
      });
    });
  });

  return { cols, pos, edges, chartW, chartH, inputsOf, consumersOf, allConsumersOf, utility, recipeFor, byId };
}
