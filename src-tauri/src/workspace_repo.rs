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
    #[serde(default)]
    node_positions: HashMap<String, CanvasPoint>,
    #[serde(default)]
    edge_anchors: HashMap<String, EdgeAnchor>,
    #[serde(default)]
    collapsed_node_ids: Vec<String>,
    undo_stack: Vec<DocumentState>,
    redo_stack: Vec<DocumentState>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DocumentState {
    root_id: String,
    cursor_id: String,
    nodes: HashMap<String, Node>,
    #[serde(default)]
    node_positions: HashMap<String, CanvasPoint>,
    #[serde(default)]
    edge_anchors: HashMap<String, EdgeAnchor>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct CanvasPoint {
    x: f64,
    y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
enum AnchorSide {
    Top,
    Right,
    Bottom,
    Left,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct EdgeAnchor {
    from: Option<AnchorSide>,
    to: Option<AnchorSide>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Node {
    id: String,
    text: String,
    #[serde(default)]
    note: Option<String>,
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

#[cfg(test)]
mod tests {
    use super::{AnchorSide, CanvasPoint, DocumentState, EdgeAnchor, Workspace};

    const LEGACY_WORKSPACE: &str = r#"{
      "tabs": [{"docId": "doc-1"}],
      "activeDocId": "doc-1",
      "documents": {
        "doc-1": {
          "id": "doc-1",
          "rootId": "root",
          "cursorId": "root",
          "nodes": {
            "root": {
              "id": "root",
              "text": "Root",
              "parentId": null,
              "childrenIds": [],
              "color": null
            }
          },
          "undoStack": [],
          "redoStack": []
        }
      }
    }"#;

    #[test]
    fn legacy_workspace_defaults_collapsed_nodes_note_and_edge_anchors() {
        let workspace: Workspace = serde_json::from_str(LEGACY_WORKSPACE).unwrap();
        let document = workspace.documents.get("doc-1").unwrap();
        let root = document.nodes.get("root").unwrap();

        assert!(document.collapsed_node_ids.is_empty());
        assert!(document.node_positions.is_empty());
        assert!(document.edge_anchors.is_empty());
        assert_eq!(root.note, None);
    }

    #[test]
    fn workspace_round_trip_preserves_positions_collapsed_nodes_note_and_edge_anchors() {
        let mut workspace: Workspace = serde_json::from_str(LEGACY_WORKSPACE).unwrap();
        let document = workspace.documents.get_mut("doc-1").unwrap();
        document.collapsed_node_ids.push("root".to_string());
        document
            .node_positions
            .insert("root".to_string(), CanvasPoint { x: -12.5, y: 44.0 });
        document.edge_anchors.insert(
            "root->child".to_string(),
            EdgeAnchor {
                from: Some(AnchorSide::Right),
                to: Some(AnchorSide::Left),
            },
        );
        document.nodes.get_mut("root").unwrap().note = Some("memo".to_string());
        document.undo_stack.push(DocumentState {
            root_id: document.root_id.clone(),
            cursor_id: document.cursor_id.clone(),
            nodes: document.nodes.clone(),
            node_positions: document.node_positions.clone(),
            edge_anchors: document.edge_anchors.clone(),
        });

        let json = serde_json::to_string(&workspace).unwrap();
        let restored: Workspace = serde_json::from_str(&json).unwrap();
        let restored_document = restored.documents.get("doc-1").unwrap();

        assert_eq!(restored_document.collapsed_node_ids, vec!["root"]);
        assert_eq!(
            restored_document.node_positions.get("root"),
            Some(&CanvasPoint { x: -12.5, y: 44.0 })
        );
        assert_eq!(
            restored_document.undo_stack[0].node_positions.get("root"),
            Some(&CanvasPoint { x: -12.5, y: 44.0 })
        );
        assert_eq!(
            restored_document.edge_anchors.get("root->child"),
            Some(&EdgeAnchor {
                from: Some(AnchorSide::Right),
                to: Some(AnchorSide::Left),
            })
        );
        assert_eq!(
            restored_document.undo_stack[0].edge_anchors.get("root->child"),
            Some(&EdgeAnchor {
                from: Some(AnchorSide::Right),
                to: Some(AnchorSide::Left),
            })
        );
        assert_eq!(
            restored_document.nodes.get("root").unwrap().note.as_deref(),
            Some("memo")
        );
    }
}
