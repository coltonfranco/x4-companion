import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { EntityIcon } from "../../../components/game/EntityIcon";
import { ShipClassBadge, ShipTypeBadge } from "../../../components/game/ShipBadges";
import { classShort, getClassColor, getTypeColor } from "../../../lib/formatters";
import { cn } from "../../../lib/utils";
import type { ShipSummary } from "../lib/builderTypes";

const SHIP_CLASSES = ["XS", "S", "M", "L", "XL"] as const;

export function ShipSelector({
  ships, selectedId, onSelect,
}: { ships: ShipSummary[]; selectedId?: string; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [classFilters, setClassFilters] = useState<Set<string>>(new Set());
  const [roleFilters, setRoleFilters] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  const selectedShip = ships.find(s => s.ship_id === selectedId);

  const allRoles = useMemo(() =>
    [...new Set(ships.map(s => s.role).filter(Boolean) as string[])].sort(),
  [ships]);

  const filtered = useMemo(() => {
    let list = ships;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q));
    }
    if (classFilters.size > 0) list = list.filter(s => classFilters.has(classShort(s.class_id)));
    if (roleFilters.size > 0) list = list.filter(s => s.role != null && roleFilters.has(s.role));
    return list;
  }, [ships, search, classFilters, roleFilters]);

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const toggleClass = (c: string) => setClassFilters(prev => { const n = new Set(prev); n.has(c) ? n.delete(c) : n.add(c); return n; });
  const toggleRole = (r: string) => setRoleFilters(prev => { const n = new Set(prev); n.has(r) ? n.delete(r) : n.add(r); return n; });

  return (
    <div ref={ref} className="relative w-72">
      <button
        onClick={() => { setOpen(!open); if (!open) setSearch(""); }}
        className="flex items-center gap-2 w-full h-9 px-3 rounded-md border border-input bg-background text-sm hover:bg-accent/50 transition-colors"
      >
        {selectedShip ? (
          <>
            <EntityIcon src={selectedShip.icon_url} alt={selectedShip.name} size={20} />
            <span className="flex-1 text-left truncate">{selectedShip.name}</span>
            <ShipClassBadge class_id={selectedShip.class_id} className="text-[9px] px-1 py-0 shrink-0" />
          </>
        ) : (
          <span className="flex-1 text-left text-muted-foreground">Select a ship…</span>
        )}
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-[420px] border border-border rounded-md bg-[#101422]/95 backdrop-blur-md shadow-xl overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/20">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search ships…" className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60" />
          </div>
          {/* Filter pills */}
          <div className="px-3 py-2 border-b border-border flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground uppercase tracking-wide shrink-0">Class:</span>
              {SHIP_CLASSES.map(c => {
                const isActive = classFilters.has(c);
                const colorCls = getClassColor(`ship_${c}`);
                const textColor = colorCls.split(' ').find(x => x.startsWith('text-')) || "text-foreground";
                return (
                  <button key={c} onClick={() => toggleClass(c)}
                    className={cn("px-1.5 py-0.5 rounded border text-xs font-medium uppercase transition-colors",
                      isActive ? colorCls : cn("bg-muted/50 border-transparent hover:bg-muted", textColor, "opacity-70 hover:opacity-100"))}>
                    {c}
                  </button>
                );
              })}
            </div>
            {allRoles.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-muted-foreground uppercase tracking-wide shrink-0">Type:</span>
                {allRoles.map(r => {
                  const isActive = roleFilters.has(r);
                  const colorCls = getTypeColor(r);
                  const textColor = colorCls.split(' ').find(x => x.startsWith('text-')) || "text-foreground";
                  return (
                    <button key={r} onClick={() => toggleRole(r)}
                      className={cn("px-1.5 py-0.5 rounded border text-xs font-medium capitalize transition-colors",
                        isActive ? colorCls : cn("bg-muted/50 border-transparent hover:bg-muted", textColor, "opacity-70 hover:opacity-100"))}>
                      {r}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {/* Results */}
          <div className="max-h-64 overflow-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-sm text-muted-foreground text-center">No ships match</p>
            ) : (
              filtered.map(s => (
                <button key={s.ship_id}
                  onClick={() => { onSelect(s.ship_id); setOpen(false); setSearch(""); setClassFilters(new Set()); setRoleFilters(new Set()); }}
                  className={cn("flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent transition-colors text-left",
                    s.ship_id === selectedId && "bg-primary/10 text-primary")}>
                  <EntityIcon src={s.icon_url} alt={s.name} size={20} />
                  <span className="flex-1 truncate">{s.name}</span>
                  <ShipTypeBadge role={s.role} className="text-[8px] px-1 py-0 shrink-0" />
                  <ShipClassBadge class_id={s.class_id} className="text-[8px] px-1 py-0 shrink-0" />
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
