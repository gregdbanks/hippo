import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { fetchJson } from '../lib/api';
import { useFile } from '../hooks/useFile';

interface DocInfo {
  filename: string;
  path: string;
  sizeBytes: number;
  tokens: number;
  modified: string;
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

function MarkdownPreview({ content }: { content: string }) {
  // Simple markdown rendering — headers, bold, italic, lists, tables, code blocks
  const lines = content.split('\n');
  const elements: JSX.Element[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let inTable = false;
  let tableRows: string[][] = [];
  let tableHeader: string[] = [];

  const flushTable = () => {
    if (tableHeader.length === 0) return;
    elements.push(
      <table key={`table-${elements.length}`} className="data-table" style={{ marginBottom: '1rem' }}>
        <thead>
          <tr>{tableHeader.map((h, i) => <th key={i}>{h.trim()}</th>)}</tr>
        </thead>
        <tbody>
          {tableRows.map((row, ri) => (
            <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{formatInline(cell.trim())}</td>)}</tr>
          ))}
        </tbody>
      </table>
    );
    tableHeader = [];
    tableRows = [];
    inTable = false;
  };

  const formatInline = (text: string) => {
    // Bold-italic with AUTH/REQUIRED/NEVER — render as red warning
    text = text.replace(
      /\*\*\*(.*?)\*\*\*/g,
      (_, content) => {
        const isWarning = /auth|required|never|secret|credential|token|key/i.test(content);
        if (isWarning) {
          return `<span style="color:#e74c3c;font-weight:700;font-style:italic;background:rgba(231,76,60,0.1);padding:0.15rem 0.5rem;border-radius:4px;border-left:3px solid #e74c3c;display:inline-block;margin:0.25rem 0">${content}</span>`;
        }
        return `<strong><em>${content}</em></strong>`;
      }
    );
    // Bold
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic — auth-related italics also get red
    text = text.replace(/\*(.*?)\*/g, (_, content) => {
      const isAuthNote = /auth|no secrets|no token|none required|never commit/i.test(content);
      if (isAuthNote) {
        return `<em style="color:#e74c3c;font-weight:600">${content}</em>`;
      }
      return `<em>${content}</em>`;
    });
    // Inline code
    text = text.replace(/`(.*?)`/g, '<code style="background:#252a3a;padding:0.1rem 0.3rem;border-radius:3px;font-size:0.85em">$1</code>');
    return <span dangerouslySetInnerHTML={{ __html: text }} />;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${i}`} style={{ background: '#0d1117', padding: '1rem', borderRadius: '6px', overflow: 'auto', fontSize: '0.85rem', marginBottom: '1rem' }}>
            <code>{codeLines.join('\n')}</code>
          </pre>
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        if (inTable) flushTable();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Table detection
    if (line.includes('|') && line.trim().startsWith('|')) {
      const cells = line.split('|').filter(c => c.trim() !== '');
      if (!inTable) {
        tableHeader = cells;
        inTable = true;
        continue;
      }
      // Skip separator row
      if (cells.every(c => /^[\s-:]+$/.test(c))) continue;
      tableRows.push(cells);
      continue;
    } else if (inTable) {
      flushTable();
    }

    // Empty line
    if (line.trim() === '') {
      elements.push(<div key={`space-${i}`} style={{ height: '0.5rem' }} />);
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={`hr-${i}`} style={{ border: 'none', borderTop: '1px solid #2a2f3e', margin: '1.5rem 0' }} />);
      continue;
    }

    // Headers
    if (line.startsWith('### ')) {
      elements.push(<h3 key={`h3-${i}`} style={{ color: '#fff', fontSize: '1rem', marginTop: '1.5rem', marginBottom: '0.5rem' }}>{formatInline(line.slice(4))}</h3>);
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(<h2 key={`h2-${i}`} style={{ color: '#fff', fontSize: '1.15rem', marginTop: '2rem', marginBottom: '0.75rem' }}>{formatInline(line.slice(3))}</h2>);
      continue;
    }
    if (line.startsWith('# ')) {
      elements.push(<h1 key={`h1-${i}`} style={{ color: '#fff', fontSize: '1.4rem', marginTop: '0', marginBottom: '0.5rem' }}>{formatInline(line.slice(2))}</h1>);
      continue;
    }

    // List items
    if (line.match(/^\s*- /)) {
      const indent = line.match(/^(\s*)/)?.[1].length || 0;
      elements.push(
        <div key={`li-${i}`} style={{ paddingLeft: `${1 + indent * 0.5}rem`, marginBottom: '0.25rem', position: 'relative' }}>
          <span style={{ position: 'absolute', left: `${indent * 0.5}rem` }}>&#8226;</span>
          {formatInline(line.replace(/^\s*- /, ''))}
        </div>
      );
      continue;
    }

    // Regular paragraph
    elements.push(<p key={`p-${i}`} style={{ marginBottom: '0.5rem', lineHeight: 1.6 }}>{formatInline(line)}</p>);
  }

  if (inTable) flushTable();

  return <div>{elements}</div>;
}

export default function DocsBrowser() {
  const [searchParams] = useSearchParams();
  const viewPath = searchParams.get('view');
  const [docs, setDocs] = useState<DocInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fileData = useFile(viewPath);

  useEffect(() => {
    fetchJson<DocInfo[]>('/docs').then(d => { setDocs(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (viewPath) {
    const filename = viewPath.split('/').pop() || viewPath;
    return (
      <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>{filename}</h1>
            <p className="page-subtitle">{viewPath}</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Link className="btn btn-ghost" to="/docs">Back to Docs</Link>
            <Link className="btn btn-primary" to={`/edit?path=${encodeURIComponent(viewPath)}`}>Edit</Link>
          </div>
        </div>
        {fileData.loading && <div className="loading">Loading...</div>}
        {fileData.error && <div className="error-msg">{fileData.error}</div>}
        {fileData.data && (
          <div style={{ background: '#1a1f2e', border: '1px solid #2a2f3e', borderRadius: '8px', padding: '2rem' }}>
            <MarkdownPreview content={fileData.data.content} />
          </div>
        )}
      </>
    );
  }

  if (loading) return <div className="loading">Loading docs...</div>;

  return (
    <>
      <h1>Docs</h1>
      <p className="page-subtitle">Markdown documents in the config repo</p>

      <div className="project-list">
        {docs.map(doc => (
          <div key={doc.filename} className="project-card">
            <div>
              <div className="project-name">{doc.filename}</div>
              <div className="project-path">{doc.path}</div>
            </div>
            <div className="project-stats">
              <span className="badge badge-token">{formatTokens(doc.tokens)} tokens</span>
              <span style={{ fontSize: '0.75rem', color: '#666' }}>{timeAgo(doc.modified)}</span>
              <Link className="btn btn-ghost" to={`/docs?view=${encodeURIComponent(doc.path)}`} style={{ fontSize: '0.75rem' }}>
                View
              </Link>
              <Link className="btn btn-ghost" to={`/edit?path=${encodeURIComponent(doc.path)}`} style={{ fontSize: '0.75rem' }}>
                Edit
              </Link>
            </div>
          </div>
        ))}
      </div>

      {docs.length === 0 && <div className="loading">No markdown files found in repo root</div>}
    </>
  );
}
