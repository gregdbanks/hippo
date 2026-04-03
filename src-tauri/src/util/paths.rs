use std::env;
use std::path::{Path, PathBuf};

pub fn home_dir() -> PathBuf {
    PathBuf::from(env::var("HOME").unwrap_or_else(|_| "/tmp".to_string()))
}

pub fn claude_dir() -> PathBuf {
    home_dir().join(".claude")
}

pub fn global_claude_md() -> PathBuf {
    home_dir().join("CLAUDE.md")
}

pub fn settings_path() -> PathBuf {
    claude_dir().join("settings.json")
}

pub fn projects_dir() -> PathBuf {
    claude_dir().join("projects")
}

pub fn skills_dir() -> PathBuf {
    claude_dir().join("skills")
}

pub fn plans_dir() -> PathBuf {
    claude_dir().join("plans")
}

pub fn decode_project_slug(slug: &str) -> PathBuf {
    let parts: Vec<&str> = slug.split('-').filter(|s| !s.is_empty()).collect();

    // Try simple case: all dashes are path separators
    let simple = format!("/{}", parts.join("/"));
    if Path::new(&simple).exists() {
        return PathBuf::from(simple);
    }

    // Greedy approach: join with / if directory exists, otherwise join with -
    let mut current = String::new();
    for (i, part) in parts.iter().enumerate() {
        let candidate = if current.is_empty() {
            format!("/{}", part)
        } else {
            format!("{}/{}", current, part)
        };

        if i == parts.len() - 1 {
            // Last part
            if Path::new(&candidate).exists() {
                return PathBuf::from(candidate);
            }
            let dash_candidate = format!("{}-{}", current, part);
            if Path::new(&dash_candidate).exists() {
                return PathBuf::from(dash_candidate);
            }
            return PathBuf::from(candidate);
        }

        if Path::new(&candidate).exists() {
            current = candidate;
        } else {
            current = format!("{}-{}", current, part);
        }
    }

    PathBuf::from(simple)
}

pub fn is_path_writable(file_path: &Path) -> bool {
    let resolved = file_path.canonicalize().unwrap_or_else(|_| file_path.to_path_buf());

    // Check CLAUDE.md files in any existing directory
    if let Some(name) = resolved.file_name() {
        if name == "CLAUDE.md" {
            if let Some(parent) = resolved.parent() {
                return parent.exists();
            }
        }
    }

    let writable_prefixes = [
        claude_dir().join("projects"),
        claude_dir().join("skills"),
        claude_dir().join("plans"),
        settings_path(),
        global_claude_md(),
    ];

    writable_prefixes.iter().any(|prefix| {
        let p = prefix.canonicalize().unwrap_or_else(|_| prefix.clone());
        resolved == p || resolved.starts_with(&p)
    })
}

