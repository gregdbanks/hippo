import { Link } from 'react-router-dom';
import type { DiscoveryResult } from '../hooks/useDiscovery';

interface Props {
  data: DiscoveryResult | null;
}

function formatTokens(n: number): string {
  if (n >= 1000) return `~${(n / 1000).toFixed(1)}k`;
  return `~${n}`;
}

export default function SkillsBrowser({ data }: Props) {
  if (!data) return <div className="loading">Loading...</div>;

  return (
    <>
      <h1>Skills</h1>
      <p className="page-subtitle">
        On-demand slash commands loaded only when invoked ({data.skills.length} total)
      </p>

      {data.skills.length === 0 ? (
        <div className="loading">No skills found in ~/.claude/skills/</div>
      ) : (
        <div className="project-list">
          {data.skills.map(skill => (
            <div key={skill.name} className="project-card">
              <div>
                <div className="project-name">/{skill.name}</div>
                <div className="project-path">{skill.description || 'No description'}</div>
              </div>
              <div className="project-stats">
                <span className="badge badge-token">{formatTokens(skill.tokens)} tokens</span>
                <Link
                  className="btn btn-ghost"
                  to={`/edit?path=${encodeURIComponent(skill.path)}`}
                  style={{ fontSize: '0.75rem' }}
                >
                  Edit
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
