use serde::Serialize;

pub const CLAUDE_MD_LINES: usize = 200;
pub const MEMORY_INDEX_LINES: usize = 200;
pub const MEMORY_INDEX_BYTES: usize = 25_000;
pub const SKILL_LINES: usize = 500;
pub const SKILL_LISTING_CHARS: usize = 1_536;
pub const CURSOR_RULE_LINES: usize = CLAUDE_MD_LINES;
pub const CONTEXT_WINDOW_TOKENS: usize = 200_000;
const WARN_AT_PCT: usize = 80;

const CLAUDE_MEMORY_DOCS: &str = "https://code.claude.com/docs/en/memory";
const CLAUDE_SKILLS_DOCS: &str = "https://code.claude.com/docs/en/skills";
const CURSOR_RULES_DOCS: &str = "https://cursor.com/docs/context/rules";

#[derive(Serialize, serde::Deserialize, Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "camelCase")]
pub enum Level {
    Ok,
    Warn,
    Over,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Budget {
    pub label: String,
    pub used: usize,
    pub limit: usize,
    pub unit: String,
    pub level: Level,
    pub note: String,
    pub source: String,
}

pub fn level(used: usize, limit: usize) -> Level {
    if used > limit {
        Level::Over
    } else if used * 100 >= limit * WARN_AT_PCT {
        Level::Warn
    } else {
        Level::Ok
    }
}

fn budget(label: &str, used: usize, limit: usize, unit: &str, note: &str, source: &str) -> Budget {
    Budget {
        label: label.to_string(),
        used,
        limit,
        unit: unit.to_string(),
        level: level(used, limit),
        note: note.to_string(),
        source: source.to_string(),
    }
}

pub fn instructions(lines: usize) -> Budget {
    budget(
        "Length",
        lines,
        CLAUDE_MD_LINES,
        "lines",
        "Anthropic recommends under 200 lines. Longer files use more context and get followed less reliably. Move parts that only apply to some files into path-scoped rules.",
        CLAUDE_MEMORY_DOCS,
    )
}

pub fn always_loaded_rule(lines: usize) -> Budget {
    budget(
        "Length",
        lines,
        CLAUDE_MD_LINES,
        "lines",
        "Loads every session like CLAUDE.md, so the same under-200-lines guidance applies. Adding paths: frontmatter makes it load only for matching files.",
        CLAUDE_MEMORY_DOCS,
    )
}

pub fn memory_index_lines(lines: usize) -> Budget {
    budget(
        "Lines loaded",
        lines,
        MEMORY_INDEX_LINES,
        "lines",
        "Only the first 200 lines are loaded at session start. Anything past that is invisible to Claude.",
        CLAUDE_MEMORY_DOCS,
    )
}

pub fn memory_index_bytes(bytes: usize) -> Budget {
    budget(
        "Size loaded",
        bytes,
        MEMORY_INDEX_BYTES,
        "bytes",
        "Only the first 25KB is loaded at session start. Anything past that is invisible to Claude.",
        CLAUDE_MEMORY_DOCS,
    )
}

pub fn skill_lines(lines: usize) -> Budget {
    budget(
        "Length",
        lines,
        SKILL_LINES,
        "lines",
        "Anthropic recommends keeping SKILL.md under 500 lines and moving reference material to separate files.",
        CLAUDE_SKILLS_DOCS,
    )
}

pub fn skill_listing(chars: usize) -> Budget {
    budget(
        "Description",
        chars,
        SKILL_LISTING_CHARS,
        "chars",
        "description plus when_to_use is cut off at 1,536 characters in the skill list Claude sees. Put the key use case first.",
        CLAUDE_SKILLS_DOCS,
    )
}

pub fn cursor_rule(lines: usize) -> Budget {
    budget(
        "Length",
        lines,
        CURSOR_RULE_LINES,
        "lines",
        "Held to the same 200-line target as CLAUDE.md so Cursor and Claude work the same way. Cursor's own docs allow up to 500.",
        CURSOR_RULES_DOCS,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn under_80_percent_is_ok() {
        assert_eq!(level(159, 200), Level::Ok);
    }

    #[test]
    fn from_80_percent_up_to_the_limit_warns() {
        assert_eq!(level(160, 200), Level::Warn);
        assert_eq!(level(200, 200), Level::Warn);
    }

    #[test]
    fn past_the_limit_is_over() {
        assert_eq!(level(201, 200), Level::Over);
    }

    #[test]
    fn budgets_carry_the_documented_limits() {
        assert_eq!(instructions(380).limit, 200);
        assert_eq!(instructions(380).level, Level::Over);
        assert_eq!(memory_index_lines(88).level, Level::Ok);
        assert_eq!(memory_index_bytes(26_000).level, Level::Over);
        assert_eq!(skill_lines(450).level, Level::Warn);
        assert_eq!(skill_listing(1_600).level, Level::Over);
        assert_eq!(cursor_rule(43).level, Level::Ok);
        assert_eq!(cursor_rule(250).limit, 200);
        assert_eq!(cursor_rule(250).level, Level::Over);
    }
}
