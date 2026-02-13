mod workspace_repo;

use workspace_repo::{load_workspace_from_disk, save_workspace_to_disk, Workspace};

#[tauri::command]
fn load_workspace(app: tauri::AppHandle) -> Result<Option<Workspace>, String> {
    load_workspace_from_disk(&app)
}

#[tauri::command]
fn save_workspace(app: tauri::AppHandle, workspace: Workspace) -> Result<(), String> {
    save_workspace_to_disk(&app, workspace)
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, load_workspace, save_workspace])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
