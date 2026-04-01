import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useFile } from '../hooks/useFile';

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.7);
}

export default function Editor() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const filePath = searchParams.get('path');
  const { data, loading, error, saving, saved, save } = useFile(filePath);
  const [content, setContent] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data) {
      setContent(data.content);
      setDirty(false);
    }
  }, [data]);

  if (!filePath) return <div className="error-msg">No file path specified</div>;
  if (loading) return <div className="loading">Loading file...</div>;
  if (error) return <div className="error-msg">{error}</div>;

  const filename = filePath.split('/').pop() || filePath;
  const tokens = estimateTokens(content);

  const handleSave = () => {
    save(content);
    setDirty(false);
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>{filename}</h1>
          <p className="page-subtitle" style={{ fontFamily: 'monospace' }}>{filePath}</p>
        </div>
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>Back</button>
      </div>

      <div className="editor-container">
        <div className="editor-header">
          <span className="file-path">{filePath}</span>
          <span className="badge badge-token">~{tokens.toLocaleString()} tokens</span>
        </div>

        <textarea
          className="editor-textarea"
          value={content}
          onChange={e => { setContent(e.target.value); setDirty(true); }}
          spellCheck={false}
        />

        <div className="editor-footer">
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !dirty}>
              {saving ? 'Saving...' : 'Save'}
            </button>
            {saved && <span className="success-msg">Saved</span>}
            {dirty && <span style={{ color: '#f39c12', fontSize: '0.8rem' }}>Unsaved changes</span>}
          </div>
          <span style={{ fontSize: '0.8rem', color: '#666' }}>
            {content.length.toLocaleString()} chars
          </span>
        </div>
      </div>
    </>
  );
}
