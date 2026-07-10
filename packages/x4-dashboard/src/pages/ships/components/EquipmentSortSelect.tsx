import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import type { SortOption } from "../lib/builderTypes";

export function EquipmentSortSelect({
  value,
  onChange,
  sortOptions,
  baseSorts,
  defaultSortId,
  className = "w-[180px] h-9 text-xs border border-border hover:border-primary/50 transition-colors focus:border-primary",
}: {
  value: string;
  onChange: (value: string) => void;
  sortOptions: SortOption[];
  baseSorts: SortOption[];
  defaultSortId: string;
  className?: string;
}) {
  return (
    <Select value={value || defaultSortId} onValueChange={onChange}>
      <SelectTrigger className={className}>
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
  );
}
