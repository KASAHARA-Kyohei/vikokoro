use serde_json::Value;
use std::{
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::Manager;

pub type Workspace = Value;

fn workspace_json_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let path = app
        .path()
        .resolve("workspace.json", tauri::path::BaseDirectory::AppData)
        .map_err(|error| error.to_string())?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    Ok(path)
}

fn timestamp_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

fn workspace_broken_backup_path(path: &Path) -> PathBuf {
    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    parent.join(format!("workspace.json.broken-{}", timestamp_millis()))
}

fn write_workspace_json_atomic(path: &Path, text: &str) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "workspace.json path has no parent".to_string())?;
    let tmp_path = parent.join(format!("workspace.json.tmp-{}", timestamp_millis()));
    fs::write(&tmp_path, text).map_err(|error| error.to_string())?;
    match fs::rename(&tmp_path, path) {
        Ok(()) => Ok(()),
        Err(_) if path.exists() => {
            fs::remove_file(path).map_err(|error| error.to_string())?;
            fs::rename(&tmp_path, path).map_err(|error| error.to_string())
        }
        Err(error) => Err(error.to_string()),
    }
}

pub fn load_workspace_from_disk(app: &tauri::AppHandle) -> Result<Option<Workspace>, String> {
    let path = workspace_json_path(app)?;
    if !path.exists() {
        return Ok(None);
    }
    let text = fs::read_to_string(&path).map_err(|error| error.to_string())?;
    match serde_json::from_str::<Workspace>(&text) {
        Ok(workspace) => Ok(Some(workspace)),
        Err(_) => {
            let backup_path = workspace_broken_backup_path(&path);
            let _ = fs::rename(&path, backup_path);
            Ok(None)
        }
    }
}

pub fn save_workspace_to_disk(app: &tauri::AppHandle, workspace: Workspace) -> Result<(), String> {
    let path = workspace_json_path(app)?;
    let text = serde_json::to_string_pretty(&workspace).map_err(|error| error.to_string())?;
    write_workspace_json_atomic(&path, &format!("{text}\n"))
}

#[cfg(test)]
mod tests {
    use super::Workspace;

    #[test]
    fn generic_workspace_keeps_future_canvas_fields() {
        let source = r#"{"schemaVersion":2,"documents":{"doc":{"groups":{"g":{"title":"ideas"}},"viewport":{"zoom":1.25}}}}"#;
        let workspace: Workspace = serde_json::from_str(source).unwrap();
        let encoded = serde_json::to_string(&workspace).unwrap();
        let round_trip: Workspace = serde_json::from_str(&encoded).unwrap();
        assert_eq!(round_trip["schemaVersion"], 2);
        assert_eq!(round_trip["documents"]["doc"]["groups"]["g"]["title"], "ideas");
        assert_eq!(round_trip["documents"]["doc"]["viewport"]["zoom"], 1.25);
    }
}
