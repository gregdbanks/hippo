import { useState } from 'react';
import { Link } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import type { DiscoveryResult } from '../hooks/useDiscovery';

interface Props {
  data: DiscoveryResult | null;
  refresh: () => void;
}

function formatTokens(n: number): string {
  if (n >= 1000) return `~${(n / 1000).toFixed(1)}k`;
  return `~${n}`;
}

const SKILL_TEMPLATES: Record<string, { description: string; body: string; disableModelInvocation: boolean; allowedTools: string; }> = {
  blank: {
    description: '',
    body: '',
    disableModelInvocation: false,
    allowedTools: '',
  },
  'code-review': {
    description: 'Review code changes for bugs, security issues, and style. Use when reviewing PRs or diffs.',
    body: `Review the code changes with focus on:

1. **Correctness** — Logic errors, edge cases, off-by-one mistakes
2. **Security** — Injection, auth issues, data exposure
3. **Performance** — N+1 queries, unnecessary allocations, missing indexes
4. **Readability** — Naming, structure, unnecessary complexity

Only flag real issues. Don't nitpick style preferences.
Output format: list each issue with file:line, severity (blocker/warning/nit), and a fix suggestion.`,
    disableModelInvocation: false,
    allowedTools: 'Read Grep Glob Bash',
  },
  'commit-message': {
    description: 'Generate a commit message from staged changes. Use when committing code.',
    body: `Look at the staged git diff and write a commit message.

Rules:
- First line: imperative mood, under 72 chars, no period (e.g. "Add retry logic to API client")
- Blank line, then body if the change is non-trivial
- Body explains **why**, not what (the diff shows what)
- Never mention AI, Claude, LLM, or assistant`,
    disableModelInvocation: false,
    allowedTools: 'Bash',
  },
  'explain': {
    description: 'Explain how code works with diagrams and analogies. Use when the user asks how something works.',
    body: `When explaining code, always include:

1. **Analogy** — Compare to something from everyday life
2. **Diagram** — ASCII art showing the flow or structure
3. **Walkthrough** — Step-by-step what happens at runtime
4. **Gotcha** — One common misconception about this code

Keep it conversational. Match depth to the user's experience level.`,
    disableModelInvocation: false,
    allowedTools: 'Read Grep Glob',
  },
  'test-writer': {
    description: 'Write tests for the specified code. Use when the user asks for tests.',
    body: `Write tests for the specified code following TDD principles:

1. **Read the code** — Understand all branches, edge cases, error paths
2. **Name tests descriptively** — "should reject expired tokens" not "test1"
3. **Arrange-Act-Assert** — Clear setup, action, and verification
4. **Cover edge cases** — Empty inputs, boundaries, error conditions, concurrency
5. **No mocks unless necessary** — Prefer real dependencies; mock only external services

Match the existing test framework and patterns in the project.`,
    disableModelInvocation: false,
    allowedTools: 'Read Grep Glob Bash',
  },
  'refactor': {
    description: 'Refactor code for clarity and maintainability. Use when asked to clean up or simplify code.',
    body: `Refactor the specified code. Priorities:

1. **Extract** — Break large functions into named, testable pieces
2. **Simplify** — Remove dead code, redundant checks, unnecessary abstractions
3. **Rename** — Make names say what they mean
4. **Flatten** — Reduce nesting; early returns over deep if/else

Constraints:
- Preserve all existing behavior (no functional changes)
- Keep the diff minimal — don't reformat unrelated code
- If a refactor is risky, explain the tradeoff before proceeding`,
    disableModelInvocation: true,
    allowedTools: 'Read Grep Glob Edit Bash',
  },
  'design-audit': {
    description: 'Audit an entire app\'s UI for cohesion and professional quality. Creates a design system spec and GitHub issues for every deviation. Use when an app looks AI-generated or lacks brand cohesion.',
    body: `You are a senior design director auditing an entire application for professional cohesion. You are NOT fixing anything — you are establishing the standard and documenting every deviation.

## Process

1. **Discover the app's surface area** — Read all pages, shared components, global styles, theme files
2. **Screenshot 3-5 key pages** — Dashboard, detail view, form, empty state
3. **Diagnose cohesion problems** across ALL pages — typography inconsistencies, color palette drift, spacing arbitrariness, component inconsistencies, missing interaction states
4. **Write a design system spec** — Concrete values (hex, px, ms) for typography scale, color palette, spacing grid, and interaction patterns
5. **Create a GitHub issue** via \`gh issue create\` with title "Design audit: [app] — [X] deviations", the spec, and categorized checklists (typography/color/spacing/polish) with file:line references

Rules: No code changes. Every deviation must reference a file path. The spec must be concrete, not vague.`,
    disableModelInvocation: true,
    allowedTools: 'Read Grep Glob Bash Agent',
  },
  'design-typography': {
    description: 'Apply a cohesive type scale across an entire app. Reads the design audit issue for the spec, then fixes every typography deviation app-wide. Use after /design-audit.',
    body: `You are a senior designer implementing typography consistency across an entire application.

1. Find the design audit issue: \`gh issue list --label design,audit --state open\` — if none exists, tell the user to run /design-audit first
2. Map every font-size, font-weight, line-height, letter-spacing in the app
3. Fix in order: theme/token files first, shared components second, page overrides last
4. Screenshot the same pages from the audit to verify consistency
5. Check off typography items in the audit issue, commit with \`refs #ISSUE\``,
    disableModelInvocation: true,
    allowedTools: 'Read Grep Glob Edit Bash Agent',
  },
  'design-color': {
    description: 'Apply a cohesive color palette across an entire app. Reads the design audit issue for the spec, then fixes every color deviation app-wide. Use after /design-audit.',
    body: `You are a senior designer implementing color consistency across an entire application.

1. Find the design audit issue: \`gh issue list --label design,audit --state open\` — if none exists, tell the user to run /design-audit first
2. Map every color value (hex, rgb, hsl, tailwind classes, theme refs) and group by purpose
3. Fix in order: CSS variables/theme first, shared components second, page overrides last
4. Convert hardcoded colors to variables. Ensure 4.5:1 contrast. No pure #FFF/#000.
5. Screenshot to verify, check off color items in the audit issue, commit with \`refs #ISSUE\``,
    disableModelInvocation: true,
    allowedTools: 'Read Grep Glob Edit Bash Agent',
  },
  'design-spacing': {
    description: 'Apply a cohesive spacing grid and visual hierarchy across an entire app. Reads the design audit issue for the spec. Use after /design-audit.',
    body: `You are a senior designer implementing spacing consistency across an entire application.

1. Find the design audit issue: \`gh issue list --label design,audit --state open\` — if none exists, tell the user to run /design-audit first
2. Map every margin, padding, gap value. Flag anything off-grid.
3. Fix in order: spacing tokens, layout components, shared components, page layouts, one-offs
4. Key principles: proximity = relationship, consistent rhythm, generous whitespace, hierarchy through space
5. Screenshot to verify, check off spacing items in the audit issue, commit with \`refs #ISSUE\``,
    disableModelInvocation: true,
    allowedTools: 'Read Grep Glob Edit Bash Agent',
  },
  'design-polish': {
    description: 'Add professional interaction polish across an entire app — hover states, transitions, focus rings, loading states. Use after /design-audit, typically last.',
    body: `You are a senior designer adding the final layer of professional polish across an entire application.

1. Find the design audit issue: \`gh issue list --label design,audit --state open\` — if none exists, tell the user to run /design-audit first
2. Inventory every interactive element (buttons, links, inputs, clickable cards, tabs, modals)
3. Add consistent hover states, focus-visible rings, active feedback, transitions (150-200ms), disabled styles, loading states
4. Fix in order: global CSS defaults, shared components, navigation, page-specific interactions
5. Test by interacting across pages. Screenshot states. Check off polish items, close the issue if all done. Commit with \`refs #ISSUE\``,
    disableModelInvocation: true,
    allowedTools: 'Read Grep Glob Edit Bash Agent',
  },
};

