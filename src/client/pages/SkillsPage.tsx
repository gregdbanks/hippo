import { Link } from 'react-router-dom';
import { allFiles, useInventory } from '../hooks/useInventory';
import { Gauge } from '../components/Gauge';
import { NewFileButtons } from '../components/NewFileForm';
import type { ConfigFile, Inventory } from '../lib/types';
import { displayPath, editorLink, usedBy, worstLevel } from '../lib/format';

interface SkillGroup {
  title: string;
  note: string;
  root: string | null;
  skills: ConfigFile[];
}

function groups(inv: Inventory): SkillGroup[] {
  const isSkill = (f: ConfigFile) => f.kind === 'skill';
  const out: SkillGroup[] = [
    { title: 'Claude, global', note: '~/.claude/skills. Cursor reads these too.', root: inv.home, skills: inv.claudeGlobal.filter(isSkill) },
    { title: 'Cursor, global', note: '~/.cursor/skills', root: null, skills: inv.cursorGlobal.filter(isSkill) },
  ];
  for (const p of inv.projects.filter(p => p.exists)) {
    const skills = p.files.filter(isSkill);
    if (skills.length) out.push({ title: p.name, note: 'Project skills. Cursor reads .claude/skills here too.', root: p.root, skills });
  }
  return out.filter(g => g.skills.length || g.root === inv.home);
}

function SkillRow({ skill, inv }: { skill: ConfigFile; inv: Inventory }) {
  const users = usedBy(allFiles(inv), skill.path);
  return (
    <div className="skill-row">
      <div className="skill-head">
        <span className={`dot dot-${worstLevel(skill)}`} />
        <Link to={editorLink(skill.path)} className="file-link">{skill.name}</Link>
        <span className={`badge badge-tool-${skill.tool}`}>{skill.tool === 'claude' ? 'Claude + Cursor' : 'Cursor'}</span>
        <span className="muted small">{displayPath(inv.home, skill.path)}</span>
      </div>
      {skill.description && <p className="skill-desc">{skill.description}</p>}
      <div className="skill-gauges">{skill.budgets.map(b => <Gauge key={b.label} budget={b} compact />)}</div>
      <p className="muted small">
        {users.length === 0 ? 'Not referenced by any config. Claude still finds it by its description.' : 'Used by: '}
        {users.map((u, i) => (
          <span key={u.path}>{i > 0 && ', '}<Link to={editorLink(u.path)}>{displayPath(inv.home, u.path)}</Link></span>
        ))}
      </p>
    </div>
  );
}

export default function SkillsPage() {
  const { data, loading, error } = useInventory();
  if (loading && !data) return <div className="loading">Scanning config files...</div>;
  if (error) return <div className="error-msg">{error}</div>;
  if (!data) return null;

  return (
    <>
      <h1>Skills</h1>
      <p className="page-subtitle">
        Only a skill's name and description load every session; the rest loads when it's used. Good for step-by-step procedures. Rules that must always apply belong in CLAUDE.md instead.
      </p>
      {groups(data).map(g => (
        <section key={g.root ?? g.title} className="tool-section">
          <h2>{g.title} <span className="muted small">{g.note}</span></h2>
          {g.skills.length === 0 && <p className="empty-note">No skills yet.</p>}
          {g.skills.map(s => <SkillRow key={s.path} skill={s} inv={data} />)}
          {g.root && <div className="section-actions"><NewFileButtons root={g.root} kinds={['claudeSkill']} /></div>}
        </section>
      ))}
    </>
  );
}
