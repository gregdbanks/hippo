import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { useInventory } from '../hooks/useInventory';
import { displayPath } from '../lib/format';

interface SearchHit {
  path: string;
  name: string;
  line: number;
  text: string;
}

const DEBOUNCE_MS = 250;

export default function SearchPage() {
  const { data } = useInventory();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setHits(null);
      return;
    }
    const timer = window.setTimeout(() => {
      invoke<SearchHit[]>('search_configs', { query })
        .then(result => { setHits(result); setError(null); })
        .catch(err => setError(String(err)));
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  const home = data?.home ?? '';
  const files = hits ? [...new Set(hits.map(h => h.path))] : [];

  return (
    <>
      <h1>Search</h1>
      <p className="page-subtitle">Find text across every Claude and Cursor config file, skill, rule and memory.</p>
      <input className="search-input" autoFocus placeholder="Search, e.g. browser-testing" value={query} onChange={e => setQuery(e.target.value)} />
      {error && <p className="text-over small">{error}</p>}
      {hits && <p className="muted small">{hits.length === 0 ? 'No matches.' : `${hits.length} matching line${hits.length === 1 ? '' : 's'} in ${files.length} file${files.length === 1 ? '' : 's'}${hits.length >= 300 ? ' (showing the first 300)' : ''}.`}</p>}
      {files.map(path => (
        <section key={path} className="search-file">
          <h3>{displayPath(home, path)}</h3>
          {hits?.filter(h => h.path === path).map(h => (
            <Link key={h.line} className="search-hit" to={`/edit?path=${encodeURIComponent(h.path)}&find=${encodeURIComponent(query.trim())}&line=${h.line}`}>
              <span className="muted small">{h.line}</span>
              <span>{h.text}</span>
            </Link>
          ))}
        </section>
      ))}
    </>
  );
}
