import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface PortableFileInfo {
  name: string;
  relativePath: string;
  sizeBytes: number;
}

interface PortableStatus {
  hasPortable: boolean;
  portablePath: string;
  files: PortableFileInfo[];
}

interface ExportResult {
  exported: string[];
  portablePath: string;
}

interface ImportResult {
  imported: string[];
  skipped: string[];
}

function formatBytes(n: number): string {
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

export default function SyncPage() {
  const [status, setStatus] = useState<PortableStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const s = await invoke<PortableStatus>('get_portable_status');
      setStatus(s);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStatus(); }, []);

  const handleExport = async () => {
    setExporting(true);
    setResult(null);
    setError(null);
    try {
      const res = await invoke<ExportResult>('export_config');
      setResult(`Exported ${res.exported.length} items to portable/`);
      await loadStatus();
    } catch (err) {
      setError(String(err));
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    if (!confirm('This will overwrite your local CLAUDE.md, settings.json, and skills with the portable versions. Continue?')) return;
    setImporting(true);
    setResult(null);
    setError(null);
    try {
      const res = await invoke<ImportResult>('import_config');
      setResult(`Imported ${res.imported.length} items: ${res.imported.join(', ')}`);
      await loadStatus();
    } catch (err) {
      setError(String(err));
    } finally {
      setImporting(false);
    }
  };

  if (loading) return <div className="loading">Checking portable config...</div>;

  return (
    <>
      <h1>Sync</h1>
      <p className="page-subtitle">
        Port your global config between machines via this repo
      </p>

      {error && <div className="error-msg">{error}</div>}
      {result && <div className="success-msg" style={{ marginBottom: '1rem' }}>{result}</div>}

      <div className="summary-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: '2rem' }}>
        <div className="summary-card">
          <div className="label">Export (This Machine → Repo)</div>
          <div style={{ fontSize: '0.85rem', color: '#8b8fa3', margin: '0.75rem 0' }}>
            Copies your local CLAUDE.md, settings.json, and skills into the <code style={{ background: '#252a3a', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>portable/</code> folder in this repo. Commit and push to share.
          </div>
          <button className="btn btn-primary" onClick={handleExport} disabled={exporting}>
            {exporting ? 'Exporting...' : 'Export Config'}
          </button>
        </div>

        <div className="summary-card">
          <div className="label">Import (Repo → This Machine)</div>
          <div style={{ fontSize: '0.85rem', color: '#8b8fa3', margin: '0.75rem 0' }}>
            Writes the portable config to your local machine. Overwrites existing CLAUDE.md, settings, and skills.
          </div>
          <button
            className="btn btn-primary"
            onClick={handleImport}
            disabled={importing || !status?.hasPortable}
          >
            {importing ? 'Importing...' : status?.hasPortable ? 'Import Config' : 'Nothing to Import'}
          </button>
        </div>
      </div>

      <h2 style={{ color: '#fff', fontSize: '1.1rem', marginBottom: '1rem' }}>
        Portable Config {status?.hasPortable ? '' : '(Empty)'}
      </h2>

      {status?.hasPortable ? (
        <>
          <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: '1rem', fontFamily: 'monospace' }}>
            {status.portablePath}
          </p>
          <table className="data-table">
            <thead>
              <tr>
                <th>File</th>
                <th>Path</th>
                <th>Size</th>
              </tr>
            </thead>
            <tbody>
              {status.files.map(f => (
                <tr key={f.relativePath}>
                  <td style={{ fontWeight: 600, color: '#fff' }}>{f.name}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{f.relativePath}</td>
                  <td>{formatBytes(f.sizeBytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <div style={{ background: '#1a1f2e', border: '1px solid #2a2f3e', borderRadius: '8px', padding: '2rem', textAlign: 'center', color: '#666' }}>
          No portable config yet. Click "Export Config" to snapshot your current setup.
        </div>
      )}

      <div style={{ marginTop: '2rem', padding: '1rem', background: '#1a1f2e', border: '1px solid #2a2f3e', borderRadius: '8px' }}>
        <h3 style={{ color: '#fff', fontSize: '0.95rem', marginBottom: '0.5rem' }}>How to use on another machine</h3>
        <ol style={{ fontSize: '0.85rem', color: '#8b8fa3', lineHeight: 1.8, paddingLeft: '1.25rem' }}>
          <li>Export your config on this machine</li>
          <li>Commit and push: <code style={{ background: '#252a3a', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>git add portable/ && git commit -m "Update portable config" && git push</code></li>
          <li>On the new machine: clone this repo, <code style={{ background: '#252a3a', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>npm install && npm run build</code></li>
          <li>Open the app, go to Sync, click "Import Config"</li>
        </ol>
      </div>
    </>
  );
}
