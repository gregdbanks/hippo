use crate::util::budget::{self, Budget};
use crate::util::config_paths::{Kind, Tool};
use crate::util::unity::{is_mirrored, mirror_plan, MirrorItem, MIRROR_MARKER};
use std::collections::HashMap;
use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Loading {
    Always,
    Scoped,
    AgentDecides,
    Manual,
    OnDemand,
    Config,
    Ignored,
    Skipped,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ConfigFile {
    pub path: String,
    pub name: String,
    pub tool: Tool,
    pub kind: Kind,
    pub loading: Loading,
    pub loading_note: String,
    pub description: String,
    pub lines: usize,
    pub bytes: usize,
    pub tokens: usize,
    pub modified: String,
    pub budgets: Vec<Budget>,
    pub issues: Vec<String>,
    pub link_target: Option<String>,
    pub mirrored_from: Option<String>,
    pub references: Vec<Reference>,
}

#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RefKind {
    File,
    Skill,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Reference {
    pub label: String,
    pub path: String,
    pub kind: RefKind,
}

#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum AgentsLink {
    Linked,
    Separate,
    Unshared,
    NoClaudeMd,
}

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct LoadItem {
    pub path: String,
    pub label: String,
    pub tokens: usize,
}

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct SessionLoad {
    pub tokens: usize,
    pub items: Vec<LoadItem>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub root: String,
    pub name: String,
    pub exists: bool,
    pub memory_slug: Option<String>,
    pub files: Vec<ConfigFile>,
    pub claude_session: SessionLoad,
    pub cursor_session: SessionLoad,
    pub agents_link: AgentsLink,
    pub mirror: Vec<MirrorItem>,
    pub uses_cursor: bool,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Inventory {
    pub home: String,
    pub context_window: usize,
    pub claude_global: Vec<ConfigFile>,
    pub cursor_global: Vec<ConfigFile>,
    pub projects: Vec<Project>,
}

const SCAN_DEPTH: usize = 3;
const SKIP_DIRS: &[&str] = &[
    "node_modules", "Library", "Applications", "Desktop", "Documents", "Downloads", "Pictures", "Music",
    "Movies", "Public", "target", "dist", "build", "vendor", "venv", "__pycache__",
];
const PROJECT_MARKERS: &[&str] = &["CLAUDE.md", "CLAUDE.local.md", "AGENTS.md", ".cursorrules"];
const CLAUDE_MD_NAMES: &[&str] = &["CLAUDE.md", "CLAUDE.local.md"];

pub fn build(home: &Path) -> Inventory {
    let claude_global = global_claude_files(home);
    let cursor_global = global_cursor_files(home);

    let mut projects: Vec<Project> = project_roots(home)
        .into_iter()
        .map(|(root, slug, exists)| {
            let files = project_files(home, &root, slug.as_deref(), exists);
            Project {
                name: project_name(home, &root, slug.as_deref(), exists),
                root: root.to_string_lossy().to_string(),
                exists,
                memory_slug: slug,
                files,
                claude_session: SessionLoad::default(),
                cursor_session: SessionLoad::default(),
                agents_link: AgentsLink::NoClaudeMd,
                mirror: Vec::new(),
                uses_cursor: false,
            }
        })
        .filter(|p| !p.files.is_empty())
        .collect();

    for p in projects.iter_mut().filter(|p| p.exists) {
        let root = PathBuf::from(&p.root);
        apply_agents_md_rule(home, &root, &mut p.files);
        p.claude_session = claude_session(home, &root, &claude_global, &p.files);
        p.cursor_session = cursor_session(home, &p.files);
        p.agents_link = agents_link(home, &root);
        p.mirror = mirror_plan(home, &root);
        p.uses_cursor = root != home && (is_dir(&root.join(".cursor")) || root.join(".cursorrules").is_file());
    }

    let mut claude_global = claude_global;
    let mut cursor_global = cursor_global;
    attach_references(home, &mut claude_global, &mut cursor_global, &mut projects);
    projects.sort_by(|a, b| (!a.exists, a.root.to_lowercase()).cmp(&(!b.exists, b.root.to_lowercase())));

    Inventory {
        home: home.to_string_lossy().to_string(),
        context_window: budget::CONTEXT_WINDOW_TOKENS,
        claude_global,
        cursor_global,
        projects,
    }
}

pub fn slug_for(path: &Path) -> String {
    path.to_string_lossy().chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '-' }).collect()
}

fn display(home: &Path, path: &Path) -> String {
    match path.strip_prefix(home) {
        Ok(rel) if rel.as_os_str().is_empty() => "~".to_string(),
        Ok(rel) => format!("~/{}", rel.to_string_lossy()),
        Err(_) => path.to_string_lossy().to_string(),
    }
}

fn project_name(home: &Path, root: &Path, slug: Option<&str>, exists: bool) -> String {
    if !exists {
        let slug = slug.unwrap_or("unknown");
        let home_slug = slug_for(home);
        let short = slug.strip_prefix(home_slug.as_str()).map(|s| s.trim_start_matches('-')).filter(|s| !s.is_empty()).unwrap_or(slug);
        return format!("{} (folder moved or deleted)", short);
    }
    display(home, root)
}

fn is_dir(p: &Path) -> bool {
    p.symlink_metadata().map(|m| m.is_dir()).unwrap_or(false)
}

fn list_dir(dir: &Path) -> Vec<PathBuf> {
    let mut out: Vec<PathBuf> = std::fs::read_dir(dir)
        .map(|rd| rd.flatten().map(|e| e.path()).collect())
        .unwrap_or_default();
    out.sort();
    out
}

const MAX_RULE_DEPTH: usize = 6;

fn follows_to_dir(p: &Path) -> bool {
    std::fs::metadata(p).map(|m| m.is_dir()).unwrap_or(false)
}

fn files_under(dir: &Path, keep: &dyn Fn(&Path) -> bool) -> Vec<PathBuf> {
    files_under_depth(dir, keep, 0)
}

