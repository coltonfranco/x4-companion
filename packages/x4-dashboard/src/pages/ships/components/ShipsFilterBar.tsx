import { useMemo } from "react";
import { MultiSelect } from "../../../components/ui/multi-select";
import { FactionBadge } from "../../../components/game/FactionBadge";
import { Button } from "../../../components/ui/button";
import { Switch } from "../../../components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { FilterBar } from "../../../components/layout/FilterBar";
import { SearchInput } from "../../../components/ui/search-input";
import { getClassColor, getTypeColor, formatDlc } from "../../../lib/formatters";
import { cn } from "../../../lib/utils";
import type { FactionSummary } from "../../../lib/types";
import { ALL_COLUMNS, CLASSES, type GroupByKey, type ShipSummary } from "../lib/shipsColumns";

export function ShipsFilterBar({
  ships,
  factions,
  search, setSearch,
  selectedClass, setSelectedClass, isLinear,
  selectedFactions, setSelectedFactions,
  selectedTypes, setSelectedTypes,
  selectedSubTypes, setSelectedSubTypes,
  selectedDlcs, setSelectedDlcs,
  ownedOnly, setOwnedOnly,
  obtainableOnly, setObtainableOnly,
  hasFilters, onClear,
  visibleColumns, setVisibleColumns,
  groupBy, setGroupBy,
}: {
  ships: ShipSummary[];
  factions: FactionSummary[];
  search: string; setSearch: (v: string) => void;
  selectedClass: string | null; setSelectedClass: (v: string | null) => void; isLinear: boolean;
  selectedFactions: Set<string>; setSelectedFactions: (v: Set<string>) => void;
  selectedTypes: Set<string>; setSelectedTypes: (v: Set<string>) => void;
  selectedSubTypes: Set<string>; setSelectedSubTypes: (v: Set<string>) => void;
  selectedDlcs: Set<string>; setSelectedDlcs: (v: Set<string>) => void;
  ownedOnly: boolean; setOwnedOnly: (v: boolean) => void;
  obtainableOnly: boolean; setObtainableOnly: (v: boolean) => void;
  hasFilters: boolean; onClear: () => void;
  visibleColumns: Set<string>; setVisibleColumns: (v: Set<string>) => void;
  groupBy: GroupByKey; setGroupBy: (v: GroupByKey) => void;
}) {
  const toggleClass = (cls: string) => {
    setSelectedClass(selectedClass === cls ? null : cls);
  };

  const availableSubTypes = useMemo(
    () =>
      selectedTypes.size > 0
        ? Array.from(
            new Set(
              ships
                .filter((s) => s.role && selectedTypes.has(s.role))
                .map((s) => s.ship_type)
                .filter(Boolean) as string[]
            )
          )
            .sort()
            .map((r) => {
              const matchingShip = ships.find(
                (s) => s.ship_type === r && s.role && selectedTypes.has(s.role)
              );
              const baseColor = getTypeColor(matchingShip?.role || "default");
              const textColor = baseColor.split(" ").find((c) => c.startsWith("text-"));
              return {
                value: r,
                label: r.charAt(0).toUpperCase() + r.slice(1),
                node: (
                  <div className="flex items-center gap-2">
                    <div className={cn("w-1.5 h-1.5 rounded-full bg-current opacity-50", textColor)} />
                    <span className="capitalize">{r}</span>
                  </div>
                ),
              };
            })
        : [],
    [ships, selectedTypes]
  );

  return (
    <FilterBar
      secondRow={
        <div className="flex items-center gap-2">
          <div className={cn("w-1.5 h-1.5 rounded-[2px]", isLinear ? "bg-amber-400/80" : "bg-primary/70")} />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {isLinear
              ? `Linear scale · comparing within ${selectedClass} class`
              : "Log scale · compares across all sizes"}
          </span>
        </div>
      }
    >
      {/* Search */}
      <SearchInput
        placeholder="Search ships…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-48"
      />

      {/* Class pills */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelectedClass(null)}
          className={cn(
            "h-7 px-3 text-xs rounded-[4px] font-medium transition-colors",
            selectedClass === null
              ? "bg-accent text-accent-foreground border-accent"
              : "bg-transparent text-muted-foreground hover:bg-muted/50 border-input"
          )}
        >
          All
        </Button>
        {CLASSES.map((cls) => {
          const isSelected = selectedClass === cls;
          const baseColor = getClassColor(`ship_${cls.toLowerCase()}`);
          const textColor = baseColor.split(" ").find((c) => c.startsWith("text-"));
          return (
            <Button
              key={cls}
              variant="outline"
              size="sm"
              onClick={() => toggleClass(cls)}
              className={cn(
                "h-7 px-2.5 text-xs flex items-center gap-1.5 rounded-[4px] font-medium transition-colors",
                isSelected
                  ? cn(baseColor)
                  : "bg-transparent text-muted-foreground hover:bg-muted/50 border-input"
              )}
            >
              <div className={cn("w-1.5 h-1.5 rounded-[2px] bg-current", textColor)} />
              {cls}
            </Button>
          );
        })}
      </div>

      {/* Factions */}
      <MultiSelect
        options={factions.map((f) => ({
          value: f.faction_id,
          label: f.name,
          node: (
            <FactionBadge
              name={f.name}
              color_hex={f.color_hex}
              icon_url={f.icon_url}
              size="sm"
              className="font-normal"
            />
          ),
        }))}
        selected={selectedFactions}
        onChange={setSelectedFactions}
        placeholder="Factions..."
        className="h-7 text-xs text-muted-foreground bg-transparent w-36"
      />

      {/* Roles */}
      <MultiSelect
        options={Array.from(
          new Set(ships.map((s) => s.role).filter(Boolean) as string[])
        )
          .sort()
          .map((r) => {
            const baseColor = getTypeColor(r);
            const textColor = baseColor.split(" ").find((c) => c.startsWith("text-"));
            return {
              value: r,
              label: r.charAt(0).toUpperCase() + r.slice(1),
              node: (
                <div className="flex items-center gap-2">
                  <div className={cn("w-1.5 h-1.5 rounded-full bg-current", textColor)} />
                  <span className="capitalize">{r}</span>
                </div>
              ),
            };
          })}
        selected={selectedTypes}
        onChange={setSelectedTypes}
        placeholder="Roles..."
        className="h-7 text-xs text-muted-foreground bg-transparent w-32"
      />

      {/* Sub-types (conditional) */}
      {selectedTypes.size > 0 && availableSubTypes.length > 0 && (
        <MultiSelect
          options={availableSubTypes}
          selected={selectedSubTypes}
          onChange={setSelectedSubTypes}
          placeholder="Types..."
          className="h-7 text-xs text-muted-foreground bg-transparent w-32"
        />
      )}

      {/* Expansions */}
      <MultiSelect
        options={Array.from(new Set(ships.map((s) => s.dlc || "base_game")))
          .sort()
          .map((d) => ({ value: d, label: formatDlc(d) }))}
        selected={selectedDlcs}
        onChange={setSelectedDlcs}
        placeholder="Expansions..."
        className="h-7 text-xs text-muted-foreground bg-transparent w-36"
      />

      {/* Toggles */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Switch id="owned-only" checked={ownedOnly} onCheckedChange={setOwnedOnly} />
          <label htmlFor="owned-only" className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
            Owned Only
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="obtainable-only" checked={obtainableOnly} onCheckedChange={setObtainableOnly} />
          <label htmlFor="obtainable-only" className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
            Obtainable
          </label>
        </div>
      </div>

      {/* Clear */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-7 text-xs text-muted-foreground"
        >
          Clear
        </Button>
      )}

      {/* Right: column visibility + group-by */}
      <div className="ml-auto flex items-center gap-3">
        <div className="h-5 w-px bg-border/50" />
        <MultiSelect
          options={ALL_COLUMNS.map((c) => ({
            value: c.key,
            label: c.label,
            group: c.groupId,
          }))}
          selected={visibleColumns}
          onChange={setVisibleColumns}
          placeholder="Columns..."
          className="h-7 text-xs text-muted-foreground bg-transparent w-36"
          searchable
          hideClear
        />
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            Group By
          </span>
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupByKey)}>
            <SelectTrigger className="w-24 h-7 text-xs text-muted-foreground bg-transparent border-transparent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="class_id">Class</SelectItem>
              <SelectItem value="role">Type</SelectItem>
              <SelectItem value="faction_id">Faction</SelectItem>
              <SelectItem value="dlc">Expansion</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </FilterBar>
  );
}
