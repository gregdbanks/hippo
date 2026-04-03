import { useState } from 'react';

const ACCENT = '#6ea8fe';
const ACCENT_DIM = 'rgba(110, 168, 254, 0.12)';
const PURPLE = '#8e44ad';
const GREEN = '#27ae60';
const ORANGE = '#f39c12';
const RED = '#e74c3c';
const CARD_BG = '#1a1f2e';
const CARD_BORDER = '#2a2f3e';
const SURFACE = '#161b26';
const TEXT = '#c5c8d0';
const TEXT_DIM = '#6b7280';
const WHITE = '#fff';

// --- SVG Diagram Components ---

function FileSystemDiagram() {
  return (
    <svg viewBox="0 0 680 320" style={{ width: '100%', maxWidth: 680, display: 'block', margin: '0 auto' }}>
      {/* Background */}
      <rect x="0" y="0" width="680" height="320" rx="12" fill={SURFACE} />

      {/* Central node */}
      <rect x="260" y="20" width="160" height="44" rx="8" fill={ACCENT} />
      <text x="340" y="47" textAnchor="middle" fill="#000" fontSize="13" fontWeight="700" fontFamily="system-ui">Your Prompt</text>

      {/* Lines from center */}
      <line x1="290" y1="64" x2="110" y2="110" stroke={CARD_BORDER} strokeWidth="1.5" />
      <line x1="340" y1="64" x2="340" y2="110" stroke={CARD_BORDER} strokeWidth="1.5" />
      <line x1="390" y1="64" x2="570" y2="110" stroke={CARD_BORDER} strokeWidth="1.5" />

      {/* Always loaded - left */}
      <rect x="20" y="110" width="180" height="80" rx="8" fill={CARD_BG} stroke={GREEN} strokeWidth="1.5" />
      <circle cx="40" cy="130" r="6" fill={GREEN} />
      <text x="52" y="134" fill={GREEN} fontSize="10" fontWeight="600" fontFamily="system-ui">ALWAYS LOADED</text>
      <text x="36" y="155" fill={WHITE} fontSize="12" fontWeight="600" fontFamily="system-ui">Global CLAUDE.md</text>
      <text x="36" y="175" fill={TEXT_DIM} fontSize="10" fontFamily="system-ui">~/CLAUDE.md</text>

      {/* Always loaded - center */}
      <rect x="220" y="110" width="240" height="80" rx="8" fill={CARD_BG} stroke={ORANGE} strokeWidth="1.5" />
      <circle cx="240" cy="130" r="6" fill={ORANGE} />
      <text x="252" y="134" fill={ORANGE} fontSize="10" fontWeight="600" fontFamily="system-ui">LOADED IN PROJECT</text>
      <text x="236" y="155" fill={WHITE} fontSize="12" fontWeight="600" fontFamily="system-ui">Project CLAUDE.md + Memories</text>
      <text x="236" y="175" fill={TEXT_DIM} fontSize="10" fontFamily="system-ui">~/.claude/projects/&#123;slug&#125;/memory/</text>

      {/* On demand - right */}
      <rect x="480" y="110" width="180" height="80" rx="8" fill={CARD_BG} stroke={PURPLE} strokeWidth="1.5" strokeDasharray="6 3" />
      <circle cx="500" cy="130" r="6" fill={PURPLE} />
      <text x="512" y="134" fill={PURPLE} fontSize="10" fontWeight="600" fontFamily="system-ui">ON DEMAND</text>
      <text x="496" y="155" fill={WHITE} fontSize="12" fontWeight="600" fontFamily="system-ui">Skills</text>
      <text x="496" y="175" fill={TEXT_DIM} fontSize="10" fontFamily="system-ui">~/.claude/skills/</text>

      {/* Token cost bars */}
      <text x="20" y="225" fill={TEXT_DIM} fontSize="10" fontWeight="600" fontFamily="system-ui">TOKEN COST PER PROMPT</text>

      {/* Global bar */}
      <rect x="20" y="240" width="180" height="8" rx="4" fill="#252a3a" />
      <rect x="20" y="240" width="60" height="8" rx="4" fill={GREEN} />
      <text x="20" y="264" fill={TEXT_DIM} fontSize="9" fontFamily="system-ui">Global CLAUDE.md (~1k tokens)</text>

      {/* Memories bar */}
      <rect x="220" y="240" width="240" height="8" rx="4" fill="#252a3a" />
      <rect x="220" y="240" width="190" height="8" rx="4" fill={ORANGE} />
      <text x="220" y="264" fill={TEXT_DIM} fontSize="9" fontFamily="system-ui">Memories + Project CLAUDE.md (~5-15k tokens)</text>

      {/* Skills bar */}
      <rect x="480" y="240" width="180" height="8" rx="4" fill="#252a3a" />
      <rect x="480" y="240" width="0" height="8" rx="4" fill={PURPLE} />
      <text x="480" y="264" fill={TEXT_DIM} fontSize="9" fontFamily="system-ui">Skills (0 until invoked)</text>

      {/* Legend */}
      <rect x="20" y="286" width="640" height="24" rx="4" fill="rgba(110,168,254,0.06)" />
      <text x="340" y="302" textAnchor="middle" fill={TEXT_DIM} fontSize="10" fontFamily="system-ui">
        Smaller token cost = faster responses + more room for your actual conversation
      </text>
    </svg>
  );
}