fn files_under_depth(dir: &Path, keep: &dyn Fn(&Path) -> bool, depth: usize) -> Vec<PathBuf> {
    let mut out = Vec::new();
    if depth > MAX_RULE_DEPTH {
        return out;
    }
    for entry in list_dir(dir) {
        if follows_to_dir(&entry) {
            out.extend(files_under_depth(&entry, keep, depth + 1));
        } else if keep(&entry) {
            out.push(entry);
        }
    }
    out
}

fn skill_files(skills_dir: &Path) -> Vec<PathBuf> {
    list_dir(skills_dir)
        .into_iter()
        .filter(|d| follows_to_dir(d))
        .map(|d| d.join("SKILL.md"))
        .filter(|f| f.is_file())
        .collect()
}

fn ends_with_any(p: &Path, exts: &[&str]) -> bool {
    let name = p.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
    exts.iter().any(|e| name.ends_with(e))
}

fn global_claude_files(home: &Path) -> Vec<ConfigFile> {
    let dot = home.join(".claude");
    let mut paths = vec![dot.join("CLAUDE.md"), dot.join("settings.json"), dot.join("settings.local.json")];
    paths.extend(files_under(&dot.join("rules"), &|p| ends_with_any(p, &[".md"])));
    paths.extend(skill_files(&dot.join("skills")));
    to_config_files(home, paths)
}

fn global_cursor_files(home: &Path) -> Vec<ConfigFile> {
    let dot = home.join(".cursor");
    let mut paths = files_under(&dot.join("rules"), &|p| ends_with_any(p, &[".mdc", ".md"]));
    paths.extend(skill_files(&dot.join("skills")));
    let mut files = to_config_files(home, paths);
    for f in files.iter_mut().filter(|f| f.kind == Kind::Rule) {
        f.loading_note.push_str(" Cursor's docs don't list ~/.cursor/rules as a rule location (User Rules live in Cursor Settings > Rules), so check it's actually being applied. It isn't counted in project totals.");
    }
    files
}

fn to_config_files(home: &Path, paths: Vec<PathBuf>) -> Vec<ConfigFile> {
    paths.iter().filter_map(|p| config_file(home, p)).collect()
}

fn project_files(home: &Path, root: &Path, slug: Option<&str>, exists: bool) -> Vec<ConfigFile> {
    let mut paths = Vec::new();
    if exists {
        for name in PROJECT_MARKERS {
            paths.push(root.join(name));
        }
        if root != home {
            let claude = root.join(".claude");
            paths.push(claude.join("CLAUDE.md"));
            paths.push(claude.join("settings.json"));
            paths.push(claude.join("settings.local.json"));
            paths.extend(files_under(&claude.join("rules"), &|p| ends_with_any(p, &[".md"])));
            paths.extend(skill_files(&claude.join("skills")));
            let cursor = root.join(".cursor");
            paths.extend(files_under(&cursor.join("rules"), &|p| ends_with_any(p, &[".mdc", ".md"])));
            paths.extend(skill_files(&cursor.join("skills")));
            paths.extend(files_under(&root.join("docs/claude"), &|p| ends_with_any(p, &[".md"])));
        }
    }
    if let Some(slug) = slug {
        let memory = home.join(".claude/projects").join(slug).join("memory");
        let mut mem: Vec<PathBuf> = list_dir(&memory).into_iter().filter(|p| ends_with_any(p, &[".md"])).collect();
        mem.sort_by_key(|p| p.file_name().map(|n| n != "MEMORY.md").unwrap_or(true));
        paths.extend(mem);
    }
    to_config_files(home, paths)
}

fn is_linked_worktree(dir: &Path) -> bool {
    dir.join(".git").is_file()
}

fn looks_like_project(home: &Path, dir: &Path) -> bool {
    if PROJECT_MARKERS.iter().any(|m| dir.join(m).is_file()) {
        return true;
    }
    dir != home && (is_dir(&dir.join(".claude")) || is_dir(&dir.join(".cursor/rules")))
}

fn scan(home: &Path, dir: &Path, depth: usize, out: &mut Vec<PathBuf>) {
    if looks_like_project(home, dir) && !is_linked_worktree(dir) {
        out.push(dir.to_path_buf());
    }
    if depth == SCAN_DEPTH {
        return;
    }
    for child in list_dir(dir) {
        let name = child.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
        if name.starts_with('.') || SKIP_DIRS.contains(&name.as_str()) || !is_dir(&child) {
            continue;
        }
        scan(home, &child, depth + 1, out);
    }
}

fn decode_slug(slug: &str) -> Option<PathBuf> {
    fn walk(dir: &Path, rest: &str) -> Option<PathBuf> {
        if rest.is_empty() {
            return Some(dir.to_path_buf());
        }
        for child in list_dir(dir) {
            if !is_dir(&child) {
                continue;
            }
            let encoded = format!("-{}", slug_for(Path::new(child.file_name()?)));
            if let Some(after) = rest.strip_prefix(&encoded) {
                if after.is_empty() || after.starts_with('-') {
                    if let Some(found) = walk(&child, after) {
                        return Some(found);
                    }
                }
            }
        }
        None
    }
    walk(Path::new("/"), slug)
}

fn project_roots(home: &Path) -> Vec<(PathBuf, Option<String>, bool)> {
    let mut scanned = Vec::new();
    scan(home, home, 0, &mut scanned);

    let slugs: Vec<String> = list_dir(&home.join(".claude/projects"))
        .into_iter()
        .filter(|p| is_dir(p))
        .filter_map(|p| p.file_name().map(|n| n.to_string_lossy().to_string()))
        .collect();

    let mut roots: Vec<(PathBuf, Option<String>, bool)> = Vec::new();
    for root in scanned {
        let slug = slug_for(&root);
        let has_slug = slugs.contains(&slug);
        roots.push((root, has_slug.then_some(slug), true));
    }
    for slug in slugs {
        if roots.iter().any(|(_, s, _)| s.as_deref() == Some(slug.as_str())) {
            continue;
        }
        match decode_slug(&slug).filter(|p| p.starts_with(home)) {
            Some(root) => {
                if let Some(existing) = roots.iter_mut().find(|(r, _, _)| *r == root) {
                    existing.1 = Some(slug);
                } else {
                    roots.push((root, Some(slug), true));
                }
            }
            None => roots.push((home.join(".claude/projects").join(&slug), Some(slug), false)),
        }
    }
    roots
}

