import type { ErrorComponentProps } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { ErrorFallback } from "./ErrorFallback";

/** Adapts TanStack Router's per-route error contract onto the shared fallback UI. `reset()`
 *  re-attempts rendering the failed route without a full page reload. The router is mounted
 *  here (unlike the other two error layers, which replace it entirely), so "Go Home" can be a
 *  soft client-side navigation instead of the shared default's hard `location.href` reset —
 *  it lands on Empire without losing the rest of the app's in-memory state. */
export function RouteErrorFallback({ error, info, reset }: ErrorComponentProps) {
  const navigate = useNavigate();
  return (
    <ErrorFallback
      error={error}
      componentStack={info?.componentStack}
      onRetry={reset}
      onGoHome={() => navigate({ to: "/empire" })}
    />
  );
}
