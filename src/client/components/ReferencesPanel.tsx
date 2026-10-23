import { Link } from 'react-router-dom';
import type { ConfigFile, Inventory } from '../lib/types';
import { allFiles } from '../hooks/useInventory';
import { KIND_LABEL, displayPath, editorLink, usedBy } from '../lib/format';

export function ReferencesPanel({ file, inventory }: { file: ConfigFile; inventory: Inventory }) {
  const referrers = usedBy(allFiles(inventory), file.path);
  if (file.references.length === 0 && referrers.length === 0) return null;

  return (
    <div className="refs-panel">
      {file.references.length > 0 && (
        <div>
          <h3>Points to</h3>
          <ul>
            {file.references.map(r => (
              <li key={r.path}>
                <Link to={editorLink(r.path)}>{r.kind === 'skill' ? 'Skill' : 'File'}: {r.label}</Link>
                <span className="muted small"> {displayPath(inventory.home, r.path)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {referrers.length > 0 && (
        <div>
          <h3>Used by</h3>
          <ul>
            {referrers.map(f => (
              <li key={f.path}>
                <Link to={editorLink(f.path)}>{f.name}</Link>
                <span className="muted small"> {KIND_LABEL[f.kind]}, {displayPath(inventory.home, f.path)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
