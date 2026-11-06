import { useState, type ReactNode } from 'react';
import type { Json, JsonObject, RuleList } from '../lib/settings';
import { RULE_LISTS, addRule, groupRules, humanizeKey, removeRule, sectionsOf, updateSettings } from '../lib/settings';

const LIST_INFO: Record<RuleList, { title: string; hint: string }> = {
  allow: { title: 'Allow', hint: 'Runs without asking' },
  ask: { title: 'Ask', hint: 'Asks you first' },
  deny: { title: 'Deny', hint: 'Always blocked' },
};

interface Props {
  settings: JsonObject;
  text: string;
  onChange: (text: string) => void;
}

function Section({ title, count, hint, children }: { title: string; count?: number; hint?: string; children: ReactNode }) {
  return (
    <section className="settings-section">
      <header className="settings-section-head">
        <h3>{title}</h3>
        {count !== undefined && <span className="badge badge-type">{count}</span>}
        {hint && <span className="muted small">{hint}</span>}
      </header>
      {children}
    </section>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`settings-toggle${on ? ' on' : ''}`} onClick={() => onChange(!on)}>
      <span />
    </button>
  );
}

function ScalarValue({ value, label, onChange }: { value: Json; label: string; onChange: (value: Json) => void }) {
  if (typeof value === 'boolean') return <Toggle on={value} label={label} onChange={onChange} />;
  if (typeof value === 'number') {
    return <input className="settings-input" type="number" aria-label={label} value={value} onChange={e => onChange(Number(e.target.value))} />;
  }
  return <input className="settings-input mono" aria-label={label} value={value === null ? '' : String(value)} onChange={e => onChange(e.target.value)} />;
}

function RuleColumn({ list, rules, text, onChange }: { list: RuleList; rules: string[]; text: string; onChange: (text: string) => void }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    onChange(addRule(text, list, draft));
    setDraft('');
  };
  return (
    <div className={`rule-column rule-${list}`}>
      <div className="rule-column-head">
        <strong>{LIST_INFO[list].title}</strong>
        <span className="badge badge-type">{rules.length}</span>
        <span className="muted small">{LIST_INFO[list].hint}</span>
      </div>
      {rules.length === 0 && <p className="muted small">No rules</p>}
      {groupRules(rules).map(group => (
        <div key={group.label} className="rule-group">
          <div className="rule-group-label">{group.label} <span className="muted">{group.rules.length}</span></div>
          <div className="rule-chips">
            {group.rules.map(({ rule, index }) => (
              <span key={`${index}:${rule}`} className="rule-chip mono" title={rule}>
                {rule}
                <button type="button" aria-label={`Remove ${rule}`} onClick={() => onChange(removeRule(text, list, index))}>×</button>
              </span>
            ))}
          </div>
        </div>
      ))}
      <div className="rule-add">
        <input
          className="settings-input mono"
          placeholder="Add a rule"
          aria-label={`Add ${list} rule`}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        />
        <button type="button" className="btn btn-ghost btn-small" onClick={add} disabled={!draft.trim()}>Add</button>
      </div>
    </div>
  );
}

function KeyValueRows({ rows, path, text, onChange }: { rows: [string, Json][]; path: string[]; text: string; onChange: (text: string) => void }) {
  return (
    <div className="settings-rows">
      {rows.map(([key, value]) => (
        <div key={key} className="settings-row">
          <div>
            <div>{humanizeKey(key)}</div>
            <div className="muted small mono">{key}</div>
          </div>
          <ScalarValue value={value} label={key} onChange={v => onChange(updateSettings(text, [...path, key], v))} />
        </div>
      ))}
    </div>
  );
}

export function SettingsView({ settings, text, onChange }: Props) {
  const s = sectionsOf(settings);
  const extras = s.permissions ? Object.entries(s.permissions.extras) : [];
  return (
    <div className="settings-view">
      <Section title="Permissions" count={s.permissions ? RULE_LISTS.reduce((n, l) => n + (s.permissions?.lists[l].length ?? 0), 0) : 0} hint="Deny wins over ask, ask wins over allow">
        <div className="rule-columns">
          {RULE_LISTS.map(list => <RuleColumn key={list} list={list} rules={s.permissions?.lists[list] ?? []} text={text} onChange={onChange} />)}
        </div>
        {extras.length > 0 && (
          <KeyValueRows rows={extras.filter(([, v]) => v === null || typeof v !== 'object')} path={['permissions']} text={text} onChange={onChange} />
        )}
      </Section>

      {s.general.length > 0 && (
        <Section title="General" count={s.general.length}>
          <KeyValueRows rows={s.general} path={[]} text={text} onChange={onChange} />
        </Section>
      )}

      {(s.plugins.length > 0 || s.marketplaces.length > 0) && (
        <Section title="Plugins" count={s.plugins.length}>
          <div className="settings-rows">
            {s.plugins.map(([name, on]) => {
              const [plugin, market] = name.split('@');
              return (
                <div key={name} className="settings-row">
                  <div>
                    <div>{plugin}</div>
                    {market && <div className="muted small mono">from {market}</div>}
                  </div>
                  <Toggle on={on} label={name} onChange={v => onChange(updateSettings(text, ['enabledPlugins', name], v))} />
                </div>
              );
            })}
          </div>
          {s.marketplaces.length > 0 && (
            <p className="muted small">Extra marketplaces: {s.marketplaces.map(m => <span key={m} className="badge badge-type settings-tag">{m}</span>)}</p>
          )}
        </Section>
      )}

      {s.hooks.length > 0 && (
        <Section title="Hooks" count={s.hooks.length} hint="Commands that run on Claude Code events">
          <div className="settings-rows">
            {s.hooks.map((h, i) => (
              <div key={`${h.event}:${i}`} className="settings-row settings-row-top">
                <div>
                  <div>{h.event}</div>
                  {h.matcher && <div className="muted small mono">matches {h.matcher}</div>}
                </div>
                <div className="settings-code">{h.commands.map((c, j) => <code key={j}>{c}</code>)}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {s.env.length > 0 && (
        <Section title="Environment" count={s.env.length} hint="Variables set for every session">
          <KeyValueRows rows={s.env} path={['env']} text={text} onChange={onChange} />
        </Section>
      )}

      {s.statusLine && (
        <Section title="Status line">
          <KeyValueRows rows={Object.entries(s.statusLine).filter(([, v]) => v === null || typeof v !== 'object')} path={['statusLine']} text={text} onChange={onChange} />
        </Section>
      )}

      {s.other.map(([key, value]) => (
        <Section key={key} title={humanizeKey(key)} hint="Edit in the JSON tab">
          {Array.isArray(value) || typeof value !== 'object' || value === null ? (
            <pre className="settings-json">{JSON.stringify(value, null, 2)}</pre>
          ) : (
            Object.entries(value).map(([child, v]) => (
              <div key={child} className="rule-group">
                <div className="rule-group-label">{humanizeKey(child)} {Array.isArray(v) && <span className="muted">{v.length}</span>}</div>
                {Array.isArray(v) && v.every(x => typeof x === 'string')
                  ? <ul className="settings-list">{v.map((x, i) => <li key={i}>{String(x)}</li>)}</ul>
                  : <pre className="settings-json">{JSON.stringify(v, null, 2)}</pre>}
              </div>
            ))
          )}
        </Section>
      ))}
    </div>
  );
}
