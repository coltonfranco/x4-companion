import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { ClearFiltersButton } from "../../../components/ui/clear-filters-button";
import { FactionCombobox } from "../../../components/game/FactionCombobox";
import { EquipmentMkBadge } from "../../../components/game/ShipBadges";
import { Switch } from "../../../components/ui/switch";

export interface SortOption {
  id: string;
  label: string;
  desc?: boolean;
  eval?: (item: any) => any;
}

export interface EquipmentFilterBarProps {
  categoryKind: string;
  
  availableFactions: string[];
  factions: any[]; 
  factionFilter: string;
  setFactionFilter: (val: string) => void;
  
  availableMks: number[];
  mkFilter: string;
  setMkFilter: (val: string) => void;
  
  availableTypes: string[];
  typeFilter: string;
  setTypeFilter: (val: string) => void;

  showObtainableOnly?: boolean;
  obtainableOnly?: boolean;
  setObtainableOnly?: (val: boolean) => void;

  showSort?: boolean;
  sortFilter?: string;
  setSortFilter?: (val: string) => void;
  sortOptions?: SortOption[];
  baseSorts?: SortOption[];
  defaultSortId?: string;
}

export function EquipmentFilterBar({
  categoryKind,
  availableFactions, factions, factionFilter, setFactionFilter,
  availableMks, mkFilter, setMkFilter,
  availableTypes, typeFilter, setTypeFilter,
  showObtainableOnly, obtainableOnly, setObtainableOnly,
  showSort, sortFilter, setSortFilter, sortOptions, baseSorts, defaultSortId
}: EquipmentFilterBarProps) {
  const hasFilters = factionFilter !== "all" || mkFilter !== "all" || typeFilter !== "all" || (showSort && sortFilter !== "") || (showObtainableOnly && !obtainableOnly);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {showSort && setSortFilter && sortOptions && baseSorts && (
        <Select value={sortFilter || defaultSortId} onValueChange={setSortFilter}>
          <SelectTrigger className="w-[180px] h-7 text-xs rounded-[4px]">
            <div className="flex items-center gap-1.5 text-muted-foreground truncate">
              <span>Order by:</span>
              <span className="text-foreground font-medium truncate"><SelectValue /></span>
            </div>
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
            ))}
            {baseSorts.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {["weapon", "turret"].includes(categoryKind) && (
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px] h-7 text-xs rounded-[4px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {availableTypes.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select value={mkFilter} onValueChange={setMkFilter}>
        <SelectTrigger className="w-[120px] h-7 text-xs rounded-[4px]">
          <SelectValue placeholder="All Mks" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Mks</SelectItem>
          {availableMks.map(mk => (
            <SelectItem key={mk} value={mk.toString()}>
              <div className="flex items-center py-0.5"><EquipmentMkBadge mk={mk} className="px-1.5 py-0 rounded-[4px] text-xs" /></div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <FactionCombobox
        factions={factions.filter(f => availableFactions.includes(f.faction_id))}
        value={factionFilter}
        onChange={setFactionFilter}
        className="w-[180px]"
        disabled={availableFactions.length === 0}
      />

      {showObtainableOnly && setObtainableOnly && (
        <label className="flex items-center gap-2 cursor-pointer">
          <Switch id="equipment-obtainable-only" checked={!!obtainableOnly} onCheckedChange={setObtainableOnly} />
          <span className="text-xs text-muted-foreground whitespace-nowrap">Obtainable</span>
        </label>
      )}
      
      {hasFilters && (
        <ClearFiltersButton
          onClick={() => { 
            setFactionFilter("all"); setMkFilter("all"); setTypeFilter("all"); 
            if (setSortFilter) setSortFilter(""); 
            if (setObtainableOnly) setObtainableOnly(true);
          }}
        />
      )}
    </div>
  );
}
