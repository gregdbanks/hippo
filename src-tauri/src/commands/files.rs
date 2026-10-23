use crate::util::config_paths::{classify, is_editable, resolve, Kind};
use crate::util::paths::home_dir;
use crate::util::safe_write::atomic_write;
use crate::util::tokens::estimate_tokens;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

pub const CONFLICT: &str = "CONFLICT";

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FileReadResult {
    pub content: String,
    pub size_bytes: u64,
    pub modified: String,
    pub tokens: usize,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FileWriteResult {
    pub size_bytes: u64,
    pub tokens: usize,
    pub modified: String,
}

#[derive(Serialize)]
pub struct FileDeleteResult {
    pub deleted: bool,
}

#[derive(Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum NewFileKind {
    ClaudeRule,
    CursorRule,
    ClaudeSkill,
    CursorSkill,
}

fn modified_of(path: &Path) -> String {
    fs::metadata(path)
        .and_then(|m| m.modified())
        .map(|t| chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339())
        .unwrap_or_default()
}

pub fn read_config(home: &Path, path: &Path) -> Result<FileReadResult, String> {
    let target = resolve(home, path).ok_or("Hippo only opens Claude and Cursor config files inside your home folder.")?;
    let content = fs::read_to_string(&target).map_err(|e| format!("Cannot read file: {}", e))?;
    Ok(FileReadResult {
        tokens: estimate_tokens(&content),
        size_bytes: content.len() as u64,
        modified: modified_of(path),
        content,
    })
}

pub fn write_config(home: &Path, path: &Path, content: &str, expected_modified: Option<&str>) -> Result<FileWriteResult, String> {
    let target = resolve(home, path).ok_or("Hippo only saves Claude and Cursor config files inside your home folder.")?;
    if let Some(expected) = expected_modified {
        if !target.exists() || modified_of(&target) != expected {
            return Err(format!("{}: This file changed on disk since you opened it. Reload to see the latest, then make your edit again.", CONFLICT));
        }
    }
    if classify(home, path).map(|(_, k)| k) == Some(Kind::Settings) {
        serde_json::from_str::<serde_json::Value>(content).map_err(|e| format!("Not valid JSON ({}). Nothing was saved.", e))?;
    }
    atomic_write(&target, content)?;
    Ok(FileWriteResult {
        size_bytes: content.len() as u64,
        tokens: estimate_tokens(content),
        modified: modified_of(&target),
    })
}

pub fn delete_config(home: &Path, path: &Path) -> Result<(), String> {
    if classify(home, path).map(|(_, k)| k) != Some(Kind::Memory) || resolve(home, path).is_none() {
        return Err("Only memory files can be deleted.".to_string());
    }
    fs::remove_file(path).map_err(|e| format!("Cannot delete file: {}", e))?;

    let filename = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
    let index = path.with_file_name("MEMORY.md");
    if let Some(index_target) = resolve(home, &index).filter(|t| t.exists()) {
        let content = fs::read_to_string(&index_target).map_err(|e| format!("Deleted, but couldn't update MEMORY.md: {}", e))?;
        let updated = remove_index_line(&content, &filename);
        if updated != content {
            atomic_write(&index_target, &updated)?;
        }
    }
    Ok(())
}

