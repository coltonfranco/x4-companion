export type GlobalErrorRecord = { error: unknown; source: "window.onerror" | "unhandledrejection" };

let current: GlobalErrorRecord | null = null;
const listeners = new Set<() => void>();

export function reportGlobalError(record: GlobalErrorRecord): void {
  current = record;
  listeners.forEach((l) => l());
}

export function clearGlobalError(): void {
  current = null;
  listeners.forEach((l) => l());
}

export function subscribeGlobalError(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getGlobalErrorSnapshot(): GlobalErrorRecord | null {
  return current;
}
