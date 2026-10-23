use crate::util::config_paths::is_editable;
use crate::util::frontmatter::parse_frontmatter;
use crate::util::safe_write::atomic_write;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

pub const MIRROR_MARKER: &str = "<!-- hippo:mirrored-from ";

#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum MirrorState {
    Missing,
    Outdated,
    Current,
    HandWritten,
    Orphaned,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MirrorItem {
    pub source: Option<String>,
    pub dest: String,
    pub state: MirrorState,
}

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct MirrorReport {
    pub created: Vec<String>,
    pub updated: Vec<String>,
    pub removed: Vec<String>,
    pub unchanged: Vec<String>,
    pub skipped: Vec<String>,
}

fn project_root(home: &Path, root: &Path) -> Result<PathBuf, String> {
    let real_home = home.canonicalize().map_err(|e| format!("Home folder not found: {}", e))?;
    let real_root = root.canonicalize().map_err(|_| "That project folder doesn't exist.".to_string())?;
    if !real_root.is_dir() || !real_root.starts_with(&real_home) {
        return Err("Only project folders inside your home folder can be changed.".to_string());
    }
    if real_root == real_home {
        return Err("This works per project. Cursor keeps its global rules in Settings > Rules, not in files.".to_string());
    }
    Ok(real_root)
}

pub fn link_agents_md(home: &Path, root: &Path) -> Result<PathBuf, String> {
    let root = project_root(home, root)?;
    let claude = root.join("CLAUDE.md");
    if !claude.symlink_metadata().map(|m| m.is_file()).unwrap_or(false) {
        return Err("This project has no CLAUDE.md file to share.".to_string());
    }
    let agents = root.join("AGENTS.md");
    if agents.symlink_metadata().is_ok() {
        return Err("AGENTS.md already exists here, so Hippo won't replace it.".to_string());
    }
    std::os::unix::fs::symlink("CLAUDE.md", &agents).map_err(|e| format!("Couldn't create AGENTS.md: {}", e))?;
    Ok(agents)
}

const MAX_DEPTH: usize = 6;

pub fn is_mirrored(content: &str) -> bool {
    let Some(rest) = content.strip_prefix("---\n") else { return false };
    let Some(end) = rest.find("\n---\n") else { return false };
    rest[end + 5..].trim_start_matches('\n').starts_with(MIRROR_MARKER)
}

fn walk(dir: &Path, depth: usize, keep: &dyn Fn(&Path) -> bool, out: &mut Vec<PathBuf>) {
    if depth > MAX_DEPTH {
        return;
    }
    let mut entries: Vec<PathBuf> = fs::read_dir(dir).map(|rd| rd.flatten().map(|e| e.path()).collect()).unwrap_or_default();
    entries.sort();
    for entry in entries {
        let Ok(meta) = fs::symlink_metadata(&entry) else { continue };
        if meta.is_dir() {
            walk(&entry, depth + 1, keep, out);
        } else if fs::metadata(&entry).map(|m| m.is_file()).unwrap_or(false) && keep(&entry) {
            out.push(entry);
        }
    }
}

fn rule_sources(rules: &Path) -> Vec<PathBuf> {
    let mut files = Vec::new();
    walk(rules, 0, &|p| p.extension().map(|e| e == "md").unwrap_or(false), &mut files);
    files.into_iter().filter_map(|f| f.strip_prefix(rules).ok().map(|r| r.to_path_buf())).collect()
}

fn mirrored_files(dir: &Path) -> Vec<PathBuf> {
    let mut files = Vec::new();
    walk(
        dir,
        0,
        &|p| p.extension().map(|e| e == "mdc").unwrap_or(false) && fs::read_to_string(p).map(|c| is_mirrored(&c)).unwrap_or(false),
        &mut files,
    );
    files
}

fn split_top_level(text: &str) -> Vec<String> {
    let mut parts = Vec::new();
    let mut depth = 0i32;
    let mut current = String::new();
    for c in text.chars() {
        match c {
            '{' => { depth += 1; current.push(c) }
            '}' => { depth -= 1; current.push(c) }
            ',' if depth == 0 => { parts.push(current.trim().to_string()); current.clear() }
            _ => current.push(c),
        }
    }
    if !current.trim().is_empty() {
        parts.push(current.trim().to_string());
    }
    parts
}

