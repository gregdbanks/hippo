use crate::commands::memories::sync_memory_index_internal;
use crate::util::paths::{is_path_deletable, is_path_writable};
use crate::util::tokens::estimate_tokens;
use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileReadResult {
    pub content: String,
    pub size_bytes: u64,
    pub modified: String,
    pub tokens: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileWriteResult {
    pub size_bytes: u64,
    pub tokens: usize,
}

#[derive(Serialize)]
pub struct FileDeleteResult {
    pub deleted: bool,
}

#[tauri::command]
pub fn read_file(path: String) -> Result<FileReadResult, String> {
    let p = Path::new(&path);
    let content = fs::read_to_string(p).map_err(|e| format!("File not found: {}", e))?;
    let meta = fs::metadata(p).map_err(|e| format!("Cannot stat file: {}", e))?;
    let modified = meta
        .modified()
        .map(|t| {
            let dt: chrono::DateTime<chrono::Utc> = t.into();
            dt.to_rfc3339()
        })
        .unwrap_or_default();

    Ok(FileReadResult {
        tokens: estimate_tokens(&content),
        size_bytes: meta.len(),
        modified,
        content,
    })
}

#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<FileWriteResult, String> {
    let p = Path::new(&path);
    if !is_path_writable(p) {
        return Err("Path not in writable allowlist".to_string());
    }

    if let Some(parent) = p.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("Cannot create directory: {}", e))?;
        }
    }

    let tokens = estimate_tokens(&content);
    fs::write(p, &content).map_err(|e| format!("Failed to write file: {}", e))?;
    let meta = fs::metadata(p).map_err(|e| format!("Cannot stat file: {}", e))?;

    Ok(FileWriteResult {
        size_bytes: meta.len(),
        tokens,
    })
}

#[tauri::command]
pub fn delete_file(path: String) -> Result<FileDeleteResult, String> {
    let p = Path::new(&path);
    log::info!("[delete_file] path={}, exists={}, deletable={}", path, p.exists(), is_path_deletable(p));
    if !is_path_deletable(p) {
        log::error!("[delete_file] REJECTED — path not in deletable allowlist: {}", path);
        return Err(format!("Path not deletable: {}", path));
    }

    let filename = p
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    log::info!("[delete_file] Removing file: {}", path);
    fs::remove_file(p).map_err(|e| {
        log::error!("[delete_file] Failed to remove: {} — {}", path, e);
        format!("Failed to remove file: {}", e)
    })?;
    log::info!("[delete_file] Successfully removed: {}", path);

    // If this is a memory file, resync the MEMORY.md index
    if let Some(parent) = p.parent() {
        let parent_str = parent.to_string_lossy();
        if parent_str.contains("/memory") && filename != "MEMORY.md" {
            let _ = sync_memory_index_internal(parent);
        }
    }

    Ok(FileDeleteResult { deleted: true })
}
