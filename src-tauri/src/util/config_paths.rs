use serde::Serialize;
use std::path::{Component, Path, PathBuf};

#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Tool {
    Claude,
    Cursor,
    Shared,
}

#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Kind {
    Instructions,
    Rule,
    Skill,
    Settings,
    MemoryIndex,
    Memory,
    Reference,
}

pub fn classify(home: &Path, path: &Path) -> Option<(Tool, Kind)> {
    if !path.is_absolute() || path.components().any(|c| !matches!(c, Component::Normal(_) | Component::RootDir)) {
        return None;
    }
    let rel = path.strip_prefix(home).ok()?;
    let parts: Vec<&str> = rel.iter().map(|p| p.to_str().unwrap_or("")).collect();
    if parts.contains(&"node_modules") {
        return None;
    }
    let n = parts.len();
    let name = *parts.last()?;

    if n == 5 && parts[0] == ".claude" && parts[1] == "projects" && parts[3] == "memory" && name.ends_with(".md") {
        return Some((Tool::Claude, if name == "MEMORY.md" { Kind::MemoryIndex } else { Kind::Memory }));
    }

    if let Some(i) = parts.iter().rposition(|p| *p == ".claude") {
        match parts.get(i + 1).copied() {
            Some("settings.json") | Some("settings.local.json") if n == i + 2 => return Some((Tool::Claude, Kind::Settings)),
            Some("rules") if n > i + 2 && name.ends_with(".md") => return Some((Tool::Claude, Kind::Rule)),
            Some("skills") if n == i + 4 && name == "SKILL.md" => return Some((Tool::Claude, Kind::Skill)),
            _ => {}
        }
    }

    if let Some(i) = parts.iter().rposition(|p| *p == ".cursor") {
        match parts.get(i + 1).copied() {
            Some("rules") if n > i + 2 && (name.ends_with(".mdc") || name.ends_with(".md")) => return Some((Tool::Cursor, Kind::Rule)),
            Some("skills") if n == i + 4 && name == "SKILL.md" => return Some((Tool::Cursor, Kind::Skill)),
            _ => {}
        }
    }

    match name {
        "CLAUDE.md" | "CLAUDE.local.md" => Some((Tool::Claude, Kind::Instructions)),
        "AGENTS.md" => Some((Tool::Shared, Kind::Instructions)),
        ".cursorrules" => Some((Tool::Cursor, Kind::Instructions)),
        _ if name.ends_with(".md") && parts.windows(2).any(|w| w == ["docs", "claude"]) => Some((Tool::Claude, Kind::Reference)),
        _ => None,
    }
}

pub const MAX_FILE_BYTES: u64 = 2 * 1024 * 1024;

pub fn resolve(home: &Path, path: &Path) -> Option<PathBuf> {
    classify(home, path)?;
    let real_home = home.canonicalize().unwrap_or_else(|_| home.to_path_buf());
    let parent = path.parent()?.canonicalize().ok()?;
    if !parent.starts_with(&real_home) {
        return None;
    }
    if path.symlink_metadata().is_err() {
        return Some(parent.join(path.file_name()?));
    }
    let target = path.canonicalize().ok()?;
    let meta = std::fs::metadata(&target).ok()?;
    if !target.starts_with(&real_home) || !meta.is_file() || meta.len() > MAX_FILE_BYTES {
        return None;
    }
    let same_type = match path.extension() {
        Some(ext) => target.extension() == Some(ext),
        None => target.file_name() == path.file_name(),
    };
    same_type.then_some(target)
}