pub fn is_path_deletable(file_path: &Path) -> bool {
    let resolved = file_path.canonicalize().unwrap_or_else(|_| file_path.to_path_buf());
    let resolved_str = resolved.to_string_lossy();

    let projects_prefix = claude_dir().join("projects");
    let global_memory_prefix = claude_dir().join("memory");
    let plans_prefix = plans_dir();

    (resolved.starts_with(&projects_prefix) && resolved_str.contains("/memory/"))
        || (resolved.starts_with(&global_memory_prefix) && resolved_str.ends_with(".md"))
        || resolved.starts_with(&plans_prefix)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    /// Set up a fake HOME with the expected .claude directory structure.
    /// Returns the TempDir (must stay alive for the duration of the test).
    /// Uses canonicalized path so that is_path_deletable/is_path_writable
    /// comparisons work (canonicalize resolves symlinks on macOS).
    fn setup_fake_home() -> TempDir {
        let tmp = TempDir::new().unwrap();
        let home = tmp.path().canonicalize().unwrap();
        env::set_var("HOME", &home);

        // Create directory structure
        fs::create_dir_all(home.join(".claude/projects/my-project/memory")).unwrap();
        fs::create_dir_all(home.join(".claude/memory")).unwrap();
        fs::create_dir_all(home.join(".claude/skills")).unwrap();
        fs::create_dir_all(home.join(".claude/plans")).unwrap();

        // Create files that will be tested
        fs::write(home.join(".claude/settings.json"), "{}").unwrap();
        fs::write(home.join("CLAUDE.md"), "# root").unwrap();
        fs::write(
            home.join(".claude/projects/my-project/memory/note.md"),
            "test",
        )
        .unwrap();
        fs::write(home.join(".claude/memory/some_memory.md"), "test").unwrap();
        fs::write(home.join(".claude/memory/MEMORY.md"), "# index").unwrap();
        fs::write(home.join(".claude/plans/plan1.md"), "plan").unwrap();

        tmp
    }

    // NOTE: These tests mutate env::HOME so they must run serially.
    // Use `cargo test -- --test-threads=1` if needed, but since they each
    // create unique temp dirs the paths won't collide in practice — the
    // key concern is the global HOME var. We accept this tradeoff for
    // testing real path resolution logic.

    #[test]
    fn test_project_memory_is_deletable() {
        let tmp = setup_fake_home();
        let home = tmp.path().canonicalize().unwrap();
        let path = home.join(".claude/projects/my-project/memory/note.md");
        assert!(
            is_path_deletable(&path),
            "Project memory files should be deletable"
        );
    }

    #[test]
    fn test_global_memory_file_is_deletable() {
        let tmp = setup_fake_home();
        let home = tmp.path().canonicalize().unwrap();
        let path = home.join(".claude/memory/some_memory.md");
        assert!(
            is_path_deletable(&path),
            "Global memory .md files should be deletable (bug fix)"
        );
    }

    #[test]
    fn test_memory_index_is_deletable_but_its_just_an_md() {
        // MEMORY.md in global memory dir IS an .md file under ~/.claude/memory/,
        // so the current implementation allows it. The protection is at the
        // application layer (delete_file checks filename != "MEMORY.md").
        let tmp = setup_fake_home();
        let home = tmp.path().canonicalize().unwrap();
        let path = home.join(".claude/memory/MEMORY.md");
        // The path-level check allows it (it ends with .md and is under memory/).
        // The command-level delete_file function prevents actual deletion by
        // checking the filename. This test documents the boundary.
        assert!(
            is_path_deletable(&path),
            "MEMORY.md passes path check (command layer guards it)"
        );
    }

    #[test]
    fn test_random_path_not_deletable() {
        let _tmp = setup_fake_home();
        let random = Path::new("/etc/passwd");
        assert!(
            !is_path_deletable(random),
            "Paths outside .claude should not be deletable"
        );
    }

    #[test]
    fn test_home_dir_not_deletable() {
        let tmp = setup_fake_home();
        let home = tmp.path().canonicalize().unwrap();
        assert!(
            !is_path_deletable(&home),
            "Home directory itself should not be deletable"
        );
    }

    #[test]
    fn test_settings_not_deletable() {
        let tmp = setup_fake_home();
        let home = tmp.path().canonicalize().unwrap();
        let path = home.join(".claude/settings.json");
        assert!(
            !is_path_deletable(&path),
            "Settings file should not be deletable"
        );
    }

    #[test]
    fn test_plans_are_deletable() {
        let tmp = setup_fake_home();
        let home = tmp.path().canonicalize().unwrap();
        let path = home.join(".claude/plans/plan1.md");
        assert!(is_path_deletable(&path), "Plan files should be deletable");
    }

    #[test]
    fn test_settings_is_writable() {
        let tmp = setup_fake_home();
        let home = tmp.path().canonicalize().unwrap();
        let path = home.join(".claude/settings.json");
        assert!(
            is_path_writable(&path),
            "Settings path should be writable"
        );
    }

    #[test]
    fn test_claude_md_is_writable() {
        let tmp = setup_fake_home();
        let home = tmp.path().canonicalize().unwrap();
        let path = home.join("CLAUDE.md");
        assert!(
            is_path_writable(&path),
            "Global CLAUDE.md should be writable"
        );
    }

    #[test]
    fn test_claude_md_in_project_dir_is_writable() {
        let tmp = setup_fake_home();
        let home = tmp.path().canonicalize().unwrap();
        // CLAUDE.md in any existing directory should be writable
        let dir = home.join("some-project");
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("CLAUDE.md");
        assert!(
            is_path_writable(&path),
            "CLAUDE.md in any existing directory should be writable"
        );
    }

    #[test]
    fn test_random_path_not_writable() {
        let _tmp = setup_fake_home();
        let path = Path::new("/etc/some_random_file.txt");
        assert!(
            !is_path_writable(path),
            "Random paths should not be writable"
        );
    }

    #[test]
    fn test_project_files_are_writable() {
        let tmp = setup_fake_home();
        let home = tmp.path().canonicalize().unwrap();
        let path = home.join(".claude/projects/my-project/memory/note.md");
        assert!(
            is_path_writable(&path),
            "Project files should be writable"
        );
    }
}
