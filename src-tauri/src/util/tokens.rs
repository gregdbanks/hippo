const CHARS_PER_TOKEN: f64 = 3.7;

pub fn estimate_tokens(text: &str) -> usize {
    if text.is_empty() {
        return 0;
    }
    (text.len() as f64 / CHARS_PER_TOKEN).ceil() as usize
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_empty_string() {
        assert_eq!(estimate_tokens(""), 0);
    }

    #[test]
    fn test_short_string() {
        // "hello" = 5 chars, 5 / 3.7 = 1.35 -> ceil = 2
        assert_eq!(estimate_tokens("hello"), 2);
    }

    #[test]
    fn test_known_length() {
        // 37 chars / 3.7 = 10.0 exactly
        let text = "a".repeat(37);
        assert_eq!(estimate_tokens(&text), 10);
    }

    #[test]
    fn test_ratio_approximately_correct() {
        // For a 1000 char string, expect ~270 tokens (1000/3.7 = 270.27)
        let text = "x".repeat(1000);
        let tokens = estimate_tokens(&text);
        assert_eq!(tokens, 271); // ceil(270.27)

        // Verify the ratio is in the right ballpark
        let ratio = 1000.0 / tokens as f64;
        assert!(
            (ratio - 3.7).abs() < 0.1,
            "Ratio {} should be close to 3.7",
            ratio
        );
    }

    #[test]
    fn test_single_char() {
        // 1 / 3.7 = 0.27 -> ceil = 1
        assert_eq!(estimate_tokens("a"), 1);
    }

    #[test]
    fn test_ceiling_behavior() {
        // 4 chars / 3.7 = 1.08 -> ceil = 2
        assert_eq!(estimate_tokens("abcd"), 2);
        // 3 chars / 3.7 = 0.81 -> ceil = 1
        assert_eq!(estimate_tokens("abc"), 1);
    }
}
