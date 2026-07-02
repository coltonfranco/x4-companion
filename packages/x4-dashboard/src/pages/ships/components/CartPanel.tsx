import { ShoppingCart, Trash2, X } from "lucide-react";
import { Currency } from "../../../components/game/Currency";
import { EntityIcon } from "../../../components/game/EntityIcon";
import { cn } from "../../../lib/utils";
import type { EquipmentItem, ShipDetail, SlotDef } from "../lib/builderTypes";
import { CATEGORIES, getCategoryStatus } from "../lib/builderHelpers";

function CategoryStatusDot({ kind, slots, cart }: { kind: string; slots: SlotDef[]; cart: Record<string, EquipmentItem | null> }) {
  const status = getCategoryStatus(kind, slots, cart);
  if (status === "full") return <div className="w-2 h-2 shrink-0 rounded-full bg-success shadow-[0_0_8px_var(--success)]" title="Fully equipped" />;
  if (status === "partial") return <div className="w-2 h-2 shrink-0 rounded-full bg-warning shadow-[0_0_8px_var(--warning)]" title="Partially equipped" />;
  if (status === "missing") return <div className="w-2 h-2 shrink-0 rounded-full bg-destructive shadow-[0_0_8px_var(--danger)]" title="Required component missing" />;
  return <div className="w-2 h-2 shrink-0 rounded-full bg-muted-foreground/30 shadow-inner" title="Optional/Empty" />;
}

export function CartPanel({
  slots, cart, onRemove, onClear, totalCost, onSelectCategory, shipDetail
}: {
  slots: SlotDef[]; cart: Record<string, EquipmentItem | null>;
  onRemove: (k: string) => void; onClear: () => void; totalCost: number;
  onSelectCategory: (c: string) => void; shipDetail?: ShipDetail;
}) {
  const byKind = new Map<string, SlotDef[]>();
  for (const s of slots) { if (!byKind.has(s.kind)) byKind.set(s.kind, []); byKind.get(s.kind)!.push(s); }

  return (
    <div className="flex flex-col h-full border border-border rounded-lg bg-card/40 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border bg-muted/20">
        <ShoppingCart className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-semibold flex-1">Shopping List</span>
        <button onClick={onClear} className="text-xs text-muted-foreground hover:text-destructive transition-colors" title="Clear all">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-3 text-sm">
        {shipDetail && (
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 w-full text-left">
              <div className="w-2 h-2 shrink-0 rounded-full bg-success" />
              <span>Hull</span>
            </div>
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-md border text-xs border-primary/30 bg-primary/5">
              <EntityIcon src={shipDetail.icon_url} alt={shipDetail.name} size={20} />
              <span className="flex-1 truncate font-medium">{shipDetail.name} (Base)</span>
              {shipDetail.price_avg && <span className="text-xs tabular-nums text-muted-foreground" title="Base price"><Currency value={shipDetail.price_avg} /></span>}
            </div>
          </div>
        )}
        {[...byKind.entries()].map(([kind, kindSlots]) => {
          const cat = CATEGORIES.find(c => c.kind === kind);
          const equipped = kindSlots.filter(s => cart[s.key]).length;
          return (
            <div key={kind}>
              <button
                onClick={() => onSelectCategory(cat?.id ?? kind)}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 hover:text-foreground transition-colors w-full text-left"
              >
                <CategoryStatusDot kind={kind} slots={kindSlots} cart={cart} />
                <span>{cat?.label ?? kind}</span>
                <span className="font-normal text-xs">({equipped}/{kindSlots.length})</span>
              </button>
              <div className="space-y-1">
                {kindSlots.map(slot => {
                  const item = cart[slot.key];
                  return (
                    <div key={slot.key} className={cn(
                      "flex items-center gap-2 px-2 py-1.5 rounded-md border text-xs",
                      item ? "border-primary/30 bg-primary/5" : "border-dashed border-border/50 bg-muted/5")}>
                      {item ? (
                        <>
                          <EntityIcon src={item.icon_url} alt={item.name} size={20} />
                          <span className="flex-1 truncate font-medium">{item.name}</span>
                          <span className="text-xs text-muted-foreground uppercase font-mono">{slot.size}</span>
                          {item.price_avg && <span className="text-xs tabular-nums text-muted-foreground" title="Base price"><Currency value={item.price_avg} /></span>}
                          <button onClick={() => onRemove(slot.key)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0"><X className="w-3 h-3" /></button>
                        </>
                      ) : (
                        <>
                          <div className="w-5 h-5 rounded bg-muted/20 shrink-0" />
                          <span className="flex-1 text-muted-foreground/50 italic">Empty</span>
                          <span className="text-xs text-muted-foreground/40 uppercase font-mono">{slot.size}</span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="px-3 py-2.5 border-t border-border flex items-center justify-between bg-muted/20">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total</span>
        <span className="text-sm font-bold tabular-nums"><Currency value={totalCost} /></span>
      </div>
    </div>
  );
}
