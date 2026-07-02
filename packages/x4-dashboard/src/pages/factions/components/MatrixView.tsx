import { useMemo } from "react";
import { getReputationScore } from "../../../lib/formatters";
import type { FactionSummary } from "../../../lib/types";
import { NoSavePlaceholder } from "./NoSavePlaceholder";

export type AllFactionRelation = {
  faction_id: string;
  other_faction_id: string;
  initial_relation: number;
};

export function MatrixView({
  factions,
  relations,
  onSelectFaction,
  hasSave,
}: {
  factions: FactionSummary[];
  relations: AllFactionRelation[];
  onSelectFaction: (id: string) => void;
  hasSave: boolean;
}) {
  if (!hasSave || relations.length === 0) {
    return <NoSavePlaceholder title="No save loaded" />;
  }
  const relMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of relations) {
      m.set(`${r.faction_id}::${r.other_faction_id}`, r.initial_relation);
    }
    return m;
  }, [relations]);

  return (
    <div className="overflow-auto h-full p-4">
      <table
        style={{
          borderCollapse: "collapse",
          fontSize: 11,
          whiteSpace: "nowrap",
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                width: 140,
                minWidth: 140,
                padding: "4px 8px",
                textAlign: "left",
                position: "sticky",
                left: 0,
                top: 0,
                background: "rgba(16, 20, 34, 0.95)",
                backdropFilter: "blur(4px)",
                zIndex: 3,
                borderBottom: "1px solid var(--border)",
                borderRight: "1px solid var(--border)",
                fontWeight: 600,
                color: "var(--muted-foreground)",
              }}
            >
              From \ To
            </th>
            {factions.map((f) => (
              <th
                key={f.faction_id}
                title={f.name}
                onClick={() => onSelectFaction(f.faction_id)}
                style={{
                  padding: "6px 0",
                  height: 140,
                  width: 44,
                  minWidth: 44,
                  maxWidth: 44,
                  color: f.color_hex ?? "var(--foreground)",
                  fontWeight: 600,
                  borderBottom: "1px solid var(--border)",
                  verticalAlign: "bottom",
                  cursor: "pointer",
                  position: "sticky",
                  top: 0,
                  background: "rgba(16, 20, 34, 0.95)",
                  backdropFilter: "blur(4px)",
                  zIndex: 2,
                }}
                className="hover:bg-muted/50"
              >
                <div className="flex flex-col items-center justify-end h-full gap-2 pb-1">
                  <span
                    style={{
                      writingMode: "vertical-lr",
                      transform: "rotate(180deg)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxHeight: "100px",
                    }}
                  >
                    {f.name}
                  </span>
                  {f.icon_url && (
                    <div style={{
                      width: '18px', height: '18px', flexShrink: 0,
                      backgroundColor: f.color_hex ?? 'var(--foreground)',
                      WebkitMaskImage: `url(${f.icon_url})`,
                      WebkitMaskSize: 'contain', WebkitMaskRepeat: 'no-repeat', WebkitMaskPosition: 'center',
                    }} />
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {factions.map((from) => (
            <tr key={from.faction_id}>
              <td
                onClick={() => onSelectFaction(from.faction_id)}
                style={{
                  padding: "4px 8px",
                  fontWeight: 600,
                  color: from.color_hex ?? "var(--foreground)",
                  position: "sticky",
                  left: 0,
                  background: "rgba(16, 20, 34, 0.95)",
                  backdropFilter: "blur(4px)",
                  zIndex: 1,
                  borderRight: "1px solid var(--border)",
                  borderBottom: "1px solid var(--border)",
                  maxWidth: 160,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                }}
                className="hover:bg-muted/50"
              >
                <div className="flex items-center gap-2">
                  {from.icon_url && (
                    <div style={{
                      width: '18px', height: '18px', flexShrink: 0,
                      backgroundColor: from.color_hex ?? 'var(--foreground)',
                      WebkitMaskImage: `url(${from.icon_url})`,
                      WebkitMaskSize: 'contain', WebkitMaskRepeat: 'no-repeat', WebkitMaskPosition: 'center',
                    }} />
                  )}
                  <span className="truncate">{from.name}</span>
                </div>
              </td>
              {factions.map((to) => {
                if (from.faction_id === to.faction_id) {
                  return (
                    <td
                      key={to.faction_id}
                      style={{
                        padding: "6px 4px",
                        textAlign: "center",
                        background: "var(--muted)",
                        borderBottom: "1px solid var(--border)",
                        color: "var(--muted-foreground)",
                      }}
                    >
                      —
                    </td>
                  );
                }
                const rawVal = relMap.get(`${from.faction_id}::${to.faction_id}`);
                const val = rawVal != null ? getReputationScore(rawVal) : null;

                let cellClass = "bg-transparent text-muted-foreground";
                if (val != null) {
                  if (val >= 20) cellClass = "bg-emerald-600 text-white font-bold";
                  else if (val >= 10) cellClass = "bg-emerald-800/80 text-emerald-100 font-medium";
                  else if (val <= -20) cellClass = "bg-red-700 text-white font-bold";
                  else if (val <= -10) cellClass = "bg-red-900/80 text-red-100 font-medium";
                  else if (val !== 0) cellClass = "bg-muted/30 text-muted-foreground";
                }

                return (
                  <td
                    key={to.faction_id}
                    title={val != null ? `${from.name} → ${to.name}: ${val}` : undefined}
                    className={cellClass}
                    style={{
                      padding: "6px 4px",
                      textAlign: "center",
                      borderBottom: "1px solid var(--border)",
                      width: 44,
                      minWidth: 44,
                      cursor: "help",
                    }}
                  >
                    {val != null ? val.toFixed(0) : ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
