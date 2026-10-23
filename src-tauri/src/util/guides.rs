use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GuideInfo {
    pub id: String,
    pub title: String,
    pub updated: String,
}

fn valid_id(id: &str) -> bool {
    !id.is_empty() && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

pub fn list(dir: &Path) -> Vec<GuideInfo> {
    let mut out: Vec<GuideInfo> = fs::read_dir(dir)
        .map(|rd| rd.flatten().map(|e| e.path()).collect::<Vec<_>>())
        .unwrap_or_default()
        .into_iter()
        .filter_map(|folder| {
            let id = folder.file_name()?.to_str()?.to_string();
            let file = folder.join("guide.md");
            if !valid_id(&id) || !file.is_file() {
                return None;
            }
            let text = fs::read_to_string(&file).ok()?;
            let title = text.lines().find_map(|l| l.strip_prefix("# ")).unwrap_or(&id).trim().to_string();
            let updated = fs::metadata(&file).and_then(|m| m.modified()).map(|t| chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339()).unwrap_or_default();
            Some(GuideInfo { id, title, updated })
        })
        .collect();
    out.sort_by(|a, b| a.title.to_lowercase().cmp(&b.title.to_lowercase()));
    out
}

pub fn read(dir: &Path, id: &str) -> Result<String, String> {
    use base64::Engine;
    if !valid_id(id) {
        return Err("Unknown guide.".to_string());
    }
    let folder = dir.join(id);
    let text = fs::read_to_string(folder.join("guide.md")).map_err(|_| "That guide doesn't exist.".to_string())?;
    let re = regex::Regex::new(r"!\[([^\]]*)\]\(([\w.-]+\.(png|jpg|jpeg|gif))\)").expect("valid pattern");
    Ok(re
        .replace_all(&text, |c: &regex::Captures| {
            let mime = match &c[3] { "jpg" | "jpeg" => "image/jpeg", "gif" => "image/gif", _ => "image/png" };
            match fs::read(folder.join(&c[2])) {
                Ok(bytes) => format!("![{}](data:{};base64,{})", &c[1], mime, base64::engine::general_purpose::STANDARD.encode(bytes)),
                Err(_) => c[0].to_string(),
            }
        })
        .to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn guides() -> (tempfile::TempDir, std::path::PathBuf) {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join("guides");
        fs::create_dir_all(dir.join("hippo-tour")).unwrap();
        fs::write(dir.join("hippo-tour/guide.md"), "# Hippo tour\n\n![Overview](overview.png)\n\nText.\n").unwrap();
        fs::write(dir.join("hippo-tour/overview.png"), [137u8, 80, 78, 71]).unwrap();
        fs::create_dir_all(dir.join("empty")).unwrap();
        (tmp, dir)
    }

    #[test]
    fn lists_guides_with_titles_from_their_heading() {
        let (_tmp, dir) = guides();
        let list = list(&dir);
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].id, "hippo-tour");
        assert_eq!(list[0].title, "Hippo tour");
    }

    #[test]
    fn inlines_local_images_so_the_page_can_show_them() {
        let (_tmp, dir) = guides();
        let md = read(&dir, "hippo-tour").unwrap();
        assert!(md.contains("![Overview](data:image/png;base64,iVBORw==)"), "{}", md);
        assert!(md.contains("Text."));
    }

    #[test]
    fn rejects_ids_that_leave_the_guides_folder() {
        let (_tmp, dir) = guides();
        assert!(read(&dir, "../secrets").is_err());
        assert!(read(&dir, "missing").is_err());
    }
}