fn unquote(value: &str) -> String {
    let v = value.trim();
    if v.len() >= 2 && ((v.starts_with('"') && v.ends_with('"')) || (v.starts_with('\'') && v.ends_with('\''))) {
        v[1..v.len() - 1].to_string()
    } else {
        v.to_string()
    }
}

fn expand_braces(glob: &str) -> Vec<String> {
    let Some(open) = glob.find('{') else { return vec![glob.to_string()] };
    let mut depth = 0;
    let mut close = None;
    for (i, c) in glob[open..].char_indices() {
        match c {
            '{' => depth += 1,
            '}' => { depth -= 1; if depth == 0 { close = Some(open + i); break } }
            _ => {}
        }
    }
    let Some(close) = close else { return vec![glob.to_string()] };
    let (prefix, inner, suffix) = (&glob[..open], &glob[open + 1..close], &glob[close + 1..]);
    split_top_level(inner).iter().flat_map(|opt| expand_braces(&format!("{}{}{}", prefix, opt, suffix))).collect()
}

fn claude_paths(source: &str) -> Vec<String> {
    let Some(rest) = source.strip_prefix("---\n") else { return Vec::new() };
    let Some(end) = rest.find("\n---") else { return Vec::new() };
    let lines: Vec<&str> = rest[..end].lines().collect();
    let Some(i) = lines.iter().position(|l| l.starts_with("paths:")) else { return Vec::new() };
    let inline = lines[i]["paths:".len()..].trim();
    let raw: Vec<String> = if inline.starts_with('[') {
        let mut text = inline.to_string();
        let mut j = i + 1;
        while !text.contains(']') && j < lines.len() {
            text.push_str(lines[j].trim());
            j += 1;
        }
        split_top_level(text.trim_start_matches('[').split(']').next().unwrap_or(""))
    } else if inline.is_empty() {
        lines[i + 1..].iter().take_while(|l| l.trim_start().starts_with("- ")).map(|l| l.trim_start()[2..].to_string()).collect()
    } else {
        vec![inline.to_string()]
    };
    raw.iter().map(|g| unquote(g)).filter(|g| !g.is_empty()).flat_map(|g| expand_braces(&g)).collect()
}

fn yaml_safe(text: &str) -> String {
    let one_line = text.split_whitespace().collect::<Vec<_>>().join(" ");
    let needs_quotes = one_line.contains(": ")
        || one_line.contains(" #")
        || one_line.ends_with(':')
        || one_line.starts_with(['[', '{', '&', '*', '!', '|', '>', '\'', '"', '%', '@', '`', '#', '-', '?']);
    if needs_quotes {
        format!("\"{}\"", one_line.replace('\\', "\\\\").replace('"', "\\\""))
    } else {
        one_line
    }
}

fn render(rel: &Path, source: &str) -> String {
    let parsed = parse_frontmatter(source);
    let fm = &parsed.frontmatter;
    let heading = parsed.body.lines().find_map(|l| l.strip_prefix("# ")).map(|h| h.trim().to_string());
    let stem = rel.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
    let description = fm.get("description").filter(|d| !d.trim().is_empty()).cloned().or(heading).unwrap_or(stem);
    let globs = claude_paths(source).join(", ");
    let always = globs.is_empty();
    format!(
        "---\ndescription: {}\nglobs: {}\nalwaysApply: {}\n---\n{}.claude/rules/{}. Edit that file and mirror again; changes made here get overwritten. -->\n\n{}",
        yaml_safe(&description),
        globs,
        always,
        MIRROR_MARKER,
        rel.to_string_lossy(),
        parsed.body
    )
}

fn planned(root: &Path) -> Vec<(Option<PathBuf>, PathBuf, Option<String>)> {
    let rules = root.join(".claude/rules");
    let sources = rule_sources(&rules);
    let mut plan: Vec<(Option<PathBuf>, PathBuf, Option<String>)> = sources
        .into_iter()
        .filter_map(|rel| {
            let content = fs::read_to_string(rules.join(&rel)).ok()?;
            let dest = root.join(".cursor/rules").join(&rel).with_extension("mdc");
            Some((Some(rel.clone()), dest, Some(render(&rel, &content))))
        })
        .collect();
    let mut existing = mirrored_files(&root.join(".cursor/rules"));
    existing.sort();
    for file in existing {
        if !plan.iter().any(|(_, dest, _)| *dest == file) {
            plan.push((None, file, None));
        }
    }
    plan
}

