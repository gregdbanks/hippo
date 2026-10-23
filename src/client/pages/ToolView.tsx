import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useInventory } from '../hooks/useInventory';
import { FileList } from '../components/FileList';
import { SessionMeter } from '../components/SessionMeter';
import { NewFileButtons } from '../components/NewFileForm';
import { CursorSync } from '../components/CursorSync';
import type { ConfigFile, NewFileKind, Project } from '../lib/types';
import { mirrorNeedsRun, needsAttention } from '../lib/format';

type ToolName = 'claude' | 'cursor';

const TOOL_TEXT: Record<ToolName, { title: string; subtitle: string; kinds: NewFileKind[] }> = {
  claude: {
    title: 'Claude',
    subtitle: 'Claude Code reads these: CLAUDE.md, rules, skills, settings and memory. AGENTS.md only when no CLAUDE.md applies.',
    kinds: ['claudeRule', 'claudeSkill'],
  },
  cursor: {
    title: 'Cursor',
    subtitle: 'Cursor follows your Claude setup here: it reads AGENTS.md (linked to CLAUDE.md), mirrored rules, and Claude skills. Global User Rules live in Cursor Settings > Rules, so paste ~/.claude/CLAUDE.md there once.',
    kinds: ['cursorRule', 'cursorSkill'],
  },
};

function forTool(files: ConfigFile[], tool: ToolName): ConfigFile[] {
  return files.filter(f => f.tool === tool || f.tool === 'shared');
}

function ProjectSection({ project, tool, contextWindow, startOpen }: { project: Project; tool: ToolName; contextWindow: number; startOpen: boolean }) {
  const files = forTool(project.files, tool);
  const flagged = files.filter(needsAttention).length;
  const session = tool === 'claude' ? project.claudeSession : project.cursorSession;

  return (
    <details className="project-section" open={startOpen}>
      <summary>
        <span className="project-name">{project.name}</span>
        <span className="muted small"> {files.length} file{files.length === 1 ? '' : 's'}</span>
        {flagged > 0 && <span className="badge badge-warn-count">{flagged} to review</span>}
        {tool === 'cursor' && project.usesCursor && (project.agentsLink === 'unshared' || mirrorNeedsRun(project.mirror)) && (
          <span className="badge badge-warn-count">Not synced with Claude</span>
        )}
      </summary>
      {!project.exists && (
        <p className="muted small">This folder no longer exists, but Claude still has memory saved for it. Review or delete those memories.</p>
      )}
      {tool === 'cursor' && project.exists && <CursorSync project={project} />}
      <SessionMeter tool={TOOL_TEXT[tool].title} session={session} contextWindow={contextWindow} />
      <FileList files={files} />
      <div className="section-actions">
        {project.exists && <NewFileButtons root={project.root} kinds={TOOL_TEXT[tool].kinds} />}
        {tool === 'claude' && project.memorySlug && (
          <Link className="btn btn-ghost btn-small" to={`/memories/${encodeURIComponent(project.memorySlug)}`}>Manage memories</Link>
        )}
      </div>
    </details>
  );
}

export default function ToolView({ tool }: { tool: ToolName }) {
  const { data, loading, error } = useInventory();
  const [filter, setFilter] = useState('');

  if (loading && !data) return <div className="loading">Scanning config files...</div>;
  if (error) return <div className="error-msg">{error}</div>;
  if (!data) return null;

  const text = TOOL_TEXT[tool];
  const global = tool === 'claude' ? data.claudeGlobal : data.cursorGlobal;
  const projects = data.projects
    .filter(p => forTool(p.files, tool).length > 0 || (tool === 'cursor' && p.exists && (p.agentsLink !== 'noClaudeMd' || p.mirror.length > 0)))
    .filter(p => p.name.toLowerCase().includes(filter.trim().toLowerCase()));

  return (
    <>
      <h1>{text.title}</h1>
      <p className="page-subtitle">{text.subtitle}</p>

      <section className="tool-section">
        <h2>Global <span className="muted small">applies to every project</span></h2>
        <FileList files={global} />
        <div className="section-actions"><NewFileButtons root={data.home} kinds={text.kinds} /></div>
      </section>

      <section className="tool-section">
        <div className="section-head">
          <h2>Projects <span className="muted small">{projects.length}</span></h2>
          <input className="filter-input" placeholder="Filter projects" value={filter} onChange={e => setFilter(e.target.value)} />
        </div>
        {projects.length === 0 && <p className="empty-note">No projects with {text.title} files{filter ? ' match that filter' : ''}.</p>}
        {projects.map(p => (
          <ProjectSection key={p.root} project={p} tool={tool} contextWindow={data.contextWindow} startOpen={filter.trim() !== '' && projects.length <= 3} />
        ))}
      </section>
    </>
  );
}
