import { useState } from "react";
import { Button } from "../../components/ui/button";

export default function CrashTestPage() {
  const [throwOnRender, setThrowOnRender] = useState(false);

  if (throwOnRender) {
    throw new Error("Deliberate render-phase crash (CrashTestPage)");
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-lg font-bold leading-none">Crash Test</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Dev-only page to exercise the three error-catching layers. Each button
          deliberately triggers an uncaught error/rejection.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="destructive" onClick={() => setThrowOnRender(true)}>
          Throw during render
        </Button>
        <Button
          variant="destructive"
          onClick={() => {
            throw new Error("Deliberate click-handler crash (CrashTestPage)");
          }}
        >
          Throw in click handler
        </Button>
        <Button
          variant="destructive"
          onClick={() => {
            Promise.reject(new Error("Deliberate unhandled rejection (CrashTestPage)"));
          }}
        >
          Unhandled promise rejection
        </Button>
      </div>
    </div>
  );
}
