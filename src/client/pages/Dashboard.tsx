import { Link } from 'react-router-dom';
import type { DiscoveryResult } from '../hooks/useDiscovery';

interface Props {
  data: DiscoveryResult | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

function formatTokens(n: number): string {
  if (n >= 1000) return `~${(n / 1000).toFixed(1)}k`;
  return `~${n}`;
}

function formatBytes(n: number): string {
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function Dashboard({ data, loading, error, refresh }: Props) {
  if (loading) return <div className="loading">Scanning Claude Code config...</div>;
  if (error) return <div className="error-msg">{error}</div>;
  if (!data) return null;

  const totalMemories = data.projects.reduce((n, p) => n + p.memoryCount, 0);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Dashboard</h1>
          <p className="page-subtitle">Overview of all Claude Code configuration</p>
        </div>
        <button className="btn btn-ghost" onClick={refresh}>Refresh</button>
      </div>

      <div className="summary-grid">
        <div className="summary-card token-budget">
          <div className="label">Context Budget / Prompt</div>
          <div className="value">{formatTokens(data.totals.totalTokens)}</div>
          <div className="detail">{data.totals.filesLoaded} files loaded</div>
        </div>

        <div className="summary-card">
          <div className="label">Global CLAUDE.md</div>
          <div className="value">{data.globalClaude ? formatTokens(data.globalClaude.tokens) : 'None'}</div>
          <div className="detail">
            {data.globalClaude
              ? <Link className="clickable" to={`/edit?path=${encodeURIComponent(data.globalClaude.path)}`}>Edit</Link>
              : 'Not found'}
          </div>
        </div>

        <div className="summary-card">
          <div className="label">Projects</div>
          <div className="value">{data.projects.length}</div>
          <div className="detail">{totalMemories} total memories</div>
        </div>

        <div className="summary-card">
          <div className="label">Skills</div>
          <div className="value">{data.skills.length}</div>
          <div className="detail">On-demand slash commands</div>
        </div>

        <div className="summary-card">
          <div className="label">Settings</div>
          <div className="value">{data.settings.exists ? 'Active' : 'None'}</div>
          <div className="detail">
            {data.settings.allowCount} allow, {data.settings.denyCount} deny, {data.settings.hookCount} hooks
          </div>
        </div>

        <div className="summary-card">
          <div className="label">Plans</div>
          <div className="value">{data.plans.length}</div>
          <div className="detail">Session planning docs</div>
        </div>
      </div>

      <h2 style={{ color: '#fff', fontSize: '1.1rem', marginBottom: '1rem' }}>Projects</h2>
      <div className="project-list">
        {data.projects.map(p => {
          const name = p.realPath.split('/').pop() || p.slug;
          const projectTokens = (p.claudeMd?.tokens || 0) + (p.memoryIndex?.tokens || 0) + p.memoryTotalTokens;
          const health = p.memoryHealth;
          return (
            <div key={p.slug} className="project-card" style={{ flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <div>
                  <div className="project-name">{name}</div>
                  <div className="project-path">{p.realPath}</div>
                </div>
                <div className="project-stats">
                  {p.claudeMd && (
                    <Link className="btn btn-ghost" to={`/edit?path=${encodeURIComponent(p.claudeMd.path)}`} style={{ fontSize: '0.75rem' }}>
                      CLAUDE.md
                    </Link>
                  )}
                  <Link className="btn btn-ghost" to={`/memories/${encodeURIComponent(p.slug)}`} style={{ fontSize: '0.75rem' }}>
                    {p.memoryCount} memories
                  </Link>
                  <span className="badge badge-token">{formatTokens(projectTokens)} tokens</span>
                </div>
              </div>

              {health && health.memoryCount > 0 && (
                <div className="memory-health-bar" style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#8b8fa3' }}>
                      Memory Health: {health.memoryCount}/{health.optimalMax} optimal
                    </span>
                    <span className={`badge badge-${health.grade === 'healthy' ? 'current' : health.grade === 'warning' ? 'review' : 'stale'}`}>
                      {health.score}% {health.grade}
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: '#252a3a', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(100, (health.memoryCount / health.optimalMax) * 100)}%`,
                      height: '100%',
                      borderRadius: '3px',
                      background: health.grade === 'healthy' ? 'var(--color-current)' : health.grade === 'warning' ? 'var(--color-review)' : 'var(--color-stale)',
                      transition: 'width 0.3s',
                    }} />
                  </div>
                  {health.suggestions.length > 0 && (
                    <div style={{ marginTop: '0.4rem' }}>
                      {health.suggestions.map((s, i) => (
                        <div key={i} style={{ fontSize: '0.7rem', color: health.grade === 'critical' ? 'var(--color-stale)' : 'var(--color-review)', lineHeight: 1.4 }}>
                          {s}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {data.plans.length > 0 && (
        <>
          <h2 style={{ color: '#fff', fontSize: '1.1rem', marginTop: '2rem', marginBottom: '1rem' }}>Plans</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Size</th>
                <th>Tokens</th>
                <th>Modified</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.plans.map(plan => (
                <tr key={plan.path}>
                  <td>{plan.path.split('/').pop()}</td>
                  <td>{formatBytes(plan.sizeBytes)}</td>
                  <td><span className="badge badge-token">{formatTokens(plan.tokens)}</span></td>
                  <td>{timeAgo(plan.modified)}</td>
                  <td>
                    <Link className="btn btn-ghost" to={`/edit?path=${encodeURIComponent(plan.path)}`} style={{ fontSize: '0.75rem' }}>
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}
