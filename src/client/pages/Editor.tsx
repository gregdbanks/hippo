import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { findFile, useInventory } from '../hooks/useInventory';
import { Gauge } from '../components/Gauge';
import { ReferencesPanel } from '../components/ReferencesPanel';
import { HighlightedEditor } from '../components/HighlightedEditor';
import { HistoryPanel } from '../components/HistoryPanel';
import { Link } from 'react-router-dom';
import type { FileData } from '../lib/types';
import { KIND_LABEL, LOADING_LABEL, TOOL_LABEL, displayPath, editorLink, findMatches, formatTokens, liveBudget, mirrorSourcePath } from '../lib/format';

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
  const [findOpen, setFindOpen] = useState(params.get('find') !== null);
  const [findQuery, setFindQuery] = useState(params.get('find') ?? '');
  const [matchIndex, setMatchIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const findRef = useRef<HTMLInputElement>(null);
  const startLine = Number(params.get('line') ?? '0');

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setFindOpen(true);
        window.setTimeout(() => findRef.current?.select(), 0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const matches = findMatches(content, findQuery);

  const [scrollKey, setScrollKey] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loadedVersion, setLoadedVersion] = useState<string | null>(null);

  const showMatch = useCallback((index: number) => {
    setMatchIndex(index);
    setScrollKey(`${index}:${Date.now()}`);
  }, []);

  const findParam = params.get('find');
  useEffect(() => {
    if (findParam === null) return;
    setFindOpen(true);
    setFindQuery(findParam);
  }, [findParam]);

  useEffect(() => {
    if (!disk || !params.get('find')) return;
    const first = findMatches(disk.content, params.get('find') ?? '').findIndex(m => m.line >= startLine);
    if (first >= 0) showMatch(first);
  }, [disk, params, startLine, showMatch]);

  const step = (direction: 1 | -1) => {
    if (matches.length === 0) return;
    showMatch((matchIndex + direction + matches.length) % matches.length);
  };

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
      setLoadedVersion(null);
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.startsWith(CONFLICT)) setConflict(true);
      else setError(message);
    } finally {
      setSaving(false);
    }
  };

  const loadVersion = (text: string, savedAt: string) => {
    onChange(text);
    setLoadedVersion(new Date(savedAt).toLocaleString());
    setHistoryOpen(false);
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

      {historyOpen && <HistoryPanel path={path} onLoad={loadVersion} onClose={() => setHistoryOpen(false)} />}
      {loadedVersion && dirty && (
        <div className="banner">Showing the version from {loadedVersion}. Save to restore it, or reload to keep the current file.</div>
      )}
      {budgets.length > 0 && <div className="gauges">{budgets.map(b => <Gauge key={b.label} budget={b} />)}</div>}
      {info && inventory && <ReferencesPanel file={info} inventory={inventory} />}

      <div className="editor-container">
        <div className="editor-header">
          <span className="file-path">{info ? LOADING_LABEL[info.loading] : ''}</span>
          <button className="btn btn-ghost btn-small" onClick={() => { setFindOpen(true); window.setTimeout(() => findRef.current?.select(), 0); }}>Find (Cmd+F)</button>
          <button className="btn btn-ghost btn-small" onClick={() => setHistoryOpen(o => !o)}>History</button>
          <span className="badge badge-token">{formatTokens(Math.ceil(content.length / 3.7))} tokens</span>
        </div>
        {findOpen && (
          <div className="find-bar">
            <input
              ref={findRef}
              autoFocus
              placeholder="Find in this file"
              value={findQuery}
              onChange={e => { setFindQuery(e.target.value); showMatch(0); }}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); step(e.shiftKey ? -1 : 1); }
                if (e.key === 'Escape') setFindOpen(false);
              }}
            />
            <span className="muted small">{findQuery.trim() ? (matches.length ? `${Math.min(matchIndex + 1, matches.length)} of ${matches.length}` : 'No matches') : 'Enter for next, Shift+Enter for previous'}</span>
            <button className="btn btn-ghost btn-small" onClick={() => step(-1)} disabled={!matches.length}>Previous</button>
            <button className="btn btn-ghost btn-small" onClick={() => step(1)} disabled={!matches.length}>Next</button>
            <button className="btn btn-ghost btn-small" onClick={() => setFindOpen(false)}>Close</button>
          </div>
        )}
        <HighlightedEditor
          value={content}
          onChange={onChange}
          matches={findOpen ? matches : []}
          current={matchIndex}
          scrollKey={scrollKey}
          areaRef={textareaRef}
        />
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
