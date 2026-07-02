import { useMemo, useState } from "react";

export type SortDir = "asc" | "desc";

/** Generic click-to-sort over a row set. `accessors` maps a column key to a value
 *  getter; nulls always sort last regardless of direction. `comparators` lets a
 *  column opt out of the generic accessor comparison entirely (e.g. a custom
 *  rank mapping, or a multi-level tiebreak whose sub-comparisons don't all
 *  flip with `dir` the same way) — it's handed the live sort direction so it
 *  can apply it selectively. */
export function useSort<T>(
  rows: T[],
  accessors: Record<string, (row: T) => number | string | null>,
  initial: { key: string; dir: SortDir },
  comparators?: Record<string, (a: T, b: T, dir: SortDir) => number>
) {
  const [key, setKey] = useState(initial.key);
  const [dir, setDir] = useState<SortDir>(initial.dir);

  const sorted = useMemo(() => {
    const customCmp = comparators?.[key];
    if (customCmp) return [...rows].sort((a, b) => customCmp(a, b, dir));

    const get = accessors[key];
    if (!get) return rows;
    const mul = dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string" || typeof bv === "string")
        return String(av).localeCompare(String(bv)) * mul;
      return (av - bv) * mul;
    });
    // accessors/comparators are stable literals per page; intentionally not a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, key, dir]);

  function toggle(nextKey: string, defaultDir: SortDir = "desc") {
    if (nextKey === key) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setKey(nextKey);
      setDir(defaultDir);
    }
  }

  return { sorted, key, dir, toggle };
}
