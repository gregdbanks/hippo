use crate::util::inventory::Inventory;
use serde::Serialize;

pub const MAX_HITS: usize = 300;

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub path: String,
    pub name: String,
    pub line: usize,
    pub text: String,
}

const MIN_QUERY: usize = 2;
const MAX_LINE_CHARS: usize = 200;

pub fn search(home: &std::path::Path, inv: &Inventory, query: &str) -> Vec<SearchHit> {
    let needle = query.trim().to_lowercase();
    if needle.chars().count() < MIN_QUERY {
        return Vec::new();
    }
    let mut seen = std::collections::HashSet::new();
    let mut hits = Vec::new();
    let files = inv.claude_global.iter().chain(inv.cursor_global.iter()).chain(inv.projects.iter().flat_map(|p| p.files.iter()));
    for f in files.filter(|f| f.link_target.is_none()) {
        let Some(target) = crate::util::config_paths::resolve(home, std::path::Path::new(&f.path)) else { continue };
        if !seen.insert(target.clone()) {
            continue;
        }
        let Ok(content) = std::fs::read_to_string(&target) else { continue };
        for (i, line) in content.lines().enumerate() {
            if line.to_lowercase().contains(&needle) {
                hits.push(SearchHit {
                    path: f.path.clone(),
                    name: f.name.clone(),
                    line: i + 1,
                    text: line.trim().chars().take(MAX_LINE_CHARS).collect(),
                });
                if hits.len() >= MAX_HITS {
                    return hits;
                }
            }
        }
    }
    hits
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn finds_matching_lines_across_global_and_project_files() {
        let tmp = tempfile::tempdir().unwrap();
        let home = tmp.path().canonicalize().unwrap();
        let write = |rel: &str, text: &str| {
            let p = home.join(rel);
            fs::create_dir_all(p.parent().unwrap()).unwrap();
            fs::write(p, text).unwrap();
        };
        write(".claude/CLAUDE.md", "# me\n- Always use the `/browser-testing` skill.\n");
        write("app/CLAUDE.md", "first\nBROWSER-TESTING again\n");
        std::os::unix::fs::symlink("CLAUDE.md", home.join("app/AGENTS.md")).unwrap();
        write("app/README.md", "browser-testing in a non-config file\n");

        let inv = crate::util::inventory::build(&home);
        let hits = search(&home, &inv, "browser-testing");
        let shown: Vec<(String, usize)> = hits.iter().map(|h| (h.path.replace(home.to_str().unwrap(), "~"), h.line)).collect();
        assert_eq!(shown, vec![("~/.claude/CLAUDE.md".to_string(), 2), ("~/app/CLAUDE.md".to_string(), 2)]);
        assert_eq!(hits[1].text, "BROWSER-TESTING again");
    }

    #[test]
    fn ignores_very_short_queries_and_caps_results() {
        let tmp = tempfile::tempdir().unwrap();
        let home = tmp.path().canonicalize().unwrap();
        fs::create_dir_all(home.join(".claude")).unwrap();
        fs::write(home.join(".claude/CLAUDE.md"), "x\n".repeat(1000)).unwrap();
        let inv = crate::util::inventory::build(&home);
        assert!(search(&home, &inv, " x").is_empty());
        fs::write(home.join(".claude/CLAUDE.md"), "xy\n".repeat(1000)).unwrap();
        let inv = crate::util::inventory::build(&home);
        assert_eq!(search(&home, &inv, "xy").len(), MAX_HITS);
    }
}
