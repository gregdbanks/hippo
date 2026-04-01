import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface SettingsData {
  content: string;
  parsed: Record<string, unknown>;
}

export default function SettingsEditor() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    invoke<SettingsData>('read_settings')
      .then(data => {
        setContent(JSON.stringify(JSON.parse(data.content), null, 2));
        setLoading(false);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Failed to load');
        setLoading(false);
      });
  }, []);

  const handleChange = (value: string) => {
    setContent(value);
    setDirty(true);
    try {
      JSON.parse(value);
      setJsonError(null);
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  };

  const handleSave = async () => {
    if (jsonError) return;
    setSaving(true);
    setSaved(false);
    try {
      await invoke('write_settings', { content });
      setSaved(true);
      setDirty(false);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(content);
      setContent(JSON.stringify(parsed, null, 2));
      setJsonError(null);
    } catch {
      // Already showing error
    }
  };

  if (loading) return <div className="loading">Loading settings...</div>;
  if (error) return <div className="error-msg">{error}</div>;

  return (
    <>
      <h1>Settings</h1>
      <p className="page-subtitle">~/.claude/settings.json - Permissions, hooks, and deny rules</p>

      <div className="editor-container">
        <div className="editor-header">
          <span className="file-path">~/.claude/settings.json</span>
          <button className="btn btn-ghost" onClick={handleFormat} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>
            Format
          </button>
        </div>

        <textarea
          className="editor-textarea"
          value={content}
          onChange={e => handleChange(e.target.value)}
          spellCheck={false}
          style={{ minHeight: '500px' }}
        />

        {jsonError && <div className="json-error" style={{ padding: '0.5rem 1rem' }}>{jsonError}</div>}

        <div className="editor-footer">
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving || !!jsonError || !dirty}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            {saved && <span className="success-msg">Saved</span>}
            {dirty && !jsonError && <span style={{ color: '#f39c12', fontSize: '0.8rem' }}>Unsaved changes</span>}
          </div>
        </div>
      </div>
    </>
  );
}
