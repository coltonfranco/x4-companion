// Hide the extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Child, Command, Stdio};
use std::sync::Mutex;

use tauri::{Manager, RunEvent, WindowEvent};

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Holds the spawned API server process so we can terminate it when the window closes.
/// Without this the uvicorn process would outlive the desktop shell.
struct ServerProcess(Mutex<Option<Child>>);

/// Launch the x4-api server (FastAPI/uvicorn on 127.0.0.1:8765).
///
/// Release: run the bundled `x4c-server` PyInstaller sidecar shipped as a Tauri resource
/// (`<resource_dir>/server/x4c-server/x4c-server[.exe]`), telling it where the dashboard
/// `dist/` resource lives via `X4C_DASHBOARD_DIST` so it can serve the SPA. The webview's
/// loader page then redirects to the server, making every relative /api and /static URL
/// same-origin.  On Windows the sidecar's console window is hidden with CREATE_NO_WINDOW.
///
/// Dev: fall back to `uv run x4c serve` at the repo root so a source checkout still works
/// with live reload (no sidecar staged).
fn spawn_server(app: &tauri::AppHandle) -> Option<Child> {
    #[cfg(windows)]
    use std::os::windows::process::CommandExt;
    // env!("CARGO_MANIFEST_DIR") is packages/x4-desktop/src-tauri at compile time;
    // three levels up is the repository root.
    let repo_root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..");

    if !cfg!(debug_assertions) {
        if let Ok(resource_dir) = app.path().resource_dir() {
            let server_dir = resource_dir.join("server").join("x4c-server");
            let sidecar = server_dir.join(if cfg!(windows) {
                "x4c-server.exe"
            } else {
                "x4c-server"
            });
            let dashboard_dist = resource_dir.join("dashboard");
            if sidecar.exists() {
                let mut cmd = Command::new(sidecar);
                cmd.env("X4C_DASHBOARD_DIST", dashboard_dist);
                #[cfg(windows)]
                {
                    cmd.creation_flags(CREATE_NO_WINDOW);
                }
                return cmd.spawn().ok();
            }
        }
    }

    Command::new("uv")
        .args(["run", "x4c", "serve"])
        .current_dir(repo_root)
        .spawn()
        .ok()
}

/// Dev only: find whatever's listening on `port` and kill its whole process tree.
///
/// Vite is started by Tauri's `beforeDevCommand`, not by us — and `tauri-cli` genuinely
/// needs to own that spawn itself (it polls `devUrl` before it will even launch our Rust
/// binary, so we can't take over the spawn without deadlocking `tauri dev` at startup). But
/// on Windows this is a long-standing upstream limitation (tauri-apps/tauri#2794, #4949,
/// #10023): tauri-cli's own cleanup only kills the immediate child it spawned (`npm.cmd`, a
/// batch-file wrapper), not the `node`/`vite` grandchild actually bound to the port, so Vite
/// survives the window closing. We can't get a `Child` handle to a process we didn't spawn,
/// so instead we look up whoever owns the port via `netstat` and `taskkill /T` that PID —
/// same tree-kill approach as `kill_process_tree` below, just discovered differently.
#[cfg(windows)]
fn kill_whatever_is_on_port(port: u16) {
    use std::os::windows::process::CommandExt;
    let Ok(output) = Command::new("netstat")
        .args(["-ano"])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
    else {
        return;
    };
    let needle = format!(":{port}");
    for line in String::from_utf8_lossy(&output.stdout).lines() {
        let fields: Vec<&str> = line.split_whitespace().collect();
        let [proto, local_addr, _foreign_addr, state, pid] = fields[..] else {
            continue;
        };
        if proto != "TCP" || state != "LISTENING" || !local_addr.ends_with(&needle) {
            continue;
        }
        let _ = Command::new("taskkill")
            .args(["/F", "/T", "/PID", pid])
            .creation_flags(CREATE_NO_WINDOW)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn();
    }
}

/// Terminate the server and ALL of its descendants, without blocking the caller.
///
/// `Child::kill()` only signals the immediate child. In dev that child is `uv`, which
/// spawns `x4c` → `python`/uvicorn as grandchildren; killing `uv` alone orphans the
/// uvicorn process, which keeps holding port 8765 and serving stale code after the
/// window is closed. On Windows we therefore kill the whole tree with `taskkill /T`.
///
/// This is called from the `CloseRequested` window event on the main/event-loop thread.
/// Waiting for `taskkill` to finish walking + killing the tree (and then reaping the
/// child) used to stall that thread — and with it, the window actually closing — for
/// however long the OS took, which is where the multi-second close delay came from.
/// `taskkill.exe` keeps running to completion on its own once spawned, independent of
/// our process, so there's nothing worth waiting for here.
///
/// `stdout`/`stderr` are dropped rather than inherited: `shutdown_all` runs once from
/// `CloseRequested` and again from the `Exit` backstop, and since these kills are
/// fire-and-forget there's a benign race where the second pass's `taskkill` targets a
/// PID the first pass already reaped, printing a harmless "process not found" into
/// whatever console launched the app.
fn kill_process_tree(child: Child) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let _ = Command::new("taskkill")
            .args(["/F", "/T", "/PID", &child.id().to_string()])
            .creation_flags(CREATE_NO_WINDOW)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn();
    }
    #[cfg(not(windows))]
    {
        let mut child = child;
        let _ = child.kill();
    }
}

/// Take the stored child (if any) and kill its process tree. Idempotent: the `take()`
/// means a second call (e.g. CloseRequested then Exit) is a no-op.
fn shutdown_all(app: &tauri::AppHandle) {
    if let Some(child) = app.state::<ServerProcess>().0.lock().unwrap().take() {
        kill_process_tree(child);
    }

    // Dev builds only: Vite (spawned by tauri-cli's beforeDevCommand, not us) doesn't get
    // cleaned up by tauri-cli on Windows — see kill_whatever_is_on_port's doc comment.
    #[cfg(windows)]
    if cfg!(debug_assertions) {
        kill_whatever_is_on_port(5173);
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(ServerProcess(Mutex::new(None)))
        .setup(|app| {
            let child = spawn_server(app.handle());
            if child.is_none() {
                eprintln!(
                    "x4-desktop: failed to start the API server \
                     (bundled sidecar missing and `uv` not on PATH?)"
                );
            }
            *app.state::<ServerProcess>().0.lock().unwrap() = child;
            Ok(())
        })
        // Clicking the window's X fires CloseRequested before the app tears down — kill the
        // server(s) here so nothing survives the window closing.
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { .. } = event {
                shutdown_all(window.app_handle());
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building the X4 Nexus desktop app")
        // Backstop: also kill on the final Exit event (covers paths that don't emit a
        // window CloseRequested, e.g. a tray/quit action).
        .run(|app_handle, event| {
            if let RunEvent::Exit = event {
                shutdown_all(app_handle);
            }
        });
}
