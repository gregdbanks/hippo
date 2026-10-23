import { describe, expect, it } from 'vitest';
import type { Budget, ConfigFile } from '../types';
import { countBytes, countLines, displayPath, levelOf, liveBudget, mirrorNeedsRun, mirrorSourcePath, percentOf, usedBy, worstLevel } from '../format';

const budget = (over: Partial<Budget> = {}): Budget => ({
  label: 'Length', used: 0, limit: 200, unit: 'lines', level: 'ok', note: '', source: '', ...over,
});

const file = (over: Partial<ConfigFile> = {}): ConfigFile => ({
  path: '/h/a', name: 'a', tool: 'claude', kind: 'rule', loading: 'always', loadingNote: '', description: '',
  lines: 1, bytes: 1, tokens: 1, modified: '', budgets: [], issues: [], linkTarget: null, mirroredFrom: null, references: [], ...over,
});

describe('countLines matches how the Rust side counts', () => {
  it.each([
    ['', 0],
    ['one', 1],
    ['one\n', 1],
    ['one\ntwo', 2],
    ['one\ntwo\n', 2],
    ['one\r\ntwo\r\n', 2],
    ['\n', 1],
    ['a\n\nb\n', 3],
  ])('%j has %i lines', (text, expected) => {
    expect(countLines(text)).toBe(expected);
  });
});

describe('levelOf', () => {
  it('uses the same 80% warning line as the backend', () => {
    expect(levelOf(159, 200)).toBe('ok');
    expect(levelOf(160, 200)).toBe('warn');
    expect(levelOf(200, 200)).toBe('warn');
    expect(levelOf(201, 200)).toBe('over');
  });
});

describe('liveBudget', () => {
  it('recounts lines and bytes as you type', () => {
    expect(liveBudget(budget(), 'x\n'.repeat(201)).level).toBe('over');
    expect(liveBudget(budget({ unit: 'bytes', limit: 4 }), 'héllo').used).toBe(countBytes('héllo'));
  });

  it('leaves character budgets as saved', () => {
    const chars = budget({ unit: 'chars', used: 10, limit: 1536 });
    expect(liveBudget(chars, 'anything')).toBe(chars);
  });
});

describe('worstLevel', () => {
  it('takes the worst budget', () => {
    expect(worstLevel(file({ budgets: [budget({ level: 'warn' }), budget({ level: 'over' })] }))).toBe('over');
  });

  it('treats an issue as worth a look even within limits', () => {
    expect(worstLevel(file({ issues: ['Cursor ignores .md rules'] }))).toBe('warn');
    expect(worstLevel(file())).toBe('ok');
  });
});

describe('display helpers', () => {
  it('shortens paths under home', () => {
    expect(displayPath('/Users/a', '/Users/a')).toBe('~');
    expect(displayPath('/Users/a', '/Users/a/code/CLAUDE.md')).toBe('~/code/CLAUDE.md');
    expect(displayPath('/Users/a', '/Users/ab/CLAUDE.md')).toBe('/Users/ab/CLAUDE.md');
  });

  it('formats small shares of the context window', () => {
    expect(percentOf(500, 200_000)).toBe('<1%');
    expect(percentOf(20_000, 200_000)).toBe('10%');
  });
});

describe('unity helpers', () => {
  it('knows when a mirror run would change something', () => {
    expect(mirrorNeedsRun([{ source: 'a', dest: 'b', state: 'current' }, { source: null, dest: 'c', state: 'handWritten' }])).toBe(false);
    expect(mirrorNeedsRun([{ source: 'a', dest: 'b', state: 'outdated' }])).toBe(true);
    expect(mirrorNeedsRun([{ source: null, dest: 'b', state: 'orphaned' }])).toBe(true);
  });

  it('finds the Claude rule a mirrored Cursor rule came from', () => {
    const mirrored = file({ path: '/h/app/.cursor/rules/api/x.mdc', mirroredFrom: '.claude/rules/api/x.md' });
    expect(mirrorSourcePath(mirrored)).toBe('/h/app/.claude/rules/api/x.md');
    expect(mirrorSourcePath(file())).toBeNull();
  });

  it('lists the files that reference a path', () => {
    const doc = '/h/app/docs/claude/api.md';
    const claude = file({ path: '/h/app/CLAUDE.md', references: [{ label: 'docs/claude/api.md', path: doc, kind: 'file' }] });
    expect(usedBy([claude, file({ path: doc })], doc)).toEqual([claude]);
  });
});
