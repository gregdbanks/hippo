import { useState, useEffect, useCallback } from 'react';
import { fetchJson } from '../lib/api';

export interface FileInfo {
  path: string;
  exists: boolean;
  sizeBytes: number;
  tokens: number;
  modified: string;
}

export interface MemoryHealth {
  score: number;
  grade: 'healthy' | 'warning' | 'critical';
  memoryCount: number;
  optimalMax: number;
  indexLineCount: number;
  indexLineLimit: number;
  staleCount: number;
  reviewCount: number;
  memoryTokens: number;
  tokenBudgetPct: number;
  suggestions: string[];
}

export interface ProjectInfo {
  slug: string;
  realPath: string;
  claudeMd: FileInfo | null;
  memoryIndex: FileInfo | null;
  memoryCount: number;
  memoryTotalTokens: number;
  memoryHealth: MemoryHealth | null;
}

export interface SkillInfo {
  name: string;
  path: string;
  description: string;
  sizeBytes: number;
  tokens: number;
}

export interface SettingsInfo {
  path: string;
  exists: boolean;
  sizeBytes: number;
  hookCount: number;
  allowCount: number;
  denyCount: number;
}

export interface DiscoveryResult {
  globalClaude: FileInfo | null;
  projects: ProjectInfo[];
  skills: SkillInfo[];
  settings: SettingsInfo;
  plans: FileInfo[];
  totals: {
    filesLoaded: number;
    totalTokens: number;
  };
}

export function useDiscovery() {
  const [data, setData] = useState<DiscoveryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchJson<DiscoveryResult>('/discovery');
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, loading, error, refresh };
}
