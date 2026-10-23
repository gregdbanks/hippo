import { Link } from 'react-router-dom';
import { allFiles, useInventory } from '../hooks/useInventory';
import { Gauge } from '../components/Gauge';
import { AlertSettings } from '../components/AlertSettings';
import type { ConfigFile, Inventory } from '../lib/types';
import { TOOL_LABEL, displayPath, editorLink, formatTokens, mirrorNeedsRun, percentOf, worstLevel } from '../lib/format';

function attentionList(inv: Inventory): ConfigFile[] {
  const rank = { over: 0, warn: 1, ok: 2 };
  return allFiles(inv)
    .filter(f => !f.linkTarget && worstLevel(f) !== 'ok')
    .sort((a, b) => rank[worstLevel(a)] - rank[worstLevel(b)] || b.lines - a.lines);
}

export default function Overview() {
  const { data, loading, error, refresh } = useInventory();

  if (loading && !data) return <div className="loading">Scanning config files...</div>;
  if (error) return <div className="error-msg">{error}</div>;
  if (!data) return null;

  const files = allFiles(data);
  const attention = attentionList(data);
  const over = attention.filter(f => worstLevel(f) === 'over').length;
  const outOfSync = data.projects.filter(p => p.usesCursor && (p.agentsLink === 'unshared' || mirrorNeedsRun(p.mirror)));
  const busiest = [...data.projects].filter(p => p.exists).sort((a, b) => b.claudeSession.tokens - a.claudeSession.tokens);

  return (
    <>
      <div className="section-head">
        <div>
          <h1>Overview</h1>
          <p className="page-subtitle">Every Claude and Cursor config file on this Mac, checked against the documented size limits.</p>
        </div>
        <button className="btn btn-ghost" onClick={refresh} disabled={loading}>{loading ? 'Scanning...' : 'Rescan'}</button>
      </div>

      <div className="summary-grid">
        <div className="summary-card"><div className="label">Config files</div><div className="value">{files.length}</div><div className="detail">{data.projects.length} projects</div></div>
        <div className="summary-card"><div className="label">Over a limit</div><div className={`value ${over ? 'text-over' : ''}`}>{over}</div><div className="detail">{attention.length - over} close to a limit or with a problem</div></div>
        <div className="summary-card"><div className="label">Claude, global</div><div className="value">{data.claudeGlobal.length}</div><div className="detail"><Link to="/claude">View Claude files</Link></div></div>
        <div className="summary-card"><div className="label">Cursor, global</div><div className="value">{data.cursorGlobal.length}</div><div className="detail"><Link to="/cursor">View Cursor files</Link></div></div>
      </div>

      <h2>Needs attention</h2>
      {attention.length === 0 && <p className="empty-note">Everything is within its limits.</p>}
      <div className="attention-list">
        {attention.map(f => (
          <Link key={f.path} to={editorLink(f.path)} className="attention-item">
            <div className="attention-head">
              <span className={`dot dot-${worstLevel(f)}`} />
              <strong>{f.name}</strong>
              <span className={`badge badge-tool-${f.tool}`}>{TOOL_LABEL[f.tool]}</span>
              <span className="muted small">{displayPath(data.home, f.path)}</span>
            </div>
            {f.budgets.filter(b => b.level !== 'ok').map(b => <Gauge key={b.label} budget={b} />)}
            {f.issues.map(i => <p key={i} className="issue">{i}</p>)}
          </Link>
        ))}
      </div>

      <h2>Out of sync with Cursor</h2>
      {outOfSync.length === 0 && <p className="empty-note">Cursor sees the same instructions and rules as Claude everywhere.</p>}
      {outOfSync.length > 0 && (
        <p className="muted small">
          {outOfSync.length} project{outOfSync.length === 1 ? '' : 's'}: {outOfSync.map(p => p.name).join(', ')}. <Link to="/cursor">Fix on the Cursor page</Link>
        </p>
      )}

      <h2>Alerts</h2>
      <AlertSettings />

      <h2>What loads every session</h2>
      <p className="muted small">Estimated tokens Claude reads before you type anything, per project: global and project CLAUDE.md files, always-on rules, the memory index and skill descriptions.</p>
      <table className="data-table">
        <thead><tr><th>Project</th><th>Claude</th><th>Cursor</th></tr></thead>
        <tbody>
          {busiest.map(p => (
            <tr key={p.root}>
              <td>{p.name}</td>
              <td>{formatTokens(p.claudeSession.tokens)} <span className="muted small">({percentOf(p.claudeSession.tokens, data.contextWindow)})</span></td>
              <td>{p.cursorSession.items.length ? formatTokens(p.cursorSession.tokens) : <span className="muted">none</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
