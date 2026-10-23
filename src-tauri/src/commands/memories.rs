use crate::util::memory::{get_memories as do_get_memories, MemoryInfo};
use crate::util::paths::projects_dir;
use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateMemoryInput {
    pub slug: String,
    pub filename: String,
    pub name: String,
    pub description: String,
    pub memory_type: String,
    pub body: String,
}

#[derive(Serialize)]
pub struct CreateMemoryResult {
    pub path: String,
    pub created: bool,
}

#[derive(Serialize)]
pub struct SyncIndexResult {
    pub synced: bool,
    pub entries: usize,
}

fn valid_segment(s: &str) -> bool {
    !s.is_empty() && s != ".." && s.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.') && !s.contains("..")
}

#[tauri::command]
pub fn get_memories(slug: String) -> Result<Vec<MemoryInfo>, String> {
    if !valid_segment(&slug) {
        return Err("Invalid project".to_string());
    }
    Ok(do_get_memories(&slug))
}

#[tauri::command]
pub fn create_memory(input: CreateMemoryInput) -> Result<CreateMemoryResult, String> {
    let stem = input.filename.trim_end_matches(".md");
    if !valid_segment(&input.slug) || !valid_segment(stem) {
        return Err("Use letters, numbers, dashes or underscores for the file name".to_string());
    }
    let memory_dir = projects_dir().join(&input.slug).join("memory");
    if !memory_dir.exists() {
        fs::create_dir_all(&memory_dir)
            .map_err(|e| format!("Cannot create memory directory: {}", e))?;
    }

    // Sanitize filename
    let filename = if input.filename.ends_with(".md") {
        input.filename.clone()
    } else {
        format!("{}.md", input.filename)
    };

    let file_path = memory_dir.join(&filename);
    if file_path.exists() {
        return Err(format!("Memory file '{}' already exists", filename));
    }

    // Build file with frontmatter
    let content = format!(
        "---\nname: {}\ndescription: {}\ntype: {}\n---\n\n{}",
        input.name, input.description, input.memory_type, input.body
    );

    fs::write(&file_path, &content).map_err(|e| format!("Failed to write memory: {}", e))?;

    // Auto-sync MEMORY.md index
    sync_memory_index_internal(&memory_dir)?;

    Ok(CreateMemoryResult {
        path: file_path.to_string_lossy().to_string(),
        created: true,
    })
}

#[tauri::command]
pub fn sync_memory_index(slug: String) -> Result<SyncIndexResult, String> {
    if !valid_segment(&slug) {
        return Err("Invalid project".to_string());
    }
    let memory_dir = projects_dir().join(&slug).join("memory");
    if !memory_dir.exists() {
        return Err("Memory directory not found".to_string());
    }
    sync_memory_index_internal(&memory_dir)
}

fn sync_memory_index_internal(memory_dir: &std::path::Path) -> Result<SyncIndexResult, String> {
    let index_path = memory_dir.join("MEMORY.md");
    let existing = match fs::read_to_string(&index_path) {
        Ok(text) => text,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => String::new(),
        Err(e) => return Err(format!("Couldn't read MEMORY.md, so it was left alone: {}", e)),
    };

    let mut files: Vec<std::path::PathBuf> = fs::read_dir(memory_dir)
        .map_err(|e| format!("Cannot read memory directory: {}", e))?
        .flatten()
        .map(|e| e.path())
        .filter(|p| {
            let name = p.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
            name.ends_with(".md") && name != "MEMORY.md"
        })
        .collect();
    files.sort();

    let missing: Vec<String> = files
        .iter()
        .filter_map(|path| {
            let filename = path.file_name()?.to_string_lossy().to_string();
            if existing.contains(&format!("({})", filename)) {
                return None;
            }
            let content = fs::read_to_string(path).ok()?;
            let fm = crate::util::frontmatter::parse_frontmatter(&content).frontmatter;
            let name = fm.get("name").cloned().unwrap_or_else(|| filename.trim_end_matches(".md").to_string());
            let description = fm.get("description").cloned().unwrap_or_else(|| "No description".to_string());
            Some(format!("- [{}]({}) - {}", name, filename, description))
        })
        .collect();

    if !missing.is_empty() || existing.is_empty() {
        let mut updated = if existing.is_empty() { "# Memory Index\n\n".to_string() } else { existing.clone() };
        if !updated.ends_with('\n') {
            updated.push('\n');
        }
        for line in &missing {
            updated.push_str(line);
            updated.push('\n');
        }
        fs::write(&index_path, updated).map_err(|e| format!("Failed to write MEMORY.md: {}", e))?;
    }

    Ok(SyncIndexResult {
        synced: true,
        entries: missing.len(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn memory_dir() -> (tempfile::TempDir, std::path::PathBuf) {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join("memory");
        fs::create_dir_all(&dir).unwrap();
        (tmp, dir)
    }

    #[test]
    fn sync_keeps_every_existing_line_and_appends_missing_entries() {
        let (_tmp, dir) = memory_dir();
        let curated = "# Memory Index\n\n## Active Work\n- [Known](known.md) - already listed\n\n## Rules\n- NEVER post without showing Greg first.\n";
        fs::write(dir.join("MEMORY.md"), curated).unwrap();
        fs::write(dir.join("known.md"), "---\nname: Known\ndescription: listed\n---\nx\n").unwrap();
        fs::write(dir.join("new_fact.md"), "---\nname: New fact\ndescription: not listed yet\n---\nx\n").unwrap();

        let result = sync_memory_index_internal(&dir).unwrap();
        let index = fs::read_to_string(dir.join("MEMORY.md")).unwrap();

        assert!(index.starts_with(curated));
        assert!(index.contains("[New fact](new_fact.md)"));
        assert_eq!(index.matches("known.md").count(), 1);
        assert_eq!(result.entries, 1);
    }

    #[test]
    fn sync_creates_an_index_when_missing() {
        let (_tmp, dir) = memory_dir();
        fs::write(dir.join("a.md"), "---\nname: A\ndescription: first\n---\nx\n").unwrap();
        sync_memory_index_internal(&dir).unwrap();
        let index = fs::read_to_string(dir.join("MEMORY.md")).unwrap();
        assert!(index.contains("[A](a.md)"));
    }

    #[test]
    fn rejects_names_that_could_escape_the_memory_folder() {
        assert!(valid_segment("feedback_style"));
        assert!(valid_segment("-Users-someone-code-app"));
        assert!(!valid_segment("../../x"));
        assert!(!valid_segment("a/b"));
        assert!(!valid_segment(""));
        assert!(!valid_segment(".."));
    }

    #[test]
    fn sync_refuses_to_touch_an_index_it_cannot_read() {
        let (_tmp, dir) = memory_dir();
        let curated = b"# Index\n- caf\xe9 notes\n";
        fs::write(dir.join("MEMORY.md"), curated).unwrap();
        fs::write(dir.join("a.md"), "---\nname: A\n---\nx\n").unwrap();
        assert!(sync_memory_index_internal(&dir).is_err());
        assert_eq!(fs::read(dir.join("MEMORY.md")).unwrap(), curated);
    }
}
