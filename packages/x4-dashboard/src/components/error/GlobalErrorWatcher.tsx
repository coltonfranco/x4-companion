import { useSyncExternalStore, type ReactNode } from "react";
import { clearGlobalError, getGlobalErrorSnapshot, subscribeGlobalError } from "../../lib/globalErrorStore";
import { ErrorFallback } from "./ErrorFallback";

/** Renders the shared crash screen in place of the whole app when an error escapes to
 *  `window` (event handler / async / unhandled rejection) — no React boundary sees these.
 *  "Try Again" dismisses and re-renders the real tree. "Go Home" uses a hard location
 *  reset — useNavigate / router.navigate can both fail when the router context is gone
 *  or the router itself is in an error state. */
export function GlobalErrorWatcher({ children }: { children: ReactNode }) {
  const record = useSyncExternalStore(subscribeGlobalError, getGlobalErrorSnapshot);

  if (record) {
    return (
      <ErrorFallback
        error={record.error}
        onRetry={clearGlobalError}
      />
    );
  }
  return <>{children}</>;
}