fn config_file(home: &Path, path: &Path) -> Option<ConfigFile> {
    let (tool, kind) = crate::util::config_paths::classify(home, path)?;
    let target = crate::util::config_paths::resolve(home, path)?;
    let content = std::fs::read_to_string(&target).ok()?;
    let meta = std::fs::metadata(&target).ok()?;
    let modified = meta
        .modified()
        .map(|t| chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339())
        .unwrap_or_default();
    let fm = crate::util::frontmatter::parse_frontmatter(&content).frontmatter;
    let field = |k: &str| fm.get(k).cloned().unwrap_or_default();
    let lines = content.lines().count();
    let file_name = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();

    let name = if kind == Kind::Skill {
        path.parent().and_then(|p| p.file_name()).map(|n| n.to_string_lossy().to_string()).unwrap_or(file_name.clone())
    } else {
        file_name.clone()
    };

    let mut budgets = Vec::new();
    let mut issues = Vec::new();
    let (loading, loading_note) = match (tool, kind) {
        (Tool::Claude, Kind::Instructions) => {
            budgets.push(budget::instructions(lines));
            (Loading::Always, "Loads every session started in this folder or below it.")
        }
        (Tool::Shared, Kind::Instructions) => {
            budgets.push(budget::instructions(lines));
            (Loading::Always, "Read by Cursor, and by Claude when no CLAUDE.md applies.")
        }
        (Tool::Cursor, Kind::Instructions) => {
            (Loading::Always, "Older Cursor format. Current Cursor docs use .cursor/rules or AGENTS.md.")
        }
        (Tool::Claude, Kind::Rule) if fm.contains_key("paths") => {
            (Loading::Scoped, "Loads only when Claude works with files matching its paths.")
        }
        (Tool::Claude, Kind::Rule) => {
            budgets.push(budget::always_loaded_rule(lines));
            (Loading::Always, "No paths: frontmatter, so it loads every session.")
        }
        (Tool::Cursor, Kind::Rule) if file_name.ends_with(".md") => {
            issues.push("Cursor ignores rule files without the .mdc extension. Rename it to .mdc, or move the content to AGENTS.md.".to_string());
            (Loading::Ignored, "Not loaded by Cursor (wrong extension).")
        }
        (Tool::Cursor, Kind::Rule) => {
            budgets.push(budget::cursor_rule(lines));
            if field("alwaysApply") == "true" {
                (Loading::Always, "alwaysApply: true, so it's included in every chat.")
            } else if !field("globs").is_empty() {
                (Loading::Scoped, "Attached when a file matching its globs is in context.")
            } else if !field("description").is_empty() {
                (Loading::AgentDecides, "The agent pulls it in when the description looks relevant.")
            } else {
                (Loading::Manual, "Only used when you @-mention it in chat.")
            }
        }
        (_, Kind::Skill) => {
            let listing = format!("{} {}", field("description"), field("when_to_use"));
            budgets.push(budget::skill_lines(lines));
            budgets.push(budget::skill_listing(listing.trim().chars().count()));
            (Loading::OnDemand, "Only its name and description load every session. The rest loads when it's used.")
        }
        (_, Kind::Settings) => {
            if serde_json::from_str::<serde_json::Value>(&content).is_err() {
                issues.push("Not valid JSON, so these settings are being ignored.".to_string());
            }
            (Loading::Config, "Settings and permissions. Not loaded as context.")
        }
        (_, Kind::MemoryIndex) => {
            budgets.push(budget::memory_index_lines(lines));
            budgets.push(budget::memory_index_bytes(content.len()));
            (Loading::Always, "The first 200 lines (up to 25KB) load every session.")
        }
        (_, Kind::Memory) => (Loading::OnDemand, "Loads when Claude decides it's relevant."),
        (_, Kind::Reference) => (Loading::OnDemand, "Reference doc. Claude reads it when a config file points to it."),
        (Tool::Shared, Kind::Rule) => (Loading::Manual, ""),
    };

    Some(ConfigFile {
        path: path.to_string_lossy().to_string(),
        name,
        tool,
        kind,
        loading,
        loading_note: loading_note.to_string(),
        description: field("description"),
        lines,
        bytes: content.len(),
        tokens: crate::util::tokens::estimate_tokens(&content),
        modified,
        budgets,
        issues,
        link_target: std::fs::read_link(path).ok().map(|t| t.to_string_lossy().to_string()),
        mirrored_from: if tool == Tool::Cursor && kind == Kind::Rule { mirrored_source(&content) } else { None },
        references: Vec::new(),
    })
}

fn mirrored_source(content: &str) -> Option<String> {
    if !is_mirrored(content) {
        return None;
    }
    let line = content.lines().find(|l| l.starts_with(MIRROR_MARKER))?;
    let rest = &line[MIRROR_MARKER.len()..];
    Some(rest.split(". Edit").next().unwrap_or(rest).trim().to_string())
}

fn agents_link(home: &Path, root: &Path) -> AgentsLink {
    let claude = root.join("CLAUDE.md");
    let agents = root.join("AGENTS.md");
    if root == home || !claude.is_file() {
        return AgentsLink::NoClaudeMd;
    }
    if agents.symlink_metadata().is_err() {
        return AgentsLink::Unshared;
    }
    let same_file = match (claude.canonicalize(), agents.canonicalize()) {
        (Ok(a), Ok(b)) => a == b,
        _ => false,
    };
    let imports_agents = std::fs::read_to_string(&claude)
        .map(|c| c.lines().any(|l| l.trim() == "@AGENTS.md"))
        .unwrap_or(false);
    if same_file || imports_agents { AgentsLink::Linked } else { AgentsLink::Separate }
}

