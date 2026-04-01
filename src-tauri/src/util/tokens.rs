const CHARS_PER_TOKEN: f64 = 3.7;

pub fn estimate_tokens(text: &str) -> usize {
    if text.is_empty() {
        return 0;
    }
    (text.len() as f64 / CHARS_PER_TOKEN).ceil() as usize
}
