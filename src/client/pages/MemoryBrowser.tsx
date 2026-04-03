import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { useDiscovery } from '../hooks/useDiscovery';
import type { MemoryHealth } from '../hooks/useDiscovery';

interface MemoryInfo {
  filename: string;
  path: string;
  name: string;
  description: string;
  type: string;
  sizeBytes: number;
  tokens: number;
  modified: string;
  staleness: 'current' | 'stale' | 'review';
}

function formatTokens(n: number): string {
  if (n >= 1000) return `~${(n / 1000).toFixed(1)}k`;
  return `~${n}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function MemoryBrowser() {
  const { slug } = useParams<{ slug: string }>();
  const [memories, setMemories] = useState<MemoryInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'modified' | 'name' | 'tokens'>('modified');
  const [showCreate, setShowCreate] = useState(false);
  const [newMemory, setNewMemory] = useState({ filename: '', name: '', description: '', memoryType: 'feedback', body: '' });
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const data = await invoke<MemoryInfo[]>('get_memories', { slug });
      setMemories(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!slug || !newMemory.filename || !newMemory.name) return;
    setCreating(true);
    try {
      await invoke('create_memory', {
        input: {
          slug,
          filename: newMemory.filename,
          name: newMemory.name,
          description: newMemory.description,
          memoryType: newMemory.memoryType,
          body: newMemory.body || `${newMemory.description}`,
        },
      });
      setNewMemory({ filename: '', name: '', description: '', memoryType: 'feedback', body: '' });
      setShowCreate(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  const handleSyncIndex = async () => {
    if (!slug) return;
    try {
      await invoke('sync_memory_index', { slug });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const [pendingDelete, setPendingDelete] = useState<MemoryInfo | null>(null);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await invoke('delete_file', { path: pendingDelete.path });
      setPendingDelete(null);
      await load();
    } catch (err) {
      const msg = typeof err === 'string' ? err : err instanceof Error ? err.message : 'Failed to delete';
      setError(msg);
      setPendingDelete(null);
    }
  };

  const { data: discoveryData } = useDiscovery();
  const projectHealth: MemoryHealth | null = discoveryData?.projects.find(p => p.slug === slug)?.memoryHealth || null;

  if (loading) return <div className="loading">Loading memories...</div>;
  if (error) return <div className="error-msg">{error}</div>;

  const decodedSlug = slug || '';
  const projectName = decodedSlug.split('-').pop() || decodedSlug;

  const types = ['all', ...new Set(memories.map(m => m.type))];
  const filtered = memories
    .filter(m => filter === 'all' || m.type === filter)
    .sort((a, b) => {
      if (sortBy === 'modified') return new Date(b.modified).getTime() - new Date(a.modified).getTime();
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return b.tokens - a.tokens;
    });

  const staleCount = memories.filter(m => m.staleness === 'stale').length;
  const reviewCount = memories.filter(m => m.staleness === 'review').length;
  const totalTokens = memories.reduce((n, m) => n + m.tokens, 0);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Memories: {projectName}</h1>
          <p className="page-subtitle">
            {memories.length} memories, ~{totalTokens.toLocaleString()} tokens total
            {staleCount > 0 && <span style={{ color: 'var(--color-stale)', marginLeft: '1rem' }}>{staleCount} stale</span>}
            {reviewCount > 0 && <span style={{ color: 'var(--color-review)', marginLeft: '1rem' }}>{reviewCount} needs review</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-ghost" onClick={handleSyncIndex}>Sync Index</button>
          <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? 'Cancel' : 'New Memory'}
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="editor-container" style={{ marginBottom: '1.5rem' }}>
          <div className="editor-header">
            <span style={{ fontWeight: 600, color: '#fff' }}>Create New Memory</span>
          </div>
          <div className="frontmatter-fields">
            <div>
              <label>Filename (without .md)</label>
              <input
                value={newMemory.filename}
                onChange={e => setNewMemory({ ...newMemory, filename: e.target.value })}
                placeholder="feedback_my_rule"
              />
            </div>
            <div>
              <label>Name</label>
              <input
                value={newMemory.name}
                onChange={e => setNewMemory({ ...newMemory, name: e.target.value })}
                placeholder="Human-readable name"
              />
            </div>
            <div>
              <label>Type</label>
              <select
                value={newMemory.memoryType}
                onChange={e => setNewMemory({ ...newMemory, memoryType: e.target.value })}
              >
                <option value="feedback">feedback</option>
                <option value="project">project</option>
                <option value="user">user</option>
                <option value="reference">reference</option>
              </select>
            </div>
            <div>
              <label>Description (one-line)</label>
              <input
                value={newMemory.description}
                onChange={e => setNewMemory({ ...newMemory, description: e.target.value })}
                placeholder="Brief description for the index"
              />
            </div>
          </div>
          <textarea
            className="editor-textarea"
            style={{ minHeight: '120px' }}
            value={newMemory.body}
            onChange={e => setNewMemory({ ...newMemory, body: e.target.value })}
            placeholder="Memory content (markdown)..."
          />
          <div className="editor-footer">
            <button
              className="btn btn-primary"
              onClick={handleCreate}
              disabled={creating || !newMemory.filename || !newMemory.name}
            >
              {creating ? 'Creating...' : 'Create Memory'}
            </button>
          </div>
        </div>
      )}

      {projectHealth && (
        <div style={{
          background: projectHealth.grade === 'critical' ? 'rgba(231, 76, 60, 0.08)' : projectHealth.grade === 'warning' ? 'rgba(243, 156, 18, 0.08)' : 'rgba(39, 174, 96, 0.08)',
          border: `1px solid ${projectHealth.grade === 'critical' ? 'rgba(231, 76, 60, 0.25)' : projectHealth.grade === 'warning' ? 'rgba(243, 156, 18, 0.25)' : 'rgba(39, 174, 96, 0.25)'}`,
          borderRadius: '8px',
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: 600, color: '#fff', fontSize: '0.9rem' }}>
              Memory Health
            </span>
            <span className={`badge badge-${projectHealth.grade === 'healthy' ? 'current' : projectHealth.grade === 'warning' ? 'review' : 'stale'}`}
              style={{ fontSize: '0.8rem', padding: '0.2rem 0.75rem' }}>
              {projectHealth.score}%
            </span>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8rem', color: '#8b8fa3', marginBottom: '0.5rem' }}>
            <span>{projectHealth.memoryCount}/{projectHealth.optimalMax} optimal count</span>
            <span>{projectHealth.tokenBudgetPct}% of context budget</span>
            <span>MEMORY.md: {projectHealth.indexLineCount}/{projectHealth.indexLineLimit} lines</span>
          </div>
          <div style={{ width: '100%', height: '8px', background: '#252a3a', borderRadius: '4px', overflow: 'hidden', marginBottom: '0.5rem' }}>
            <div style={{
              width: `${Math.min(100, (projectHealth.memoryCount / (projectHealth.optimalMax * 2)) * 100)}%`,
              height: '100%',
              borderRadius: '4px',
              background: projectHealth.grade === 'healthy' ? 'var(--color-current)' : projectHealth.grade === 'warning' ? 'var(--color-review)' : 'var(--color-stale)',
            }} />
          </div>
          {projectHealth.suggestions.length > 0 && (
            <div style={{ marginTop: '0.25rem' }}>
              {projectHealth.suggestions.map((s, i) => (
                <div key={i} style={{
                  fontSize: '0.75rem',
                  color: projectHealth.grade === 'critical' ? 'var(--color-stale)' : 'var(--color-review)',
                  lineHeight: 1.5,
                }}>
                  {s}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="filter-bar">
        {types.map(t => (
          <button
            key={t}
            className={`btn btn-ghost ${filter === t ? 'active' : ''}`}
            onClick={() => setFilter(t)}
          >
            {t}
          </button>
        ))}
        <span style={{ marginLeft: 'auto' }} />
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as typeof sortBy)}
          style={{ background: '#1a1f2e', color: '#c5c8d0', border: '1px solid #2a2f3e', borderRadius: '4px', padding: '0.35rem', fontSize: '0.8rem' }}
        >
          <option value="modified">Recent</option>
          <option value="name">Name</option>
          <option value="tokens">Tokens</option>
        </select>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Tokens</th>
            <th>Status</th>
            <th>Modified</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(m => (
            <tr key={m.filename}>
              <td>
                <Link className="clickable" to={`/edit?path=${encodeURIComponent(m.path)}`}>
                  {m.name}
                </Link>
                {m.description && (
                  <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.2rem' }}>
                    {m.description}
                  </div>
                )}
              </td>
              <td><span className="badge badge-type">{m.type}</span></td>
              <td><span className="badge badge-token">{formatTokens(m.tokens)}</span></td>
              <td>
                <span className={`badge badge-${m.staleness}`}>
                  {m.staleness}
                </span>
              </td>
              <td style={{ whiteSpace: 'nowrap' }}>{timeAgo(m.modified)}</td>
              <td>
                <button
                  className="btn btn-danger"
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                  onClick={() => setPendingDelete(m)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {filtered.length === 0 && (
        <div className="loading">No memories match the current filter</div>
      )}

      {pendingDelete && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setPendingDelete(null)}>
          <div style={{
            background: '#1a1f2e', border: '1px solid #2a2f3e', borderRadius: '12px',
            padding: '1.5rem', maxWidth: '400px', width: '90%',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 0.5rem', color: '#fff', fontSize: '1rem' }}>Delete memory?</h3>
            <p style={{ color: '#8b8fa3', fontSize: '0.85rem', margin: '0 0 0.25rem' }}>
              <strong style={{ color: '#c5c8d0' }}>{pendingDelete.name}</strong>
            </p>
            <p style={{ color: '#666', fontSize: '0.75rem', margin: '0 0 1.25rem', wordBreak: 'break-all' }}>
              {pendingDelete.path}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setPendingDelete(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
