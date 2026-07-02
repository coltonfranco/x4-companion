import { BookOpen, MessageCircle, Info, Star, Newspaper, Wrench, Shield, Ribbon, Handshake, UserCheck, Crosshair, Flame, AlertTriangle } from "lucide-react";
import { cn } from "../../../lib/utils";
import { getReputationColor } from "../../../lib/formatters";

export const CATEGORY_META: Record<string, { label: string; icon: typeof BookOpen; dotColor: string; activeClasses: string; textClass: string }> = {
  combat: { label: "Combat", icon: Crosshair, dotColor: "bg-red-500", activeClasses: "text-red-500 border-red-500/30 bg-red-500/10", textClass: "text-red-500" },
  personnel: { label: "Personnel", icon: UserCheck, dotColor: "bg-teal-500", activeClasses: "text-teal-500 border-teal-500/30 bg-teal-500/10", textClass: "text-teal-500" },
  economy: { label: "Economy", icon: Wrench, dotColor: "bg-emerald-500", activeClasses: "text-emerald-500 border-emerald-500/30 bg-emerald-500/10", textClass: "text-emerald-500" },
  reputation: { label: "Reputation", icon: Handshake, dotColor: "bg-blue-400", activeClasses: "text-blue-400 border-blue-400/30 bg-blue-400/10", textClass: "text-blue-400" },
  missions: { label: "Missions", icon: Star, dotColor: "bg-amber-500", activeClasses: "text-amber-500 border-amber-500/30 bg-amber-500/10", textClass: "text-amber-500" },
  alerts: { label: "Alerts", icon: AlertTriangle, dotColor: "bg-yellow-500", activeClasses: "text-yellow-500 border-yellow-500/30 bg-yellow-500/10", textClass: "text-yellow-500" },
  boarding: { label: "Boarding", icon: Flame, dotColor: "bg-orange-500", activeClasses: "text-orange-500 border-orange-500/30 bg-orange-500/10", textClass: "text-orange-500" },
  construction: { label: "Construction", icon: Wrench, dotColor: "bg-purple-500", activeClasses: "text-purple-500 border-purple-500/30 bg-purple-500/10", textClass: "text-purple-500" },
  looting: { label: "Looting", icon: Info, dotColor: "bg-cyan-500", activeClasses: "text-cyan-500 border-cyan-500/30 bg-cyan-500/10", textClass: "text-cyan-500" },
  hacking: { label: "Hacking", icon: Shield, dotColor: "bg-indigo-500", activeClasses: "text-indigo-500 border-indigo-500/30 bg-indigo-500/10", textClass: "text-indigo-500" },
  research: { label: "Research", icon: Star, dotColor: "bg-sky-500", activeClasses: "text-sky-500 border-sky-500/30 bg-sky-500/10", textClass: "text-sky-500" },
  rewards: { label: "Rewards", icon: Ribbon, dotColor: "bg-amber-600", activeClasses: "text-amber-600 border-amber-600/30 bg-amber-600/10", textClass: "text-amber-600" },
  news: { label: "News", icon: Newspaper, dotColor: "bg-pink-500", activeClasses: "text-pink-500 border-pink-500/30 bg-pink-500/10", textClass: "text-pink-500" },
  tips: { label: "Tips", icon: Info, dotColor: "bg-emerald-600", activeClasses: "text-emerald-600 border-emerald-600/30 bg-emerald-600/10", textClass: "text-emerald-600" },
  ventures: { label: "Ventures", icon: Star, dotColor: "bg-violet-500", activeClasses: "text-violet-500 border-violet-500/30 bg-violet-500/10", textClass: "text-violet-500" },
  other: { label: "Other", icon: MessageCircle, dotColor: "bg-slate-500", activeClasses: "text-slate-500 border-slate-500/30 bg-slate-500/10", textClass: "text-slate-500" },
};
export const DEFAULT_META = { label: "Event", icon: MessageCircle, dotColor: "bg-muted-foreground/40", activeClasses: "text-primary border-primary/30 bg-primary/10", textClass: "text-muted-foreground" };

export function CategoryIcon({ catKey, size = 14 }: { catKey: string; size?: number }) {
  const meta = CATEGORY_META[catKey] ?? DEFAULT_META;
  const Icon = meta.icon;
  return (
    <div className={cn("rounded-full flex items-center justify-center shrink-0", meta.dotColor)} style={{ width: size + 4, height: size + 4 }}>
      <Icon className="text-white" style={{ width: size - 2, height: size - 2 }} />
    </div>
  );
}

export function FormattedReputationTitle({ title }: { title: string }) {
  const match = title.match(/^(.*?)(\+|-)(\d+)$/);
  if (match) {
    const isPositive = match[2] === '+';
    return (
      <span>
        {match[1]}
        <span className={isPositive ? "text-green-500" : "text-red-500"}>
          {match[2]}{match[3]}
        </span>
      </span>
    );
  }
  return <span>{title}</span>;
}

export function FormattedReputationBody({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, i) => {
        if (line.startsWith("Current reputation:")) {
          const match = line.match(/Current reputation:\s*(-?\d+)/);
          if (match) {
            const val = parseInt(match[1], 10);
            return (
              <span key={i} className="block">
                Current reputation: <span className={getReputationColor(val)}>{val}</span>
              </span>
            );
          }
        }
        return <span key={i} className="block">{line}</span>;
      })}
    </>
  );
}

export function FormattedAssignmentBody({ title, componentName }: { title: string, componentName?: string }) {
  const cleanTitle = title.replace(/\.$/, "");
  const match = cleanTitle.match(/^Assigned (.*?) to (.*)$/i);
  if (match) {
    return (
      <div className="flex flex-col gap-0.5 mt-1.5">
        <span className="text-[13px] text-muted-foreground/80">
          Person: <span className="text-foreground">{match[1]}</span>
        </span>
        <span className="text-[13px] text-muted-foreground/80">
          Location: <span className="text-foreground">{componentName || match[2]}</span>
        </span>
      </div>
    );
  }
  return null;
}
