use crate::util::paths::home_dir;
use crate::util::unity::{link_agents_md, mirror_rules, MirrorReport};
use std::path::Path;

#[tauri::command(async)]
pub fn share_with_cursor(root: String) -> Result<String, String> {
    link_agents_md(&home_dir(), Path::new(&root)).map(|p| p.to_string_lossy().to_string())
}

#[tauri::command(async)]
pub fn mirror_rules_to_cursor(root: String) -> Result<MirrorReport, String> {
    mirror_rules(&home_dir(), Path::new(&root))
}
