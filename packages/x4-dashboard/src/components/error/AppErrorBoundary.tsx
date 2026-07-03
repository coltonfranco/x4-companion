import { Component, type ReactNode } from "react";
import { ErrorFallback } from "./ErrorFallback";

type Props = { children: ReactNode };
type State = { error: Error | null; componentStack?: string };

/** Top-level defense-in-depth boundary. TanStack Router's per-route error boundary only
 *  covers what's rendered inside the route tree — this catches render-phase errors thrown
 *  by anything outside it (SettingsProvider, SetupGate, BackgroundRefresh in app/providers.tsx),
 *  which render as siblings of RouterProvider and are otherwise invisible to the router.
 *  Must be a class component: componentDidCatch has no hook equivalent. */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error("[AppErrorBoundary]", error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? undefined });
  }

  private reset = () => this.setState({ error: null, componentStack: undefined });

  render() {
    if (this.state.error) {
      return (
        <ErrorFallback
          error={this.state.error}
          componentStack={this.state.componentStack}
          onRetry={this.reset}
        />
      );
    }
    return this.props.children;
  }
}