pub fn is_editable(home: &Path, path: &Path) -> bool {
    resolve(home, path).is_some()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn home() -> PathBuf {
        PathBuf::from("/Users/someone")
    }

    fn class(p: &str) -> Option<(Tool, Kind)> {
        classify(&home(), Path::new(p))
    }

    #[test]
    fn instructions_files_anywhere_in_home() {
        assert_eq!(class("/Users/someone/.claude/CLAUDE.md"), Some((Tool::Claude, Kind::Instructions)));
        assert_eq!(class("/Users/someone/code/app/CLAUDE.md"), Some((Tool::Claude, Kind::Instructions)));
        assert_eq!(class("/Users/someone/code/app/CLAUDE.local.md"), Some((Tool::Claude, Kind::Instructions)));
        assert_eq!(class("/Users/someone/code/app/.claude/CLAUDE.md"), Some((Tool::Claude, Kind::Instructions)));
        assert_eq!(class("/Users/someone/code/app/AGENTS.md"), Some((Tool::Shared, Kind::Instructions)));
        assert_eq!(class("/Users/someone/code/app/.cursorrules"), Some((Tool::Cursor, Kind::Instructions)));
    }

    #[test]
    fn claude_settings_rules_and_skills() {
        assert_eq!(class("/Users/someone/.claude/settings.json"), Some((Tool::Claude, Kind::Settings)));
        assert_eq!(class("/Users/someone/code/app/.claude/settings.local.json"), Some((Tool::Claude, Kind::Settings)));
        assert_eq!(class("/Users/someone/.claude/rules/style.md"), Some((Tool::Claude, Kind::Rule)));
        assert_eq!(class("/Users/someone/code/app/.claude/rules/frontend/forms.md"), Some((Tool::Claude, Kind::Rule)));
        assert_eq!(class("/Users/someone/.claude/skills/review/SKILL.md"), Some((Tool::Claude, Kind::Skill)));
        assert_eq!(class("/Users/someone/code/app/.claude/skills/router/SKILL.md"), Some((Tool::Claude, Kind::Skill)));
    }

    #[test]
    fn claude_memory_only_inside_the_projects_store() {
        assert_eq!(class("/Users/someone/.claude/projects/-Users-someone/memory/MEMORY.md"), Some((Tool::Claude, Kind::MemoryIndex)));
        assert_eq!(class("/Users/someone/.claude/projects/-Users-someone/memory/feedback_x.md"), Some((Tool::Claude, Kind::Memory)));
        assert_eq!(class("/Users/someone/code/app/memory/MEMORY.md"), None);
    }

    #[test]
    fn cursor_rules_and_skills() {
        assert_eq!(class("/Users/someone/.cursor/rules/no-commits.mdc"), Some((Tool::Cursor, Kind::Rule)));
        assert_eq!(class("/Users/someone/code/app/.cursor/rules/api/errors.mdc"), Some((Tool::Cursor, Kind::Rule)));
        assert_eq!(class("/Users/someone/code/app/.cursor/rules/plain.md"), Some((Tool::Cursor, Kind::Rule)));
        assert_eq!(class("/Users/someone/code/app/.cursor/skills/deploy/SKILL.md"), Some((Tool::Cursor, Kind::Skill)));
    }

    #[test]
    fn reference_docs_live_in_docs_claude() {
        assert_eq!(class("/Users/someone/acme/docs/claude/frontends.md"), Some((Tool::Claude, Kind::Reference)));
        assert_eq!(class("/Users/someone/app/docs/claude/deep/notes.md"), Some((Tool::Claude, Kind::Reference)));
        assert_eq!(class("/Users/someone/app/docs/notes.md"), None);
        assert_eq!(class("/Users/someone/app/docs/claude/notes.txt"), None);
    }

    #[test]
    fn everything_else_is_not_config() {
        assert_eq!(class("/Users/someone/code/app/README.md"), None);
        assert_eq!(class("/Users/someone/code/app/.claude/skills/router/notes.md"), None);
        assert_eq!(class("/Users/someone/code/app/.claude/skills/SKILL.md"), None);
        assert_eq!(class("/Users/someone/.cursor/skills-cursor/review/SKILL.md"), None);
        assert_eq!(class("/Users/someone/code/app/.claude/rules/notes.txt"), None);
        assert_eq!(class("/Users/someone/code/app/.claude/other.json"), None);
        assert_eq!(class("/etc/CLAUDE.md"), None);
        assert_eq!(class("/Users/someone/code/app/node_modules/pkg/CLAUDE.md"), None);
    }

    #[test]
    fn path_tricks_are_rejected() {
        assert_eq!(class("/Users/someone/.claude/skills/../../.ssh/CLAUDE.md"), None);
        assert_eq!(class("/Users/someone/.claude/rules/../../../etc/x.md"), None);
        assert_eq!(class("relative/CLAUDE.md"), None);
    }

    #[test]
    fn editable_requires_a_real_home_parent_without_symlink_escape() {
        let tmp = tempfile::tempdir().unwrap();
        let home = tmp.path().canonicalize().unwrap();
        let outside = tempfile::tempdir().unwrap();

        std::fs::create_dir_all(home.join("code/app/.claude/rules")).unwrap();
        assert!(is_editable(&home, &home.join("code/app/.claude/rules/new.md")));
        assert!(is_editable(&home, &home.join("code/app/CLAUDE.md")));

        assert!(!is_editable(&home, &home.join("code/missing-dir/CLAUDE.md")));
        assert!(!is_editable(&home, &home.join("code/app/README.md")));

        std::os::unix::fs::symlink(outside.path(), home.join("code/escape")).unwrap();
        assert!(!is_editable(&home, &home.join("code/escape/CLAUDE.md")));
    }
}
