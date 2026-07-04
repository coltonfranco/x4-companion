import type { ErrorComponentProps } from "@tanstack/react-router";
import { ErrorFallback } from "./ErrorFallback";

/** Adapts TanStack Router's per-route error contract onto the shared fallback UI. `reset()`
 *  re-attempts rendering the failed route without a full page reload. "Go Home" uses a hard
 *  `location.href` reset — soft navigation via useNavigate() can fail when the router itself
 *  is in an error state, so we bypass it entirely. */
export function RouteErrorFallback({ error, info, reset }: ErrorComponentProps) {
  return (
    <ErrorFallback
      error={error}
      componentStack={info?.componentStack}
      onRetry={reset}
    />
  );
}
