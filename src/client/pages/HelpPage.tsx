const LIMITS = [
  { file: 'CLAUDE.md (global, project, CLAUDE.local.md)', limit: 'Under 200 lines', why: 'Loads every session. Longer files use more context and get followed less reliably.', source: 'https://code.claude.com/docs/en/memory' },
  { file: '.claude/rules/*.md without paths:', limit: 'Under 200 lines', why: 'Loads every session, same as CLAUDE.md. Add paths: to load it only for matching files.', source: 'https://code.claude.com/docs/en/memory' },
  { file: 'Memory index (MEMORY.md)', limit: '200 lines or 25KB', why: 'Hard cutoff. Anything past it is never loaded.', source: 'https://code.claude.com/docs/en/memory' },
  { file: 'SKILL.md', limit: 'Under 500 lines', why: 'Move reference material into separate files.', source: 'https://code.claude.com/docs/en/skills' },
  { file: 'Skill description + when_to_use', limit: '1,536 characters', why: 'Cut off in the skill list Claude sees. Put the key use case first.', source: 'https://code.claude.com/docs/en/skills' },
  { file: '.cursor/rules/*.mdc', limit: 'Under 200 lines', why: 'Held to the CLAUDE.md target so both tools work the same. Cursor itself allows up to 500.', source: 'https://cursor.com/docs/context/rules' },
];

export default function HelpPage() {
  return (
    <>
      <h1>How it works</h1>
      <p className="page-subtitle">Hippo finds every Claude and Cursor config file under your home folder so you can read, edit and add them in one place.</p>

      <h2>Where files come from</h2>
      <ul className="help-list">
        <li><strong>Global:</strong> <code>~/.claude</code> (CLAUDE.md, settings, rules, skills) and <code>~/.cursor</code> (rules, skills).</li>
        <li><strong>Projects:</strong> any folder up to three levels inside your home folder with a CLAUDE.md, AGENTS.md, .cursorrules, <code>.claude</code> folder or <code>.cursor/rules</code> folder, plus every project Claude has saved memory for.</li>
        <li><strong>Skipped:</strong> node_modules, build folders, git worktrees, and Desktop, Documents, Downloads and Library.</li>
        <li><strong>AGENTS.md</strong> is read by Cursor, and by Claude only when no CLAUDE.md applies to that folder.</li>
      </ul>

      <h2>Size limits</h2>
      <p className="muted small">Gauges turn yellow at 80% of a limit and red past it. Each limit comes from the tool's own documentation.</p>
      <table className="data-table">
        <thead><tr><th>File</th><th>Limit</th><th>Why</th></tr></thead>
        <tbody>
          {LIMITS.map(l => (
            <tr key={l.file}>
              <td>{l.file}</td>
              <td>{l.limit}</td>
              <td>{l.why}<div className="gauge-source">{l.source}</div></td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Keeping Cursor in line with Claude</h2>
      <ul className="help-list">
        <li><strong>Instructions:</strong> "Share CLAUDE.md with Cursor" makes <code>AGENTS.md</code> a link to <code>CLAUDE.md</code>. Cursor reads it, and Claude skips it because a CLAUDE.md exists, so nothing loads twice.</li>
        <li><strong>Rules:</strong> "Mirror rules to Cursor" turns each <code>.claude/rules/*.md</code> into a <code>.cursor/rules/*.mdc</code> (<code>paths:</code> becomes <code>globs</code>, no paths means always apply). Edit the Claude rule and mirror again.</li>
        <li><strong>Skills:</strong> Cursor already reads <code>~/.claude/skills</code> and <code>.claude/skills</code>.</li>
        <li><strong>Global rules:</strong> Cursor keeps these in Settings &gt; Rules, so paste <code>~/.claude/CLAUDE.md</code> there once.</li>
      </ul>

      <h2>Skills vs config</h2>
      <ul className="help-list">
        <li>Hard rules that must always apply stay in CLAUDE.md, as one line that names the skill with the details.</li>
        <li>Long step-by-step procedures become skills. Only their name and description load every session.</li>
        <li>Reference material goes in <code>docs/claude/</code>, with a pointer in CLAUDE.md saying when to read it.</li>
      </ul>

      <h2>Alerts</h2>
      <p className="muted small">Hippo checks every 5 minutes while it runs. You get a notification when a file gets worse (close to a limit, over it, or a new problem) or a project falls out of sync with Cursor, and at most one daily summary after 9am while something still needs attention.</p>

      <h2>Saving</h2>
      <ul className="help-list">
        <li>Hippo only saves Claude and Cursor config files inside your home folder.</li>
        <li>If a file changed on disk since you opened it, Hippo stops and asks before overwriting.</li>
        <li>Settings files must be valid JSON before they can be saved.</li>
        <li>Unsaved edits are kept while Hippo is open, even if you switch pages.</li>
      </ul>
    </>
  );
}
