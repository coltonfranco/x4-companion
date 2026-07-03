import { reportGlobalError } from "./globalErrorStore";

let installed = false;

/** Catches errors no React error boundary can see: exceptions thrown in event handlers or
 *  timers, and unhandled promise rejections. Idempotent — safe to call more than once. */
export function installGlobalErrorHandlers(): void {
  if (installed) return;
  installed = true;

  // Without {capture: true}, resource-load errors (broken <img>, already handled locally by
  // ShipImage/EntityIcon's own onError fallbacks) don't bubble to window — only genuine
  // uncaught JS exceptions reach this listener.
  window.addEventListener("error", (event) => {
    reportGlobalError({ error: event.error ?? event.message, source: "window.onerror" });
  });

  window.addEventListener("unhandledrejection", (event) => {
    reportGlobalError({ error: event.reason, source: "unhandledrejection" });
  });
}
