import { useSyncExternalStore, type ReactNode } from "react";
import { clearGlobalError, getGlobalErrorSnapshot, subscribeGlobalError } from "../../lib/globalErrorStore";
import { ErrorFallback } from "./ErrorFallback";

/** Renders the shared crash screen in place of the whole app when an error escapes to
 *  `window` (event handler / async / unhandled rejection) — no React boundary sees these.
 *  Since the error happened outside any render cycle, the app's live state is unknown, so
 *  this is a full swap rather than a scoped retry: "Try Again" just dismisses and re-renders
 *  the real tree, "Reload App" is the guaranteed-clean path. */
export function GlobalErrorWatcher({ children }: { children: ReactNode }) {
  const record = useSyncExternalStore(subscribeGlobalError, getGlobalErrorSnapshot);

  if (record) {
    return <ErrorFallback error={record.error} onRetry={clearGlobalError} />;
  }
  return <>{children}</>;
}
