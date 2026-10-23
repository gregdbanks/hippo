use crate::util::frontmatter::parse_frontmatter;
use crate::util::paths::projects_dir;
use crate::util::tokens::estimate_tokens;
use chrono::{DateTime, Utc};
use serde::Serialize;
use std::fs;
use std::time::SystemTime;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MemoryInfo {
    pub filename: String,
    pub path: String,
    pub exists: bool,
    pub size_bytes: u64,
    pub tokens: usize,
    pub modified: String,
    pub name: String,
    pub description: String,
    #[serde(rename = "type")]
    pub memory_type: String,
    pub staleness: String,
}

fn system_time_to_iso(st: SystemTime) -> String {
    let dt: DateTime<Utc> = st.into();
    dt.to_rfc3339()
}

fn get_memory_staleness(mem_type: &str, modified: SystemTime) -> String {
    let now = SystemTime::now();
    let age = now.duration_since(modified).unwrap_or_default();
    let days = age.as_secs() / 86400;

    if mem_type == "project" && days > 14 {
        "stale".to_string()
    } else if days > 30 {
        "review".to_string()
    } else {
        "current".to_string()
    }
}

pub fn get_memories(slug: &str) -> Vec<MemoryInfo> {
    let memory_dir = projects_dir().join(slug).join("memory");
    if !memory_dir.exists() {
        return Vec::new();
    }

    let entries = match fs::read_dir(&memory_dir) {
        Ok(e) => e,
        Err(_) => return Vec::new(),
    };

    entries
        .flatten()
        .filter(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            name.ends_with(".md") && name != "MEMORY.md"
        })
        .filter_map(|e| {
            let path = e.path();
            let content = fs::read_to_string(&path).ok()?;
            let meta = fs::metadata(&path).ok()?;
            let modified = meta.modified().ok()?;
            let parsed = parse_frontmatter(&content);
            let mem_type = parsed
                .frontmatter
                .get("type")
                .cloned()
                .unwrap_or_else(|| "unknown".to_string());

            Some(MemoryInfo {
                filename: e.file_name().to_string_lossy().to_string(),
                path: path.to_string_lossy().to_string(),
                exists: true,
                size_bytes: meta.len(),
                tokens: estimate_tokens(&content),
                modified: system_time_to_iso(modified),
                name: parsed
                    .frontmatter
                    .get("name")
                    .cloned()
                    .unwrap_or_else(|| {
                        e.file_name()
                            .to_string_lossy()
                            .trim_end_matches(".md")
                            .to_string()
                    }),
                description: parsed
                    .frontmatter
                    .get("description")
                    .cloned()
                    .unwrap_or_default(),
                memory_type: mem_type.clone(),
                staleness: get_memory_staleness(&mem_type, modified),
            })
        })
        .collect()
}
