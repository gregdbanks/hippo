import { describe, expect, it } from 'vitest';
import { addRule, groupRules, humanizeKey, parseSettings, removeRule, ruleGroupLabel, sectionsOf, updateSettings } from '../settings';

const text = JSON.stringify({
  $schema: 'https://json.schemastore.org/claude-code-settings.json',
  permissions: { allow: ['Read', 'Grep'], ask: ['Bash(git push*)'], deny: ['Bash(git push --force *)', 'Bash(rm -rf *)'], defaultMode: 'acceptEdits' },
  hooks: { PostToolUse: [{ matcher: 'Edit|Write', hooks: [{ type: 'command', command: 'npm run lint' }] }] },
  env: { DEBUG: '1' },
  enabledPlugins: { 'figma@official': true, 'old@official': false },
  extraKnownMarketplaces: { official: { source: { source: 'github', repo: 'a/b' } } },
  statusLine: { type: 'command', command: 'echo hi' },
  effortLevel: 'high',
  alwaysThinkingEnabled: true,
  autoMode: { soft_deny: ['x'] },
}, null, 2) + '\n';

describe('parseSettings', () => {
  it('returns null for invalid JSON or a non-object', () => {
    expect(parseSettings('{')).toBeNull();
    expect(parseSettings('[1]')).toBeNull();
  });
});

describe('sectionsOf', () => {
  const s = sectionsOf(parseSettings(text)!);

  it('splits permissions into rule lists and extras', () => {
    expect(s.permissions?.lists.deny).toHaveLength(2);
    expect(s.permissions?.extras).toEqual({ defaultMode: 'acceptEdits' });
  });

  it('flattens hooks to event, matcher and commands', () => {
    expect(s.hooks).toEqual([{ event: 'PostToolUse', matcher: 'Edit|Write', commands: ['npm run lint'] }]);
  });

  it('puts leftover scalars in general and objects in other, skipping $schema', () => {
    expect(s.general.map(([k]) => k)).toEqual(['effortLevel', 'alwaysThinkingEnabled']);
    expect(s.other.map(([k]) => k)).toEqual(['autoMode']);
  });

  it('reads plugins and marketplaces', () => {
    expect(s.plugins).toEqual([['figma@official', true], ['old@official', false]]);
    expect(s.marketplaces).toEqual(['official']);
  });
});

describe('rule grouping', () => {
  it.each([
    ['Read', 'Read'],
    ['Bash(git push --force *)', 'Bash: git'],
    ['Bash(npm run test:*)', 'Bash: npm'],
    ['Bash(*)', 'Bash'],
    ['WebFetch(domain:example.com)', 'WebFetch'],
    ['mcp__figma__get', 'mcp__figma__get'],
  ])('%s groups under %s', (rule, label) => {
    expect(ruleGroupLabel(rule)).toBe(label);
  });

  it('keeps original indexes and puts the biggest group first', () => {
    expect(groupRules(['Read', 'Bash(git a)', 'Bash(git b)'])).toEqual([
      { label: 'Bash: git', rules: [{ rule: 'Bash(git a)', index: 1 }, { rule: 'Bash(git b)', index: 2 }] },
      { label: 'Read', rules: [{ rule: 'Read', index: 0 }] },
    ]);
  });
});

describe('editing', () => {
  it('sets nested values and keeps the trailing newline', () => {
    const next = updateSettings(text, ['enabledPlugins', 'old@official'], true);
    expect(parseSettings(next)?.enabledPlugins).toEqual({ 'figma@official': true, 'old@official': true });
    expect(next.endsWith('}\n')).toBe(true);
  });

  it('removes a key when the value is undefined', () => {
    expect(parseSettings(updateSettings(text, ['effortLevel'], undefined))).not.toHaveProperty('effortLevel');
  });

  it('creates missing parents', () => {
    expect(parseSettings(updateSettings('{}', ['env', 'A'], 'b'))).toEqual({ env: { A: 'b' } });
  });

  it('leaves invalid JSON untouched', () => {
    expect(updateSettings('{', ['a'], 1)).toBe('{');
  });

  it('adds and removes rules, ignoring blanks and duplicates', () => {
    expect(parseSettings(addRule(text, 'allow', ' Glob '))?.permissions).toMatchObject({ allow: ['Read', 'Grep', 'Glob'] });
    expect(addRule(text, 'allow', 'Read')).toBe(text);
    expect(addRule(text, 'allow', '  ')).toBe(text);
    expect(parseSettings(removeRule(text, 'deny', 0))?.permissions).toMatchObject({ deny: ['Bash(rm -rf *)'] });
    expect(parseSettings(addRule('{}', 'ask', 'Bash'))).toEqual({ permissions: { ask: ['Bash'] } });
  });
});

describe('humanizeKey', () => {
  it.each([
    ['alwaysThinkingEnabled', 'Always thinking enabled'],
    ['soft_deny', 'Soft deny'],
    ['tui', 'Tui'],
  ])('%s -> %s', (key, label) => {
    expect(humanizeKey(key)).toBe(label);
  });
});
