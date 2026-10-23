import { mockIPC } from '@tauri-apps/api/mocks';

interface Snapshot {
  inventory: { home: string; projects: { root: string; agentsLink: string; mirror: { state: string }[]; memorySlug: string | null; files: { path: string; kind: string; name: string; description: string; bytes: number; tokens: number; modified: string }[] }[] };
  contents: Record<string, string>;
  alerts: unknown[];
}

const snapshot: Snapshot = await (await fetch('./snapshot.json')).json();
const contents = { ...snapshot.contents };

function templateFor(kind: string, name: string): string {
  if (kind === 'cursorRule') return `---\ndescription: \nglobs: \nalwaysApply: false\n---\n\n# ${name}\n\n- \n`;
  if (kind.endsWith('Skill')) return `---\nname: ${name}\ndescription: \n---\n\n# ${name}\n\n`;
  return `# ${name}\n\n- \n`;
}

mockIPC((cmd, args) => {
  const a = (args ?? {}) as Record<string, unknown>;
  switch (cmd) {
    case 'inventory':
      return snapshot.inventory;
    case 'read_file': {
      const content = contents[a.path as string] ?? '';
      return { content, sizeBytes: content.length, modified: 'demo', tokens: Math.ceil(content.length / 3.7) };
    }
    case 'write_file':
      contents[a.path as string] = a.content as string;
      return { sizeBytes: 1, tokens: 1, modified: 'demo' };
    case 'create_config_file': {
      const { root, kind, name } = a as { root: string; kind: string; name: string };
      const path = kind === 'cursorRule' ? `${root}/.cursor/rules/${name}.mdc`
        : kind === 'claudeRule' ? `${root}/.claude/rules/${name}.md`
        : `${root}/${kind === 'cursorSkill' ? '.cursor' : '.claude'}/skills/${name}/SKILL.md`;
      contents[path] = templateFor(kind, name);
      return path;
    }
    case 'mirror_rules_to_cursor':
      snapshot.inventory.projects.filter(p => p.root === a.root).forEach(p => p.mirror.forEach(m => { m.state = 'current'; }));
      return { created: ['.cursor/rules/forms.mdc', '.cursor/rules/style.mdc'], updated: [], removed: [], unchanged: [], skipped: [] };
    case 'share_with_cursor':
      snapshot.inventory.projects.filter(p => p.root === a.root).forEach(p => { p.agentsLink = 'linked'; });
      return `${a.root}/AGENTS.md`;
    case 'search_configs': {
      const q = String(a.query).toLowerCase();
      const hits: { path: string; name: string; line: number; text: string }[] = [];
      for (const [path, text] of Object.entries(contents)) {
        text.split('\n').forEach((line, i) => { if (line.toLowerCase().includes(q)) hits.push({ path, name: '', line: i + 1, text: line.trim() }); });
      }
      return hits.slice(0, 300);
    }
    case 'list_history':
      return [
        { id: '00000000000000000002', savedAt: new Date(Date.now() - 2 * 3600e3).toISOString(), bytes: 9214 },
        { id: '00000000000000000001', savedAt: new Date(Date.now() - 26 * 3600e3).toISOString(), bytes: 8860 },
      ];
    case 'read_history':
      return (contents[a.path as string] ?? '').split('\n').slice(0, 120).join('\n');
    case 'get_memories': {
      const project = snapshot.inventory.projects.find(p => p.memorySlug === a.slug);
      return (project?.files ?? []).filter(f => f.kind === 'memory').map(f => ({
        filename: f.path.split('/').pop(), path: f.path, name: f.name, description: f.description,
        type: /type:\s*(\w+)/.exec(contents[f.path] ?? '')?.[1] ?? 'feedback', sizeBytes: f.bytes, tokens: f.tokens, modified: f.modified, staleness: 'current',
      }));
    }
    case 'get_alerts':
      return { enabled: true, items: snapshot.alerts };
    case 'plugin:autostart|is_enabled':
      return false;
    case 'list_guides':
      return [];
    default:
      return { ok: true };
  }
});

await import('../main');
