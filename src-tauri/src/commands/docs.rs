use crate::util::tokens::estimate_tokens;
use serde::Serialize;
use std::fs;
use std::path::PathBuf;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocInfo {
    pub filename: String,
    pub path: String,
    pub size_bytes: u64,
    pub tokens: usize,
    pub modified: String,
}

fn get_docs_dir() -> PathBuf {
    // In dev, look for the repo root via Cargo manifest dir
    // In production, use a bundled resources dir or ~/.claude/docs
    let cargo_dir = std::env::var("CARGO_MANIFEST_DIR")
        .map(|d| PathBuf::from(d).parent().unwrap_or(&PathBuf::from(".")).to_path_buf());

    if let Ok(dir) = cargo_dir {
        if dir.join("CLI_TOOLS.md").exists() {
            return dir;
        }
    }

    // Fallback: check for docs in the app's resource directory
    // or the current executable's parent
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            // In macOS .app bundle: Contents/MacOS/../Resources
            let resources = parent.join("../Resources");
            if resources.exists() {
                return resources;
            }
            return parent.to_path_buf();
        }
    }

    PathBuf::from(".")
}

#[tauri::command]
pub fn list_docs() -> Result<Vec<DocInfo>, String> {
    let dir = get_docs_dir();
    let entries =
        fs::read_dir(&dir).map_err(|e| format!("Failed to read docs dir: {}", e))?;

    let mut docs: Vec<DocInfo> = entries
        .flatten()
        .filter(|e| e.file_name().to_string_lossy().ends_with(".md"))
        .filter_map(|e| {
            let path = e.path();
            let content = fs::read_to_string(&path).ok()?;
            let meta = fs::metadata(&path).ok()?;
            let modified = meta.modified().ok().map(|t| {
                let dt: chrono::DateTime<chrono::Utc> = t.into();
                dt.to_rfc3339()
            })?;

            Some(DocInfo {
                filename: e.file_name().to_string_lossy().to_string(),
                path: path.to_string_lossy().to_string(),
                size_bytes: meta.len(),
                tokens: estimate_tokens(&content),
                modified,
            })
        })
        .collect();

    docs.sort_by(|a, b| a.filename.cmp(&b.filename));
    Ok(docs)
}
