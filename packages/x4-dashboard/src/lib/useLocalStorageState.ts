import { useEffect, useState } from "react";

/**
 * State synced to localStorage as JSON, tolerant of missing/corrupt storage.
 * `serialize`/`deserialize` let callers store non-JSON-native shapes (e.g. a
 * Set, or `null` meaning "remove the key" rather than "store null") without
 * the hook special-casing them. `serialize` returning `null` removes the key.
 */
export function useLocalStorageState<T>(
  key: string,
  defaultValue: T,
  options?: {
    serialize?: (value: T) => string | null;
    deserialize?: (raw: string) => T;
  },
): [T, (next: T | ((prev: T) => T)) => void] {
  const serialize = options?.serialize ?? ((v: T) => JSON.stringify(v));
  const deserialize = options?.deserialize ?? ((raw: string) => JSON.parse(raw) as T);

  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) return deserialize(raw);
    } catch {
      // ignore corrupt/inaccessible storage, fall back to default
    }
    return defaultValue;
  });

  useEffect(() => {
    try {
      const serialized = serialize(value);
      if (serialized === null) localStorage.removeItem(key);
      else localStorage.setItem(key, serialized);
    } catch {
      // ignore storage write failures (e.g. quota, private mode)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, value]);

  return [value, setValue];
}
