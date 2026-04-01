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
    let plans_prefix = plans_dir();

    (resolved.starts_with(&projects_prefix) && resolved_str.contains("/memory/"))
        || resolved.starts_with(&plans_prefix)
}
