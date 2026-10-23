import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import type { NewFileKind } from '../lib/types';
import { editorLink } from '../lib/format';
import { useInventory } from '../hooks/useInventory';

const KIND_TEXT: Record<NewFileKind, { button: string; placeholder: string }> = {
  claudeRule: { button: 'New rule', placeholder: 'rule name, e.g. api-style' },
  cursorRule: { button: 'New rule', placeholder: 'rule name, e.g. api-style' },
  claudeSkill: { button: 'New skill', placeholder: 'skill name, e.g. triage' },
  cursorSkill: { button: 'New skill', placeholder: 'skill name, e.g. triage' },
};

export function NewFileButtons({ root, kinds }: { root: string; kinds: NewFileKind[] }) {
  const [open, setOpen] = useState<NewFileKind | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { refresh } = useInventory();

  const create = async () => {
    if (!open || !name.trim()) return;
    setBusy(true);
    try {
      const path = await invoke<string>('create_config_file', { root, kind: open, name: name.trim() });
      await refresh();
      navigate(editorLink(path));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className="new-file-buttons">
        {kinds.map(kind => (
          <button key={kind} className="btn btn-ghost btn-small" onClick={() => { setOpen(kind); setName(''); setError(null); }}>
            + {KIND_TEXT[kind].button}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="new-file-form">
      <input
        autoFocus
        value={name}
        placeholder={KIND_TEXT[open].placeholder}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') create(); if (e.key === 'Escape') setOpen(null); }}
      />
      <button className="btn btn-primary btn-small" onClick={create} disabled={busy || !name.trim()}>Create</button>
      <button className="btn btn-ghost btn-small" onClick={() => setOpen(null)}>Cancel</button>
      {error && <div className="error-msg small">{error}</div>}
    </div>
  );
}
