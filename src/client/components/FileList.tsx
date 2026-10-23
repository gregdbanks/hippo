import { Link } from 'react-router-dom';
import type { ConfigFile } from '../lib/types';
import { KIND_LABEL, LOADING_LABEL, TOOL_LABEL, editorLink, formatTokens, timeAgo, worstLevel } from '../lib/format';
import { Gauge } from './Gauge';

export function FileList({ files }: { files: ConfigFile[] }) {
  if (files.length === 0) return <p className="empty-note">No files yet.</p>;

  return (
    <table className="data-table file-table">
      <thead>
        <tr>
          <th>File</th>
          <th>Loads</th>
          <th>Size</th>
          <th className="hide-narrow">Updated</th>
        </tr>
      </thead>
      <tbody>
        {files.map(f => {
          const level = worstLevel(f);
          const lengthBudget = f.budgets[0];
          return (
            <tr key={f.path}>
              <td>
                <Link to={editorLink(f.path)} className="file-link">
                  <span className={`dot dot-${level}`} aria-label={level} />
                  {f.name}
                </Link>
                <span className="badge badge-type">{KIND_LABEL[f.kind]}</span>
                {f.tool === 'shared' && <span className="badge badge-tool-shared">{TOOL_LABEL.shared}</span>}
                {f.issues.map(issue => <div key={issue} className="issue">{issue}</div>)}
                {f.description && <div className="file-desc">{f.description}</div>}
              </td>
              <td><span className={`badge badge-load-${f.loading}`} title={f.loadingNote}>{LOADING_LABEL[f.loading]}</span></td>
              <td>
                {lengthBudget ? <Gauge budget={lengthBudget} compact /> : <span className="muted">{f.lines} lines</span>}
                <div className="muted small">{formatTokens(f.tokens)} tokens</div>
              </td>
              <td className="muted small hide-narrow">{timeAgo(f.modified)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
