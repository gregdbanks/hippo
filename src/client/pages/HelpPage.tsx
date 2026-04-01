export default function HelpPage() {
  return (
    <>
      <h1>How to Use Claude Config</h1>
      <p className="page-subtitle">Everything you need to know about managing your Claude Code setup</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        <Section title="What This App Does">
          <p>Claude Config gives you visibility and control over all the hidden files that Claude Code uses. Without this app, these files are scattered across your machine in hard-to-find locations. This app puts them all in one place where you can see, edit, and manage them.</p>
        </Section>

        <Section title="Dashboard">
          <p>The <strong>Dashboard</strong> is your home screen. It shows:</p>
          <ul>
            <li><strong>Context Budget / Prompt</strong> — how many tokens your config files cost per prompt. Every prompt you send to Claude loads these files, so smaller = cheaper and faster.</li>
            <li><strong>Global CLAUDE.md</strong> — your global instructions that apply to every project. Click "Edit" to modify.</li>
            <li><strong>Projects</strong> — every project Claude Code has tracked. Each shows its memory count, token cost, and a health score.</li>
            <li><strong>Memory Health</strong> — a 0-100% score for each project. Green (75-100%) is healthy. Orange (50-74%) means you should clean up. Red (0-49%) means memories are costing too much or are stale.</li>
          </ul>
        </Section>

        <Section title="Memories">
          <p>Click any project in the sidebar to see its <strong>memories</strong>. Memories are things Claude Code has learned about you, your preferences, and your project. They persist across conversations.</p>
          <ul>
            <li><strong>Types</strong>: <em>feedback</em> (how you like to work), <em>project</em> (current state/context), <em>user</em> (who you are), <em>reference</em> (where to find things)</li>
            <li><strong>Staleness</strong>: Project memories older than 14 days are marked <span style={{ color: 'var(--color-stale)', fontWeight: 600 }}>stale</span> because project state changes fast. Any memory over 30 days gets <span style={{ color: 'var(--color-review)', fontWeight: 600 }}>review</span>.</li>
            <li><strong>Optimal count</strong>: 15-25 memories per project. More than that dilutes context and wastes tokens.</li>
            <li><strong>New Memory</strong>: Click the button to create a memory with proper frontmatter. The MEMORY.md index auto-updates.</li>
            <li><strong>Sync Index</strong>: If your MEMORY.md gets out of sync with the actual files, click this to rebuild it.</li>
            <li><strong>Delete</strong>: Removes the file from disk and its entry from MEMORY.md.</li>
          </ul>
        </Section>

        <Section title="Settings">
          <p>The <strong>Settings</strong> page shows your <code>~/.claude/settings.json</code> — this controls permissions, hooks, and deny rules. Edit with caution; invalid JSON is rejected before saving.</p>
          <ul>
            <li><strong>permissions.allow</strong> — tools Claude can use without asking</li>
            <li><strong>permissions.deny</strong> — commands Claude is blocked from running</li>
            <li><strong>hooks</strong> — shell commands that run before/after tool calls</li>
          </ul>
        </Section>

        <Section title="Skills">
          <p><strong>Skills</strong> are on-demand slash commands (like <code>/commit</code>, <code>/audit</code>). They live in <code>~/.claude/skills/</code> and are only loaded when you invoke them — they don't cost tokens per prompt like CLAUDE.md does.</p>
          <p>Click "Edit" on any skill to modify its SKILL.md file.</p>
        </Section>

        <Section title="Docs">
          <p>The <strong>Docs</strong> page lists markdown files in this repo. View them with rendered formatting or click "Edit" to modify. Good for keeping reference docs (like CLI_TOOLS.md) alongside your config.</p>
        </Section>

        <Section title="Sync (Porting Config Between Machines)">
          <p>The <strong>Sync</strong> page lets you port your global config to another machine:</p>
          <ol>
            <li><strong>Export</strong> — snapshots your CLAUDE.md, settings.json, and all skills into a <code>portable/</code> folder in this repo</li>
            <li><strong>Commit & push</strong> the portable folder to GitHub</li>
            <li>On the new machine: clone this repo, build the app, open <strong>Sync</strong>, click <strong>Import</strong></li>
            <li>Your global config is now on the new machine</li>
          </ol>
          <p><strong>What gets synced:</strong> Global CLAUDE.md, settings.json, skills</p>
          <p><strong>What doesn't:</strong> Project memories (they're machine/project-specific)</p>
        </Section>

        <Section title="CLAUDE.md vs Skills vs Memories">
          <table className="data-table" style={{ marginTop: '0.5rem' }}>
            <thead>
              <tr>
                <th>Type</th>
                <th>Loaded When</th>
                <th>Token Cost</th>
                <th>Best For</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 600, color: '#fff' }}>Global CLAUDE.md</td>
                <td>Every prompt</td>
                <td>Always</td>
                <td>Rules that apply 80%+ of the time</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600, color: '#fff' }}>Project CLAUDE.md</td>
                <td>Every prompt in that project</td>
                <td>Always (in project)</td>
                <td>Project-specific context, tech stack</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600, color: '#fff' }}>Memories</td>
                <td>Every prompt in that project</td>
                <td>Always (in project)</td>
                <td>Learned preferences, project state</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600, color: '#fff' }}>Skills</td>
                <td>Only when invoked</td>
                <td>Zero (until used)</td>
                <td>Specialized workflows you trigger manually</td>
              </tr>
            </tbody>
          </table>
        </Section>

        <Section title="Tips">
          <ul>
            <li>Keep your Global CLAUDE.md concise — every token counts on every prompt</li>
            <li>Move specialized procedures to Skills instead of CLAUDE.md</li>
            <li>Audit memories regularly — delete stale ones, consolidate duplicates</li>
            <li>Use the token count on each file to understand what you're paying per prompt</li>
            <li>The health score is a guide, not a rule — use your judgment on what to keep</li>
          </ul>
        </Section>

      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#1a1f2e', border: '1px solid #2a2f3e', borderRadius: '8px', padding: '1.25rem 1.5rem' }}>
      <h2 style={{ color: '#fff', fontSize: '1.05rem', marginTop: 0, marginBottom: '0.75rem' }}>{title}</h2>
      <div style={{ fontSize: '0.875rem', color: '#c5c8d0', lineHeight: 1.7 }}>
        {children}
      </div>
      <style>{`
        div > ul, div > ol { padding-left: 1.25rem; margin: 0.5rem 0; }
        div > ul li, div > ol li { margin-bottom: 0.35rem; }
        div > p { margin: 0.5rem 0; }
        div > p code, div > ul code, div > ol code { background: #252a3a; padding: 0.1rem 0.3rem; border-radius: 3px; font-size: 0.85em; }
      `}</style>
    </div>
  );
}
