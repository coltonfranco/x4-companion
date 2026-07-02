import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";

import { AppProviders } from "./app/providers";
import { router } from "./app/router";
import "./index.css";

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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </React.StrictMode>,
);