fn state_of(dest: &Path, expected: Option<&str>) -> MirrorState {
    let Some(expected) = expected else { return MirrorState::Orphaned };
    match fs::read_to_string(dest) {
        Err(_) => MirrorState::Missing,
        Ok(current) if !is_mirrored(&current) => MirrorState::HandWritten,
        Ok(current) if current == expected => MirrorState::Current,
        Ok(_) => MirrorState::Outdated,
    }
}

pub fn mirror_plan(home: &Path, root: &Path) -> Vec<MirrorItem> {
    let Ok(root) = project_root(home, root) else { return Vec::new() };
    planned(&root)
        .into_iter()
        .map(|(source, dest, expected)| MirrorItem {
            state: state_of(&dest, expected.as_deref()),
            source: source.map(|s| format!(".claude/rules/{}", s.to_string_lossy())),
            dest: dest.to_string_lossy().to_string(),
        })
        .collect()
}

fn inside_cursor_rules(root: &Path, dest: &Path) -> bool {
    let Ok(rules) = root.join(".cursor/rules").canonicalize() else { return false };
    let parent_ok = dest.parent().and_then(|p| p.canonicalize().ok()).map(|p| p.starts_with(&rules)).unwrap_or(false);
    let not_a_link = fs::symlink_metadata(dest).map(|m| !m.file_type().is_symlink()).unwrap_or(true);
    parent_ok && not_a_link
}

pub fn mirror_rules(home: &Path, root: &Path) -> Result<MirrorReport, String> {
    let root = project_root(home, root)?;
    let mut report = MirrorReport::default();
    for (_, dest, expected) in planned(&root) {
        let shown = dest.strip_prefix(&root).map(|p| p.to_string_lossy().to_string()).unwrap_or_default();
        match (state_of(&dest, expected.as_deref()), expected) {
            (MirrorState::Missing, Some(text)) | (MirrorState::Outdated, Some(text)) => {
                let is_new = !dest.exists();
                fs::create_dir_all(dest.parent().ok_or("Invalid location")?).map_err(|e| format!("Cannot create folder: {}", e))?;
                if !is_editable(home, &dest) || !inside_cursor_rules(&root, &dest) {
                    return Err(format!("{} isn't a location Hippo can write to.", shown));
                }
                atomic_write(&dest, &text)?;
                if is_new { report.created.push(shown) } else { report.updated.push(shown) }
            }
            (MirrorState::Orphaned, _) => {
                if !inside_cursor_rules(&root, &dest) {
                    report.skipped.push(shown);
                    continue;
                }
                fs::remove_file(&dest).map_err(|e| format!("Couldn't remove {}: {}", shown, e))?;
                report.removed.push(shown);
            }
            (MirrorState::HandWritten, _) => report.skipped.push(shown),
            _ => report.unchanged.push(shown),
        }
    }
    Ok(report)
}

#[cfg(test)]
mod tests {
    use super::*;

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

