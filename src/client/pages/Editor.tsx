import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { findFile, useInventory } from '../hooks/useInventory';
import { Gauge } from '../components/Gauge';
import { ReferencesPanel } from '../components/ReferencesPanel';
import { Link } from 'react-router-dom';
import type { FileData } from '../lib/types';
import { KIND_LABEL, LOADING_LABEL, TOOL_LABEL, displayPath, editorLink, formatTokens, liveBudget, mirrorSourcePath } from '../lib/format';

const CONFLICT = 'CONFLICT';
const draftKey = (path: string) => `hippo-draft:${path}`;

interface Draft {
  base: string;
  text: string;
}

function readDraft(path: string): Draft | null {
  try {
    const raw = sessionStorage.getItem(draftKey(path));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && 'base' in parsed && 'text' in parsed
      && typeof parsed.base === 'string' && typeof parsed.text === 'string') {
      return { base: parsed.base, text: parsed.text };
    }
    return null;
  } catch {
    return null;
  }
}

function writeDraft(path: string, draft: Draft | null) {
  try {
    if (draft === null) sessionStorage.removeItem(draftKey(path));
    else sessionStorage.setItem(draftKey(path), JSON.stringify(draft));
  } catch {
    return;
  }
}

function jsonProblem(text: string): string | null {
  try {
    JSON.parse(text);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Invalid JSON';
  }
}

export default function Editor() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const path = params.get('path');
  const { data: inventory, refresh } = useInventory();
  const info = findFile(inventory, path);

  const [disk, setDisk] = useState<FileData | null>(null);
  const [base, setBase] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [restored, setRestored] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const load = useCallback(async (keepDraft: boolean) => {
    if (!path) return;
    try {
      const file = await invoke<FileData>('read_file', { path });
      const draft = keepDraft ? readDraft(path) : null;
      const useDraft = draft !== null && draft.text !== file.content;
      setDisk(file);
      setBase(useDraft ? draft.base : file.modified);
      setContent(useDraft ? draft.text : file.content);
      setRestored(useDraft);
      setConflict(useDraft && draft.base !== file.modified);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [path]);

  useEffect(() => {
    setDisk(null);
    setContent('');
    setError(null);
    setSavedAt(null);
    load(true);
  }, [load]);

  if (!path) return <div className="error-msg">No file selected.</div>;
  if (error && !disk) return <div className="error-msg">{error}</div>;
  if (!disk) return <div className="loading">Loading file...</div>;

  const dirty = content !== disk.content;
  const isSettings = info?.kind === 'settings';
  const badJson = isSettings ? jsonProblem(content) : null;
  const budgets = (info?.budgets ?? []).map(b => liveBudget(b, content));

  const onChange = (text: string) => {
    setContent(text);
    setSavedAt(null);
    writeDraft(path, text === disk.content ? null : { base, text });
  };

  const save = async () => {
    setSaving(true);
    try {
      await invoke('write_file', { path, content, expectedModified: base });
      writeDraft(path, null);
      await load(false);
      await refresh();
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.startsWith(CONFLICT)) setConflict(true);
      else setError(message);
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    writeDraft(path, null);
    load(false);
  };

  return (
    <>
      <div className="section-head">
        <div>
          <h1>{info?.name ?? path.split('/').pop()}</h1>
          <p className="page-subtitle mono">{inventory ? displayPath(inventory.home, path) : path}</p>
        </div>
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>Back</button>
      </div>

      {info && (
        <div className="file-facts">
          <span className={`badge badge-tool-${info.tool}`}>{TOOL_LABEL[info.tool]}</span>
          <span className="badge badge-type">{KIND_LABEL[info.kind]}</span>
          <span className={`badge badge-load-${info.loading}`}>{LOADING_LABEL[info.loading]}</span>
          <span className="muted small">{info.loadingNote}</span>
        </div>
      )}
      {info?.issues.map(i => <p key={i} className="issue">{i}</p>)}
      {info && mirrorSourcePath(info) && (
        <div className="banner banner-warn">
          This Cursor rule is mirrored from a Claude rule. Edit the Claude rule, then mirror again from the Cursor page, or your change here gets overwritten.
          <div className="banner-actions"><Link className="btn btn-ghost btn-small" to={editorLink(mirrorSourcePath(info) as string)}>Open the Claude rule</Link></div>
        </div>
      )}
      {info?.linkTarget && (
        <div className="banner">This file is a link to {info.linkTarget}. Saving here changes {info.linkTarget}.</div>
      )}

      {conflict && (
        <div className="banner banner-warn">
          This file changed on disk since you opened it, maybe from Claude or Cursor. Saving now would overwrite that.
          <div className="banner-actions">
            <button className="btn btn-ghost btn-small" onClick={discard}>Load the disk version (drops your edits)</button>
            <button className="btn btn-ghost btn-small" onClick={() => navigator.clipboard?.writeText(content)}>Copy my edits</button>
          </div>
        </div>
      )}
      {restored && (
        <div className="banner">
          Restored your unsaved edits from earlier.
          <div className="banner-actions"><button className="btn btn-ghost btn-small" onClick={discard}>Discard them</button></div>
        </div>
      )}

      {budgets.length > 0 && <div className="gauges">{budgets.map(b => <Gauge key={b.label} budget={b} />)}</div>}
      {info && inventory && <ReferencesPanel file={info} inventory={inventory} />}

      <div className="editor-container">
        <div className="editor-header">
          <span className="file-path">{info ? LOADING_LABEL[info.loading] : ''}</span>
          <span className="badge badge-token">{formatTokens(Math.ceil(content.length / 3.7))} tokens</span>
        </div>
        <textarea className="editor-textarea" value={content} onChange={e => onChange(e.target.value)} spellCheck={false} />
        <div className="editor-footer">
          <div className="row">
            <button className="btn btn-primary" onClick={save} disabled={saving || !dirty || !!badJson}>
              {saving ? 'Saving...' : 'Save'}
            </button>
            {dirty && !badJson && <span className="text-warn small">Unsaved changes</span>}
            {badJson && <span className="text-over small">Not valid JSON: {badJson}</span>}
            {savedAt && !dirty && <span className="success-msg">Saved at {savedAt}</span>}
            {error && <span className="text-over small">{error}</span>}
          </div>
          <span className="muted small">{content.length.toLocaleString()} chars</span>
        </div>
      </div>
    </>
  );
}
