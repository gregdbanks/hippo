use serde::Serialize;
use std::collections::HashMap;

#[derive(Serialize, Clone, Default)]
pub struct ParsedFile {
    pub frontmatter: HashMap<String, String>,
    pub body: String,
    pub raw: String,
}

pub fn parse_frontmatter(content: &str) -> ParsedFile {
    // Match pattern: ---\n...\n---\n...
    let trimmed = content.trim_start();
    if !trimmed.starts_with("---") {
        return ParsedFile {
            frontmatter: HashMap::new(),
            body: content.to_string(),
            raw: content.to_string(),
        };
    }

    // Find the closing ---
    let after_first = &trimmed[3..].trim_start_matches('\r').trim_start_matches('\n');
    if let Some(end_idx) = after_first.find("\n---") {
        let fm_str = &after_first[..end_idx];
        let body_start = end_idx + 4; // skip \n---
        let body = after_first[body_start..]
            .trim_start_matches('\r')
            .trim_start_matches('\n')
            .to_string();

        let mut frontmatter = HashMap::new();
        for line in fm_str.lines() {
            if let Some(colon_idx) = line.find(':') {
                let key = line[..colon_idx].trim().to_string();
                let value = line[colon_idx + 1..].trim().to_string();
                if !key.is_empty() {
                    frontmatter.insert(key, value);
                }
            }
        }

        ParsedFile {
            frontmatter,
            body,
            raw: content.to_string(),
        }
    } else {
        ParsedFile {
            frontmatter: HashMap::new(),
            body: content.to_string(),
            raw: content.to_string(),
        }
    }
}
