import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { SetupGate } from "../components/setup/SetupGate";
import { TooltipProvider } from "../components/ui/tooltip";
import { SettingsProvider } from "../lib/settingsStore";
import { BackgroundRefresh } from "../lib/useBackgroundRefresh";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: true },
  },
});

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <TooltipProvider>
          <SetupGate>
            <BackgroundRefresh />
            {children}
          </SetupGate>
        </TooltipProvider>
      </SettingsProvider>
    </QueryClientProvider>
  );
}
