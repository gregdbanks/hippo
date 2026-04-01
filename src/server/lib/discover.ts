import fs from 'fs';
import path from 'path';
import { HOME_DIR, CLAUDE_DIR, GLOBAL_CLAUDE_MD, SETTINGS_PATH, PROJECTS_DIR, SKILLS_DIR, PLANS_DIR, decodeProjectSlug } from './paths.js';
import { parseFrontmatter } from './frontmatter.js';
import { estimateTokens } from './tokens.js';

export interface FileInfo {
  path: string;
  exists: boolean;
  sizeBytes: number;
  tokens: number;
  modified: string;
}

export interface MemoryInfo extends FileInfo {
  filename: string;
  name: string;
  description: string;
  type: string;
  staleness: 'current' | 'stale' | 'review';
}

export interface MemoryHealth {
  score: number;          // 0-100, higher is better
  grade: 'healthy' | 'warning' | 'critical';
  memoryCount: number;
  optimalMax: number;     // recommended max for this project
  indexLineCount: number;
  indexLineLimit: number; // 200 line truncation limit
  staleCount: number;
  reviewCount: number;
  memoryTokens: number;
  tokenBudgetPct: number; // % of total prompt context used by memories
  suggestions: string[];
}

export interface ProjectInfo {
  slug: string;
  realPath: string;
  claudeMd: FileInfo | null;
  memoryIndex: FileInfo | null;
  memoryCount: number;
  memoryTotalTokens: number;
  memoryHealth: MemoryHealth | null;
}

export interface SkillInfo {
  name: string;
  path: string;
  description: string;
  sizeBytes: number;
  tokens: number;
}

export interface SettingsInfo {
  path: string;
  exists: boolean;
  sizeBytes: number;
  hookCount: number;
  allowCount: number;
  denyCount: number;
}

export interface DiscoveryResult {
  globalClaude: FileInfo | null;
  projects: ProjectInfo[];
  skills: SkillInfo[];
  settings: SettingsInfo;
  plans: FileInfo[];
  totals: {
    filesLoaded: number;
    totalTokens: number;
  };
}

function getFileInfo(filePath: string): FileInfo | null {
  try {
    const stat = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    return {
      path: filePath,
      exists: true,
      sizeBytes: stat.size,
      tokens: estimateTokens(content),
      modified: stat.mtime.toISOString(),
    };
  } catch {
    return null;
  }
}

function getMemoryStaleness(type: string, modified: Date): 'current' | 'stale' | 'review' {
  const now = Date.now();
  const age = now - modified.getTime();
  const days = age / (1000 * 60 * 60 * 24);

  if (type === 'project' && days > 14) return 'stale';
  if (days > 30) return 'review';
  return 'current';
}

// MEMORY.md index truncates after 200 lines
// Each memory entry is ~1 line in the index
// Optimal: 15-25 memories per project (focused, high-signal)
// Acceptable: up to 35 (still manageable)
// Warning: 35-50 (likely has stale entries)
// Critical: 50+ (diluting context, guaranteed stale info)
const OPTIMAL_MAX = 25;
const ACCEPTABLE_MAX = 35;
const INDEX_LINE_LIMIT = 200;

