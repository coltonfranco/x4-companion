import { Sparkles } from "lucide-react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "../../../components/ui/select";
import type { LoadoutOption } from "../lib/builderTypes";

export function LoadoutSelector({
  value, options, onChange, disabled,
}: { value: string; options: LoadoutOption[]; onChange: (value: string) => void; disabled?: boolean }) {
  const custom = options.filter(o => o.source === "custom");
  const presets = options.filter(o => o.source === "preset");
  const approx = options.filter(o => o.source === "approx");
  const hasOptions = options.length > 0;

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        className="w-[200px] h-9 text-xs border border-border hover:border-primary/50 transition-colors focus:border-primary"
        title={disabled ? undefined : hasOptions ? undefined : "This ship has no game presets or saved custom loadouts"}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Sparkles className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <SelectValue placeholder={hasOptions ? "Load a preset…" : "No presets available"} />
        </div>
      </SelectTrigger>
      <SelectContent>
        {!hasOptions && (
          <p className="px-2 py-3 text-xs text-muted-foreground text-center max-w-[220px]">
            No game presets or saved custom loadouts found for this ship.
          </p>
        )}
        {custom.length > 0 && (
          <SelectGroup>
            <SelectLabel>My Loadouts</SelectLabel>
            {custom.map(o => (
              <SelectItem key={o.loadout_id} value={o.loadout_id}>{o.name ?? o.loadout_id}</SelectItem>
            ))}
          </SelectGroup>
        )}
        {presets.length > 0 && (
          <SelectGroup>
            <SelectLabel>Game Presets</SelectLabel>
            {presets.map(o => (
              <SelectItem key={o.loadout_id} value={o.loadout_id}>{o.name ?? o.loadout_id}</SelectItem>
            ))}
          </SelectGroup>
        )}
        {approx.length > 0 && (
          <SelectGroup>
            <SelectLabel title="Not from game data — a heuristic reconstruction, see the ship builder docs">
              Approximate Tiers (not from game data)
            </SelectLabel>
            {approx.map(o => (
              <SelectItem key={o.loadout_id} value={o.loadout_id}>{o.name ?? o.loadout_id}</SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}
