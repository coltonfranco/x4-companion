import type { ReactNode } from "react";
import type { Station } from "../types";
import { fmtNum, pct, statusOf } from "../lib/stationFormat";

export function StatusBadge({ s }: { s: Station }) {
  const st = statusOf(s);
  return (
    <span
      className="inline-flex flex-none items-center gap-1.5 rounded-[7px] px-2.5 py-1 text-[10.5px] font-semibold tracking-[0.4px]"
      style={{ background: `${st.color}1f`, color: st.color }}
    >
      <span className="h-[7px] w-[7px] rounded-full" style={{ background: st.color }} />
      {st.label}
    </span>
  );
}

/** A 2-up stat tile used in the card KPI grid. */
export function MiniStat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bg-[#0b1120] px-3 py-2.5">
      <div className="font-mono text-[9.5px] tracking-[0.5px] text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-[14px] font-semibold text-[#cdd5e3]">{children}</div>
    </div>
  );
}

export function WorkforceValue({ s }: { s: Station }) {
  if (s.workforce_current == null) return <span className="text-muted-foreground">—</span>;
  const p = pct(s.workforce_current, s.workforce_capacity);
  return (
    <span>
      {fmtNum(s.workforce_current)}
      {p != null && <span className="text-muted-foreground">{` · ${p}%`}</span>}
    </span>
  );
}

export function DetailStat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-[10px] border border-white/8 bg-white/[0.02] px-3 py-3">
      <div className="font-mono text-[9.5px] tracking-[0.5px] text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-[16px] font-semibold text-[#cdd5e3]">{children}</div>
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="mb-2.5 font-mono text-[11px] tracking-[1.5px] text-muted-foreground">▸ {children}</div>;
}
