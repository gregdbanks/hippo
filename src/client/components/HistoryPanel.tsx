import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { timeAgo } from '../lib/format';

interface Snapshot {
  id: string;
  savedAt: string;
  bytes: number;
}

export function HistoryPanel({ path, onLoad, onClose }: { path: string; onLoad: (text: string, savedAt: string) => void; onClose: () => void }) {
  const [snaps, setSnaps] = useState<Snapshot[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    invoke<Snapshot[]>('list_history', { path }).then(setSnaps).catch(e => setError(String(e)));
  }, [path]);

  const load = async (snap: Snapshot) => {
    try {
      onLoad(await invoke<string>('read_history', { path, id: snap.id }), snap.savedAt);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="history-panel">
      <div className="section-head">
        <strong>Earlier versions</strong>
        <button className="btn btn-ghost btn-small" onClick={onClose}>Close</button>
      </div>
      <p className="muted small">Hippo keeps the last 20 versions from before each save. Loading one puts it in the editor; nothing changes until you save.</p>
      {error && <p className="text-over small">{error}</p>}
      {snaps && snaps.length === 0 && <p className="empty-note">No earlier versions yet. They start with your next save.</p>}
      <ul className="history-list">
        {snaps?.map(s => (
          <li key={s.id}>
            <span>{new Date(s.savedAt).toLocaleString()} <span className="muted small">({timeAgo(s.savedAt)}, {s.bytes.toLocaleString()} bytes)</span></span>
            <button className="btn btn-ghost btn-small" onClick={() => load(s)}>Load this version</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
