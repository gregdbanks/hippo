import type { Budget } from '../lib/types';

const UNIT_LABEL: Record<Budget['unit'], string> = { lines: 'lines', bytes: 'bytes', chars: 'characters' };

export function Gauge({ budget, compact = false }: { budget: Budget; compact?: boolean }) {
  const pct = Math.min(100, Math.round((budget.used / budget.limit) * 100));
  const summary = `${budget.used.toLocaleString()} / ${budget.limit.toLocaleString()} ${UNIT_LABEL[budget.unit]}`;

  if (compact) {
    return (
      <span className={`gauge gauge-compact gauge-${budget.level}`} title={`${budget.label}: ${summary}. ${budget.note}`}>
        <span className="gauge-track"><span className="gauge-fill" style={{ width: `${pct}%` }} /></span>
        <span className="gauge-text">{budget.used.toLocaleString()}/{budget.limit.toLocaleString()}</span>
      </span>
    );
  }

  return (
    <div className={`gauge gauge-${budget.level}`}>
      <div className="gauge-head">
        <span className="gauge-label">{budget.label}</span>
        <span className="gauge-text">{summary}</span>
      </div>
      <div className="gauge-track"><div className="gauge-fill" style={{ width: `${pct}%` }} /></div>
      <p className="gauge-note">{budget.note}</p>
      <p className="gauge-source">Source: {budget.source}</p>
    </div>
  );
}
