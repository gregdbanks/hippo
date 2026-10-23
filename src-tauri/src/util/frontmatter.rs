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

        let frontmatter = parse_fields(fm_str);

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

fn unquote(value: &str) -> String {
    let v = value.trim();
    let quoted = v.len() >= 2
        && ((v.starts_with('"') && v.ends_with('"')) || (v.starts_with('\'') && v.ends_with('\'')));
    if quoted { v[1..v.len() - 1].to_string() } else { v.to_string() }
}

fn parse_fields(fm: &str) -> HashMap<String, String> {
    let mut fields = HashMap::new();
    let lines: Vec<&str> = fm.lines().collect();
    let mut i = 0;
    while i < lines.len() {
        let line = lines[i];
        i += 1;
        let Some(colon) = line.find(':') else { continue };
        let key = line[..colon].trim().to_string();
        if key.is_empty() || key.starts_with('-') {
            continue;
        }
        let top_level = !line.starts_with([' ', '\t']);
        let value = line[colon + 1..].trim();

        let value = if matches!(value, ">" | ">-" | ">+" | "|" | "|-" | "|+") {
            let mut block = Vec::new();
            while i < lines.len() && (lines[i].starts_with([' ', '\t']) || lines[i].trim().is_empty()) {
                block.push(lines[i].trim());
                i += 1;
            }
            let sep = if value.starts_with('>') { " " } else { "\n" };
            block.iter().filter(|l| !l.is_empty()).cloned().collect::<Vec<_>>().join(sep)
        } else if value.is_empty() {
            let mut items = Vec::new();
            while i < lines.len() && lines[i].trim_start().starts_with("- ") {
                items.push(unquote(lines[i].trim_start()[2..].trim()));
                i += 1;
            }
            items.join(", ")
        } else {
            unquote(value)
        };

        if top_level || !fields.contains_key(&key) {
            fields.insert(key, value);
        }
    }
    fields
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_flat_keys() {
        let p = parse_frontmatter("---\nname: review\ndescription: Review a PR\n---\nbody\n");
        assert_eq!(p.frontmatter["name"], "review");
        assert_eq!(p.frontmatter["description"], "Review a PR");
        assert_eq!(p.body, "body\n");
    }

    #[test]
    fn joins_folded_and_literal_block_values() {
        let p = parse_frontmatter("---\nname: noun\ndescription: >-\n  Build an API\n  with journals.\nwhen_to_use: |\n  adding endpoints\n---\nbody\n");
        assert_eq!(p.frontmatter["description"], "Build an API with journals.");
        assert_eq!(p.frontmatter["when_to_use"], "adding endpoints");
    }

    #[test]
    fn list_values_are_joined() {
        let p = parse_frontmatter("---\npaths:\n  - \"src/**/*.ts\"\n  - lib/**\nname: x\n---\nrule\n");
        assert_eq!(p.frontmatter["paths"], "src/**/*.ts, lib/**");
        assert_eq!(p.frontmatter["name"], "x");
    }

    #[test]
    fn no_frontmatter_means_whole_file_is_body() {
        let p = parse_frontmatter("# Title\ntext\n");
        assert!(p.frontmatter.is_empty());
        assert_eq!(p.body, "# Title\ntext\n");
    }
}
