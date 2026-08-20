use serde_json::Value;
use std::{
    fs,
    fs::File,
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

fn workspace_backup_path(path: &Path) -> PathBuf {
    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    parent.join(format!("workspace.json.backup-{}", timestamp_millis()))
}

fn workspace_backup_paths(path: &Path) -> Vec<PathBuf> {
    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    let Ok(entries) = fs::read_dir(parent) else {
        return Vec::new();
    };
    let prefix = "workspace.json.backup-";
    let mut paths: Vec<PathBuf> = entries
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|entry| {
            entry
                .file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.starts_with(prefix))
        })
        .collect();
    paths.sort_by(|left, right| right.cmp(left));
    paths
}

fn load_latest_backup(path: &Path) -> Result<Option<Workspace>, String> {
    for backup_path in workspace_backup_paths(path) {
        let Ok(text) = fs::read_to_string(&backup_path) else {
            continue;
        };
        if let Ok(workspace) = serde_json::from_str::<Workspace>(&text) {
            return Ok(Some(workspace));
        }
    }
    Ok(None)
}

fn prune_backups(path: &Path) {
    for backup_path in workspace_backup_paths(path).into_iter().skip(5) {
        let _ = fs::remove_file(backup_path);
    }
}

fn write_workspace_json_atomic(path: &Path, text: &str) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "workspace.json path has no parent".to_string())?;
    let tmp_path = parent.join(format!("workspace.json.tmp-{}", timestamp_millis()));
    fs::write(&tmp_path, text).map_err(|error| error.to_string())?;
    File::open(&tmp_path)
        .and_then(|file| file.sync_all())
        .map_err(|error| error.to_string())?;

    let backup_path = workspace_backup_path(path);
    if path.exists() {
        fs::rename(path, &backup_path).map_err(|error| error.to_string())?;
    }

    match fs::rename(&tmp_path, path) {
        Ok(()) => {
            prune_backups(path);
            Ok(())
        }
        Err(error) => {
            let _ = fs::remove_file(&tmp_path);
            if backup_path.exists() {
                let _ = fs::rename(&backup_path, path);
            }
            Err(error.to_string())
        }
    }
}

pub fn load_workspace_from_disk(app: &tauri::AppHandle) -> Result<Option<Workspace>, String> {
    let path = workspace_json_path(app)?;
    if !path.exists() {
        return load_latest_backup(&path);
    }
    let text = fs::read_to_string(&path).map_err(|error| error.to_string())?;
    match serde_json::from_str::<Workspace>(&text) {
        Ok(workspace) => Ok(Some(workspace)),
        Err(_) => {
            let backup_path = workspace_broken_backup_path(&path);
            let _ = fs::rename(&path, backup_path);
            load_latest_backup(&path)
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
    use super::{write_workspace_json_atomic, Workspace};
    use std::{fs, path::PathBuf, time::{SystemTime, UNIX_EPOCH}};

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

    #[test]
    fn atomic_write_keeps_a_recoverable_backup() {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let directory = std::env::temp_dir().join(format!("vikokoro-workspace-{suffix}"));
        fs::create_dir_all(&directory).unwrap();
        let path: PathBuf = directory.join("workspace.json");

        write_workspace_json_atomic(&path, "{\"revision\":1}").unwrap();
        write_workspace_json_atomic(&path, "{\"revision\":2}").unwrap();

        assert_eq!(fs::read_to_string(&path).unwrap(), "{\"revision\":2}");
        assert!(fs::read_dir(&directory)
            .unwrap()
            .filter_map(Result::ok)
            .any(|entry| entry.file_name().to_string_lossy().starts_with("workspace.json.backup-")));

        fs::remove_dir_all(directory).unwrap();
    }
}
