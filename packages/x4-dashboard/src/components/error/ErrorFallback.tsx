import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { toErrorMessage } from "../../lib/utils";

export type ErrorFallbackProps = {
  title?: string;
  error: unknown;
  componentStack?: string;
  onRetry?: () => void;
  onGoHome?: () => void;
  onReload?: () => void;
};

/** Full-screen "something went wrong" recovery UI. Shared by every error-catching layer
 *  (route errors, the top-level boundary, and the window-level error/rejection watcher) so
 *  there is one recovery experience regardless of where the error originated.
 *
 *  Three escalating options: Try Again (re-render in place — only offered where that's
 *  actually possible), Go Home (navigate away from whatever route/state triggered this,
 *  since Reload App alone would just reload back into the same crash if it's route-specific),
 *  Reload App (full reset, always available). */
export function ErrorFallback({
  title = "Something went wrong",
  error,
  componentStack,
  onRetry,
  onGoHome = () => { window.location.href = "/"; },
  onReload = () => window.location.reload(),
}: ErrorFallbackProps) {
  const [showDetails, setShowDetails] = useState(false);
  const message = toErrorMessage(error);
  const stack = error instanceof Error ? error.stack : undefined;
  const details = [stack, componentStack].filter(Boolean).join("\n\n");

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <CardTitle>{title}</CardTitle>
          </div>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {details && (
            <div>
              <button
                onClick={() => setShowDetails((v) => !v)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showDetails ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                Technical details
              </button>
              {showDetails && (
                <pre className="mt-2 max-h-64 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap">
                  {details}
                </pre>
              )}
            </div>
          )}
          <div className="flex items-center gap-2">
            {onRetry && (
              <Button variant="outline" onClick={onRetry}>
                Try Again
              </Button>
            )}
            <Button variant="secondary" onClick={onGoHome}>
              Go Home
            </Button>
            <Button variant="default" onClick={onReload}>
              Reload App
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
