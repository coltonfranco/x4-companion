import { Button } from "../ui/button";
import { classShort, getClassColor } from "../../lib/formatters";
import { cn } from "../../lib/utils";

type SizeFilterGroupProps = {
  values: readonly string[];
  selected: string | null;
  onChange: (value: string | null) => void;
  allLabel?: string;
  toggleSelected?: boolean;
};

export function SizeFilterGroup({
  values,
  selected,
  onChange,
  allLabel = "All",
  toggleSelected = true,
}: SizeFilterGroupProps) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange(null)}
        className={cn(
          "h-7 px-3 text-xs rounded-[4px] font-medium transition-colors",
          selected === null
            ? "bg-accent text-accent-foreground border-accent"
            : "bg-transparent text-muted-foreground hover:bg-muted/50 border-input"
        )}
      >
        {allLabel}
      </Button>
      {values.map((value) => {
        const isSelected = selected === value;
        const baseColor = getClassColor(value);
        const textColor = baseColor.split(" ").find((c) => c.startsWith("text-"));
        return (
          <Button
            key={value}
            variant="outline"
            size="sm"
            onClick={() => onChange(isSelected && toggleSelected ? null : value)}
            className={cn(
              "h-7 px-2.5 text-xs flex items-center gap-1.5 rounded-[4px] font-medium transition-colors",
              isSelected
                ? cn(baseColor)
                : "bg-transparent text-muted-foreground hover:bg-muted/50 border-input"
            )}
          >
            <div className={cn("w-1.5 h-1.5 rounded-[2px] bg-current", textColor)} />
            {classShort(value)}
          </Button>
        );
      })}
    </div>
  );
}
