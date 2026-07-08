import { FactionBadge } from "../../../components/game/FactionBadge";
import { ClearFiltersButton } from "../../../components/ui/clear-filters-button";
import { SizeBadge } from "../../../components/game/ShipBadges";
import { MultiSelect } from "../../../components/ui/multi-select";
import { Switch } from "../../../components/ui/switch";
import { cn } from "../../../lib/utils";
import { FilterBar } from "../../../components/layout/FilterBar";
import { SearchInput } from "../../../components/ui/search-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import {
  KIND_COLORS,
  KIND_LABELS,
  moduleSizeToClassId,
} from "../../../components/detail-panels/ModuleDetailPanel";
import type { FactionSummary } from "../../../lib/types";
import type { GroupByKey } from "../lib/modulesColumns";

export function ModulesFilterBar({
  search, setSearch,
  selectedKind, setSelectedKind, kinds,
  selectedSize, setSelectedSize, sizes,
  selectedFactions, setSelectedFactions, availableFactions, factionMap,
  availabilityFilter, setAvailabilityFilter,
  obtainableOnly, setObtainableOnly,
  ownedOnly, setOwnedOnly,
  hasFilters, onClear,
  columnOptions, visibleColumns, setVisibleColumns,
  groupBy, setGroupBy,
}: {
  search: string; setSearch: (v: string) => void;
  selectedKind: string; setSelectedKind: (v: string) => void; kinds: string[];
  selectedSize: string; setSelectedSize: (v: string) => void; sizes: string[];
  selectedFactions: Set<string>; setSelectedFactions: (v: Set<string>) => void;
  availableFactions: string[]; factionMap: Map<string, FactionSummary>;
  availabilityFilter: string; setAvailabilityFilter: (v: string) => void;
  obtainableOnly: boolean; setObtainableOnly: (v: boolean) => void;
  ownedOnly: boolean; setOwnedOnly: (v: boolean) => void;
  hasFilters: boolean; onClear: () => void;
  columnOptions: { value: string; label: string; group: string }[];
  visibleColumns: Set<string>; setVisibleColumns: (v: Set<string>) => void;
  groupBy: GroupByKey; setGroupBy: (v: GroupByKey) => void;
}) {
  return (
    <FilterBar>
      <SearchInput placeholder="Search modules…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" />
      <Select value={selectedKind} onValueChange={setSelectedKind}>
        <SelectTrigger className="w-36 h-7 text-xs"><SelectValue placeholder="All kinds" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All kinds</SelectItem>
          {kinds.map((k) => {
            const color = KIND_COLORS[k] ?? "bg-muted text-muted-foreground border-border";
            return (
              <SelectItem key={k} value={k}>
                <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border", color)}>
                  {KIND_LABELS[k] ?? k}
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      <Select value={selectedSize} onValueChange={setSelectedSize}>
        <SelectTrigger className="w-32 h-7 text-xs"><SelectValue placeholder="All sizes" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All sizes</SelectItem>
          <SelectItem value="none">None</SelectItem>
          {sizes.map((s) => (<SelectItem key={s} value={s}><SizeBadge size={moduleSizeToClassId(s)} /></SelectItem>))}
        </SelectContent>
      </Select>
      <MultiSelect
        options={[
          { value: "__none__", label: "None" },
          ...availableFactions.map((f) => {
            const fac = factionMap.get(f);
            return {
              value: f,
              label: fac?.name ?? f,
              node: fac ? (
                <FactionBadge
                  name={fac.name}
                  color_hex={fac.color_hex}
                  icon_url={fac.icon_url}
                  linked={false}
                />
              ) : undefined,
            };
          }),
        ]}
        selected={selectedFactions}
        onChange={setSelectedFactions}
        placeholder="Factions…"
        className="h-7 text-xs w-40"
        searchable
      />
      <Select value={availabilityFilter} onValueChange={setAvailabilityFilter}>
        <SelectTrigger className="w-40 h-7 text-xs"><SelectValue placeholder="All modules" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="ready">Ready to Build</SelectItem>
          <SelectItem value="purchasable">Purchasable</SelectItem>
          <SelectItem value="locked">Locked</SelectItem>
          <SelectItem value="unavailable">Unavailable</SelectItem>
        </SelectContent>
      </Select>
      <label className="flex items-center gap-2 cursor-pointer">
        <Switch id="obtainable-only" checked={obtainableOnly} onCheckedChange={setObtainableOnly} />
        <span className="text-xs text-muted-foreground whitespace-nowrap">Obtainable</span>
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <Switch id="module-owned-only" checked={ownedOnly} onCheckedChange={setOwnedOnly} />
        <span className="text-xs text-muted-foreground whitespace-nowrap">Owned</span>
      </label>
      {hasFilters && <ClearFiltersButton onClick={onClear} />}
      {/* Right: column visibility + group-by */}
      <div className="ml-auto flex items-center gap-3">
        <div className="h-5 w-px bg-border/50" />
        <MultiSelect
          options={columnOptions}
          selected={visibleColumns}
          onChange={setVisibleColumns}
          placeholder="Columns"
          className="h-7 text-xs w-36"
          hideClear
        />
        <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupByKey)}>
          <SelectTrigger className="w-24 h-7 text-xs"><SelectValue placeholder="Group by" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="kind">Kind</SelectItem>
            <SelectItem value="size">Size</SelectItem>
            <SelectItem value="dlc">DLC</SelectItem>
            <SelectItem value="makerrace">Faction</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </FilterBar>
  );
}