        fn read(&self, rel: &str) -> String {
            fs::read_to_string(self.root.join(rel)).unwrap()
        }
    }

    #[test]
    fn link_points_agents_md_at_claude_md_with_a_relative_link() {
        let h = Home::new();
        h.write("app/CLAUDE.md", "# app rules\n");
        let link = link_agents_md(&h.root, &h.root.join("app")).unwrap();

        assert_eq!(link, h.root.join("app/AGENTS.md"));
        assert_eq!(fs::read_link(&link).unwrap(), PathBuf::from("CLAUDE.md"));
        assert_eq!(h.read("app/AGENTS.md"), "# app rules\n");
    }

    #[test]
    fn link_refuses_when_it_would_overwrite_or_has_nothing_to_point_at() {
        let h = Home::new();
        h.write("has-agents/CLAUDE.md", "@AGENTS.md\n");
        h.write("has-agents/AGENTS.md", "# real instructions\n");
        fs::create_dir_all(h.root.join("no-claude")).unwrap();

        assert!(link_agents_md(&h.root, &h.root.join("has-agents")).is_err());
        assert_eq!(h.read("has-agents/AGENTS.md"), "# real instructions\n");
        assert!(link_agents_md(&h.root, &h.root.join("no-claude")).is_err());
        assert!(link_agents_md(&h.root, Path::new("/tmp")).is_err());
        assert!(link_agents_md(&h.root, &h.root).is_err());
    }

    #[test]
    fn mirror_turns_claude_rules_into_cursor_rules() {
        let h = Home::new();
        h.write("app/.claude/rules/style.md", "# Code style\n\n- Few comments.\n");
        h.write("app/.claude/rules/api/services.md", "---\ndescription: Service classes\npaths:\n  - \"**/src/services/**/*.ts\"\n  - \"**/src/api/**\"\n---\n- Check response.ok.\n");
        let report = mirror_rules(&h.root, &h.root.join("app")).unwrap();
        assert_eq!(report.created.len(), 2);

        let always = h.read("app/.cursor/rules/style.mdc");
        assert!(always.starts_with("---\ndescription: Code style\nglobs: \nalwaysApply: true\n---\n"));
        assert!(always.contains("hippo:mirrored-from .claude/rules/style.md"));
        assert!(always.ends_with("# Code style\n\n- Few comments.\n"));

        let scoped = h.read("app/.cursor/rules/api/services.mdc");
        assert!(scoped.starts_with("---\ndescription: Service classes\nglobs: **/src/services/**/*.ts, **/src/api/**\nalwaysApply: false\n---\n"));
        assert!(scoped.ends_with("- Check response.ok.\n"));
        assert!(!scoped.contains("paths:"));
    }

    #[test]
    fn mirror_is_idempotent_and_follows_source_edits() {
        let h = Home::new();
        h.write("app/.claude/rules/style.md", "- one\n");
        mirror_rules(&h.root, &h.root.join("app")).unwrap();

        let again = mirror_rules(&h.root, &h.root.join("app")).unwrap();
        assert!(again.created.is_empty() && again.updated.is_empty());
        assert_eq!(again.unchanged.len(), 1);

        h.write("app/.claude/rules/style.md", "- two\n");
        assert_eq!(mirror_plan(&h.root, &h.root.join("app"))[0].state, MirrorState::Outdated);
        let edited = mirror_rules(&h.root, &h.root.join("app")).unwrap();
        assert_eq!(edited.updated.len(), 1);
        assert!(h.read("app/.cursor/rules/style.mdc").ends_with("- two\n"));
    }

    #[test]
    fn mirror_never_touches_hand_written_cursor_rules() {
        let h = Home::new();
        h.write("app/.claude/rules/style.md", "- from claude\n");
        h.write("app/.cursor/rules/style.mdc", "---\nalwaysApply: true\n---\nmine\n");
        h.write("app/.cursor/rules/other.mdc", "---\nalwaysApply: true\n---\nalso mine\n");

        let report = mirror_rules(&h.root, &h.root.join("app")).unwrap();
        assert_eq!(report.skipped.len(), 1);
        assert_eq!(h.read("app/.cursor/rules/style.mdc"), "---\nalwaysApply: true\n---\nmine\n");
        assert_eq!(h.read("app/.cursor/rules/other.mdc"), "---\nalwaysApply: true\n---\nalso mine\n");
        assert_eq!(mirror_plan(&h.root, &h.root.join("app"))[0].state, MirrorState::HandWritten);
    }

    #[test]
    fn mirrored_rules_are_removed_when_their_claude_rule_is_deleted() {
        let h = Home::new();
        h.write("app/.claude/rules/gone.md", "- temp\n");
        mirror_rules(&h.root, &h.root.join("app")).unwrap();
        fs::remove_file(h.root.join("app/.claude/rules/gone.md")).unwrap();
        h.write("app/.cursor/rules/keep.mdc", "mine\n");

        let plan = mirror_plan(&h.root, &h.root.join("app"));
        assert!(plan.iter().any(|i| i.state == MirrorState::Orphaned));
        let report = mirror_rules(&h.root, &h.root.join("app")).unwrap();
        assert_eq!(report.removed.len(), 1);
        assert!(!h.root.join("app/.cursor/rules/gone.mdc").exists());
        assert!(h.root.join("app/.cursor/rules/keep.mdc").exists());
    }

    #[test]
    fn mirror_plan_reports_missing_before_the_first_run() {
        let h = Home::new();
        h.write("app/.claude/rules/style.md", "- x\n");
        let plan = mirror_plan(&h.root, &h.root.join("app"));
        assert_eq!(plan.len(), 1);
        assert_eq!(plan[0].state, MirrorState::Missing);
        assert!(plan[0].dest.ends_with(".cursor/rules/style.mdc"));
    }

    #[test]
    fn mirror_refuses_the_home_folder_and_places_outside_it() {
        let h = Home::new();
        h.write(".claude/rules/global.md", "- x\n");
        assert!(mirror_rules(&h.root, &h.root).is_err());
        assert!(mirror_rules(&h.root, Path::new("/tmp")).is_err());
        assert!(!h.root.join(".cursor/rules/global.mdc").exists());
    }

    #[test]
    fn mirror_never_reaches_into_another_project_through_a_symlinked_folder() {
        let h = Home::new();
        h.write("other/.cursor/rules/theirs.mdc", "---\nalwaysApply: true\n---\n<!-- hippo:mirrored-from .claude/rules/theirs.md. Edit that file and mirror again; changes made here get overwritten. -->\n\nx\n");
        h.write("app/.claude/rules/style.md", "- x\n");
        fs::create_dir_all(h.root.join("app/.cursor/rules")).unwrap();
        std::os::unix::fs::symlink(h.root.join("other/.cursor/rules"), h.root.join("app/.cursor/rules/shared")).unwrap();

        assert!(mirror_plan(&h.root, &h.root.join("app")).iter().all(|i| !i.dest.contains("theirs")));
        mirror_rules(&h.root, &h.root.join("app")).unwrap();
        assert!(h.root.join("other/.cursor/rules/theirs.mdc").exists());
    }

    #[test]
    fn symlink_loops_in_rule_folders_do_not_hang() {
        let h = Home::new();
        h.write("app/.claude/rules/style.md", "- x\n");
        std::os::unix::fs::symlink(".", h.root.join("app/.claude/rules/self")).unwrap();
        fs::create_dir_all(h.root.join("app/.cursor/rules")).unwrap();
        std::os::unix::fs::symlink(".", h.root.join("app/.cursor/rules/self")).unwrap();
        assert_eq!(mirror_plan(&h.root, &h.root.join("app")).len(), 1);
    }

    #[test]
    fn a_hand_written_rule_that_mentions_the_marker_is_not_treated_as_mirrored() {
        let h = Home::new();
        h.write("app/.claude/rules/style.md", "- x\n");
        h.write("app/.cursor/rules/notes.mdc", "---\nalwaysApply: false\n---\nHippo marks files with <!-- hippo:mirrored-from ... -->\n");
        let report = mirror_rules(&h.root, &h.root.join("app")).unwrap();
        assert!(report.removed.is_empty());
        assert!(h.root.join("app/.cursor/rules/notes.mdc").exists());
    }

    #[test]
    fn globs_and_descriptions_come_out_as_valid_cursor_frontmatter() {
        let h = Home::new();
        h.write("app/.claude/rules/inline.md", "---\npaths: [\"src/**/*.{ts,tsx}\", \"lib/**\"]\n---\nx\n");
        h.write("app/.claude/rules/list.md", "---\npaths:\n  - \"src/**/*.{ts,tsx}\"\n---\nx\n");
        h.write("app/.claude/rules/colon.md", "# API: errors\n\nx\n");
        h.write("app/.claude/rules/block.md", "---\ndescription: |\n  Two\n  lines\npaths:\n  - \"a/**\"\n---\nx\n");
        mirror_rules(&h.root, &h.root.join("app")).unwrap();

        assert!(h.read("app/.cursor/rules/inline.mdc").contains("\nglobs: src/**/*.ts, src/**/*.tsx, lib/**\n"));
        assert!(h.read("app/.cursor/rules/list.mdc").contains("\nglobs: src/**/*.ts, src/**/*.tsx\n"));
        assert!(h.read("app/.cursor/rules/colon.mdc").starts_with("---\ndescription: \"API: errors\"\n"));
        assert!(h.read("app/.cursor/rules/block.mdc").starts_with("---\ndescription: Two lines\nglobs: a/**\n"));
    }
}
