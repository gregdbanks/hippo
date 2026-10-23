import type { LoadItem } from './types';

export interface LoadGroup {
  title: string;
  kind: 'global' | 'folder' | 'memory';
  depth: number;
  items: LoadItem[];
  tokens: number;
}

const shorten = (home: string, dir: string) => (dir === home ? '~' : dir.startsWith(`${home}/`) ? `~${dir.slice(home.length)}` : dir);

function ownerFolder(path: string): string {
  const marker = ['/.claude/', '/.cursor/'].map(m => path.lastIndexOf(m)).find(i => i >= 0);
  if (marker !== undefined && marker >= 0) return path.slice(0, marker);
  return path.slice(0, path.lastIndexOf('/'));
}

function folderChain(home: string, root: string): string[] {
  if (root !== home && !root.startsWith(`${home}/`)) return [root];
  const parts = root.slice(home.length).split('/').filter(Boolean);
  return [home, ...parts.map((_, i) => `${home}/${parts.slice(0, i + 1).join('/')}`)];
}

export function buildLoadMap(home: string, root: string, items: LoadItem[]): LoadGroup[] {
  const globals = new Map<string, LoadItem[]>();
  const folders = new Map<string, LoadItem[]>(folderChain(home, root).map(dir => [dir, []]));
  const memory: LoadItem[] = [];

  for (const item of items) {
    if (item.path.startsWith(`${home}/.claude/projects/`)) memory.push(item);
    else if (item.path.startsWith(`${home}/.claude/`) || item.path.startsWith(`${home}/.cursor/`)) {
      const key = item.path.startsWith(`${home}/.claude/`) ? '~/.claude (global)' : '~/.cursor (global)';
      globals.set(key, [...(globals.get(key) ?? []), item]);
    } else {
      const dir = ownerFolder(item.path);
      folders.set(dir, [...(folders.get(dir) ?? []), item]);
    }
  }

  const total = (list: LoadItem[]) => list.reduce((sum, i) => sum + i.tokens, 0);
  const groups: LoadGroup[] = [...globals].map(([title, list]) => ({ title, kind: 'global', depth: 0, items: list, tokens: total(list) }));
  for (const [dir, list] of [...folders].sort((a, b) => a[0].length - b[0].length)) {
    const depth = dir === home ? 0 : dir.slice(home.length).split('/').filter(Boolean).length;
    groups.push({ title: shorten(home, dir), kind: 'folder', depth: Math.max(0, depth), items: list, tokens: total(list) });
  }
  if (memory.length) groups.push({ title: 'Memory for this project', kind: 'memory', depth: 0, items: memory, tokens: total(memory) });
  return groups;
}