fn canonical_key(p: &Path) -> Option<PathBuf> {
    p.canonicalize().ok()
}

const MAX_REFERENCE_SCAN_BYTES: usize = 256 * 1024;
const MAX_REFERENCE_CANDIDATES: usize = 400;

fn reference_candidates(content: &str) -> Vec<(String, bool)> {
    use std::sync::OnceLock;
    static PATTERNS: OnceLock<Vec<(regex::Regex, bool)>> = OnceLock::new();
    let patterns = PATTERNS.get_or_init(|| {
        [(r"\]\(([^)\s]+)\)", false), (r"`([^`\s]+)`", false), (r"(?m)(?:^|\s)@([~\w./-]+)", false), (r"(?m)(?:^|[\s(`])/([a-z0-9][a-z0-9_-]*)\b", true)]
            .iter()
            .map(|(p, slash)| (regex::Regex::new(p).expect("valid pattern"), *slash))
            .collect()
    });
    let mut cut = content.len().min(MAX_REFERENCE_SCAN_BYTES);
    while !content.is_char_boundary(cut) {
        cut -= 1;
    }
    let text = &content[..cut];
    let mut seen = std::collections::HashSet::new();
    let mut out = Vec::new();
    for (re, slash) in patterns {
        for cap in re.captures_iter(text) {
            let candidate = cap[1].trim_end_matches(['.', ',', ':', ';']).to_string();
            if candidate.starts_with("http") || candidate.starts_with('#') || candidate.starts_with("mailto:") {
                continue;
            }
            if seen.insert((candidate.clone(), *slash)) {
                out.push((candidate, *slash));
                if out.len() >= MAX_REFERENCE_CANDIDATES {
                    return out;
                }
            }
        }
    }
    out
}

fn resolve_candidate(home: &Path, file_dir: &Path, root: Option<&Path>, text: &str) -> Vec<PathBuf> {
    let text = text.trim_start_matches("./");
    if let Some(rest) = text.strip_prefix("~/") {
        return vec![home.join(rest)];
    }
    if text.starts_with('/') {
        return vec![PathBuf::from(text)];
    }
    let mut out = vec![file_dir.join(text)];
    if let Some(root) = root {
        out.push(root.join(text));
    }
    out
}

fn attach_references(home: &Path, claude_global: &mut [ConfigFile], cursor_global: &mut [ConfigFile], projects: &mut [Project]) {
    let mut by_canonical: HashMap<PathBuf, (String, Kind)> = HashMap::new();
    let mut global_skills: HashMap<String, String> = HashMap::new();
    for f in claude_global.iter().chain(cursor_global.iter()).chain(projects.iter().flat_map(|p| p.files.iter())) {
        if let Some(key) = canonical_key(Path::new(&f.path)) {
            by_canonical.entry(key).or_insert((f.path.clone(), f.kind));
        }
    }
    for f in claude_global.iter().chain(cursor_global.iter()).filter(|f| f.kind == Kind::Skill) {
        global_skills.insert(f.name.clone(), f.path.clone());
    }

    let scan = |file: &mut ConfigFile, root: Option<&Path>, skills: &HashMap<String, String>| {
        let Some(target) = crate::util::config_paths::resolve(home, Path::new(&file.path)) else { return };
        let Ok(content) = std::fs::read_to_string(&target) else { return };
        let file_dir = Path::new(&file.path).parent().unwrap_or(home).to_path_buf();
        let own = canonical_key(Path::new(&file.path));
        let mut refs: Vec<Reference> = Vec::new();
        for (text, is_slash) in reference_candidates(&content) {
            let mut found: Option<(String, Kind)> = None;
            for candidate in resolve_candidate(home, &file_dir, root, &text) {
                if let Some(key) = canonical_key(&candidate) {
                    if Some(&key) != own.as_ref() {
                        if let Some(hit) = by_canonical.get(&key) {
                            found = Some(hit.clone());
                            break;
                        }
                    }
                }
            }
            if found.is_none() && is_slash {
                if let Some(skill_path) = skills.get(text.as_str()) {
                    if Some(skill_path) != Some(&file.path) {
                        found = Some((skill_path.clone(), Kind::Skill));
                    }
                }
            }
            if let Some((path, kind)) = found {
                if !refs.iter().any(|r| r.path == path) {
                    let kind = if kind == Kind::Skill { RefKind::Skill } else { RefKind::File };
                    refs.push(Reference { label: text, path, kind });
                }
            }
        }
        file.references = refs;
    };

    for f in claude_global.iter_mut().chain(cursor_global.iter_mut()) {
        scan(f, None, &global_skills);
    }
    for p in projects.iter_mut() {
        let mut skills = global_skills.clone();
        for f in p.files.iter().filter(|f| f.kind == Kind::Skill) {
            skills.insert(f.name.clone(), f.path.clone());
        }
        let root = PathBuf::from(&p.root);
        let root_opt = if p.exists { Some(root.as_path()) } else { None };
        for f in p.files.iter_mut() {
            scan(f, root_opt, &skills);
        }
    }
}

fn chain(home: &Path, root: &Path) -> Vec<PathBuf> {
    let mut dirs: Vec<PathBuf> = root.ancestors().take_while(|d| d.starts_with(home)).map(|d| d.to_path_buf()).collect();
    dirs.reverse();
    dirs
}

fn claude_md_in_chain(home: &Path, root: &Path) -> Vec<PathBuf> {
    let mut found = Vec::new();
    for dir in chain(home, root) {
        for name in CLAUDE_MD_NAMES {
            found.push(dir.join(name));
        }
        if dir != home {
            found.push(dir.join(".claude/CLAUDE.md"));
        }
    }
    found.into_iter().filter(|p| p.is_file()).collect()
}

