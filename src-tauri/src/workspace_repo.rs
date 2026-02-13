use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Workspace {
    tabs: Vec<TabRef>,
    active_doc_id: String,
    documents: HashMap<String, Document>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TabRef {
    doc_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Document {
    id: String,
    root_id: String,
    cursor_id: String,
    nodes: HashMap<String, Node>,
    undo_stack: Vec<DocumentState>,
    redo_stack: Vec<DocumentState>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DocumentState {
    root_id: String,
    cursor_id: String,
    nodes: HashMap<String, Node>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Node {
    id: String,
    text: String,
    parent_id: Option<String>,
    children_ids: Vec<String>,
    color: Option<String>,
}

fn workspace_json_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let path = app
        .path()
        .resolve("workspace.json", tauri::path::BaseDirectory::AppData)
        .map_err(|e| e.to_string())?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    Ok(path)
}

fn workspace_broken_backup_path(path: &Path) -> PathBuf {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();

    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    parent.join(format!("workspace.json.broken-{millis}"))
}

fn write_workspace_json_atomic(path: &Path, text: &str) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "workspace.json path has no parent".to_string())?;

    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let tmp_path = parent.join(format!("workspace.json.tmp-{millis}"));

    fs::write(&tmp_path, text).map_err(|e| e.to_string())?;
    match fs::rename(&tmp_path, path) {
        Ok(()) => Ok(()),
        Err(_) => {
            if path.exists() {
                let _ = fs::remove_file(path);
            }
            fs::rename(&tmp_path, path).map_err(|e| e.to_string())?;
            Ok(())
        }
    }
}

pub fn load_workspace_from_disk(app: &tauri::AppHandle) -> Result<Option<Workspace>, String> {
    let path = workspace_json_path(app)?;
    if !path.exists() {
        return Ok(None);
    }
    let text = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    match serde_json::from_str::<Workspace>(&text) {
        Ok(workspace) => Ok(Some(workspace)),
        Err(_) => {
            let backup_path = workspace_broken_backup_path(&path);
            let _ = fs::rename(&path, &backup_path);
            Ok(None)
        }
    }
}

pub fn save_workspace_to_disk(app: &tauri::AppHandle, workspace: Workspace) -> Result<(), String> {
    let path = workspace_json_path(app)?;
    let text = serde_json::to_string_pretty(&workspace).map_err(|e| e.to_string())?;
    write_workspace_json_atomic(&path, &format!("{text}\n"))?;
    Ok(())
}
