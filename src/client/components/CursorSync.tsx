import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useInventory } from '../hooks/useInventory';
import type { MirrorReport, Project } from '../lib/types';
import { mirrorNeedsRun } from '../lib/format';

const LINK_TEXT: Record<Project['agentsLink'], string> = {
  linked: 'Cursor reads the same instructions as Claude (AGENTS.md is linked to CLAUDE.md).',
  separate: 'AGENTS.md is a separate file, so Cursor won\'t see changes to CLAUDE.md. Merge them by hand if they should match.',
  unshared: 'Cursor can\'t see this project\'s CLAUDE.md yet.',
  noClaudeMd: '',
};

function summarize(report: MirrorReport): string {
  const parts = [
    report.created.length && `${report.created.length} created`,
    report.updated.length && `${report.updated.length} updated`,
    report.removed.length && `${report.removed.length} removed`,
    report.skipped.length && `${report.skipped.length} skipped (hand-written Cursor rule with the same name)`,
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : 'Already up to date';
}

export function CursorSync({ project }: { project: Project }) {
  const { refresh } = useInventory();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<string>) => {
    setBusy(true);
    setError(null);
    try {
      setMessage(await action());
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const share = () => run(async () => {
    await invoke<string>('share_with_cursor', { root: project.root });
    return 'Created AGENTS.md as a link to CLAUDE.md.';
  });
  const mirror = () => run(async () => summarize(await invoke<MirrorReport>('mirror_rules_to_cursor', { root: project.root })));

  const counts = project.mirror.reduce<Record<string, number>>((acc, m) => ({ ...acc, [m.state]: (acc[m.state] ?? 0) + 1 }), {});
  const stale = (counts.missing ?? 0) + (counts.outdated ?? 0) + (counts.orphaned ?? 0);
  if (project.agentsLink === 'noClaudeMd' && project.mirror.length === 0) return null;

  return (
    <div className={`sync-panel ${project.agentsLink === 'unshared' || stale ? 'sync-needed' : ''}`}>
      {project.agentsLink !== 'noClaudeMd' && (
        <div className="sync-row">
          <span>{LINK_TEXT[project.agentsLink]}</span>
          {project.agentsLink === 'unshared' && (
            <button className="btn btn-primary btn-small" disabled={busy} onClick={share}>Share CLAUDE.md with Cursor</button>
          )}
        </div>
      )}
      {project.mirror.length > 0 && (
        <div className="sync-row">
          <span>
            Claude rules in Cursor: {counts.current ?? 0} up to date
            {stale > 0 && `, ${stale} need mirroring`}
            {counts.handWritten ? `, ${counts.handWritten} blocked by a hand-written Cursor rule` : ''}
          </span>
          {mirrorNeedsRun(project.mirror) && (
            <button className="btn btn-primary btn-small" disabled={busy} onClick={mirror}>Mirror rules to Cursor</button>
          )}
        </div>
      )}
      {message && <div className="success-msg small">{message}</div>}
      {error && <div className="text-over small">{error}</div>}
    </div>
  );
}
