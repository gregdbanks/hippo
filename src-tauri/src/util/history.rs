use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

pub const KEEP: usize = 20;

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub id: String,
    pub saved_at: String,
    pub bytes: u64,
}

const ID_LEN: usize = 20;

fn valid_id(id: &str) -> bool {
    id.len() == ID_LEN && id.chars().all(|c| c.is_ascii_digit())
}

fn ids(dir: &Path) -> Vec<String> {
    let mut out: Vec<String> = fs::read_dir(dir)
        .map(|rd| rd.flatten().filter_map(|e| e.file_name().to_str().and_then(|n| n.strip_suffix(".snap")).map(str::to_string)).collect())
        .unwrap_or_default();
    out.retain(|id| valid_id(id));
    out.sort_by(|a, b| b.cmp(a));
    out
}

pub fn snapshot(history: &Path, path: &Path) -> Result<(), String> {
    let Ok(content) = fs::read_to_string(path) else { return Ok(()) };
    let dir = folder(history, path);
    fs::create_dir_all(&dir).map_err(|e| format!("Couldn't save history: {}", e))?;
    let existing = ids(&dir);
    if let Some(latest) = existing.first() {
        if fs::read_to_string(dir.join(format!("{}.snap", latest))).map(|c| c == content).unwrap_or(false) {
            return Ok(());
        }
    }
    let nanos = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
    let id = format!("{:0width$}", nanos, width = ID_LEN);
    let _ = fs::write(dir.join("path.txt"), path.to_string_lossy().as_bytes());
    crate::util::safe_write::atomic_write(&dir.join(format!("{}.snap", id)), &content)?;
    for old in ids(&dir).into_iter().skip(KEEP) {
        let _ = fs::remove_file(dir.join(format!("{}.snap", old)));
    }
    Ok(())
}

pub fn list(history: &Path, path: &Path) -> Vec<Snapshot> {
    let dir = folder(history, path);
    ids(&dir)
        .into_iter()
        .filter_map(|id| {
            let meta = fs::metadata(dir.join(format!("{}.snap", id))).ok()?;
            let nanos: u128 = id.parse().ok()?;
            let at = std::time::UNIX_EPOCH + std::time::Duration::from_nanos(nanos as u64);
            Some(Snapshot { saved_at: chrono::DateTime::<chrono::Utc>::from(at).to_rfc3339(), bytes: meta.len(), id })
        })
        .collect()
}

pub fn read(history: &Path, path: &Path, id: &str) -> Result<String, String> {
    if !valid_id(id) {
        return Err("Unknown version.".to_string());
    }
    fs::read_to_string(folder(history, path).join(format!("{}.snap", id))).map_err(|_| "That version no longer exists.".to_string())
}

fn folder(history: &Path, path: &Path) -> PathBuf {
    history.join(crate::util::inventory::slug_for(path))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup() -> (tempfile::TempDir, PathBuf, PathBuf) {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path().canonicalize().unwrap();
        let file = root.join("app/CLAUDE.md");
        fs::create_dir_all(file.parent().unwrap()).unwrap();
        (tmp, root.join("history"), file)
    }

    #[test]
    fn keeps_each_previous_version_newest_first() {
        let (_tmp, history, file) = setup();
        fs::write(&file, "one\n").unwrap();
        snapshot(&history, &file).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(5));
        fs::write(&file, "two\n").unwrap();
        snapshot(&history, &file).unwrap();

        let snaps = list(&history, &file);
        assert_eq!(snaps.len(), 2);
        assert_eq!(read(&history, &file, &snaps[0].id).unwrap(), "two\n");
        assert_eq!(read(&history, &file, &snaps[1].id).unwrap(), "one\n");
    }

    #[test]
    fn skips_a_snapshot_identical_to_the_last_one() {
        let (_tmp, history, file) = setup();
        fs::write(&file, "same\n").unwrap();
        snapshot(&history, &file).unwrap();
        snapshot(&history, &file).unwrap();
        assert_eq!(list(&history, &file).len(), 1);
    }

    #[test]
    fn keeps_only_the_newest_versions() {
        let (_tmp, history, file) = setup();
        for i in 0..(KEEP + 5) {
            fs::write(&file, format!("v{}\n", i)).unwrap();
            snapshot(&history, &file).unwrap();
            std::thread::sleep(std::time::Duration::from_millis(2));
        }
        let snaps = list(&history, &file);
        assert_eq!(snaps.len(), KEEP);
        assert_eq!(read(&history, &file, &snaps[0].id).unwrap(), format!("v{}\n", KEEP + 4));
    }

    #[test]
    fn missing_files_and_bad_ids_are_handled() {
        let (_tmp, history, file) = setup();
        assert!(snapshot(&history, &file).is_ok());
        assert!(list(&history, &file).is_empty());
        assert!(read(&history, &file, "../../etc/passwd").is_err());
        assert!(read(&history, &file, "123").is_err());
    }
}
