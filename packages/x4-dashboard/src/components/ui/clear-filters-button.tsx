import type { ButtonHTMLAttributes } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

export function ClearFiltersButton({
  className,
  children = "Clear filters",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "text-[11px] font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-2 py-1.5 rounded-[4px] bg-muted/30 hover:bg-muted/50 transition-colors shrink-0",
        className
      )}
      {...props}
    >
      <X className="w-3.5 h-3.5" />
      {children}
    </button>
  );
}
