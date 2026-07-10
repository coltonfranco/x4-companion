import { Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { cn } from "../../../lib/utils";
import type { BuilderStationSummary } from "../lib/stationBuilderPersistence";

export function LoadDesignDialog({
  open,
  onOpenChange,
  isLoading,
  designs,
  currentStationId,
  onSelect,
  onDeleteRequest,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isLoading: boolean;
  designs: BuilderStationSummary[] | undefined;
  currentStationId: string | null;
  onSelect: (id: string) => void;
  onDeleteRequest: (design: BuilderStationSummary) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Load station design</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto -mx-2 px-2 mt-4">
          {isLoading ? (
            <div className="text-sm text-muted-foreground p-4 text-center">Loading…</div>
          ) : (designs?.length ?? 0) === 0 ? (
            <div className="text-sm text-muted-foreground p-6 text-center">No saved designs yet.</div>
          ) : (
            <div className="space-y-1">
              {designs!.map((s) => (
                <div key={s.id} className={cn("flex items-center gap-2 p-2 rounded border border-border hover:bg-muted/50 transition-colors", s.id === currentStationId && "border-primary/50 bg-primary/5")}>
                  <button className="flex-1 min-w-0 text-left" onClick={() => onSelect(s.id)}>
                    <div className="text-sm font-medium truncate">{s.name}</div>
                    <div className="text-[11px] text-muted-foreground">{s.node_count} modules · {s.edge_count} links · updated {new Date(s.updated_at).toLocaleString()}</div>
                  </button>
                  <button
                    className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                    title="Delete design"
                    onClick={() => onDeleteRequest(s)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
