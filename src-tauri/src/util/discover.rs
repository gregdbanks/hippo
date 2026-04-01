use crate::util::frontmatter::parse_frontmatter;
use crate::util::paths::*;
use crate::util::tokens::estimate_tokens;
use chrono::{DateTime, Utc};
use serde::Serialize;
use std::fs;
use std::path::Path;
use std::time::SystemTime;

const OPTIMAL_MAX: usize = 25;
const ACCEPTABLE_MAX: usize = 35;
const INDEX_LINE_LIMIT: usize = 200;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileInfo {
    pub path: String,
    pub exists: bool,
    pub size_bytes: u64,
    pub tokens: usize,
    pub modified: String,
}

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

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MemoryHealth {
    pub score: u8,
    pub grade: String,
    pub memory_count: usize,
    pub optimal_max: usize,
    pub index_line_count: usize,
    pub index_line_limit: usize,
    pub stale_count: usize,
    pub review_count: usize,
    pub memory_tokens: usize,
    pub token_budget_pct: usize,
    pub suggestions: Vec<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInfo {
    pub slug: String,
    pub real_path: String,
    pub claude_md: Option<FileInfo>,
    pub memory_index: Option<FileInfo>,
    pub memory_count: usize,
    pub memory_total_tokens: usize,
    pub memory_health: Option<MemoryHealth>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SkillInfo {
    pub name: String,
    pub path: String,
    pub description: String,
    pub size_bytes: u64,
    pub tokens: usize,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SettingsInfo {
    pub path: String,
    pub exists: bool,
    pub size_bytes: u64,
    pub hook_count: usize,
    pub allow_count: usize,
    pub deny_count: usize,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveryResult {
    pub global_claude: Option<FileInfo>,
    pub projects: Vec<ProjectInfo>,
    pub skills: Vec<SkillInfo>,
    pub settings: SettingsInfo,
    pub plans: Vec<FileInfo>,
    pub totals: Totals,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Totals {
    pub files_loaded: usize,
    pub total_tokens: usize,
}

fn system_time_to_iso(st: SystemTime) -> String {
    let dt: DateTime<Utc> = st.into();
    dt.to_rfc3339()
}

fn get_file_info(path: &Path) -> Option<FileInfo> {
    let meta = fs::metadata(path).ok()?;
    let content = fs::read_to_string(path).ok()?;
    let modified = meta.modified().ok()?;
    Some(FileInfo {
        path: path.to_string_lossy().to_string(),
        exists: true,
        size_bytes: meta.len(),
        tokens: estimate_tokens(&content),
        modified: system_time_to_iso(modified),
    })
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

fn calculate_memory_health(
    memory_count: usize,
    memory_total_tokens: usize,
    memory_index: &Option<FileInfo>,
    stale_count: usize,
    review_count: usize,
    total_prompt_tokens: usize,
) -> MemoryHealth {
    let mut index_line_count = 0;
    if let Some(idx) = memory_index {
        if let Ok(content) = fs::read_to_string(&idx.path) {
            index_line_count = content.lines().filter(|l| !l.trim().is_empty()).count();
        }
    }

    let token_budget_pct = if total_prompt_tokens > 0 {
        (memory_total_tokens * 100) / total_prompt_tokens
    } else {
        0
    };

    let mut score: i32 = 100;
    let mut suggestions = Vec::new();

    if memory_count > ACCEPTABLE_MAX {
        score -= std::cmp::min(30, ((memory_count - ACCEPTABLE_MAX) * 2) as i32);
        suggestions.push(format!(
            "Reduce to {} memories. You have {} over the recommended max.",
            OPTIMAL_MAX,
            memory_count - OPTIMAL_MAX
        ));
    } else if memory_count > OPTIMAL_MAX {
        score -= ((memory_count - OPTIMAL_MAX) as f64 * 1.5) as i32;
        suggestions.push(format!(
            "Consider trimming {} memories to stay under {}.",
            memory_count - OPTIMAL_MAX,
            OPTIMAL_MAX
        ));
    }

    if stale_count > 0 {
        score -= (stale_count * 5) as i32;
        suggestions.push(format!(
            "{} stale project memories may cause outdated assumptions. Review or delete them.",
            stale_count
        ));
    }

    if review_count > 0 {
        score -= (review_count * 2) as i32;
        suggestions.push(format!(
            "{} memories haven't been updated in 30+ days. Verify they're still relevant.",
            review_count
        ));
    }

    if index_line_count > (INDEX_LINE_LIMIT as f64 * 0.8) as usize {
        score -= 15;
        suggestions.push(format!(
            "MEMORY.md index is {}/{} lines. Lines past 200 are truncated and invisible.",
            index_line_count, INDEX_LINE_LIMIT
        ));
    }

    if token_budget_pct > 50 {
        score -= 15;
        suggestions.push(format!(
            "Memories use {}% of your prompt context. Consider consolidating or removing low-value entries.",
            token_budget_pct
        ));
    } else if token_budget_pct > 30 {
        score -= 5;
    }

    score = score.clamp(0, 100);

    let grade = if score < 50 {
        "critical"
    } else if score < 75 {
        "warning"
    } else {
        "healthy"
    }
    .to_string();

    MemoryHealth {
        score: score as u8,
        grade,
        memory_count,
        optimal_max: OPTIMAL_MAX,
        index_line_count,
        index_line_limit: INDEX_LINE_LIMIT,
        stale_count,
        review_count,
        memory_tokens: memory_total_tokens,
        token_budget_pct,
        suggestions,
    }
}

fn discover_projects() -> Vec<ProjectInfo> {
    let proj_dir = projects_dir();
    if !proj_dir.exists() {
        return Vec::new();
    }

    let mut projects = Vec::new();
    let entries = match fs::read_dir(&proj_dir) {
        Ok(e) => e,
        Err(_) => return Vec::new(),
    };

    for entry in entries.flatten() {
        let slug = entry.file_name().to_string_lossy().to_string();
        if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            continue;
        }

        let real_path = decode_project_slug(&slug);
        let project_claude_md = real_path.join("CLAUDE.md");
        let memory_dir = entry.path().join("memory");

        let mut memory_count = 0;
        let mut memory_total_tokens = 0;
        let mut memory_index: Option<FileInfo> = None;
        let mut stale_count = 0;
        let mut review_count = 0;

        if memory_dir.exists() {
            if let Ok(mem_entries) = fs::read_dir(&memory_dir) {
                for mem_entry in mem_entries.flatten() {
                    let fname = mem_entry.file_name().to_string_lossy().to_string();
                    if !fname.ends_with(".md") {
                        continue;
                    }
                    let mem_path = mem_entry.path();

                    if fname == "MEMORY.md" {
                        memory_index = get_file_info(&mem_path);
                    } else {
                        if let Ok(content) = fs::read_to_string(&mem_path) {
                            memory_count += 1;
                            memory_total_tokens += estimate_tokens(&content);

                            if let Ok(meta) = fs::metadata(&mem_path) {
                                if let Ok(modified) = meta.modified() {
                                    let parsed = parse_frontmatter(&content);
                                    let mem_type = parsed
                                        .frontmatter
                                        .get("type")
                                        .cloned()
                                        .unwrap_or_else(|| "unknown".to_string());
                                    let staleness = get_memory_staleness(&mem_type, modified);
                                    if staleness == "stale" {
                                        stale_count += 1;
                                    } else if staleness == "review" {
                                        review_count += 1;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        projects.push(ProjectInfo {
            slug,
            real_path: real_path.to_string_lossy().to_string(),
            claude_md: get_file_info(&project_claude_md),
            memory_index: memory_index.clone(),
            memory_count,
            memory_total_tokens,
            memory_health: None, // Filled in after totals
        });

        // Store staleness counts temporarily for health calculation
        // We'll recalculate in discover() after totals are known
        if let Some(last) = projects.last_mut() {
            let global_tokens = 0; // placeholder, calculated in discover()
            let project_total =
                global_tokens
                    + last.claude_md.as_ref().map(|f| f.tokens).unwrap_or(0)
                    + last.memory_index.as_ref().map(|f| f.tokens).unwrap_or(0)
                    + memory_total_tokens;

            last.memory_health = Some(calculate_memory_health(
                memory_count,
                memory_total_tokens,
                &memory_index,
                stale_count,
                review_count,
                project_total,
            ));
        }
    }

    projects
}

fn discover_skills() -> Vec<SkillInfo> {
    let dir = skills_dir();
    if !dir.exists() {
        return Vec::new();
    }

    let mut skills = Vec::new();
    let entries = match fs::read_dir(&dir) {
        Ok(e) => e,
        Err(_) => return Vec::new(),
    };

    for entry in entries.flatten() {
        if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        let skill_md = entry.path().join("SKILL.md");
        if !skill_md.exists() {
            continue;
        }

        if let Ok(content) = fs::read_to_string(&skill_md) {
            let parsed = parse_frontmatter(&content);
            skills.push(SkillInfo {
                name,
                path: skill_md.to_string_lossy().to_string(),
                description: parsed
                    .frontmatter
                    .get("description")
                    .cloned()
                    .unwrap_or_default(),
                size_bytes: content.len() as u64,
                tokens: estimate_tokens(&content),
            });
        }
    }

    skills
}

fn discover_settings() -> SettingsInfo {
    let path = settings_path();
    if !path.exists() {
        return SettingsInfo {
            path: path.to_string_lossy().to_string(),
            exists: false,
            size_bytes: 0,
            hook_count: 0,
            allow_count: 0,
            deny_count: 0,
        };
    }

    let content = match fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => {
            return SettingsInfo {
                path: path.to_string_lossy().to_string(),
                exists: false,
                size_bytes: 0,
                hook_count: 0,
                allow_count: 0,
                deny_count: 0,
            }
        }
    };

    let parsed: serde_json::Value = match serde_json::from_str(&content) {
        Ok(v) => v,
        Err(_) => {
            return SettingsInfo {
                path: path.to_string_lossy().to_string(),
                exists: true,
                size_bytes: content.len() as u64,
                hook_count: 0,
                allow_count: 0,
                deny_count: 0,
            }
        }
    };

    let permissions = &parsed["permissions"];
    let hooks = &parsed["hooks"];

    SettingsInfo {
        path: path.to_string_lossy().to_string(),
        exists: true,
        size_bytes: content.len() as u64,
        hook_count: hooks.as_object().map(|o| o.len()).unwrap_or(0),
        allow_count: permissions["allow"]
            .as_array()
            .map(|a| a.len())
            .unwrap_or(0),
        deny_count: permissions["deny"]
            .as_array()
            .map(|a| a.len())
            .unwrap_or(0),
    }
}

fn discover_plans() -> Vec<FileInfo> {
    let dir = plans_dir();
    if !dir.exists() {
        return Vec::new();
    }

    let entries = match fs::read_dir(&dir) {
        Ok(e) => e,
        Err(_) => return Vec::new(),
    };

    entries
        .flatten()
        .filter(|e| {
            e.file_name()
                .to_string_lossy()
                .ends_with(".md")
        })
        .filter_map(|e| get_file_info(&e.path()))
        .collect()
}

pub fn discover() -> DiscoveryResult {
    let global_claude = get_file_info(&global_claude_md());
    let mut projects = discover_projects();
    let skills = discover_skills();
    let settings = discover_settings();
    let plans = discover_plans();

    let global_tokens = global_claude.as_ref().map(|f| f.tokens).unwrap_or(0);

    // Recalculate memory health with global tokens included
    for p in &mut projects {
        let project_total = global_tokens
            + p.claude_md.as_ref().map(|f| f.tokens).unwrap_or(0)
            + p.memory_index.as_ref().map(|f| f.tokens).unwrap_or(0)
            + p.memory_total_tokens;

        if let Some(ref mut health) = p.memory_health {
            health.token_budget_pct = if project_total > 0 {
                (p.memory_total_tokens * 100) / project_total
            } else {
                0
            };
        }
    }

    // Calculate totals using the largest project
    let mut total_tokens = global_tokens;
    if let Some(max_p) = projects.iter().max_by_key(|p| {
        p.claude_md.as_ref().map(|f| f.tokens).unwrap_or(0)
            + p.memory_index.as_ref().map(|f| f.tokens).unwrap_or(0)
            + p.memory_total_tokens
    }) {
        total_tokens += max_p.claude_md.as_ref().map(|f| f.tokens).unwrap_or(0)
            + max_p
                .memory_index
                .as_ref()
                .map(|f| f.tokens)
                .unwrap_or(0)
            + max_p.memory_total_tokens;
    }

    let files_loaded = (if global_claude.is_some() { 1 } else { 0 })
        + projects.iter().fold(0usize, |n, p| {
            n + (if p.claude_md.is_some() { 1 } else { 0 })
                + (if p.memory_index.is_some() { 1 } else { 0 })
                + p.memory_count
        });

    DiscoveryResult {
        global_claude,
        projects,
        skills,
        settings,
        plans,
        totals: Totals {
            files_loaded,
            total_tokens,
        },
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
