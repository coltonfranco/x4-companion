import { Settings } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { cn } from "../../../lib/utils";
import { useSettings, type EventPriority } from "../../../lib/settingsStore";
import type { CategoryInfo } from "../types";
import { CategoryIcon } from "../lib/logEntryFormatting";

function PrioritySelect({ value, onChange }: { value: EventPriority; onChange: (v: EventPriority) => void }) {
  const PRIORITY_COLORS: Record<string, string> = {
    critical: "text-red-500 bg-red-500/10 border-red-500/30",
    high: "text-amber-500 bg-amber-500/10 border-amber-500/30",
    normal: "text-foreground bg-background border-border",
    low: "text-muted-foreground bg-muted/20 border-border/50",
    hidden: "text-muted-foreground/50 bg-transparent border-dashed",
  };
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as EventPriority)}
      className={cn(
        "rounded px-2 py-0.5 text-xs outline-none focus:ring-1 border transition-colors shrink-0",
        PRIORITY_COLORS[value]
      )}
    >
      <option className="text-red-500 bg-background" value="critical">Critical</option>
      <option className="text-amber-500 bg-background" value="high">High</option>
      <option className="text-foreground bg-background" value="normal">Normal</option>
      <option className="text-muted-foreground bg-background" value="low">Low</option>
      <option className="text-muted-foreground/50 bg-background" value="hidden">Hidden</option>
    </select>
  );
}

export function LogbookSettingsModal({ open, onClose, catInfos }: { open: boolean; onClose: () => void; catInfos: CategoryInfo[] }) {
  const { settings, updateSettings } = useSettings();
  const priorities = settings.logbookPriorities;

  const updatePriority = (key: string, value: EventPriority) => {
    updateSettings({ logbookPriorities: { ...priorities, [key]: value } });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Logbook Event Priorities
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
          {catInfos.map((c) => (
            <div key={c.key} className="rounded-lg border border-border bg-card p-3 space-y-1.5">
              {/* Header — icon + label only, no priority */}
              <div className="flex items-center gap-2 pb-1 border-b border-border/40">
                <CategoryIcon catKey={c.key} size={16} />
                <span className="text-sm font-semibold truncate">{c.label}</span>
              </div>
              {/* Subcategory rows */}
              {c.subcategories.map((s) => {
                const subKey = `${c.key}.${s.key}`;
                return (
                  <div key={subKey} className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground truncate">{s.label}</span>
                    <PrioritySelect
                      value={priorities[subKey] ?? "normal"}
                      onChange={(v) => updatePriority(subKey, v)}
                    />
                  </div>
                );
              })}
            </div>
          ))}
          {/* General fallback */}
          <div className="rounded-lg border border-dashed border-border/50 bg-card/50 p-3 flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">General (unmatched)</span>
            <PrioritySelect
              value={priorities["general"] ?? "normal"}
              onChange={(v) => updatePriority("general", v)}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
