import os from 'os';
import path from 'path';
import fs from 'fs';

export const HOME_DIR = os.homedir();
export const CLAUDE_DIR = path.join(HOME_DIR, '.claude');
export const GLOBAL_CLAUDE_MD = path.join(HOME_DIR, 'CLAUDE.md');
export const SETTINGS_PATH = path.join(CLAUDE_DIR, 'settings.json');
export const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');
export const SKILLS_DIR = path.join(CLAUDE_DIR, 'skills');
export const PLANS_DIR = path.join(CLAUDE_DIR, 'plans');

const WRITABLE_PREFIXES = [
  path.join(CLAUDE_DIR, 'projects'),
  path.join(CLAUDE_DIR, 'skills'),
  path.join(CLAUDE_DIR, 'plans'),
  SETTINGS_PATH,
  GLOBAL_CLAUDE_MD,
];

export function decodeProjectSlug(slug: string): string {
  // Slug format: -Users-gregbanks-Desktop-project-name
  // Decode: replace leading - with /, then replace - with /
  // This is ambiguous for paths with actual dashes, so we try candidates
  const parts = slug.split('-').filter(Boolean);

  // Try progressively joining parts with / vs -
  // Start with the simple case: all dashes are path separators
  const simplePath = '/' + parts.join('/');
  if (fs.existsSync(simplePath)) return simplePath;

  // Try combining adjacent parts with dashes (for paths containing dashes)
  // Use a greedy approach: from left to right, try joining with /
  // If a segment doesn't exist as a directory, join it with the next using -
  let current = '';
  for (let i = 0; i < parts.length; i++) {
    const candidate = current ? current + '/' + parts[i] : '/' + parts[i];
    if (i === parts.length - 1) {
      // Last part - try both
      if (fs.existsSync(candidate)) return candidate;
      // Try joining with dash to previous
      const dashCandidate = current + '-' + parts[i];
      if (fs.existsSync(dashCandidate)) return dashCandidate;
      return candidate; // Fall back to slash-separated
    }
    if (fs.existsSync(candidate)) {
      current = candidate;
    } else {
      // This part might be dash-joined with previous
      current = current + '-' + parts[i];
    }
  }
  return simplePath;
}

export function isPathWritable(filePath: string): boolean {
  const resolved = path.resolve(filePath);

  // Check if it's a project CLAUDE.md
  if (resolved.endsWith('/CLAUDE.md') || resolved.endsWith('\\CLAUDE.md')) {
    // Allow any CLAUDE.md that's in a real project directory
    const dir = path.dirname(resolved);
    if (fs.existsSync(dir)) return true;
  }

  return WRITABLE_PREFIXES.some(prefix => {
    const resolvedPrefix = path.resolve(prefix);
    return resolved === resolvedPrefix || resolved.startsWith(resolvedPrefix + path.sep);
  });
}

export function isPathDeletable(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  // Only allow deleting memory files and plan files
  const memoryPrefix = path.resolve(path.join(CLAUDE_DIR, 'projects'));
  const plansPrefix = path.resolve(PLANS_DIR);
  return (
    (resolved.startsWith(memoryPrefix + path.sep) && resolved.includes('/memory/')) ||
    resolved.startsWith(plansPrefix + path.sep)
  );
}
