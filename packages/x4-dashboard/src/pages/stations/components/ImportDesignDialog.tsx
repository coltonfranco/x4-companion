import { useMemo, useState } from "react";
import { DownloadCloud, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import type { ConstructionPlanLite, LiveStationLite } from "../lib/stationBuilderPersistence";

type ImportItem = { id: string; label: string; sublabel: string };

function ImportSection({
  title, isLoading, emptyMessage, items, onSelect,
}: {
  title: string; isLoading: boolean; emptyMessage: string;
  items: ImportItem[]; onSelect: (id: string, label: string) => void;
}) {
  if (!isLoading && items.length === 0 && !emptyMessage) return null;
  return (
    <div>
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{title}</p>
      {isLoading ? (
        <div className="text-sm text-muted-foreground p-4 text-center">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground p-3 text-center">{emptyMessage}</div>
      ) : (
        <div className="space-y-1">
          {items.map((item) => (
            <button
              key={item.id}
              className="w-full flex items-center gap-2 p-2 rounded border border-border hover:bg-muted/50 transition-colors text-left"
              onClick={() => onSelect(item.id, item.label)}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{item.label}</div>
                <div className="text-[11px] text-muted-foreground">{item.sublabel}</div>
              </div>
              <DownloadCloud className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ImportDesignDialog({
  open,
  onOpenChange,
  isLoading,
  stations,
  onSelectStation,
  plansLoading,
  plans,
  onSelectPlan,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isLoading: boolean;
  stations: LiveStationLite[] | undefined;
  onSelectStation: (stationId: string, label: string) => void;
  plansLoading: boolean;
  plans: ConstructionPlanLite[] | undefined;
  onSelectPlan: (planId: string, label: string) => void;
}) {
  const [search, setSearch] = useState("");

  const stationItems = useMemo<ImportItem[]>(() => (stations ?? []).map((s) => ({
    id: s.station_id,
    label: s.name || s.code || s.station_id,
    sublabel: `${s.module_count ?? 0} modules${s.sector_id ? ` · ${s.sector_id}` : ""}`,
  })), [stations]);

  const planItems = useMemo(() => (plans ?? []).map((p) => ({
    id: p.plan_id,
    label: p.name ?? p.plan_id,
    sublabel: `${p.module_count} module${p.module_count === 1 ? "" : "s"}`,
    source: p.source,
  })), [plans]);

  const matches = (item: ImportItem) =>
    !search.trim() || item.label.toLowerCase().includes(search.trim().toLowerCase());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import a station design</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 my-4 px-2 py-1.5 rounded border border-border bg-muted/20">
          <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by name…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          />
        </div>
        <div className="max-h-[60vh] overflow-y-auto -mx-2 px-2 space-y-4">
          <ImportSection
            title="Your Stations"
            isLoading={isLoading}
            emptyMessage="No player stations in the active save."
            items={stationItems.filter(matches)}
            onSelect={onSelectStation}
          />
          <ImportSection
            title="My Construction Plans"
            isLoading={plansLoading}
            emptyMessage=""
            items={planItems.filter((p) => p.source === "custom").filter(matches)}
            onSelect={onSelectPlan}
          />
          <ImportSection
            title="Game Construction Plans"
            isLoading={plansLoading}
            emptyMessage="No game construction plans found."
            items={planItems.filter((p) => p.source === "preset").filter(matches)}
            onSelect={onSelectPlan}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
