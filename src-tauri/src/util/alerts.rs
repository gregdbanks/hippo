use crate::util::budget::Level;
use crate::util::inventory::Inventory;
use chrono::{DateTime, Local};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AlertItem {
    pub key: String,
    pub level: Level,
    pub title: String,
    pub body: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AlertState {
    pub enabled: bool,
    pub levels: HashMap<String, Level>,
    pub last_digest: Option<DateTime<Local>>,
    pub initialized: bool,
}

#[derive(Debug, PartialEq)]
pub struct Notice {
    pub title: String,
    pub body: String,
}

const SUMMARY_AFTER: usize = 3;
const DIGEST_HOUR: u32 = 9;

fn short(home: &str, path: &str) -> String {
    path.strip_prefix(home).map(|rest| format!("~{}", rest)).unwrap_or_else(|| path.to_string())
}

pub fn current_alerts(inv: &Inventory) -> Vec<AlertItem> {
    let mut items: Vec<AlertItem> = Vec::new();
    let files = inv.claude_global.iter().chain(inv.cursor_global.iter()).chain(inv.projects.iter().flat_map(|p| p.files.iter()));
    for f in files {
        if f.link_target.is_some() || items.iter().any(|i| i.key == f.path) {
            continue;
        }
        let worst = f.budgets.iter().map(|b| b.level).max().unwrap_or(Level::Ok);
        let level = if worst == Level::Ok && !f.issues.is_empty() { Level::Warn } else { worst };
        if level == Level::Ok {
            continue;
        }
        let shown = short(&inv.home, &f.path);
        let (title, body) = match f.budgets.iter().filter(|b| b.level != Level::Ok).max_by_key(|b| b.level) {
            Some(b) => (
                format!("{} is {} its limit", f.name, if b.level == Level::Over { "over" } else { "close to" }),
                format!("{} is {} / {} {}. Open Hippo to trim it.", shown, b.used, b.limit, b.unit),
            ),
            None => (format!("{} needs a look", f.name), format!("{}: {}", shown, f.issues[0])),
        };
        items.push(AlertItem { key: f.path.clone(), level, title, body });
    }
    for p in inv.projects.iter().filter(|p| p.exists && p.uses_cursor) {
        use crate::util::inventory::AgentsLink;
        use crate::util::unity::MirrorState;
        let unshared = p.agents_link == AgentsLink::Unshared;
        let stale_rules = p.mirror.iter().filter(|m| matches!(m.state, MirrorState::Missing | MirrorState::Outdated | MirrorState::Orphaned)).count();
        if !unshared && stale_rules == 0 {
            continue;
        }
        let mut reasons = Vec::new();
        if unshared {
            reasons.push("Cursor can't see its CLAUDE.md".to_string());
        }
        if stale_rules > 0 {
            reasons.push(format!("{} Claude rule{} not mirrored", stale_rules, if stale_rules == 1 { "" } else { "s" }));
        }
        items.push(AlertItem {
            key: format!("sync:{}", p.root),
            level: Level::Warn,
            title: format!("{} is out of sync with Cursor", p.name),
            body: format!("{}. Open Hippo's Cursor page to fix it.", reasons.join(", ")),
        });
    }
    items
}

fn digest(items: &[AlertItem]) -> Notice {
    let over = items.iter().filter(|i| i.level == Level::Over).count();
    let rest = items.len() - over;
    let mut parts = Vec::new();
    if over > 0 {
        parts.push(format!("{} over a limit", over));
    }
    if rest > 0 {
        parts.push(format!("{} to review", rest));
    }
    let names: Vec<&str> = items.iter().take(SUMMARY_AFTER).map(|i| i.title.as_str()).collect();
    Notice { title: format!("Hippo daily check: {}", parts.join(", ")), body: names.join("; ") }
}

pub fn check(state: &mut AlertState, items: &[AlertItem], now: DateTime<Local>) -> Vec<Notice> {
    let previous = std::mem::take(&mut state.levels);
    state.levels = items.iter().map(|i| (i.key.clone(), i.level)).collect();
    if !state.initialized {
        state.initialized = true;
        return Vec::new();
    }
    if !state.enabled {
        return Vec::new();
    }

    let worse: Vec<&AlertItem> = items.iter().filter(|i| previous.get(&i.key).map(|p| i.level > *p).unwrap_or(true)).collect();
    let mut notices: Vec<Notice> = if worse.len() > SUMMARY_AFTER {
        let names: Vec<&str> = worse.iter().take(SUMMARY_AFTER).map(|i| i.title.as_str()).collect();
        vec![Notice { title: format!("{} config files need attention", worse.len()), body: format!("{}, and more. Open Hippo to review.", names.join("; ")) }]
    } else {
        worse.iter().map(|i| Notice { title: i.title.clone(), body: i.body.clone() }).collect()
    };

    use chrono::Timelike;
    let digest_due = !items.is_empty()
        && now.hour() >= DIGEST_HOUR
        && state.last_digest.map(|d| d.date_naive() < now.date_naive()).unwrap_or(true);
    if digest_due {
        state.last_digest = Some(now);
        if notices.is_empty() {
            notices.push(digest(items));
        }
    }
    notices
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;
    use std::fs;
    use std::path::PathBuf;

    fn item(key: &str, level: Level) -> AlertItem {
        AlertItem { key: key.to_string(), level, title: format!("{} title", key), body: format!("{} body", key) }
    }

    fn at(day: u32, hour: u32) -> DateTime<Local> {
        Local.with_ymd_and_hms(2026, 10, day, hour, 0, 0).unwrap()
    }

    fn ready() -> AlertState {
        AlertState { enabled: true, initialized: true, ..Default::default() }
    }

    #[test]
    fn first_run_sets_a_baseline_instead_of_alerting_on_every_old_problem() {
        let mut state = AlertState { enabled: true, ..Default::default() };
        let notices = check(&mut state, &[item("a", Level::Over), item("b", Level::Warn)], at(23, 8));
        assert!(notices.is_empty());
        assert!(state.initialized);
        assert_eq!(state.levels["a"], Level::Over);
    }

    #[test]
    fn alerts_when_a_file_gets_worse_and_stays_quiet_otherwise() {
        let mut state = ready();
        state.levels.insert("a".into(), Level::Warn);
        state.last_digest = Some(at(23, 9));

        let notices = check(&mut state, &[item("a", Level::Over)], at(23, 10));
        assert_eq!(notices, vec![Notice { title: "a title".into(), body: "a body".into() }]);

        assert!(check(&mut state, &[item("a", Level::Over)], at(23, 11)).is_empty());
        assert!(check(&mut state, &[item("a", Level::Warn)], at(23, 12)).is_empty());
        assert_eq!(check(&mut state, &[item("a", Level::Over)], at(23, 13)).len(), 1);
    }

    #[test]
    fn a_fixed_file_is_forgotten_so_a_new_problem_alerts_again() {
        let mut state = ready();
        state.last_digest = Some(at(23, 9));
        state.levels.insert("a".into(), Level::Over);
        check(&mut state, &[], at(23, 10));
        assert!(!state.levels.contains_key("a"));
        assert_eq!(check(&mut state, &[item("a", Level::Warn)], at(23, 11)).len(), 1);
    }

    #[test]
    fn many_new_problems_at_once_become_one_summary() {
        let mut state = ready();
        state.last_digest = Some(at(23, 9));
        let items = [item("a", Level::Over), item("b", Level::Warn), item("c", Level::Warn), item("d", Level::Over)];
        let notices = check(&mut state, &items, at(23, 10));
        assert_eq!(notices.len(), 1);
        assert!(notices[0].title.contains('4'));
    }

    #[test]
    fn daily_summary_comes_once_a_day_after_9am_and_only_when_something_is_wrong() {
        let mut state = ready();
        state.levels.insert("a".into(), Level::Over);
        state.last_digest = Some(at(22, 9));

        assert!(check(&mut state, &[item("a", Level::Over)], at(23, 8)).is_empty());
        let digest = check(&mut state, &[item("a", Level::Over)], at(23, 9));
        assert_eq!(digest.len(), 1);
        assert!(digest[0].title.starts_with("Hippo daily check"));
        assert!(check(&mut state, &[item("a", Level::Over)], at(23, 15)).is_empty());

        assert!(check(&mut state, &[], at(24, 10)).is_empty());
    }

    #[test]
    fn disabled_alerts_stay_silent_but_keep_tracking() {
        let mut state = ready();
        state.enabled = false;
        assert!(check(&mut state, &[item("a", Level::Over)], at(23, 10)).is_empty());
        assert_eq!(state.levels["a"], Level::Over);
    }

    #[test]
    fn current_alerts_cover_file_limits_issues_and_cursor_sync() {
        let tmp = tempfile::tempdir().unwrap();
        let home: PathBuf = tmp.path().canonicalize().unwrap();
        let write = |rel: &str, text: &str| {
            let p = home.join(rel);
            fs::create_dir_all(p.parent().unwrap()).unwrap();
            fs::write(p, text).unwrap();
        };
        write("big/CLAUDE.md", &"x\n".repeat(250));
        fs::create_dir_all(home.join("big/.cursor")).unwrap();
        write("claude-only/CLAUDE.md", "# no cursor here\n");
        write("fine/CLAUDE.md", "# ok\n");
        std::os::unix::fs::symlink("CLAUDE.md", home.join("fine/AGENTS.md")).unwrap();
        write("wrong-ext/.cursor/rules/plain.md", "# ignored\n");

        write("linked-big/CLAUDE.md", &"x\n".repeat(190));
        std::os::unix::fs::symlink("CLAUDE.md", home.join("linked-big/AGENTS.md")).unwrap();
        let items = current_alerts(&crate::util::inventory::build(&home));
        assert_eq!(items.iter().filter(|i| i.key.contains("linked-big/")).count(), 1);
        let find = |k: &str| items.iter().find(|i| i.key.ends_with(k));
        assert_eq!(find("big/CLAUDE.md").unwrap().level, Level::Over);
        assert!(find("big/CLAUDE.md").unwrap().body.contains("250 / 200 lines"));
        assert_eq!(find("plain.md").unwrap().level, Level::Warn);
        assert!(find("fine/CLAUDE.md").is_none());
        assert!(items.iter().any(|i| i.key == format!("sync:{}", home.join("big").display())));
        assert!(!items.iter().any(|i| i.key == format!("sync:{}", home.join("fine").display())));
        assert!(!items.iter().any(|i| i.key == format!("sync:{}", home.join("claude-only").display())));
    }
}
