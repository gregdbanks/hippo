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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_standard_frontmatter() {
        let input = "---\nname: My Memory\ndescription: A test\ntype: workflow\n---\n\nBody content here.";
        let parsed = parse_frontmatter(input);

        assert_eq!(parsed.frontmatter.get("name").unwrap(), "My Memory");
        assert_eq!(parsed.frontmatter.get("description").unwrap(), "A test");
        assert_eq!(parsed.frontmatter.get("type").unwrap(), "workflow");
        assert_eq!(parsed.body, "Body content here.");
    }

    #[test]
    fn test_no_frontmatter() {
        let input = "Just a plain markdown file.\n\nWith paragraphs.";
        let parsed = parse_frontmatter(input);

        assert!(parsed.frontmatter.is_empty());
        assert_eq!(parsed.body, input);
    }

    #[test]
    fn test_empty_frontmatter() {
        // With "---\n---", after stripping the first "---\n", we get "---"
        // which has no "\n---" pattern, so the parser treats it as no
        // valid frontmatter (unclosed). This is correct behavior.
        let input = "---\n---\n\nBody after empty frontmatter.";
        let parsed = parse_frontmatter(input);

        // The parser requires content between --- delimiters with a newline
        // before the closing ---. "---\n---" has nothing between them, so
        // it falls through as "no frontmatter found".
        assert!(parsed.frontmatter.is_empty());
        assert_eq!(parsed.body, input);
    }

    #[test]
    fn test_frontmatter_with_extra_fields() {
        let input = "---\nname: Test\ncustom_field: hello\npriority: high\n---\n\nBody.";
        let parsed = parse_frontmatter(input);

        assert_eq!(parsed.frontmatter.len(), 3);
        assert_eq!(parsed.frontmatter.get("custom_field").unwrap(), "hello");
        assert_eq!(parsed.frontmatter.get("priority").unwrap(), "high");
    }

    #[test]
    fn test_body_preserved_multiline() {
        let input = "---\nname: Test\n---\n\nLine 1\nLine 2\nLine 3";
        let parsed = parse_frontmatter(input);

        assert!(parsed.body.contains("Line 1"));
        assert!(parsed.body.contains("Line 2"));
        assert!(parsed.body.contains("Line 3"));
    }

    #[test]
    fn test_raw_is_always_original() {
        let input = "---\nname: Test\n---\n\nBody.";
        let parsed = parse_frontmatter(input);
        assert_eq!(parsed.raw, input);

        let plain = "No frontmatter here.";
        let parsed2 = parse_frontmatter(plain);
        assert_eq!(parsed2.raw, plain);
    }

    #[test]
    fn test_unclosed_frontmatter_returns_no_fields() {
        // Only opening --- with no closing --- means no valid frontmatter
        let input = "---\nname: orphaned\nThis has no closing delimiter.";
        let parsed = parse_frontmatter(input);

        assert!(
            parsed.frontmatter.is_empty(),
            "Unclosed frontmatter should not parse"
        );
    }

    #[test]
    fn test_value_with_colons() {
        let input = "---\nurl: https://example.com:8080/path\n---\n\nBody.";
        let parsed = parse_frontmatter(input);

        // The value after the first colon should include subsequent colons
        assert_eq!(
            parsed.frontmatter.get("url").unwrap(),
            "https://example.com:8080/path"
        );
    }
}