function calculateMemoryHealth(
  memoryCount: number,
  memoryTotalTokens: number,
  memoryIndex: FileInfo | null,
  memories: { staleness: string }[],
  totalPromptTokens: number,
): MemoryHealth {
  const staleCount = memories.filter(m => m.staleness === 'stale').length;
  const reviewCount = memories.filter(m => m.staleness === 'review').length;

  // Count lines in MEMORY.md index
  let indexLineCount = 0;
  if (memoryIndex) {
    const indexPath = memoryIndex.path;
    try {
      const content = fs.readFileSync(indexPath, 'utf-8');
      indexLineCount = content.split('\n').filter(l => l.trim().length > 0).length;
    } catch { /* ignore */ }
  }

  // Token budget percentage
  const tokenBudgetPct = totalPromptTokens > 0
    ? Math.round((memoryTotalTokens / totalPromptTokens) * 100)
    : 0;

  // Score calculation (0-100)
  let score = 100;
  const suggestions: string[] = [];

  // Penalize for count over optimal
  if (memoryCount > ACCEPTABLE_MAX) {
    score -= Math.min(30, (memoryCount - ACCEPTABLE_MAX) * 2);
    suggestions.push(`Reduce to ${OPTIMAL_MAX} memories. You have ${memoryCount - OPTIMAL_MAX} over the recommended max.`);
  } else if (memoryCount > OPTIMAL_MAX) {
    score -= (memoryCount - OPTIMAL_MAX) * 1.5;
    suggestions.push(`Consider trimming ${memoryCount - OPTIMAL_MAX} memories to stay under ${OPTIMAL_MAX}.`);
  }

  // Penalize for stale memories
  if (staleCount > 0) {
    score -= staleCount * 5;
    suggestions.push(`${staleCount} stale project memories may cause outdated assumptions. Review or delete them.`);
  }

  // Penalize for review-needed memories
  if (reviewCount > 0) {
    score -= reviewCount * 2;
    suggestions.push(`${reviewCount} memories haven't been updated in 30+ days. Verify they're still relevant.`);
  }

  // Penalize if MEMORY.md index is approaching truncation
  if (indexLineCount > INDEX_LINE_LIMIT * 0.8) {
    score -= 15;
    suggestions.push(`MEMORY.md index is ${indexLineCount}/${INDEX_LINE_LIMIT} lines. Lines past 200 are truncated and invisible.`);
  }

  // Penalize if memories use too much of the token budget
  if (tokenBudgetPct > 50) {
    score -= 15;
    suggestions.push(`Memories use ${tokenBudgetPct}% of your prompt context. Consider consolidating or removing low-value entries.`);
  } else if (tokenBudgetPct > 30) {
    score -= 5;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let grade: MemoryHealth['grade'] = 'healthy';
  if (score < 50) grade = 'critical';
  else if (score < 75) grade = 'warning';

  return {
    score,
    grade,
    memoryCount,
    optimalMax: OPTIMAL_MAX,
    indexLineCount,
    indexLineLimit: INDEX_LINE_LIMIT,
    staleCount,
    reviewCount,
    memoryTokens: memoryTotalTokens,
    tokenBudgetPct,
    suggestions,
  };
}

function discoverProjects(): ProjectInfo[] {
  if (!fs.existsSync(PROJECTS_DIR)) return [];

  const projects: ProjectInfo[] = [];
  const entries = fs.readdirSync(PROJECTS_DIR);

  for (const slug of entries) {
    const projectDir = path.join(PROJECTS_DIR, slug);
    const stat = fs.statSync(projectDir);
    if (!stat.isDirectory()) continue;

    const realPath = decodeProjectSlug(slug);
    const projectClaudeMd = path.join(realPath, 'CLAUDE.md');
    const memoryDir = path.join(projectDir, 'memory');

    let memoryCount = 0;
    let memoryTotalTokens = 0;
    let memoryIndex: FileInfo | null = null;
    const memoryStaleness: { staleness: string }[] = [];

    if (fs.existsSync(memoryDir)) {
      const memFiles = fs.readdirSync(memoryDir).filter(f => f.endsWith('.md'));
      for (const f of memFiles) {
        const filePath = path.join(memoryDir, f);
        const content = fs.readFileSync(filePath, 'utf-8');
        if (f === 'MEMORY.md') {
          memoryIndex = getFileInfo(filePath);
        } else {
          memoryCount++;
          memoryTotalTokens += estimateTokens(content);
          const fileStat = fs.statSync(filePath);
          const parsed = parseFrontmatter(content);
          memoryStaleness.push({
            staleness: getMemoryStaleness(parsed.frontmatter.type || 'unknown', fileStat.mtime),
          });
        }
      }
    }

    projects.push({
      slug,
      realPath,
      claudeMd: getFileInfo(projectClaudeMd),
      memoryIndex,
      memoryCount,
      memoryTotalTokens,
      memoryHealth: null, // calculated after totals are known
      _memoryStaleness: memoryStaleness, // temp field
    } as ProjectInfo & { _memoryStaleness: { staleness: string }[] });
  }

  return projects;
}

function discoverSkills(): SkillInfo[] {
  if (!fs.existsSync(SKILLS_DIR)) return [];

  const skills: SkillInfo[] = [];
  const entries = fs.readdirSync(SKILLS_DIR);

  for (const name of entries) {
    const skillDir = path.join(SKILLS_DIR, name);
    const stat = fs.statSync(skillDir);
    if (!stat.isDirectory()) continue;

    const skillMd = path.join(skillDir, 'SKILL.md');
    if (!fs.existsSync(skillMd)) continue;

    const content = fs.readFileSync(skillMd, 'utf-8');
    const parsed = parseFrontmatter(content);

    skills.push({
      name,
      path: skillMd,
      description: parsed.frontmatter.description || '',
      sizeBytes: Buffer.byteLength(content),
      tokens: estimateTokens(content),
    });
  }

  return skills;
}

function discoverSettings(): SettingsInfo {
  if (!fs.existsSync(SETTINGS_PATH)) {
    return { path: SETTINGS_PATH, exists: false, sizeBytes: 0, hookCount: 0, allowCount: 0, denyCount: 0 };
  }

  try {
    const content = fs.readFileSync(SETTINGS_PATH, 'utf-8');
    const settings = JSON.parse(content);
    const permissions = settings.permissions || {};
    const hooks = settings.hooks || {};

    return {
      path: SETTINGS_PATH,
      exists: true,
      sizeBytes: Buffer.byteLength(content),
      hookCount: Object.keys(hooks).length,
      allowCount: Array.isArray(permissions.allow) ? permissions.allow.length : 0,
      denyCount: Array.isArray(permissions.deny) ? permissions.deny.length : 0,
    };
  } catch {
    return { path: SETTINGS_PATH, exists: false, sizeBytes: 0, hookCount: 0, allowCount: 0, denyCount: 0 };
  }
}

function discoverPlans(): FileInfo[] {
  if (!fs.existsSync(PLANS_DIR)) return [];

  return fs.readdirSync(PLANS_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => getFileInfo(path.join(PLANS_DIR, f)))
    .filter((f): f is FileInfo => f !== null);
}

export function discover(): DiscoveryResult {
  const globalClaude = getFileInfo(GLOBAL_CLAUDE_MD);
  const projects = discoverProjects();
  const skills = discoverSkills();
  const settings = discoverSettings();
  const plans = discoverPlans();

  // Calculate totals - what gets loaded per prompt for any given project
  let totalTokens = globalClaude?.tokens || 0;
  // Add the largest project's context as representative
  if (projects.length > 0) {
    const maxProject = projects.reduce((max, p) => {
      const pTokens = (p.claudeMd?.tokens || 0) + (p.memoryIndex?.tokens || 0) + p.memoryTotalTokens;
      const maxTokens = (max.claudeMd?.tokens || 0) + (max.memoryIndex?.tokens || 0) + max.memoryTotalTokens;
      return pTokens > maxTokens ? p : max;
    });
    totalTokens += (maxProject.claudeMd?.tokens || 0) + (maxProject.memoryIndex?.tokens || 0) + maxProject.memoryTotalTokens;
  }

  const filesLoaded = (globalClaude ? 1 : 0) + projects.reduce((n, p) => n + (p.claudeMd ? 1 : 0) + (p.memoryIndex ? 1 : 0) + p.memoryCount, 0);

  // Calculate memory health for each project now that we have totals
  const globalTokens = globalClaude?.tokens || 0;
  for (const p of projects) {
    const projectTotalTokens = globalTokens + (p.claudeMd?.tokens || 0) + (p.memoryIndex?.tokens || 0) + p.memoryTotalTokens;
    const tmp = p as ProjectInfo & { _memoryStaleness?: { staleness: string }[] };
    p.memoryHealth = calculateMemoryHealth(
      p.memoryCount,
      p.memoryTotalTokens,
      p.memoryIndex,
      tmp._memoryStaleness || [],
      projectTotalTokens,
    );
    delete tmp._memoryStaleness;
  }

  return {
    globalClaude,
    projects,
    skills,
    settings,
    plans,
    totals: { filesLoaded, totalTokens },
  };
}

export function getMemories(slug: string): MemoryInfo[] {
  const memoryDir = path.join(PROJECTS_DIR, slug, 'memory');
  if (!fs.existsSync(memoryDir)) return [];

  return fs.readdirSync(memoryDir)
    .filter(f => f.endsWith('.md') && f !== 'MEMORY.md')
    .map(f => {
      const filePath = path.join(memoryDir, f);
      const stat = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = parseFrontmatter(content);

      return {
        filename: f,
        path: filePath,
        exists: true,
        sizeBytes: stat.size,
        tokens: estimateTokens(content),
        modified: stat.mtime.toISOString(),
        name: parsed.frontmatter.name || f.replace('.md', ''),
        description: parsed.frontmatter.description || '',
        type: parsed.frontmatter.type || 'unknown',
        staleness: getMemoryStaleness(parsed.frontmatter.type || 'unknown', stat.mtime),
      };
    });
}