function SyncDiagram() {
  return (
    <svg viewBox="0 0 680 160" style={{ width: '100%', maxWidth: 680, display: 'block', margin: '0 auto' }}>
      <rect x="0" y="0" width="680" height="160" rx="12" fill={SURFACE} />

      {/* Machine A */}
      <rect x="20" y="30" width="170" height="100" rx="8" fill={CARD_BG} stroke={ACCENT} strokeWidth="1.5" />
      <text x="105" y="55" textAnchor="middle" fill={ACCENT} fontSize="11" fontWeight="700" fontFamily="system-ui">THIS MACHINE</text>
      <text x="105" y="75" textAnchor="middle" fill={WHITE} fontSize="10" fontFamily="system-ui">CLAUDE.md</text>
      <text x="105" y="90" textAnchor="middle" fill={WHITE} fontSize="10" fontFamily="system-ui">settings.json</text>
      <text x="105" y="105" textAnchor="middle" fill={WHITE} fontSize="10" fontFamily="system-ui">skills/</text>

      {/* Arrow A -> Repo */}
      <line x1="190" y1="65" x2="250" y2="65" stroke={GREEN} strokeWidth="1.5" markerEnd="url(#arrowGreen)" />
      <text x="220" y="58" textAnchor="middle" fill={GREEN} fontSize="9" fontWeight="600" fontFamily="system-ui">EXPORT</text>

      {/* Repo */}
      <rect x="250" y="30" width="180" height="100" rx="8" fill={CARD_BG} stroke={CARD_BORDER} strokeWidth="1.5" />
      <text x="340" y="55" textAnchor="middle" fill={TEXT_DIM} fontSize="11" fontWeight="700" fontFamily="system-ui">GIT REPO</text>
      <text x="340" y="78" textAnchor="middle" fill={WHITE} fontSize="11" fontFamily="system-ui">portable/</text>
      <text x="340" y="98" textAnchor="middle" fill={TEXT_DIM} fontSize="9" fontFamily="system-ui">git push &rarr; git pull</text>
      <text x="340" y="115" textAnchor="middle" fill={TEXT_DIM} fontSize="9" fontFamily="system-ui">version controlled</text>

      {/* Arrow Repo -> Machine B */}
      <line x1="430" y1="65" x2="490" y2="65" stroke={PURPLE} strokeWidth="1.5" markerEnd="url(#arrowPurple)" />
      <text x="460" y="58" textAnchor="middle" fill={PURPLE} fontSize="9" fontWeight="600" fontFamily="system-ui">IMPORT</text>

      {/* Machine B */}
      <rect x="490" y="30" width="170" height="100" rx="8" fill={CARD_BG} stroke={PURPLE} strokeWidth="1.5" />
      <text x="575" y="55" textAnchor="middle" fill={PURPLE} fontSize="11" fontWeight="700" fontFamily="system-ui">NEW MACHINE</text>
      <text x="575" y="75" textAnchor="middle" fill={WHITE} fontSize="10" fontFamily="system-ui">CLAUDE.md</text>
      <text x="575" y="90" textAnchor="middle" fill={WHITE} fontSize="10" fontFamily="system-ui">settings.json</text>
      <text x="575" y="105" textAnchor="middle" fill={WHITE} fontSize="10" fontFamily="system-ui">skills/</text>

      <defs>
        <marker id="arrowGreen" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6" fill={GREEN} />
        </marker>
        <marker id="arrowPurple" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6" fill={PURPLE} />
        </marker>
      </defs>
    </svg>
  );
}

