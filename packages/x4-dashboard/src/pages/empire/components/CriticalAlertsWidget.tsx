import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { AlertTriangle, Hexagon, Target, Flag } from "lucide-react";
import { HUDCard } from "../../../components/layout/HUDCard";
import { useSettings } from "../../../lib/settingsStore";
import { useSaveTime } from "../../../lib/useSaveTime";
import { formatTimeAgo, cleanText } from "../../../lib/formatters";
import { apiGet } from "../../../lib/api";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../components/ui/tooltip";

const ALERT_CATEGORIES: Record<string, { icon: any; borderClass: string; iconClass: string }> = {
  combat: { icon: AlertTriangle, borderClass: "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]", iconClass: "text-red-500" },
  general: { icon: AlertTriangle, borderClass: "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]", iconClass: "text-red-500" },
  news: { icon: AlertTriangle, borderClass: "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]", iconClass: "text-red-500" },
  economy: { icon: Hexagon, borderClass: "bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.5)]", iconClass: "text-orange-500" },
  upkeep: { icon: Hexagon, borderClass: "bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.5)]", iconClass: "text-orange-500" },
  reputation: { icon: Target, borderClass: "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]", iconClass: "text-emerald-500" },
  alerts: { icon: Flag, borderClass: "bg-pink-500 shadow-[0_0_12px_rgba(236,72,153,0.5)]", iconClass: "text-pink-500" },
  default: { icon: AlertTriangle, borderClass: "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]", iconClass: "text-red-500" }
};

export function CriticalAlertsWidget() {
  const { settings } = useSettings();
  const currentTime = useSaveTime();
  const minTime = currentTime > 0 ? currentTime - 3600 : undefined;

  const { data } = useQuery<{ entries: { id: number; title: string; text: string; category: string; subcategory: string; faction: string | null; faction_name: string | null; faction_color: string | null; time: number; extra_json: string | null }[] }>({
    // Namespaced under "logbook" (not its own polling key) so the shared background-refresh
    // watcher invalidates this alongside the rest of the logbook when new entries actually
    // arrive, instead of this widget re-checking on its own timer regardless of a real change.
    queryKey: ["logbook", "critical-alerts", minTime],
    queryFn: () => {
      const p = new URLSearchParams();
      if (minTime != null) p.set("min_time", String(minTime));
      p.set("limit", "200");
      return apiGet(`/api/v1/logbook?${p}`);
    },
    enabled: currentTime > 0,
  });

  const critical = useMemo(() => {
    if (!data?.entries) return [];
    const seen = new Set<string>();
    const deduped: typeof data.entries = [];
    for (const e of data.entries) {
      const key = `${e.category}.${e.subcategory}`;
      const prio = settings.logbookPriorities[key] ?? settings.logbookPriorities["general"] ?? "normal";
      if (prio !== "critical") continue;
      const titleKey = `${e.title}-${e.text}`.toLowerCase();
      if (seen.has(titleKey)) continue;
      seen.add(titleKey);
      deduped.push(e);
    }
    return deduped.slice(0, 5);
  }, [data, settings.logbookPriorities]);

  if (!data || critical.length === 0) return null;

  return (
    <HUDCard className="w-full p-4">
      <div className="flex flex-row items-center justify-between mb-4 px-1">
        <h3 className="text-sm font-bold flex items-center gap-3 text-foreground tracking-wide">
          <div className="h-2.5 w-2.5 rounded-full bg-red-500 animate-[pulse_2s_ease-in-out_infinite] shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
          Active Alerts
          <span className="text-sm font-bold text-red-500 ml-1">
            {critical.length}
          </span>
        </h3>
        <Link to="/messages/logbook" className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium">
          View all →
        </Link>
      </div>
      <TooltipProvider delayDuration={200}>
        <div className="space-y-2">
          {critical.map((e) => {
            const catMeta = ALERT_CATEGORIES[e.category] || ALERT_CATEGORIES.default;
            const Icon = catMeta.icon;
            const body = cleanText(e.text || "");
            const extra = e.extra_json ? JSON.parse(e.extra_json) : {};
            const componentName = extra?.component_name;

            return (
              <Tooltip key={e.id}>
                <TooltipTrigger asChild>
                  <div
                    className="flex items-center gap-4 py-3 pr-4 pl-3 rounded-lg bg-[#14151a] relative overflow-hidden group border border-border/10 cursor-default"
                  >
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${catMeta.borderClass}`} />

                    <Icon className={`h-4 w-4 ml-1.5 ${catMeta.iconClass} shrink-0`} />

                    <div className="min-w-0 flex-1 flex flex-col gap-1">
                      <span className="font-semibold text-sm text-foreground truncate">{e.title}</span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono w-full">
                        {componentName ? (
                          <span className="truncate">{componentName}</span>
                        ) : e.faction_name ? (
                          <span className="truncate" style={{ color: e.faction_color ?? undefined }}>{e.faction_name}</span>
                        ) : (
                          <span className="truncate">{body || "System"}</span>
                        )}
                        <span className="opacity-50 shrink-0">·</span>
                        <span className="opacity-80 shrink-0">{formatTimeAgo(e.time, currentTime)}</span>
                      </div>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-md p-0 bg-[#04060c] text-card-foreground border border-border shadow-2xl z-50 overflow-hidden relative">
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${catMeta.borderClass}`} />
                  <div className="flex items-start gap-3 p-4 pl-5">
                    <Icon className={`h-4 w-4 mt-0.5 ${catMeta.iconClass} shrink-0`} />
                    <div className="flex flex-col gap-2">
                      <h4 className="font-semibold text-sm text-foreground">{e.title}</h4>
                      {body && (
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{body}</p>
                      )}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>
    </HUDCard>
  );
}
