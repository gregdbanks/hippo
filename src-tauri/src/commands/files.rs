use crate::util::paths::{claude_dir, is_path_deletable, is_path_writable};
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
    if !is_path_deletable(p) {
        return Err("Path not deletable".to_string());
    }

    let filename = p
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    fs::remove_file(p).map_err(|e| format!("File not found: {}", e))?;

    // If this is a memory file, update MEMORY.md index
    if let Some(parent) = p.parent() {
        let parent_str = parent.to_string_lossy();
        if parent_str.contains("/memory") && filename != "MEMORY.md" {
            let memory_index = parent.join("MEMORY.md");
            if memory_index.exists() {
                if let Ok(index_content) = fs::read_to_string(&memory_index) {
                    let updated: String = index_content
                        .lines()
                        .filter(|line| !line.contains(&filename))
                        .collect::<Vec<_>>()
                        .join("\n");
                    let _ = fs::write(&memory_index, updated);
                }
            }
        }
    }

    Ok(FileDeleteResult { deleted: true })
}

#[tauri::command]
pub fn delete_skill(name: String) -> Result<FileDeleteResult, String> {
    // Validate the skill name — must be a simple slug, no path traversal
    if name.is_empty()
        || name.contains('/')
        || name.contains('\\')
        || name.contains("..")
        || !name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err("Invalid skill name".to_string());
    }

    let skills_dir = claude_dir().join("skills");
    let skill_dir = skills_dir.join(&name);

    // Verify the resolved path is still inside ~/.claude/skills/
    let canonical_skills = skills_dir
        .canonicalize()
        .map_err(|e| format!("Skills directory not found: {}", e))?;
    let canonical_skill = skill_dir
        .canonicalize()
        .map_err(|e| format!("Skill not found: {}", e))?;
    if !canonical_skill.starts_with(&canonical_skills) {
        return Err("Path escape detected".to_string());
    }

    if !canonical_skill.is_dir() {
        return Err("Skill path is not a directory".to_string());
    }

    fs::remove_dir_all(&canonical_skill)
        .map_err(|e| format!("Failed to delete skill: {}", e))?;

    Ok(FileDeleteResult { deleted: true })
}
