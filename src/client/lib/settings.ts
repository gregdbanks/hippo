export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };

export type RuleList = 'allow' | 'ask' | 'deny';
export const RULE_LISTS: RuleList[] = ['allow', 'ask', 'deny'];

export interface RuleGroup {
  label: string;
  rules: { rule: string; index: number }[];
}

export interface HookEntry {
  event: string;
  matcher: string;
  commands: string[];
}

export interface SettingsSections {
  permissions: { lists: Record<RuleList, string[]>; extras: JsonObject } | null;
  hooks: HookEntry[];
  env: [string, Json][];
  plugins: [string, boolean][];
  marketplaces: string[];
  statusLine: JsonObject | null;
  general: [string, Json][];
  other: [string, Json][];
}

const SECTION_KEYS = new Set(['$schema', 'permissions', 'hooks', 'env', 'enabledPlugins', 'extraKnownMarketplaces', 'statusLine']);

export function isObject(value: Json | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isScalar(value: Json): boolean {
  return value === null || typeof value !== 'object';
}

export function parseSettings(text: string): JsonObject | null {
  try {
    const parsed: Json = JSON.parse(text);
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function stringList(value: Json | undefined): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function hookEntries(hooks: Json | undefined): HookEntry[] {
  if (!isObject(hooks)) return [];
  const entries: HookEntry[] = [];
  for (const [event, groups] of Object.entries(hooks)) {
    if (!Array.isArray(groups)) continue;
    for (const group of groups) {
      if (!isObject(group)) continue;
      const commands = (Array.isArray(group.hooks) ? group.hooks : [])
        .map(h => (isObject(h) && typeof h.command === 'string' ? h.command : JSON.stringify(h)));
      entries.push({ event, matcher: typeof group.matcher === 'string' ? group.matcher : '', commands });
    }
  }
  return entries;
}

export function sectionsOf(settings: JsonObject): SettingsSections {
  const perms = settings.permissions;
  const permissions = isObject(perms)
    ? {
        lists: { allow: stringList(perms.allow), ask: stringList(perms.ask), deny: stringList(perms.deny) },
        extras: Object.fromEntries(Object.entries(perms).filter(([k]) => !RULE_LISTS.includes(k as RuleList))),
      }
    : null;
  const rest = Object.entries(settings).filter(([k]) => !SECTION_KEYS.has(k));
  return {
    permissions,
    hooks: hookEntries(settings.hooks),
    env: isObject(settings.env) ? Object.entries(settings.env) : [],
    plugins: isObject(settings.enabledPlugins)
      ? Object.entries(settings.enabledPlugins).map(([k, v]) => [k, v === true] as [string, boolean])
      : [],
    marketplaces: isObject(settings.extraKnownMarketplaces) ? Object.keys(settings.extraKnownMarketplaces) : [],
    statusLine: isObject(settings.statusLine) ? settings.statusLine : null,
    general: rest.filter(([, v]) => isScalar(v)),
    other: rest.filter(([, v]) => !isScalar(v)),
  };
}

export function ruleGroupLabel(rule: string): string {
  const match = /^([\w.-]+)(?:\((.*)\))?$/.exec(rule.trim());
  if (!match) return rule;
  const [, tool, inner] = match;
  if (tool !== 'Bash' || !inner) return tool;
  const command = inner.trim().split(/[\s:*]/)[0];
  return command ? `Bash: ${command}` : 'Bash';
}

export function groupRules(rules: string[]): RuleGroup[] {
  const groups = new Map<string, RuleGroup>();
  rules.forEach((rule, index) => {
    const label = ruleGroupLabel(rule);
    const group = groups.get(label) ?? { label, rules: [] };
    group.rules.push({ rule, index });
    groups.set(label, group);
  });
  return [...groups.values()].sort((a, b) => b.rules.length - a.rules.length || a.label.localeCompare(b.label));
}

export function updateSettings(text: string, path: string[], value: Json | undefined): string {
  const root = parseSettings(text);
  if (!root || path.length === 0) return text;
  let node: JsonObject = root;
  for (const key of path.slice(0, -1)) {
    const next = node[key];
    if (!isObject(next)) {
      if (value === undefined) return text;
      node[key] = {};
    }
    node = node[key] as JsonObject;
  }
  const last = path[path.length - 1];
  if (value === undefined) delete node[last];
  else node[last] = value;
  return JSON.stringify(root, null, 2) + (text.endsWith('\n') ? '\n' : '');
}

export function removeRule(text: string, list: RuleList, index: number): string {
  const rules = sectionsOf(parseSettings(text) ?? {}).permissions?.lists[list] ?? [];
  return updateSettings(text, ['permissions', list], rules.filter((_, i) => i !== index));
}

export function addRule(text: string, list: RuleList, rule: string): string {
  const trimmed = rule.trim();
  const rules = sectionsOf(parseSettings(text) ?? {}).permissions?.lists[list] ?? [];
  if (!trimmed || rules.includes(trimmed)) return text;
  return updateSettings(text, ['permissions', list], [...rules, trimmed]);
}

export function humanizeKey(key: string): string {
  const spaced = key.replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
