import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Marked } from 'marked';

interface GuideInfo {
  id: string;
  title: string;
  updated: string;
}

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
const markdown = new Marked({ renderer: { html: token => escapeHtml(token.text) } });

export default function GuidesPage() {
  const [guides, setGuides] = useState<GuideInfo[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    invoke<GuideInfo[]>('list_guides')
      .then(list => { setGuides(list); setSelected(s => s ?? list[0]?.id ?? null); })
      .catch(e => setError(String(e)));
  }, []);

  useEffect(() => {
    if (!selected) return;
    invoke<string>('read_guide', { id: selected }).then(setBody).catch(e => setError(String(e)));
  }, [selected]);

  const html = useMemo(() => markdown.parse(body, { async: false }) as string, [body]);

  return (
    <>
      <h1>Guides</h1>
      <p className="page-subtitle">How-tos and walkthroughs collected as we learn how things work. Stored privately on this Mac, not in the repo.</p>
      {error && <p className="text-over small">{error}</p>}
      {guides && guides.length === 0 && <p className="empty-note">No guides yet.</p>}
      {guides && guides.length > 1 && (
        <div className="guide-tabs">
          {guides.map(g => (
            <button key={g.id} className={`btn btn-ghost btn-small ${g.id === selected ? 'active' : ''}`} onClick={() => setSelected(g.id)}>{g.title}</button>
          ))}
        </div>
      )}
      <article className="guide" dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}
