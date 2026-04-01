// Rough token estimation for Claude models
// ~3.7 characters per token for mixed English/code/markdown
// This is within ~15% of actual BPE tokenization for typical content

const CHARS_PER_TOKEN = 3.7;

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}
