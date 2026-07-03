import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";

import { AppProviders } from "./app/providers";
import { router } from "./app/router";
import { AppErrorBoundary } from "./components/error/AppErrorBoundary";
import { GlobalErrorWatcher } from "./components/error/GlobalErrorWatcher";
import { installGlobalErrorHandlers } from "./lib/globalErrorHandlers";
import "./index.css";

// Catches exceptions in event handlers/timers and unhandled promise rejections — the error
// classes no React error boundary below can see.
installGlobalErrorHandlers();

// Apply saved theme before first render to prevent flash.
const savedTheme = localStorage.getItem("theme");
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
  document.documentElement.classList.add("dark");
}

// Tauri fullscreen toggle: F11 uses the native window API so the entire window
// (chrome included) goes fullscreen, not just the webview content area.
if ("__TAURI__" in window) {
  import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
    document.addEventListener("keydown", async (e) => {
      if (e.key === "F11") {
        e.preventDefault();
        const win = getCurrentWindow();
        await win.setFullscreen(!(await win.isFullscreen()));
      }
    });
  });
}

// Explicit, reliable "unstick myself" reload — identical in plain-browser dev and the Tauri
// wrapper, rather than depending on the webview's undocumented default context-menu reload.
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r") {
    e.preventDefault();
    window.location.reload();
  }
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <GlobalErrorWatcher>
        <AppProviders>
          <RouterProvider router={router} />
        </AppProviders>
      </GlobalErrorWatcher>
    </AppErrorBoundary>
  </React.StrictMode>,
);
