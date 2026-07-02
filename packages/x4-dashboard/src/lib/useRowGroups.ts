import { useMemo, type ReactNode } from "react";
import type { RowGroup } from "../components/data-display/DataTable";

/**
 * Bucket `rows` by `keyFn`, sort the bucket keys (default: `localeCompare`,
 * override with `sortFn` for a fixed order like ship class XS→XL), and shape
 * the buckets into `RowGroup<T>[]` for `<DataTable rowGroups={...} />` — the
 * shared core behind every page's groupBy dropdown.
 *
 * Returns `undefined` when `enabled` is false so callers can pass it straight
 * through to `DataTable`'s `rowGroups` prop, which falls back to flat `rows`.
 *
 * `keyFn`/`labelFn`/`sortFn` usually close over page state (e.g. `groupBy`,
 * a faction map) — wrap them in `useCallback` at the call site so this hook's
 * memo only recomputes when something that actually changes the grouping did.
 */
export function useRowGroups<T>(
  rows: T[],
  enabled: boolean,
  keyFn: (row: T) => string,
  labelFn: (groupKey: string, groupRows: T[]) => ReactNode,
  sortFn?: (a: string, b: string) => number
): RowGroup<T>[] | undefined {
  return useMemo(() => {
    if (!enabled) return undefined;
    const groups = new Map<string, T[]>();
    for (const row of rows) {
      const key = keyFn(row);
      const bucket = groups.get(key);
      if (bucket) bucket.push(row);
      else groups.set(key, [row]);
    }
    const orderedKeys = [...groups.keys()].sort(sortFn ?? ((a, b) => a.localeCompare(b)));
    return orderedKeys.map((key) => {
      const groupRows = groups.get(key)!;
      return { key, label: labelFn(key, groupRows), rows: groupRows };
    });
  }, [rows, enabled, keyFn, labelFn, sortFn]);
}