function HealthDiagram() {
  const ranges = [
    { label: 'Healthy', range: '75-100%', color: GREEN, width: '25%', desc: 'Lean, focused memories' },
    { label: 'Warning', range: '50-74%', color: ORANGE, width: '25%', desc: 'Consider cleanup' },
    { label: 'Critical', range: '0-49%', color: RED, width: '50%', desc: 'Too many stale or redundant memories' },
  ];
  return (
    <svg viewBox="0 0 680 100" style={{ width: '100%', maxWidth: 680, display: 'block', margin: '0 auto' }}>
      <rect x="0" y="0" width="680" height="100" rx="12" fill={SURFACE} />
      {/* Bar */}
      <rect x="20" y="25" width="640" height="20" rx="10" fill="#252a3a" />
      <rect x="20" y="25" width="160" height="20" rx="10" fill={RED} />
      <rect x="180" y="25" width="160" height="20" fill={RED} />
      <rect x="340" y="25" width="160" height="20" fill={ORANGE} />
      <rect x="500" y="25" width="160" height="20" rx="10" fill={GREEN} />
      {/* Fix overlapping corners */}
      <rect x="500" y="25" width="10" height="20" fill={GREEN} />

      {/* Labels */}
      <text x="100" y="39" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="700" fontFamily="system-ui">0-49%</text>
      <text x="420" y="39" textAnchor="middle" fill="#000" fontSize="10" fontWeight="700" fontFamily="system-ui">50-74%</text>
      <text x="580" y="39" textAnchor="middle" fill="#000" fontSize="10" fontWeight="700" fontFamily="system-ui">75-100%</text>

      <text x="100" y="65" textAnchor="middle" fill={RED} fontSize="10" fontWeight="600" fontFamily="system-ui">Critical</text>
      <text x="100" y="80" textAnchor="middle" fill={TEXT_DIM} fontSize="9" fontFamily="system-ui">Stale/redundant memories</text>

      <text x="420" y="65" textAnchor="middle" fill={ORANGE} fontSize="10" fontWeight="600" fontFamily="system-ui">Warning</text>
      <text x="420" y="80" textAnchor="middle" fill={TEXT_DIM} fontSize="9" fontFamily="system-ui">Consider cleanup</text>

      <text x="580" y="65" textAnchor="middle" fill={GREEN} fontSize="10" fontWeight="600" fontFamily="system-ui">Healthy</text>
      <text x="580" y="80" textAnchor="middle" fill={TEXT_DIM} fontSize="9" fontFamily="system-ui">Lean &amp; focused</text>
    </svg>
  );
}

// --- Icon Components ---

function Icon({ children, color = ACCENT }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 8,
      background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 18 }}>{children}</span>
    </div>
  );
}

// --- Collapsible Section ---

