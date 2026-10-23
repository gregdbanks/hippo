import type { Budget, ConfigFile, Kind, Level, Loading, MirrorItem, Tool, Unit } from './types';

export const LOADING_LABEL: Record<Loading, string> = {
  always: 'Every session',
  scoped: 'Matching files',
  agentDecides: 'When relevant',
  manual: 'When @-mentioned',
  onDemand: 'On demand',
  config: 'Settings',
  ignored: 'Ignored',
  skipped: 'Skipped by Claude',
};

export const KIND_LABEL: Record<Kind, string> = {
  instructions: 'Instructions',
  rule: 'Rule',
  skill: 'Skill',
  settings: 'Settings',
  memoryIndex: 'Memory index',
  memory: 'Memory',
  reference: 'Reference doc',
};

export const TOOL_LABEL: Record<Tool, string> = {
  claude: 'Claude',
  cursor: 'Cursor',
  shared: 'Claude + Cursor',
};

const LEVEL_RANK: Record<Level, number> = { ok: 0, warn: 1, over: 2 };

export function worstLevel(file: ConfigFile): Level {
  const fromBudgets = file.budgets.reduce<Level>(
    (worst, b) => (LEVEL_RANK[b.level] > LEVEL_RANK[worst] ? b.level : worst),
    'ok',
  );
  return file.issues.length > 0 && fromBudgets === 'ok' ? 'warn' : fromBudgets;
}

export function needsAttention(file: ConfigFile): boolean {
  return worstLevel(file) !== 'ok';
}

export function levelOf(used: number, limit: number): Level {
  if (used > limit) return 'over';
  if (used * 100 >= limit * 80) return 'warn';
  return 'ok';
}

export function countLines(text: string): number {
  if (text === '') return 0;
  return text.replace(/\r?\n$/, '').split(/\r?\n/).length;
}

export function countBytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

const LIVE_UNITS: Unit[] = ['lines', 'bytes'];

export function liveBudget(budget: Budget, text: string): Budget {
  if (!LIVE_UNITS.includes(budget.unit)) return budget;
  const used = budget.unit === 'lines' ? countLines(text) : countBytes(text);
  return { ...budget, used, level: levelOf(used, budget.limit) };
}

export function formatTokens(n: number): string {
  if (n >= 1000) return `≈${(n / 1000).toFixed(1)}k`;
  return `≈${n}`;
}

export function percentOf(part: number, whole: number): string {
  if (whole <= 0) return '0%';
  const pct = (part / whole) * 100;
  return pct < 1 ? '<1%' : `${Math.round(pct)}%`;
}

export function displayPath(home: string, path: string): string {
  if (path === home) return '~';
  return path.startsWith(`${home}/`) ? `~${path.slice(home.length)}` : path;
}

export function timeAgo(iso: string): string {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function mirrorNeedsRun(items: MirrorItem[]): boolean {
  return items.some(i => i.state === 'missing' || i.state === 'outdated' || i.state === 'orphaned');
}

export function mirrorSourcePath(file: ConfigFile): string | null {
  if (!file.mirroredFrom) return null;
  const at = file.path.indexOf('/.cursor/rules/');
  return at < 0 ? null : `${file.path.slice(0, at)}/${file.mirroredFrom}`;
}

export function usedBy(files: ConfigFile[], path: string): ConfigFile[] {
  return files.filter(f => f.path !== path && f.references.some(r => r.path === path));
}

export function editorLink(path: string): string {
  return `/edit?path=${encodeURIComponent(path)}`;
}