fn valid_name(name: &str) -> bool {
    (1..=64).contains(&name.len()) && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

fn title_of(name: &str) -> String {
    let words = name.replace(['-', '_'], " ");
    let mut chars = words.chars();
    chars.next().map(|c| c.to_uppercase().chain(chars).collect()).unwrap_or_default()
}

fn template(kind: NewFileKind, name: &str) -> String {
    let title = title_of(name);
    match kind {
        NewFileKind::ClaudeRule => format!("# {}\n\n- \n", title),
        NewFileKind::CursorRule => format!("---\ndescription: \nglobs: \nalwaysApply: false\n---\n\n# {}\n\n- \n", title),
        NewFileKind::ClaudeSkill | NewFileKind::CursorSkill => format!("---\nname: {}\ndescription: \n---\n\n# {}\n\n", name, title),
    }
}

pub fn create_config(home: &Path, root: &Path, kind: NewFileKind, name: &str) -> Result<PathBuf, String> {
    if !valid_name(name) {
        return Err("Use letters, numbers, dashes or underscores for the name.".to_string());
    }
    let real_home = home.canonicalize().map_err(|e| format!("Home folder not found: {}", e))?;
    let real_root = root.canonicalize().map_err(|_| "That project folder doesn't exist.".to_string())?;
    if !real_root.starts_with(&real_home) || !real_root.is_dir() {
        return Err("New files can only be created inside your home folder.".to_string());
    }

    let path = match kind {
        NewFileKind::ClaudeRule => real_root.join(".claude/rules").join(format!("{}.md", name)),
        NewFileKind::CursorRule => real_root.join(".cursor/rules").join(format!("{}.mdc", name)),
        NewFileKind::ClaudeSkill => real_root.join(".claude/skills").join(name).join("SKILL.md"),
        NewFileKind::CursorSkill => real_root.join(".cursor/skills").join(name).join("SKILL.md"),
    };
    if path.exists() {
        return Err(format!("{} already exists.", path.display()));
    }
    if classify(&real_home, &path).is_none() {
        return Err("That location isn't a Claude or Cursor config folder.".to_string());
    }
    let parent = path.parent().ok_or("Invalid location")?;
    fs::create_dir_all(parent).map_err(|e| format!("Cannot create folder: {}", e))?;
    if !is_editable(&real_home, &path) {
        return Err("That location isn't inside your home folder.".to_string());
    }

    use std::io::Write;
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&path)
        .map_err(|e| format!("Cannot create file: {}", e))?;
    file.write_all(template(kind, name).as_bytes()).map_err(|e| format!("Cannot write file: {}", e))?;
    Ok(path)
}

fn remove_index_line(index: &str, filename: &str) -> String {
    let links = [format!("({})", filename), format!("(./{})", filename)];
    let mut kept: String = index
        .lines()
        .filter(|l| !links.iter().any(|link| l.contains(link.as_str())))
        .collect::<Vec<_>>()
        .join("\n");
    if index.ends_with('\n') {
        kept.push('\n');
    }
    kept
}

#[tauri::command]
pub fn read_file(path: String) -> Result<FileReadResult, String> {
    read_config(&home_dir(), Path::new(&path))
}

#[tauri::command]
pub fn write_file(path: String, content: String, expected_modified: Option<String>) -> Result<FileWriteResult, String> {
    write_config(&home_dir(), Path::new(&path), &content, expected_modified.as_deref())
}