function Accordion({ title, icon, iconColor, defaultOpen, children }: {
  title: string; icon: string; iconColor?: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div style={{
      background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 10,
      overflow: 'hidden', transition: 'all 0.2s',
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '1rem 1.25rem', background: 'transparent', border: 'none',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <Icon color={iconColor}>{icon}</Icon>
        <span style={{ flex: 1, color: WHITE, fontSize: '0.95rem', fontWeight: 600 }}>{title}</span>
        <span style={{
          color: TEXT_DIM, fontSize: '1.2rem', transition: 'transform 0.2s',
          transform: open ? 'rotate(180deg)' : 'rotate(0)',
        }}>
          &#9662;
        </span>
      </button>
      {open && (
        <div style={{
          padding: '0 1.25rem 1.25rem', fontSize: '0.875rem', color: TEXT, lineHeight: 1.75,
          borderTop: `1px solid ${CARD_BORDER}`,
        }}>
          <div style={{ paddingTop: '1rem' }}>{children}</div>
        </div>
      )}
    </div>
  );
}

// --- Step Component ---

function Steps({ steps }: { steps: { title: string; desc: string }[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, margin: '0.75rem 0' }}>
      {steps.map((step, i) => (
        <div key={i} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', background: ACCENT_DIM,
              color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.8rem', fontWeight: 700, flexShrink: 0,
            }}>
              {i + 1}
            </div>
            {i < steps.length - 1 && (
              <div style={{ width: 2, height: 32, background: CARD_BORDER }} />
            )}
          </div>
          <div style={{ paddingBottom: i < steps.length - 1 ? '0.5rem' : 0 }}>
            <div style={{ color: WHITE, fontWeight: 600, fontSize: '0.85rem' }}>{step.title}</div>
            <div style={{ color: TEXT_DIM, fontSize: '0.8rem', marginTop: '0.15rem' }}>{step.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Stat Card ---

function StatCard({ label, value, color = ACCENT }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 8,
      padding: '0.75rem 1rem', textAlign: 'center', flex: 1, minWidth: 120,
    }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: '0.7rem', color: TEXT_DIM, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.25rem' }}>{label}</div>
    </div>
  );
}

// --- Code Block ---

function Code({ children }: { children: string }) {
  return (
    <code style={{
      background: '#252a3a', padding: '0.15rem 0.4rem', borderRadius: 4,
      fontSize: '0.82em', color: ACCENT, fontFamily: "'SF Mono', 'Fira Code', monospace",
    }}>
      {children}
    </code>
  );
}

// --- Main Page ---

export default function HelpPage() {
  return (
    <div style={{ maxWidth: 720 }}>
      {/* Hero */}
      <div style={{
        background: `linear-gradient(135deg, ${CARD_BG} 0%, #1e1533 100%)`,
        border: `1px solid ${CARD_BORDER}`, borderRadius: 12,
        padding: '2.5rem 2rem', marginBottom: '2rem', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -40, right: -40, width: 180, height: 180,
          borderRadius: '50%', background: `${ACCENT}08`,
        }} />
        <div style={{
          position: 'absolute', bottom: -30, left: -30, width: 120, height: 120,
          borderRadius: '50%', background: `${PURPLE}08`,
        }} />
        <h1 style={{ color: WHITE, fontSize: '1.75rem', margin: 0, position: 'relative' }}>
          Hippo
        </h1>
        <p style={{ color: TEXT_DIM, fontSize: '1rem', marginTop: '0.5rem', marginBottom: '1.5rem', position: 'relative' }}>
          See, edit, and manage every hidden file that shapes how Claude Code works for you.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', position: 'relative' }}>
          <StatCard label="Optimal Memories" value="15-25" color={GREEN} />
          <StatCard label="Skills Cost" value="0" color={PURPLE} />
          <StatCard label="Index Line Limit" value="200" color={ORANGE} />
        </div>
      </div>

      {/* How Config Files Work - Diagram */}
      <h2 style={{ color: WHITE, fontSize: '1.15rem', marginBottom: '0.75rem' }}>How Config Files Flow Into Your Prompts</h2>
      <p style={{ color: TEXT_DIM, fontSize: '0.85rem', marginBottom: '1rem' }}>
        Every time you send a prompt, Claude Code loads config files into the context window. Understanding what's loaded — and what it costs — is the key to optimizing your setup.
      </p>
      <div style={{ marginBottom: '2rem' }}>
        <FileSystemDiagram />
      </div>

      {/* Feature Guides */}
      <h2 style={{ color: WHITE, fontSize: '1.15rem', marginBottom: '0.75rem' }}>Feature Guide</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2rem' }}>

        <Accordion title="Dashboard" icon="&#9632;" iconColor={ACCENT} defaultOpen>
          <p>Your home screen showing all config at a glance.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', margin: '0.75rem 0' }}>
            <div style={{ background: SURFACE, borderRadius: 8, padding: '0.75rem' }}>
              <div style={{ color: ACCENT, fontWeight: 600, fontSize: '0.8rem', marginBottom: '0.25rem' }}>Context Budget</div>
              <div style={{ color: TEXT_DIM, fontSize: '0.8rem' }}>Total tokens loaded per prompt across all config files</div>
            </div>
            <div style={{ background: SURFACE, borderRadius: 8, padding: '0.75rem' }}>
              <div style={{ color: ACCENT, fontWeight: 600, fontSize: '0.8rem', marginBottom: '0.25rem' }}>Memory Health</div>
              <div style={{ color: TEXT_DIM, fontSize: '0.8rem' }}>0-100% score per project based on count, staleness, token cost</div>
            </div>
            <div style={{ background: SURFACE, borderRadius: 8, padding: '0.75rem' }}>
              <div style={{ color: ACCENT, fontWeight: 600, fontSize: '0.8rem', marginBottom: '0.25rem' }}>Project Cards</div>
              <div style={{ color: TEXT_DIM, fontSize: '0.8rem' }}>Quick access to CLAUDE.md, memories, and token counts per project</div>
            </div>
            <div style={{ background: SURFACE, borderRadius: 8, padding: '0.75rem' }}>
              <div style={{ color: ACCENT, fontWeight: 600, fontSize: '0.8rem', marginBottom: '0.25rem' }}>Plans</div>
              <div style={{ color: TEXT_DIM, fontSize: '0.8rem' }}>Session planning documents from plan mode</div>
            </div>
          </div>
        </Accordion>

        <Accordion title="Memories" icon="&#9733;" iconColor={ORANGE}>
          <p>Persistent learnings Claude Code retains across conversations. Click any project in the sidebar to browse its memories.</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', margin: '1rem 0' }}>
            {[
              { type: 'feedback', desc: 'How you work', color: ACCENT },
              { type: 'project', desc: 'Current state', color: ORANGE },
              { type: 'user', desc: 'Who you are', color: GREEN },
              { type: 'reference', desc: 'Where to look', color: PURPLE },
            ].map(t => (
              <div key={t.type} style={{
                background: SURFACE, borderRadius: 6, padding: '0.6rem',
                borderLeft: `3px solid ${t.color}`, textAlign: 'center',
              }}>
                <div style={{ color: t.color, fontWeight: 600, fontSize: '0.8rem' }}>{t.type}</div>
                <div style={{ color: TEXT_DIM, fontSize: '0.7rem', marginTop: '0.15rem' }}>{t.desc}</div>
              </div>
            ))}
          </div>

          <h4 style={{ color: WHITE, fontSize: '0.85rem', marginTop: '1rem' }}>Memory Health Scale</h4>
          <HealthDiagram />

          <h4 style={{ color: WHITE, fontSize: '0.85rem', marginTop: '1rem' }}>Staleness Rules</h4>
          <div style={{ display: 'flex', gap: '1rem', margin: '0.5rem 0' }}>
            <div style={{ flex: 1, background: SURFACE, borderRadius: 6, padding: '0.6rem' }}>
              <span style={{ color: RED, fontWeight: 600, fontSize: '0.8rem' }}>Stale</span>
              <div style={{ color: TEXT_DIM, fontSize: '0.75rem' }}>Project type &gt; 14 days</div>
            </div>
            <div style={{ flex: 1, background: SURFACE, borderRadius: 6, padding: '0.6rem' }}>
              <span style={{ color: ORANGE, fontWeight: 600, fontSize: '0.8rem' }}>Review</span>
              <div style={{ color: TEXT_DIM, fontSize: '0.75rem' }}>Any type &gt; 30 days</div>
            </div>
            <div style={{ flex: 1, background: SURFACE, borderRadius: 6, padding: '0.6rem' }}>
              <span style={{ color: GREEN, fontWeight: 600, fontSize: '0.8rem' }}>Current</span>
              <div style={{ color: TEXT_DIM, fontSize: '0.75rem' }}>Feedback never stales</div>
            </div>
          </div>

          <h4 style={{ color: WHITE, fontSize: '0.85rem', marginTop: '1rem' }}>Actions</h4>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div style={{ background: ACCENT_DIM, borderRadius: 6, padding: '0.5rem 0.75rem' }}>
              <span style={{ color: ACCENT, fontWeight: 600, fontSize: '0.8rem' }}>New Memory</span>
              <div style={{ color: TEXT_DIM, fontSize: '0.7rem' }}>Creates file with frontmatter + updates index</div>
            </div>
            <div style={{ background: ACCENT_DIM, borderRadius: 6, padding: '0.5rem 0.75rem' }}>
              <span style={{ color: ACCENT, fontWeight: 600, fontSize: '0.8rem' }}>Sync Index</span>
              <div style={{ color: TEXT_DIM, fontSize: '0.7rem' }}>Rebuilds MEMORY.md from actual files</div>
            </div>
            <div style={{ background: 'rgba(231,76,60,0.1)', borderRadius: 6, padding: '0.5rem 0.75rem' }}>
              <span style={{ color: RED, fontWeight: 600, fontSize: '0.8rem' }}>Delete</span>
              <div style={{ color: TEXT_DIM, fontSize: '0.7rem' }}>Removes file + index entry</div>
            </div>
          </div>
        </Accordion>

        <Accordion title="Settings" icon="&#9881;" iconColor={TEXT_DIM}>
          <p>Edit <Code>~/.claude/settings.json</Code> — controls what Claude Code can and can't do.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', margin: '0.75rem 0' }}>
            <div style={{ background: SURFACE, borderRadius: 6, padding: '0.6rem' }}>
              <div style={{ color: GREEN, fontWeight: 600, fontSize: '0.8rem' }}>permissions.allow</div>
              <div style={{ color: TEXT_DIM, fontSize: '0.7rem' }}>Tools used without asking</div>
            </div>
            <div style={{ background: SURFACE, borderRadius: 6, padding: '0.6rem' }}>
              <div style={{ color: RED, fontWeight: 600, fontSize: '0.8rem' }}>permissions.deny</div>
              <div style={{ color: TEXT_DIM, fontSize: '0.7rem' }}>Blocked commands</div>
            </div>
            <div style={{ background: SURFACE, borderRadius: 6, padding: '0.6rem' }}>
              <div style={{ color: ORANGE, fontWeight: 600, fontSize: '0.8rem' }}>hooks</div>
              <div style={{ color: TEXT_DIM, fontSize: '0.7rem' }}>Pre/post tool scripts</div>
            </div>
          </div>
          <p style={{ color: RED, fontSize: '0.8rem', fontWeight: 600 }}>Invalid JSON is rejected before saving.</p>
        </Accordion>

        <Accordion title="Skills" icon="&#9889;" iconColor={PURPLE}>
          <p>On-demand slash commands like <Code>/commit</Code> or <Code>/audit</Code>. They live in <Code>~/.claude/skills/</Code> and cost <strong style={{ color: PURPLE }}>zero tokens</strong> until you invoke them.</p>
          <p>This is the key difference from CLAUDE.md — put specialized, rarely-used workflows in skills instead of global instructions. Your prompt context stays lean.</p>
        </Accordion>

        <Accordion title="Skill Pipelines" icon="&#9654;" iconColor={PURPLE}>
          <p>Some skills are designed to run in sequence as a pipeline. Each skill in a pipeline reads the output of the previous one (via GitHub issues) and builds on it.</p>

          <h4 style={{ color: WHITE, fontSize: '0.85rem', marginTop: '1rem' }}>Design Pipeline</h4>
          <p style={{ fontSize: '0.8rem', color: TEXT_DIM }}>
            Elevates an entire app's UI to professional quality using the <Code>@studybuddy/ui</Code> design system.
            Each skill is <strong style={{ color: WHITE }}>granular by concern, app-wide in scope</strong>.
          </p>

          <Steps steps={[
            { title: '/design-system-audit (optional)', desc: 'Are apps actually using @studybuddy/ui? Finds local reimplementations, missing imports, token violations. Creates adoption issue.' },
            { title: '/design-audit', desc: 'Reads the whole app against tokens.css. Screenshots key pages. Creates a master GitHub issue with every deviation categorized.' },
            { title: '/design-typography', desc: 'Reads the audit issue. Applies the --sb-text-* type scale across every file. Fixes in packages/ui first, then app-level.' },
            { title: '/design-color', desc: 'Reads the audit issue. Applies the --sb-color-* palette across every file. Converts hardcoded values to tokens.' },
            { title: '/design-spacing', desc: 'Reads the audit issue. Applies the --sb-space-* grid across every file. Fixes visual hierarchy through whitespace.' },
            { title: '/design-polish', desc: 'Reads the audit issue. Adds hover states, focus rings, transitions using --sb-duration-* and --sb-ease-*. Closes the issue.' },
          ]} />

          <h4 style={{ color: WHITE, fontSize: '0.85rem', marginTop: '1rem' }}>How it works</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', margin: '0.75rem 0' }}>
            <div style={{ background: SURFACE, borderRadius: 8, padding: '0.75rem' }}>
              <div style={{ color: PURPLE, fontWeight: 600, fontSize: '0.8rem', marginBottom: '0.25rem' }}>GitHub Issues as thread</div>
              <div style={{ color: TEXT_DIM, fontSize: '0.8rem' }}>The audit creates the issue. Each fix skill reads it, checks off items, and commits with <Code>refs #ISSUE</Code>.</div>
            </div>
            <div style={{ background: SURFACE, borderRadius: 8, padding: '0.75rem' }}>
              <div style={{ color: GREEN, fontWeight: 600, fontSize: '0.8rem', marginBottom: '0.25rem' }}>Design system aware</div>
              <div style={{ color: TEXT_DIM, fontSize: '0.8rem' }}>Every skill reads <Code>tokens.css</Code> and fixes in <Code>packages/ui</Code> first — the shared library is the source of truth.</div>
            </div>
            <div style={{ background: SURFACE, borderRadius: 8, padding: '0.75rem' }}>
              <div style={{ color: ORANGE, fontWeight: 600, fontSize: '0.8rem', marginBottom: '0.25rem' }}>Visual verification</div>
              <div style={{ color: TEXT_DIM, fontSize: '0.8rem' }}>Each skill takes Playwright screenshots before and after. No "trust me it looks better."</div>
            </div>
            <div style={{ background: SURFACE, borderRadius: 8, padding: '0.75rem' }}>
              <div style={{ color: ACCENT, fontWeight: 600, fontSize: '0.8rem', marginBottom: '0.25rem' }}>One at a time</div>
              <div style={{ color: TEXT_DIM, fontSize: '0.8rem' }}>Run each skill in its own session. Each is a full app-wide pass for one concern.</div>
            </div>
          </div>

          <div style={{ background: `${PURPLE}10`, borderRadius: 6, padding: '0.75rem', borderLeft: `3px solid ${PURPLE}`, marginTop: '0.75rem' }}>
            <div style={{ color: PURPLE, fontWeight: 600, fontSize: '0.8rem' }}>Why this order?</div>
            <div style={{ color: TEXT_DIM, fontSize: '0.78rem', marginTop: '0.25rem' }}>
              Typography first (affects layout). Color second (biggest visual impact, independent of layout). Spacing third (now that type is settled). Polish last (interaction states on top of the final visual foundation).
            </div>
          </div>
        </Accordion>

        <Accordion title="Docs" icon="&#9776;" iconColor={ACCENT}>
          <p>Markdown files in this repo rendered with formatting. Use for reference material like CLI tools, architecture notes, or onboarding docs. Click "Edit" to modify, "View" to read.</p>
        </Accordion>

        <Accordion title="Sync — Porting Config Between Machines" icon="&#8644;" iconColor={GREEN}>
          <SyncDiagram />
          <Steps steps={[
            { title: 'Export on this machine', desc: 'Click Export — copies CLAUDE.md, settings.json, skills to portable/' },
            { title: 'Commit and push', desc: 'git add portable/ && git commit && git push' },
            { title: 'Clone on new machine', desc: 'git clone, npm install, npm run build' },
            { title: 'Import', desc: 'Open app → Sync → Import Config' },
          ]} />
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem' }}>
            <div style={{ flex: 1, background: `${GREEN}10`, borderRadius: 6, padding: '0.6rem', borderLeft: `3px solid ${GREEN}` }}>
              <div style={{ color: GREEN, fontWeight: 600, fontSize: '0.8rem' }}>Synced</div>
              <div style={{ color: TEXT_DIM, fontSize: '0.75rem' }}>CLAUDE.md, settings, skills</div>
            </div>
            <div style={{ flex: 1, background: `${RED}10`, borderRadius: 6, padding: '0.6rem', borderLeft: `3px solid ${RED}` }}>
              <div style={{ color: RED, fontWeight: 600, fontSize: '0.8rem' }}>Not synced</div>
              <div style={{ color: TEXT_DIM, fontSize: '0.75rem' }}>Project memories (machine-specific)</div>
            </div>
          </div>
        </Accordion>
      </div>

      {/* Comparison Table */}
      <h2 style={{ color: WHITE, fontSize: '1.15rem', marginBottom: '0.75rem' }}>When to Use What</h2>
      <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 10, overflow: 'hidden', marginBottom: '2rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ background: SURFACE }}>
              <th style={{ padding: '0.75rem', textAlign: 'left', color: TEXT_DIM, fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Config Type</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', color: TEXT_DIM, fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>When Loaded</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', color: TEXT_DIM, fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Token Cost</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', color: TEXT_DIM, fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Best For</th>
            </tr>
          </thead>
          <tbody>
            {[
              { name: 'Global CLAUDE.md', when: 'Every prompt', cost: 'Always', costColor: RED, best: 'Rules that apply 80%+ of the time' },
              { name: 'Project CLAUDE.md', when: 'In that project', cost: 'Per project', costColor: ORANGE, best: 'Tech stack, architecture, project context' },
              { name: 'Memories', when: 'In that project', cost: 'Per project', costColor: ORANGE, best: 'Learned preferences, corrections, state' },
              { name: 'Skills', when: 'Only when invoked', cost: 'Zero', costColor: GREEN, best: 'Specialized workflows, deployment scripts' },
            ].map((row, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${CARD_BORDER}` }}>
                <td style={{ padding: '0.75rem', color: WHITE, fontWeight: 600 }}>{row.name}</td>
                <td style={{ padding: '0.75rem', color: TEXT }}>{row.when}</td>
                <td style={{ padding: '0.75rem' }}><span style={{ color: row.costColor, fontWeight: 600 }}>{row.cost}</span></td>
                <td style={{ padding: '0.75rem', color: TEXT_DIM }}>{row.best}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pro Tips */}
      <h2 style={{ color: WHITE, fontSize: '1.15rem', marginBottom: '0.75rem' }}>Pro Tips</h2>
      <div style={{
        background: `linear-gradient(135deg, ${CARD_BG} 0%, #1a2535 100%)`,
        border: `1px solid ${CARD_BORDER}`, borderRadius: 10, padding: '1.25rem',
      }}>
        {[
          { tip: 'Keep Global CLAUDE.md under ~1,500 tokens', why: 'It loads on every single prompt across every project' },
          { tip: 'Move specialized workflows to Skills', why: 'Zero cost until invoked vs always-on CLAUDE.md' },
          { tip: 'Audit memories monthly', why: 'Stale project memories cause incorrect assumptions' },
          { tip: 'Use the token count on each file', why: 'Know exactly what you\'re paying per prompt' },
          { tip: 'Health score is a guide, not a rule', why: 'A 60% project with all useful memories beats 95% with gaps' },
        ].map((item, i) => (
          <div key={i} style={{
            display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
            padding: '0.6rem 0', borderTop: i > 0 ? `1px solid ${CARD_BORDER}` : 'none',
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%', background: ACCENT,
              marginTop: 6, flexShrink: 0,
            }} />
            <div>
              <div style={{ color: WHITE, fontWeight: 600, fontSize: '0.85rem' }}>{item.tip}</div>
              <div style={{ color: TEXT_DIM, fontSize: '0.78rem', marginTop: '0.1rem' }}>{item.why}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
