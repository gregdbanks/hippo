use crate::util::discover::{get_memories as do_get_memories, MemoryInfo};
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

#[tauri::command]
pub fn get_memories(slug: String) -> Result<Vec<MemoryInfo>, String> {
    Ok(do_get_memories(&slug))
}

#[tauri::command]
pub fn create_memory(input: CreateMemoryInput) -> Result<CreateMemoryResult, String> {
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
    let memory_dir = projects_dir().join(&slug).join("memory");
    if !memory_dir.exists() {
        return Err("Memory directory not found".to_string());
    }
    sync_memory_index_internal(&memory_dir)
}

fn sync_memory_index_internal(memory_dir: &std::path::Path) -> Result<SyncIndexResult, String> {
    let index_path = memory_dir.join("MEMORY.md");

    // Read existing index to preserve the header
    let existing = fs::read_to_string(&index_path).unwrap_or_default();
    let header = existing
        .lines()
        .take_while(|l| !l.starts_with("- ["))
        .collect::<Vec<_>>()
        .join("\n");

    // Scan all memory files and build index entries
    let entries: Vec<String> = match fs::read_dir(memory_dir) {
        Ok(dir) => dir
            .flatten()
            .filter(|e| {
                let name = e.file_name().to_string_lossy().to_string();
                name.ends_with(".md") && name != "MEMORY.md"
            })
            .filter_map(|e| {
                let content = fs::read_to_string(e.path()).ok()?;
                let parsed = crate::util::frontmatter::parse_frontmatter(&content);
                let name = parsed.frontmatter.get("name").cloned().unwrap_or_else(|| {
                    e.file_name()
                        .to_string_lossy()
                        .trim_end_matches(".md")
                        .to_string()
                });
                let description = parsed
                    .frontmatter
                    .get("description")
                    .cloned()
                    .unwrap_or_else(|| "No description".to_string());
                let filename = e.file_name().to_string_lossy().to_string();
                Some(format!("- [{}]({}) — {}", name, filename, description))
            })
            .collect(),
        Err(e) => return Err(format!("Cannot read memory directory: {}", e)),
    };

    let entry_count = entries.len();
    let header_trimmed = header.trim_end();
    let index_content = if header_trimmed.is_empty() {
        format!("# Memory Index\n\n{}\n", entries.join("\n"))
    } else {
        format!("{}\n{}\n", header_trimmed, entries.join("\n"))
    };

    fs::write(&index_path, index_content)
        .map_err(|e| format!("Failed to write MEMORY.md: {}", e))?;

    Ok(SyncIndexResult {
        synced: true,
        entries: entry_count,
    })
}