#[tauri::command]
pub fn create_config_file(root: String, kind: NewFileKind, name: String) -> Result<String, String> {
    create_config(&home_dir(), Path::new(&root), kind, &name).map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
pub fn delete_file(path: String) -> Result<FileDeleteResult, String> {
    delete_config(&home_dir(), Path::new(&path)).map(|_| FileDeleteResult { deleted: true })
}

#[cfg(test)]
mod tests {
    use super::*;

    struct Home {
        _tmp: tempfile::TempDir,
        root: PathBuf,
    }

    fn home() -> Home {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path().canonicalize().unwrap();
        Home { _tmp: tmp, root }
    }

    fn put(h: &Home, rel: &str, text: &str) -> PathBuf {
        let p = h.root.join(rel);
        fs::create_dir_all(p.parent().unwrap()).unwrap();
        fs::write(&p, text).unwrap();
        p
    }

    #[test]
    fn reads_config_files_but_not_other_files() {
        let h = home();
        let claude = put(&h, "app/CLAUDE.md", "# app\n");
        let secret = put(&h, ".ssh/id_rsa", "key\n");
        assert_eq!(read_config(&h.root, &claude).unwrap().content, "# app\n");
        assert!(read_config(&h.root, &secret).is_err());
    }

    #[test]
    fn saves_when_unchanged_since_it_was_opened() {
        let h = home();
        let p = put(&h, "app/CLAUDE.md", "old\n");
        let opened = read_config(&h.root, &p).unwrap().modified;
        let saved = write_config(&h.root, &p, "new\n", Some(&opened)).unwrap();
        assert_eq!(fs::read_to_string(&p).unwrap(), "new\n");
        assert!(!saved.modified.is_empty());
    }

    #[test]
    fn refuses_to_overwrite_a_file_changed_on_disk() {
        let h = home();
        let p = put(&h, "app/CLAUDE.md", "old\n");
        let err = write_config(&h.root, &p, "mine\n", Some("2001-01-01T00:00:00+00:00")).unwrap_err();
        assert!(err.starts_with(CONFLICT));
        assert_eq!(fs::read_to_string(&p).unwrap(), "old\n");
    }

    #[test]
    fn refuses_non_config_and_outside_home() {
        let h = home();
        let readme = put(&h, "app/README.md", "x\n");
        assert!(write_config(&h.root, &readme, "pwned", None).is_err());
        assert!(write_config(&h.root, Path::new("/tmp/CLAUDE.md"), "pwned", None).is_err());
        assert_eq!(fs::read_to_string(&readme).unwrap(), "x\n");
    }

    #[test]
    fn refuses_invalid_json_in_settings() {
        let h = home();
        let p = put(&h, ".claude/settings.json", "{\"a\": 1}\n");
        assert!(write_config(&h.root, &p, "{\"a\": ", None).is_err());
        assert_eq!(fs::read_to_string(&p).unwrap(), "{\"a\": 1}\n");
        assert!(write_config(&h.root, &p, "{\"a\": 2}\n", None).is_ok());
    }

    #[test]
    fn creates_new_rules_and_skills_from_templates() {
        let h = home();
        fs::create_dir_all(h.root.join("app")).unwrap();
        let app = h.root.join("app");

        let claude_rule = create_config(&h.root, &app, NewFileKind::ClaudeRule, "api-style").unwrap();
        assert_eq!(claude_rule, app.join(".claude/rules/api-style.md"));
        let cursor_rule = create_config(&h.root, &app, NewFileKind::CursorRule, "api-style").unwrap();
        assert_eq!(cursor_rule, app.join(".cursor/rules/api-style.mdc"));
        assert!(fs::read_to_string(&cursor_rule).unwrap().contains("alwaysApply: false"));
        let skill = create_config(&h.root, &h.root, NewFileKind::ClaudeSkill, "triage").unwrap();
        assert_eq!(skill, h.root.join(".claude/skills/triage/SKILL.md"));
        assert!(fs::read_to_string(&skill).unwrap().contains("name: triage"));
        let cursor_skill = create_config(&h.root, &app, NewFileKind::CursorSkill, "triage").unwrap();
        assert_eq!(cursor_skill, app.join(".cursor/skills/triage/SKILL.md"));
    }

    #[test]
    fn create_never_overwrites_and_validates_inputs() {
        let h = home();
        fs::create_dir_all(h.root.join("app")).unwrap();
        let app = h.root.join("app");
        put(&h, "app/.claude/rules/taken.md", "mine\n");

        assert!(create_config(&h.root, &app, NewFileKind::ClaudeRule, "taken").is_err());
        assert_eq!(fs::read_to_string(app.join(".claude/rules/taken.md")).unwrap(), "mine\n");
        assert!(create_config(&h.root, &app, NewFileKind::ClaudeRule, "../escape").is_err());
        assert!(create_config(&h.root, &app, NewFileKind::ClaudeRule, "").is_err());
        assert!(create_config(&h.root, Path::new("/tmp"), NewFileKind::ClaudeRule, "x").is_err());
        assert!(create_config(&h.root, &h.root.join("missing"), NewFileKind::ClaudeRule, "x").is_err());
    }

    #[test]
    fn deleting_a_memory_only_removes_its_own_index_line() {
        let index = "- [A](a.md) - first\n- [Data](data.md) - second\nplain text a.md mention stays\n";
        let updated = remove_index_line(index, "a.md");
        assert!(!updated.contains("(a.md)"));
        assert!(updated.contains("(data.md)"));
        assert!(updated.contains("plain text a.md mention stays"));
        assert!(updated.ends_with('\n'));
    }

    #[test]
    fn new_files_are_classified_as_config() {
        let h = home();
        fs::create_dir_all(h.root.join("app")).unwrap();
        let p = create_config(&h.root, &h.root.join("app"), NewFileKind::CursorRule, "x").unwrap();
        assert_eq!(classify(&h.root, &p).map(|(_, k)| k), Some(Kind::Rule));
    }

    #[test]
    fn saving_through_a_symlink_keeps_the_link_and_updates_its_target() {
        let h = home();
        let target = put(&h, "dotfiles/CLAUDE.md", "old\n");
        fs::create_dir_all(h.root.join(".claude")).unwrap();
        let link = h.root.join(".claude/CLAUDE.md");
        std::os::unix::fs::symlink(&target, &link).unwrap();

        write_config(&h.root, &link, "new\n", None).unwrap();
        assert!(fs::symlink_metadata(&link).unwrap().file_type().is_symlink());
        assert_eq!(fs::read_to_string(&target).unwrap(), "new\n");
    }

    #[test]
    fn a_planted_temp_file_symlink_cannot_redirect_a_save() {
        let h = home();
        let outside = put(&h, "victim/.zshrc", "keep me\n");
        let target = put(&h, "repo/CLAUDE.md", "old\n");
        std::os::unix::fs::symlink(&outside, h.root.join("repo/.CLAUDE.md.hippo-tmp")).unwrap();

        write_config(&h.root, &target, "new\n", None).unwrap();
        assert_eq!(fs::read_to_string(&outside).unwrap(), "keep me\n");
        assert!(!fs::symlink_metadata(&target).unwrap().file_type().is_symlink());
        assert_eq!(fs::read_to_string(&target).unwrap(), "new\n");
    }

    #[test]
    fn saving_keeps_the_original_file_permissions() {
        use std::os::unix::fs::PermissionsExt;
        let h = home();
        let p = put(&h, ".claude/settings.local.json", "{}\n");
        fs::set_permissions(&p, fs::Permissions::from_mode(0o600)).unwrap();
        write_config(&h.root, &p, "{\"a\": 1}\n", None).unwrap();
        assert_eq!(fs::metadata(&p).unwrap().permissions().mode() & 0o777, 0o600);
    }

    #[test]
    fn symlinks_to_non_config_files_cannot_be_read_or_written() {
        let h = home();
        let secret = put(&h, ".ssh/id_rsa", "key\n");
        let zshrc = put(&h, ".zshrc", "export X=1\n");
        fs::create_dir_all(h.root.join("x")).unwrap();
        std::os::unix::fs::symlink(&secret, h.root.join("x/CLAUDE.md")).unwrap();
        fs::create_dir_all(h.root.join("y")).unwrap();
        std::os::unix::fs::symlink(&zshrc, h.root.join("y/CLAUDE.md")).unwrap();

        assert!(read_config(&h.root, &h.root.join("x/CLAUDE.md")).is_err());
        assert!(write_config(&h.root, &h.root.join("y/CLAUDE.md"), "pwned", None).is_err());
        assert_eq!(fs::read_to_string(&zshrc).unwrap(), "export X=1\n");
    }

    #[test]
    fn a_dotfiles_symlink_to_a_matching_file_still_works() {
        let h = home();
        let real = put(&h, "dotfiles/claude/settings.json", "{}\n");
        fs::create_dir_all(h.root.join(".claude")).unwrap();
        std::os::unix::fs::symlink(&real, h.root.join(".claude/settings.json")).unwrap();
        assert!(read_config(&h.root, &h.root.join(".claude/settings.json")).is_ok());
        assert!(write_config(&h.root, &h.root.join(".claude/settings.json"), "{\"a\": 1}\n", None).is_ok());
        assert_eq!(fs::read_to_string(&real).unwrap(), "{\"a\": 1}\n");
    }

    #[test]
    fn saving_an_opened_file_that_has_since_been_deleted_is_a_conflict() {
        let h = home();
        fs::create_dir_all(h.root.join("app")).unwrap();
        let err = write_config(&h.root, &h.root.join("app/CLAUDE.md"), "x", Some("2026-01-01T00:00:00+00:00")).unwrap_err();
        assert!(err.starts_with(CONFLICT));
        assert!(!h.root.join("app/CLAUDE.md").exists());
    }

    #[test]
    fn delete_only_removes_memory_topic_files() {
        let h = home();
        let topic = put(&h, ".claude/projects/-p/memory/a.md", "x\n");
        let index = put(&h, ".claude/projects/-p/memory/MEMORY.md", "- [A](a.md) - x\n- [B](./b.md) - y\n");
        let plan = put(&h, ".claude/plans/p.md", "plan\n");
        let other = put(&h, ".claude/projects/-p/memory/notes.txt", "x\n");
        let elsewhere = put(&h, "memory-notes/a.md", "x\n");

        assert!(delete_config(&h.root, &plan).is_err());
        assert!(delete_config(&h.root, &other).is_err());
        assert!(delete_config(&h.root, &index).is_err());
        assert!(delete_config(&h.root, &elsewhere).is_err());
        assert!(plan.exists() && other.exists() && index.exists() && elsewhere.exists());

        delete_config(&h.root, &topic).unwrap();
        assert!(!topic.exists());
        let updated = fs::read_to_string(&index).unwrap();
        assert!(!updated.contains("(a.md)") && updated.contains("(./b.md)"));
    }

    #[test]
    fn index_line_removal_also_matches_dot_slash_links() {
        let updated = remove_index_line("- [A](./a.md) - x\n- [B](b.md) - y\n", "a.md");
        assert!(!updated.contains("a.md"));
        assert!(updated.contains("(b.md)"));
    }
}
