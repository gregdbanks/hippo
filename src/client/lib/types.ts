export type Tool = 'claude' | 'cursor' | 'shared';
export type Kind = 'instructions' | 'rule' | 'skill' | 'settings' | 'memoryIndex' | 'memory' | 'reference';
export type Loading =
  | 'always'
  | 'scoped'
  | 'agentDecides'
  | 'manual'
  | 'onDemand'
  | 'config'
  | 'ignored'
  | 'skipped';
export type Level = 'ok' | 'warn' | 'over';
export type Unit = 'lines' | 'bytes' | 'chars';

export interface Budget {
  label: string;
  used: number;
  limit: number;
  unit: Unit;
  level: Level;
  note: string;
  source: string;
}

export interface ConfigFile {
  path: string;
  name: string;
  tool: Tool;
  kind: Kind;
  loading: Loading;
  loadingNote: string;
  description: string;
  lines: number;
  bytes: number;
  tokens: number;
  modified: string;
  budgets: Budget[];
  issues: string[];
  linkTarget: string | null;
  mirroredFrom: string | null;
  references: Reference[];
}

export type RefKind = 'file' | 'skill';

export interface Reference {
  label: string;
  path: string;
  kind: RefKind;
}

export type AgentsLink = 'linked' | 'separate' | 'unshared' | 'noClaudeMd';
export type MirrorState = 'missing' | 'outdated' | 'current' | 'handWritten' | 'orphaned';

export interface MirrorItem {
  source: string | null;
  dest: string;
  state: MirrorState;
}

export interface MirrorReport {
  created: string[];
  updated: string[];
  removed: string[];
  unchanged: string[];
  skipped: string[];
}

export interface LoadItem {
  path: string;
  label: string;
  tokens: number;
}

export interface SessionLoad {
  tokens: number;
  items: LoadItem[];
}

export interface Project {
  root: string;
  name: string;
  exists: boolean;
  memorySlug: string | null;
  files: ConfigFile[];
  claudeSession: SessionLoad;
  cursorSession: SessionLoad;
  agentsLink: AgentsLink;
  mirror: MirrorItem[];
  usesCursor: boolean;
}

export interface Inventory {
  home: string;
  contextWindow: number;
  claudeGlobal: ConfigFile[];
  cursorGlobal: ConfigFile[];
  projects: Project[];
}

export type NewFileKind = 'claudeRule' | 'cursorRule' | 'claudeSkill' | 'cursorSkill';

export interface FileData {
  content: string;
  sizeBytes: number;
  modified: string;
  tokens: number;
}