fn apply_agents_md_rule(home: &Path, root: &Path, files: &mut [ConfigFile]) {
    if claude_md_in_chain(home, root).is_empty() {
        return;
    }
    for f in files.iter_mut().filter(|f| f.tool == Tool::Shared) {
        f.loading = Loading::Skipped;
        f.loading_note = "Claude skips AGENTS.md because a CLAUDE.md applies here. Cursor still loads it.".to_string();
    }
}

fn read_tokens(path: &Path) -> usize {
    std::fs::read_to_string(path).map(|c| crate::util::tokens::estimate_tokens(&c)).unwrap_or(0)
}

fn memory_index_loaded_tokens(path: &Path) -> usize {
    let content = std::fs::read_to_string(path).unwrap_or_default();
    let mut loaded: String = content.lines().take(budget::MEMORY_INDEX_LINES).collect::<Vec<_>>().join("\n");
    if loaded.len() > budget::MEMORY_INDEX_BYTES {
        let mut cut = budget::MEMORY_INDEX_BYTES;
        while !loaded.is_char_boundary(cut) {
            cut -= 1;
        }
        loaded.truncate(cut);
    }
    crate::util::tokens::estimate_tokens(&loaded)
}

fn skill_listing_tokens(path: &Path) -> usize {
    let content = std::fs::read_to_string(path).unwrap_or_default();
    let fm = crate::util::frontmatter::parse_frontmatter(&content).frontmatter;
    let get = |k: &str| fm.get(k).cloned().unwrap_or_default();
    let listing: String = format!("{} {} {}", get("name"), get("description"), get("when_to_use"))
        .chars()
        .take(budget::SKILL_LISTING_CHARS)
        .collect();
    crate::util::tokens::estimate_tokens(listing.trim())
}

fn push(session: &mut SessionLoad, home: &Path, path: &Path, label: &str, tokens: usize) {
    let path_str = path.to_string_lossy().to_string();
    if session.items.iter().any(|i| i.path == path_str) {
        return;
    }
    session.tokens += tokens;
    session.items.push(LoadItem { path: path_str, label: format!("{} {}", label, display(home, path)).trim().to_string(), tokens });
}

fn claude_session(home: &Path, root: &Path, global: &[ConfigFile], files: &[ConfigFile]) -> SessionLoad {
    let mut s = SessionLoad::default();
    for f in global.iter().filter(|f| f.loading == Loading::Always) {
        push(&mut s, home, Path::new(&f.path), "", f.tokens);
    }
    let claude_mds = claude_md_in_chain(home, root);
    for p in &claude_mds {
        push(&mut s, home, p, "", read_tokens(p));
    }
    if claude_mds.is_empty() {
        for dir in chain(home, root) {
            for p in [dir.join("AGENTS.md"), dir.join(".claude/AGENTS.md")] {
                if p.is_file() {
                    push(&mut s, home, &p, "", read_tokens(&p));
                }
            }
        }
    }
    for f in files.iter().filter(|f| f.tool == Tool::Claude && f.kind == Kind::Rule && f.loading == Loading::Always) {
        push(&mut s, home, Path::new(&f.path), "", f.tokens);
    }
    for f in files.iter().filter(|f| f.kind == Kind::MemoryIndex) {
        push(&mut s, home, Path::new(&f.path), "first 200 lines of", memory_index_loaded_tokens(Path::new(&f.path)));
    }
    for f in global.iter().chain(files.iter()).filter(|f| f.tool == Tool::Claude && f.kind == Kind::Skill) {
        push(&mut s, home, Path::new(&f.path), "skill listing:", skill_listing_tokens(Path::new(&f.path)));
    }
    s
}

