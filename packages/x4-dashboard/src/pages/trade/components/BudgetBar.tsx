const BUDGET_FILL = (current: number, max: number): { pct: number; color: string } => {
  if (max <= 0) return { pct: 0, color: "bg-muted/30" };
  const ratio = Math.min(current / max, 1.5);
  const pct = Math.round(ratio * 100);
  if (current >= max) return { pct: Math.min(pct, 100), color: "bg-[var(--success)]/60" };
  if (ratio >= 0.5) return { pct, color: "bg-gold/50" };
  return { pct: Math.max(pct, 5), color: "bg-[var(--danger)]/50" };
};

export function BudgetBar({ current, max }: { current: number; max: number }) {
  const { pct, color } = BUDGET_FILL(current, max);
  return (
    <div className="absolute inset-x-0 bottom-0 h-1 bg-muted/20 rounded-b-sm overflow-hidden">
      <div
        className={`h-full ${color} transition-all rounded-b-sm`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
