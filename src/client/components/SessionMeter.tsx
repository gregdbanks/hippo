import type { SessionLoad } from '../lib/types';
import { formatTokens, percentOf } from '../lib/format';

export function SessionMeter({ tool, session, contextWindow }: { tool: string; session: SessionLoad; contextWindow: number }) {
  if (session.items.length === 0) return null;
  const pct = Math.min(100, (session.tokens / contextWindow) * 100);

  return (
    <details className="session-meter">
      <summary>
        <span>{tool} loads <strong>{formatTokens(session.tokens)} tokens</strong> every session here</span>
        <span className="muted"> ({percentOf(session.tokens, contextWindow)} of a {(contextWindow / 1000).toFixed(0)}K context window)</span>
        <span className="gauge-track session-track"><span className="gauge-fill" style={{ width: `${Math.max(pct, 1)}%` }} /></span>
      </summary>
      <ul className="session-items">
        {session.items.map(item => (
          <li key={item.path + item.label}>
            <span>{item.label}</span>
            <span className="muted">{formatTokens(item.tokens)}</span>
          </li>
        ))}
      </ul>
      <p className="muted small">Token counts are estimates (about 3.7 characters per token).</p>
    </details>
  );
}
