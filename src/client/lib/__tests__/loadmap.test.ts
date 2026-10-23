import { describe, expect, it } from 'vitest';
import { buildLoadMap } from '../loadmap';

const home = '/Users/a';
const items = [
  { path: '/Users/a/.claude/CLAUDE.md', label: '~/.claude/CLAUDE.md', tokens: 1000 },
  { path: '/Users/a/.claude/skills/review/SKILL.md', label: 'skill listing: ~/.claude/skills/review/SKILL.md', tokens: 40 },
  { path: '/Users/a/code/CLAUDE.md', label: '~/code/CLAUDE.md', tokens: 300 },
  { path: '/Users/a/code/shop/CLAUDE.md', label: '~/code/shop/CLAUDE.md', tokens: 500 },
  { path: '/Users/a/code/shop/.claude/rules/style.md', label: '~/code/shop/.claude/rules/style.md', tokens: 80 },
  { path: '/Users/a/.claude/projects/-Users-a-code-shop/memory/MEMORY.md', label: 'first 200 lines of ...', tokens: 120 },
];

describe('buildLoadMap', () => {
  const map = buildLoadMap(home, '/Users/a/code/shop', items);

  it('lists global first, then every folder from home down to the project, then memory', () => {
    expect(map.map(g => g.title)).toEqual(['~/.claude (global)', '~', '~/code', '~/code/shop', 'Memory for this project']);
  });

  it('puts each file under the folder that owns it', () => {
    const shop = map.find(g => g.title === '~/code/shop');
    expect(shop?.items.map(i => i.path)).toEqual(['/Users/a/code/shop/CLAUDE.md', '/Users/a/code/shop/.claude/rules/style.md']);
    expect(map.find(g => g.title === '~/.claude (global)')?.items).toHaveLength(2);
  });

  it('keeps folders that load nothing so the path is visible, and totals each group', () => {
    const homeGroup = map.find(g => g.title === '~');
    expect(homeGroup?.items).toEqual([]);
    expect(map.find(g => g.title === '~/code/shop')?.tokens).toBe(580);
    expect(map.map(g => g.depth)).toEqual([0, 0, 1, 2, 0]);
  });

  it('handles the home folder itself as the project', () => {
    expect(buildLoadMap(home, home, items.slice(0, 1)).map(g => g.title)).toEqual(['~/.claude (global)', '~']);
  });
});
