export interface Frontmatter {
  name?: string;
  description?: string;
  type?: string;
  [key: string]: string | undefined;
}

export interface ParsedFile {
  frontmatter: Frontmatter;
  body: string;
  raw: string;
}

export function parseFrontmatter(content: string): ParsedFile {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: content, raw: content };
  }

  const frontmatterStr = match[1];
  const body = match[2];
  const frontmatter: Frontmatter = {};

  for (const line of frontmatterStr.split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();
    frontmatter[key] = value;
  }

  return { frontmatter, body, raw: content };
}

export function serializeFrontmatter(frontmatter: Frontmatter, body: string): string {
  const entries = Object.entries(frontmatter).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return body;

  const lines = entries.map(([k, v]) => `${k}: ${v}`);
  return `---\n${lines.join('\n')}\n---\n\n${body}`;
}
