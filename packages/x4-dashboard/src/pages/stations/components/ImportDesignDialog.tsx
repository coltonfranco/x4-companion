import { DownloadCloud } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import type { LiveStationLite } from "../lib/stationBuilderPersistence";

export function ImportDesignDialog({
  open,
  onOpenChange,
  isLoading,
  stations,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isLoading: boolean;
  stations: LiveStationLite[] | undefined;
  onSelect: (stationId: string, label: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import a station from your save</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">
          Loads one of your in-game stations with its real layout and connections. It opens as an
          editable copy — saving creates a new design (the original is never changed).
        </p>
        <div className="max-h-[60vh] overflow-y-auto -mx-2 px-2">
          {isLoading ? (
            <div className="text-sm text-muted-foreground p-4 text-center">Loading…</div>
          ) : (stations?.length ?? 0) === 0 ? (
            <div className="text-sm text-muted-foreground p-6 text-center">No player stations in the active save.</div>
          ) : (
            <div className="space-y-1">
              {stations!.map((s) => {
                const label = s.name || s.code || s.station_id;
                return (
                  <button
                    key={s.station_id}
                    className="w-full flex items-center gap-2 p-2 rounded border border-border hover:bg-muted/50 transition-colors text-left"
                    onClick={() => onSelect(s.station_id, label)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{label}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {s.module_count ?? 0} modules{s.sector_id ? ` · ${s.sector_id}` : ""}
                      </div>
                    </div>
                    <DownloadCloud className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
