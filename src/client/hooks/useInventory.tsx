import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { ConfigFile, Inventory } from '../lib/types';

interface InventoryState {
  data: Inventory | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const InventoryContext = createContext<InventoryState | null>(null);

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Inventory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setData(await invoke<Inventory>('inventory'));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return <InventoryContext.Provider value={{ data, loading, error, refresh }}>{children}</InventoryContext.Provider>;
}

export function useInventory(): InventoryState {
  const state = useContext(InventoryContext);
  if (!state) throw new Error('useInventory must be used inside InventoryProvider');
  return state;
}

export function allFiles(inv: Inventory): ConfigFile[] {
  return [...inv.claudeGlobal, ...inv.cursorGlobal, ...inv.projects.flatMap(p => p.files)];
}

export function findFile(inv: Inventory | null, path: string | null): ConfigFile | null {
  if (!inv || !path) return null;
  return allFiles(inv).find(f => f.path === path) ?? null;
}
