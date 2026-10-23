import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useInventory } from '../hooks/useInventory';
import { buildLoadMap } from '../lib/loadmap';
import { displayPath, editorLink, formatTokens, percentOf } from '../lib/format';

type ToolName = 'claude' | 'cursor';

export default function MapPage() {
  const { data, loading, error } = useInventory();
  const [params, setParams] = useSearchParams();
  const [tool, setTool] = useState<ToolName>('claude');

  if (loading && !data) return <div className="loading">Scanning config files...</div>;
  if (error) return <div className="error-msg">{error}</div>;
  if (!data) return null;

  const projects = data.projects.filter(p => p.exists);
  const root = params.get('root') ?? projects[0]?.root ?? data.home;
  const project = projects.find(p => p.root === root);
  const session = tool === 'claude' ? project?.claudeSession : project?.cursorSession;
  const groups = buildLoadMap(data.home, root, session?.items ?? []);

  return (
    <>
      <h1>Where things live</h1>
      <p className="page-subtitle">
        Pick the folder you start a session in. This shows every config file that loads, from your global folder down to that project.
        Folders on the path that load nothing are shown too, so you can see the whole chain.
      </p>

      <div className="map-controls">
        <label>
          Starting folder
          <select value={root} onChange={e => setParams({ root: e.target.value })}>
            {projects.map(p => <option key={p.root} value={p.root}>{displayPath(data.home, p.root)}</option>)}
          </select>
        </label>
        <div className="map-tools" role="radiogroup" aria-label="Tool">
          {(['claude', 'cursor'] as ToolName[]).map(t => (
            <button key={t} role="radio" aria-checked={tool === t} className={`btn btn-ghost btn-small ${tool === t ? 'active' : ''}`} onClick={() => setTool(t)}>
              {t === 'claude' ? 'Claude' : 'Cursor'}
            </button>
          ))}
        </div>
      </div>

      <p className="map-total">
        {tool === 'claude' ? 'Claude' : 'Cursor'} loads <strong>{formatTokens(session?.tokens ?? 0)} tokens</strong> before you type anything
        <span className="muted"> ({percentOf(session?.tokens ?? 0, data.contextWindow)} of a {(data.contextWindow / 1000).toFixed(0)}K context window)</span>
      </p>
      {tool === 'cursor' && <p className="muted small">Cursor's global User Rules live in Cursor Settings &gt; Rules, not in files, so they can't be shown here.</p>}

      <div className="map-tree">
        {groups.map(g => (
          <div key={g.title} className={`map-group map-kind-${g.kind}`} style={{ marginLeft: `${g.depth * 1.25}rem` }}>
            <div className="map-folder">
              <span className="map-folder-name">{g.title}</span>
              <span className="muted small">{g.items.length ? formatTokens(g.tokens) + ' tokens' : 'nothing loads from here'}</span>
            </div>
            {g.items.map(item => (
              <Link key={item.path + item.label} className="map-file" to={editorLink(item.path)}>
                <span>{g.kind === 'memory' ? 'MEMORY.md (first 200 lines)' : item.label}</span>
                <span className="muted small">{formatTokens(item.tokens)}</span>
              </Link>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