fn cursor_session(home: &Path, files: &[ConfigFile]) -> SessionLoad {
    let mut s = SessionLoad::default();
    for f in files.iter().filter(|f| f.tool != Tool::Claude && f.kind == Kind::Instructions) {
        push(&mut s, home, Path::new(&f.path), "", f.tokens);
    }
    for f in files.iter().filter(|f| f.tool == Tool::Cursor && f.kind == Kind::Rule && f.loading == Loading::Always) {
        push(&mut s, home, Path::new(&f.path), "", f.tokens);
    }
    s
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    struct Home {
        _tmp: tempfile::TempDir,
        root: PathBuf,
    }

    impl Home {
        fn new() -> Home {
            let tmp = tempfile::tempdir().unwrap();
            let root = tmp.path().canonicalize().unwrap();
            Home { _tmp: tmp, root }
        }

        fn write(&self, rel: &str, text: &str) -> PathBuf {
            let p = self.root.join(rel);
            fs::create_dir_all(p.parent().unwrap()).unwrap();
            fs::write(&p, text).unwrap();
            p
        }

        fn slug(&self, rel: &str) -> String {
            let p = if rel.is_empty() { self.root.clone() } else { self.root.join(rel) };
            p.to_string_lossy().chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '-' }).collect()
        }

        fn inv(&self) -> Inventory {
            build(&self.root)
        }

        fn path(&self, rel: &str) -> String {
            if rel.is_empty() { self.root.to_string_lossy().to_string() } else { self.root.join(rel).to_string_lossy().to_string() }
        }

        fn project(&self, rel: &str) -> Project {
            let root = self.path(rel);
            self.inv().projects.into_iter().find(|p| p.root == root).unwrap_or_else(|| panic!("no project {}", rel))
        }

        fn has_project(&self, rel: &str) -> bool {
            let root = self.path(rel);
            self.inv().projects.iter().any(|p| p.root == root)
        }
    }

    fn file<'a>(files: &'a [ConfigFile], ends_with: &str) -> &'a ConfigFile {
        files.iter().find(|f| f.path.ends_with(ends_with)).unwrap_or_else(|| panic!("no file {}", ends_with))
    }

    fn lines(n: usize) -> String {
        (0..n).map(|i| format!("line {}\n", i)).collect()
    }

    #[test]
    fn finds_global_claude_and_cursor_files() {
        let h = Home::new();
        h.write(".claude/CLAUDE.md", "# me\n");
        h.write(".claude/settings.json", "{}\n");
        h.write(".claude/rules/style.md", "be brief\n");
        h.write(".claude/skills/review/SKILL.md", "---\nname: review\ndescription: Review a PR\n---\nsteps\n");
        h.write(".cursor/rules/no-commits.mdc", "---\nalwaysApply: true\n---\nask first\n");
        h.write(".cursor/skills-cursor/review/SKILL.md", "built in\n");
        let inv = h.inv();

        let claude: Vec<&str> = inv.claude_global.iter().map(|f| f.name.as_str()).collect();
        assert!(claude.contains(&"CLAUDE.md") && claude.contains(&"settings.json"));
        assert!(claude.contains(&"style.md") && claude.contains(&"review"));
        assert_eq!(inv.cursor_global.len(), 1);
        assert_eq!(inv.cursor_global[0].name, "no-commits.mdc");
        assert_eq!(inv.context_window, 200_000);
    }

    #[test]
    fn scans_for_projects_up_to_three_levels_and_skips_noise() {
        let h = Home::new();
        h.write("code/group/app/CLAUDE.md", "# app\n");
        h.write("code/group/app/deeper/nested/CLAUDE.md", "# too deep\n");
        h.write("code/group/app/node_modules/pkg/AGENTS.md", "# dep\n");
        h.write("code/cursor-only/.cursor/rules/a.mdc", "---\nalwaysApply: true\n---\nx\n");
        h.write("code/worktree/CLAUDE.md", "# copy\n");
        h.write("code/worktree/.git", "gitdir: /elsewhere\n");
        h.write("Library/thing/CLAUDE.md", "# app support\n");

        assert!(h.has_project("code/group/app"));
        assert!(h.has_project("code/cursor-only"));
        assert!(!h.has_project("code/group/app/deeper/nested"));
        assert!(!h.has_project("code/worktree"));
        assert!(!h.has_project("Library/thing"));
        assert!(!h.has_project("code/group/app/node_modules/pkg"));
    }

    #[test]
    fn claude_memory_attaches_to_its_project_and_moved_folders_still_show() {
        let h = Home::new();
        h.write("code/app.v2/CLAUDE.md", "# app\n");
        h.write(&format!(".claude/projects/{}/memory/MEMORY.md", h.slug("code/app.v2")), "- [a](a.md)\n");
        h.write(&format!(".claude/projects/{}/memory/a.md", h.slug("code/app.v2")), "---\nname: a\n---\nfact\n");
        h.write(&format!(".claude/projects/{}/memory/MEMORY.md", h.slug("old/place")), "- gone\n");

        let p = h.project("code/app.v2");
        assert!(p.exists);
        assert_eq!(p.memory_slug.as_deref(), Some(h.slug("code/app.v2").as_str()));
        assert_eq!(file(&p.files, "memory/a.md").loading, Loading::OnDemand);

        let inv = h.inv();
        let moved = inv.projects.iter().find(|p| p.memory_slug.as_deref() == Some(h.slug("old/place").as_str())).unwrap();
        assert!(!moved.exists);
        assert_eq!(moved.name, "old-place (folder moved or deleted)");
        assert_eq!(moved.files.len(), 1);
    }

    #[test]
    fn claude_rules_are_always_loaded_unless_path_scoped() {
        let h = Home::new();
        h.write("app/.claude/rules/always.md", &lines(170));
        h.write("app/.claude/rules/scoped.md", "---\npaths:\n  - \"src/**/*.ts\"\n---\nts only\n");
        let p = h.project("app");

        let always = file(&p.files, "always.md");
        assert_eq!(always.loading, Loading::Always);
        assert_eq!(always.budgets[0].level, budget::Level::Warn);
        let scoped = file(&p.files, "scoped.md");
        assert_eq!(scoped.loading, Loading::Scoped);
        assert!(scoped.budgets.is_empty());
    }

    #[test]
    fn cursor_rule_types_follow_cursor_frontmatter() {
        let h = Home::new();
        h.write("app/.cursor/rules/always.mdc", "---\nalwaysApply: true\n---\nx\n");
        h.write("app/.cursor/rules/files.mdc", "---\nglobs: src/**/*.ts\nalwaysApply: false\n---\nx\n");
        h.write("app/.cursor/rules/smart.mdc", "---\ndescription: Use for API work\nalwaysApply: false\n---\nx\n");
        h.write("app/.cursor/rules/manual.mdc", "---\nalwaysApply: false\n---\nx\n");
        h.write("app/.cursor/rules/plain.md", "# not picked up\n");
        let p = h.project("app");

        assert_eq!(file(&p.files, "always.mdc").loading, Loading::Always);
        assert_eq!(file(&p.files, "files.mdc").loading, Loading::Scoped);
        assert_eq!(file(&p.files, "smart.mdc").loading, Loading::AgentDecides);
        assert_eq!(file(&p.files, "manual.mdc").loading, Loading::Manual);
        let plain = file(&p.files, "plain.md");
        assert_eq!(plain.loading, Loading::Ignored);
        assert!(!plain.issues.is_empty());
    }

    #[test]
    fn claude_skips_agents_md_when_a_claude_md_exists_but_cursor_still_loads_it() {
        let h = Home::new();
        h.write("both/CLAUDE.md", "# claude\n");
        h.write("both/AGENTS.md", "# agents\n");
        h.write("agents-only/AGENTS.md", "# agents\n");

        let both = h.project("both");
        assert_eq!(file(&both.files, "AGENTS.md").loading, Loading::Skipped);
        assert!(both.claude_session.items.iter().all(|i| !i.path.ends_with("AGENTS.md")));
        assert!(both.cursor_session.items.iter().any(|i| i.path.ends_with("AGENTS.md")));

        let only = h.project("agents-only");
        assert_eq!(file(&only.files, "AGENTS.md").loading, Loading::Always);
        assert!(only.claude_session.items.iter().any(|i| i.path.ends_with("AGENTS.md")));
    }

    #[test]
    fn memory_index_past_200_lines_is_over_and_only_200_lines_count() {
        let h = Home::new();
        h.write("app/CLAUDE.md", "# app\n");
        let index = lines(250);
        h.write(&format!(".claude/projects/{}/memory/MEMORY.md", h.slug("app")), &index);
        let p = h.project("app");

        let mem = file(&p.files, "MEMORY.md");
        assert_eq!(mem.loading, Loading::Always);
        assert!(mem.budgets.iter().any(|b| b.unit == "lines" && b.level == budget::Level::Over));
        let counted = p.claude_session.items.iter().find(|i| i.path.ends_with("MEMORY.md")).unwrap();
        assert!(counted.tokens < mem.tokens);
    }

    #[test]
    fn claude_session_counts_what_loads_every_time() {
        let h = Home::new();
        h.write(".claude/CLAUDE.md", "global rules here\n");
        h.write(".claude/rules/global-always.md", "always\n");
        h.write(".claude/skills/review/SKILL.md", "---\nname: review\ndescription: Review a PR\n---\nlong body that only loads when used\n");
        h.write("code/CLAUDE.md", "parent folder rules\n");
        h.write("code/app/CLAUDE.md", "app rules\n");
        h.write("code/app/.claude/rules/always.md", "app always\n");
        h.write("code/app/.claude/rules/scoped.md", "---\npaths:\n  - \"x\"\n---\nscoped\n");
        h.write(&format!(".claude/projects/{}/memory/topic.md", h.slug("code/app")), "topic\n");
        let p = h.project("code/app");

        let counted: Vec<String> = p.claude_session.items.iter().map(|i| i.path.clone()).collect();
        let has = |s: &str| counted.iter().any(|c| c.ends_with(s));
        assert!(has(".claude/CLAUDE.md") && has("global-always.md"));
        assert!(has("code/CLAUDE.md") && has("code/app/CLAUDE.md") && has("app/.claude/rules/always.md"));
        assert!(has("review/SKILL.md"));
        assert!(!has("scoped.md") && !has("topic.md"));
        assert_eq!(p.claude_session.tokens, p.claude_session.items.iter().map(|i| i.tokens).sum::<usize>());

        let skill = p.claude_session.items.iter().find(|i| i.path.ends_with("SKILL.md")).unwrap();
        let skill_file = file(&h.inv().claude_global, "SKILL.md").tokens;
        assert!(skill.tokens < skill_file);
    }

    #[test]
    fn home_as_a_project_does_not_repeat_global_files() {
        let h = Home::new();
        h.write(".claude/CLAUDE.md", "# global\n");
        h.write(".claude/rules/style.md", "x\n");
        h.write(&format!(".claude/projects/{}/memory/MEMORY.md", h.slug("")), "- index\n");
        let p = h.project("");

        assert!(p.files.iter().all(|f| !f.path.contains("/.claude/rules/") && !f.path.ends_with(".claude/CLAUDE.md")));
        assert!(p.files.iter().any(|f| f.path.ends_with("MEMORY.md")));
    }

    #[test]
    fn skill_description_budget_counts_description_and_when_to_use() {
        let h = Home::new();
        let long = "x".repeat(1_600);
        h.write(".claude/skills/big/SKILL.md", &format!("---\nname: big\ndescription: {}\n---\nbody\n", long));
        let inv = h.inv();
        let skill = file(&inv.claude_global, "big/SKILL.md");
        assert!(skill.budgets.iter().any(|b| b.unit == "chars" && b.level == budget::Level::Over));
    }

    #[test]
    fn symlinked_skill_folders_are_found() {
        let h = Home::new();
        h.write("dotfiles/skills/deploy/SKILL.md", "---\nname: deploy\ndescription: Ship it\n---\nsteps\n");
        std::fs::create_dir_all(h.root.join(".claude/skills")).unwrap();
        std::os::unix::fs::symlink(h.root.join("dotfiles/skills/deploy"), h.root.join(".claude/skills/deploy")).unwrap();
        assert!(h.inv().claude_global.iter().any(|f| f.name == "deploy"));
    }

    #[test]
    fn special_or_oversized_files_named_like_config_are_skipped_not_read() {
        let h = Home::new();
        h.write("app/AGENTS.md", "# ok\n");
        h.write("app/CLAUDE.md", &"x".repeat(3 * 1024 * 1024));
        h.write("dev/AGENTS.md", "# ok\n");
        std::os::unix::fs::symlink("/dev/null", h.root.join("dev/CLAUDE.md")).unwrap();
        assert!(h.project("app").files.iter().all(|f| !f.path.ends_with("CLAUDE.md")));
        assert!(h.project("dev").files.iter().all(|f| !f.path.ends_with("CLAUDE.md")));
    }

    #[test]
    fn cursor_globs_written_as_a_yaml_list_count_as_scoped() {
        let h = Home::new();
        h.write("app/.cursor/rules/list.mdc", "---\nglobs:\n  - src/**/*.ts\n  - src/**/*.tsx\nalwaysApply: false\n---\nx\n");
        assert_eq!(file(&h.project("app").files, "list.mdc").loading, Loading::Scoped);
    }

    #[test]
    fn agents_link_status_is_reported_per_project() {
        let h = Home::new();
        h.write("linked/CLAUDE.md", "# x\n");
        std::os::unix::fs::symlink("CLAUDE.md", h.root.join("linked/AGENTS.md")).unwrap();
        h.write("separate/CLAUDE.md", "# x\n");
        h.write("separate/AGENTS.md", "# y\n");
        h.write("unshared/CLAUDE.md", "# x\n");
        h.write("agents-only/AGENTS.md", "# y\n");

        assert_eq!(h.project("linked").agents_link, AgentsLink::Linked);
        assert_eq!(h.project("separate").agents_link, AgentsLink::Separate);
        assert_eq!(h.project("unshared").agents_link, AgentsLink::Unshared);
        assert_eq!(h.project("agents-only").agents_link, AgentsLink::NoClaudeMd);
        h.write("imports/CLAUDE.md", "@AGENTS.md\n");
        h.write("imports/AGENTS.md", "# shared\n");
        assert_eq!(h.project("imports").agents_link, AgentsLink::Linked);
        assert_eq!(file(&h.project("linked").files, "AGENTS.md").link_target.as_deref(), Some("CLAUDE.md"));
    }

    #[test]
    fn mirrored_cursor_rules_point_back_to_their_claude_rule() {
        let h = Home::new();
        h.write("app/.claude/rules/style.md", "- x\n");
        crate::util::unity::mirror_rules(&h.root, &h.root.join("app")).unwrap();
        h.write("app/.claude/rules/new.md", "- y\n");
        let p = h.project("app");

        assert_eq!(file(&p.files, "style.mdc").mirrored_from.as_deref(), Some(".claude/rules/style.md"));
        assert!(file(&p.files, "style.md").mirrored_from.is_none());
        let states: Vec<_> = p.mirror.iter().map(|m| m.state).collect();
        assert!(states.contains(&crate::util::unity::MirrorState::Current));
        assert!(states.contains(&crate::util::unity::MirrorState::Missing));
    }

    #[test]
    fn reference_docs_in_docs_claude_are_listed() {
        let h = Home::new();
        h.write("app/CLAUDE.md", "Read `docs/claude/api.md` first.\n");
        h.write("app/docs/claude/api.md", "# API\n");
        h.write("app/docs/other.md", "# not ours\n");
        let p = h.project("app");
        let doc = file(&p.files, "docs/claude/api.md");
        assert_eq!(doc.kind, Kind::Reference);
        assert_eq!(doc.loading, Loading::OnDemand);
        assert!(p.files.iter().all(|f| !f.path.ends_with("docs/other.md")));
    }

    #[test]
    fn references_to_docs_files_and_skills_are_detected() {
        let h = Home::new();
        h.write(".claude/skills/ticket-review/SKILL.md", "---\nname: ticket-review\ndescription: x\n---\n");
        h.write("app/.claude/skills/router/SKILL.md", "---\nname: router\ndescription: x\n---\n");
        h.write("app/docs/claude/api.md", "# API\n");
        h.write("app/.claude/rules/index.md", "see [router](../skills/router/SKILL.md)\n");
        h.write("app/CLAUDE.md", "Read `docs/claude/api.md`. Run /ticket-review first. Use /router. Not a file: `docs/claude/missing.md`. See https://x.dev/a.md\n@docs/claude/api.md\n");
        let p = h.project("app");

        let refs: Vec<String> = file(&p.files, "app/CLAUDE.md").references.iter().map(|r| r.path.clone()).collect();
        assert!(refs.iter().any(|r| r.ends_with("app/docs/claude/api.md")));
        assert!(refs.iter().any(|r| r.ends_with(".claude/skills/ticket-review/SKILL.md")));
        assert!(refs.iter().any(|r| r.ends_with("app/.claude/skills/router/SKILL.md")));
        assert!(refs.iter().all(|r| !r.contains("missing")));
        assert_eq!(refs.len(), 3);

        let index_refs = &file(&p.files, "rules/index.md").references;
        assert_eq!(index_refs.len(), 1);
        assert_eq!(index_refs[0].kind, RefKind::Skill);
    }

    #[test]
    fn a_reference_to_claude_md_points_at_claude_md_even_when_agents_md_links_to_it() {
        let h = Home::new();
        h.write("app/CLAUDE.md", "# app\n");
        std::os::unix::fs::symlink("CLAUDE.md", h.root.join("app/AGENTS.md")).unwrap();
        h.write("app/docs/claude/notes.md", "Moved from `CLAUDE.md`.\n");
        let p = h.project("app");
        let refs = &file(&p.files, "notes.md").references;
        assert_eq!(refs.len(), 1);
        assert!(refs[0].path.ends_with("app/CLAUDE.md"));
    }

    #[test]
    fn a_skill_name_in_backticks_is_not_a_skill_link() {
        let h = Home::new();
        h.write(".claude/skills/review/SKILL.md", "---\nname: review\ndescription: x\n---\n");
        h.write("app/CLAUDE.md", "Do a `review` of the code.\n");
        assert!(file(&h.project("app").files, "app/CLAUDE.md").references.is_empty());
    }

    #[test]
    fn projects_know_whether_they_use_cursor() {
        let h = Home::new();
        h.write("with-cursor/CLAUDE.md", "# x\n");
        std::fs::create_dir_all(h.root.join("with-cursor/.cursor")).unwrap();
        h.write("legacy/CLAUDE.md", "# x\n");
        h.write("legacy/.cursorrules", "x\n");
        h.write("claude-only/CLAUDE.md", "# x\n");
        assert!(h.project("with-cursor").uses_cursor);
        assert!(h.project("legacy").uses_cursor);
        assert!(!h.project("claude-only").uses_cursor);
    }

    #[test]
    fn skills_written_as_backticked_slash_commands_are_linked() {
        let h = Home::new();
        h.write(".claude/skills/browser-testing/SKILL.md", "---\nname: browser-testing\ndescription: x\n---\n");
        h.write(".claude/skills/shipping-changes/SKILL.md", "---\nname: shipping-changes\ndescription: x\n---\n");
        h.write(".claude/CLAUDE.md", "- Test in the browser. How: `/browser-testing` (ports).\n- Commit steps: `/shipping-changes`.\n");
        let inv = h.inv();
        let refs: Vec<&str> = file(&inv.claude_global, ".claude/CLAUDE.md").references.iter().map(|r| r.label.as_str()).collect();
        assert_eq!(refs.len(), 2, "{:?}", refs);
        assert!(file(&inv.claude_global, ".claude/CLAUDE.md").references.iter().all(|r| r.kind == RefKind::Skill));
    }
}
