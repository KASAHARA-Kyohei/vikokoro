mod llm_repo;
mod workspace_repo;

use llm_repo::{
    llm_generate as llm_generate_impl, llm_improve as llm_improve_impl, llm_review as llm_review_impl,
    load_llm_settings_from_disk, save_llm_settings_to_disk, test_llm_connection as test_llm_connection_impl,
    LlmConnectionTestResult, LlmSchemaRequestInput, LlmSettings, SaveLlmSettingsInput,
    TestLlmConnectionInput,
};
use workspace_repo::{load_workspace_from_disk, save_workspace_to_disk, Workspace};

#[tauri::command]
fn load_workspace(app: tauri::AppHandle) -> Result<Option<Workspace>, String> {
    load_workspace_from_disk(&app)
}

#[tauri::command]
fn save_workspace(app: tauri::AppHandle, workspace: Workspace) -> Result<(), String> {
    save_workspace_to_disk(&app, workspace)
}

#[tauri::command]
fn load_llm_settings(app: tauri::AppHandle) -> Result<LlmSettings, String> {
    load_llm_settings_from_disk(&app)
}

#[tauri::command]
fn save_llm_settings(
    app: tauri::AppHandle,
    settings: SaveLlmSettingsInput,
) -> Result<LlmSettings, String> {
    save_llm_settings_to_disk(&app, settings)
}

#[tauri::command]
async fn test_llm_connection(
    app: tauri::AppHandle,
    request: TestLlmConnectionInput,
) -> Result<LlmConnectionTestResult, String> {
    test_llm_connection_impl(&app, request).await
}

#[tauri::command]
async fn llm_generate(
    app: tauri::AppHandle,
    request: LlmSchemaRequestInput,
) -> Result<serde_json::Value, String> {
    llm_generate_impl(&app, request).await
}

#[tauri::command]
async fn llm_improve(
    app: tauri::AppHandle,
    request: LlmSchemaRequestInput,
) -> Result<serde_json::Value, String> {
    llm_improve_impl(&app, request).await
}

#[tauri::command]
async fn llm_review(
    app: tauri::AppHandle,
    request: LlmSchemaRequestInput,
) -> Result<serde_json::Value, String> {
    llm_review_impl(&app, request).await
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
        .invoke_handler(tauri::generate_handler![
            greet,
            load_workspace,
            save_workspace,
            load_llm_settings,
            save_llm_settings,
            test_llm_connection,
            llm_generate,
            llm_improve,
            llm_review
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
