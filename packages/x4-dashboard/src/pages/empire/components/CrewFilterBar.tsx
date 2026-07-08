import { FilterBar } from "../../../components/layout/FilterBar";
import { ClearFiltersButton } from "../../../components/ui/clear-filters-button";
import { SearchInput } from "../../../components/ui/search-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { MultiSelect } from "../../../components/ui/multi-select";
import { cn } from "../../../lib/utils";
import { ALL_COLUMNS, COLUMN_GROUPS, GROUP_BY_OPTIONS, ROLE_META, type GroupByKey } from "../lib/crewColumns";

export function CrewFilterBar({
  search,
  setSearch,
  roleFilter,
  setRoleFilter,
  groupBy,
  setGroupBy,
  visibleColumns,
  setVisibleColumns,
}: {
  search: string;
  setSearch: (v: string) => void;
  roleFilter: string;
  setRoleFilter: (v: string) => void;
  groupBy: GroupByKey;
  setGroupBy: (v: GroupByKey) => void;
  visibleColumns: Set<string>;
  setVisibleColumns: (v: Set<string>) => void;
}) {
  return (
    <FilterBar>
      <SearchInput
        placeholder="Search by name or code…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        containerClassName="flex-1 min-w-[200px] max-w-sm"
      />
      <div className="flex items-center gap-2 ml-4 shrink-0">
        <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
          Role
        </span>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[140px] h-7 text-xs rounded-[4px]">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <span className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold border bg-muted text-muted-foreground border-border">
                All Roles
              </span>
            </SelectItem>
            {Object.entries(ROLE_META).map(([key, meta]) => (
              <SelectItem key={key} value={key}>
                <span className={cn("px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold border", meta.color)}>
                  {meta.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {(search !== "" || roleFilter !== "all" || groupBy !== "none") && (
        <ClearFiltersButton
          onClick={() => {
            setSearch("");
            setRoleFilter("all");
            setGroupBy("none");
          }}
          className="ml-2"
        />
      )}

      <div className="ml-auto flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            Group By
          </span>
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupByKey)}>
            <SelectTrigger className="w-[140px] h-7 text-xs rounded-[4px]">
              <SelectValue placeholder="No Grouping" />
            </SelectTrigger>
            <SelectContent>
              {GROUP_BY_OPTIONS.map((opt) => (
                <SelectItem key={opt.key} value={opt.key}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <MultiSelect
          options={ALL_COLUMNS.map((c) => ({
            value: c.key,
            label: c.label,
            group: COLUMN_GROUPS.find((g) => g.id === c.groupId)?.label || c.groupId,
          }))}
          selected={visibleColumns}
          onChange={setVisibleColumns}
        />
      </div>
    </FilterBar>
  );
}