const TEMPLATE_OPTIONS = [
  { value: 'blank', label: 'Blank skill' },
  { value: 'code-review', label: 'Code Review' },
  { value: 'commit-message', label: 'Commit Message' },
  { value: 'explain', label: 'Explain Code' },
  { value: 'test-writer', label: 'Test Writer' },
  { value: 'refactor', label: 'Refactor' },
  { value: 'design-audit', label: 'Design Audit (app-wide)' },
  { value: 'design-typography', label: 'Design: Typography' },
  { value: 'design-color', label: 'Design: Color' },
  { value: 'design-spacing', label: 'Design: Spacing' },
  { value: 'design-polish', label: 'Design: Polish' },
];

export default function SkillsBrowser({ data, refresh }: Props) {
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [body, setBody] = useState('');
  const [disableModelInvocation, setDisableModelInvocation] = useState(false);
  const [allowedTools, setAllowedTools] = useState('');
  const [contextFork, setContextFork] = useState(false);

  if (!data) return <div className="loading">Loading...</div>;

  const resetForm = () => {
    setName('');
    setDescription('');
    setBody('');
    setDisableModelInvocation(false);
    setAllowedTools('');
    setContextFork(false);
    setError(null);
  };

  const applyTemplate = (key: string) => {
    const tpl = SKILL_TEMPLATES[key];
    if (!tpl) return;
    setDescription(tpl.description);
    setBody(tpl.body);
    setDisableModelInvocation(tpl.disableModelInvocation);
    setAllowedTools(tpl.allowedTools);
  };

  const handleCreate = async () => {
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    if (!slug) {
      setError('Skill name is required');
      return;
    }
    if (!description.trim()) {
      setError('Description is required — Claude uses it to decide when to invoke the skill');
      return;
    }

    // Build frontmatter
    const fm: string[] = ['---'];
    fm.push(`name: ${slug}`);
    fm.push(`description: ${description.trim()}`);
    if (disableModelInvocation) fm.push('disable-model-invocation: true');
    if (allowedTools.trim()) fm.push(`allowed-tools: "${allowedTools.trim()}"`);
    if (contextFork) fm.push('context: fork');
    fm.push('---');
    fm.push('');

    const content = fm.join('\n') + body.trim() + '\n';
    // Derive skills dir from existing skill paths, or from settings path
    let skillsBase: string;
    if (data.skills.length > 0) {
      skillsBase = data.skills[0].path.split('/.claude/skills/')[0] + '/.claude/skills';
    } else {
      // settings.path is always populated: ~/.claude/settings.json
      skillsBase = data.settings.path.replace('/settings.json', '/skills');
    }
    const filePath = `${skillsBase}/${slug}/SKILL.md`;

    setSaving(true);
    setError(null);
    try {
      await invoke('write_file', { path: filePath, content });
      setSuccess(`Created /${slug}`);
      setTimeout(() => setSuccess(null), 3000);
      setCreating(false);
      resetForm();
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Skills</h1>
          <p className="page-subtitle">
            Slash commands loaded on demand ({data.skills.length} total)
          </p>
        </div>
        {!creating && (
          <button className="btn btn-primary" onClick={() => { resetForm(); setCreating(true); }}>
            New Skill
          </button>
        )}
      </div>

      {success && <div className="success-msg" style={{ marginBottom: '1rem' }}>{success}</div>}

      {creating && (
        <div className="editor-container" style={{ marginBottom: '1.5rem' }}>
          <div className="editor-header">
            <span style={{ color: '#fff', fontWeight: 600 }}>Create New Skill</span>
            <button className="btn btn-ghost" style={{ fontSize: '0.75rem' }} onClick={() => { setCreating(false); resetForm(); }}>
              Cancel
            </button>
          </div>

          <div className="frontmatter-fields">
            <div>
              <label>Skill Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="my-skill (becomes /my-skill)"
              />
            </div>
            <div>
              <label>Start from template</label>
              <select onChange={e => applyTemplate(e.target.value)} defaultValue="">
                <option value="" disabled>Choose a template...</option>
                {TEMPLATE_OPTIONS.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label>Description <span style={{ color: '#666', fontWeight: 400 }}>(Claude uses this to decide when to auto-invoke)</span></label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Review code for bugs and security issues. Use when reviewing PRs."
              />
            </div>
            <div>
              <label>Allowed Tools <span style={{ color: '#666', fontWeight: 400 }}>(space-separated)</span></label>
              <input
                type="text"
                value={allowedTools}
                onChange={e => setAllowedTools(e.target.value)}
                placeholder="Read Grep Glob Bash Edit"
              />
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'end', paddingBottom: '0.25rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', marginBottom: 0 }}>
                <input
                  type="checkbox"
                  checked={disableModelInvocation}
                  onChange={e => setDisableModelInvocation(e.target.checked)}
                />
                Manual only
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', marginBottom: 0 }}>
                <input
                  type="checkbox"
                  checked={contextFork}
                  onChange={e => setContextFork(e.target.checked)}
                />
                Run in subagent
              </label>
            </div>
          </div>

          <textarea
            className="editor-textarea"
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Write the prompt instructions Claude will follow when this skill is invoked..."
            style={{ minHeight: '250px' }}
          />

          <div className="editor-footer">
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
                {saving ? 'Creating...' : 'Create Skill'}
              </button>
              {error && <span style={{ color: 'var(--color-stale)', fontSize: '0.8rem' }}>{error}</span>}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#666' }}>
              Saves to ~/.claude/skills/{name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-') || '...'}/SKILL.md
            </span>
          </div>
        </div>
      )}

      {data.skills.length === 0 && !creating ? (
        <div className="loading">No skills found in ~/.claude/skills/</div>
      ) : (
        <div className="project-list">
          {data.skills.map(skill => (
            <div key={skill.name} className="project-card">
              <div>
                <div className="project-name">/{skill.name}</div>
                <div className="project-path">{skill.description || 'No description'}</div>
              </div>
              <div className="project-stats">
                <span className="badge badge-token">{formatTokens(skill.tokens)} tokens</span>
                <Link
                  className="btn btn-ghost"
                  to={`/edit?path=${encodeURIComponent(skill.path)}`}
                  style={{ fontSize: '0.75rem' }}
                >
                  Edit
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
