use std::env;
use std::path::PathBuf;

pub fn home_dir() -> PathBuf {
    PathBuf::from(env::var("HOME").unwrap_or_else(|_| "/tmp".to_string()))
}

pub fn claude_dir() -> PathBuf {
    home_dir().join(".claude")
}

pub fn projects_dir() -> PathBuf {
    claude_dir().join("projects")
}
