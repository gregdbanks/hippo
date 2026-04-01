import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface FileData {
  content: string;
  sizeBytes: number;
  modified: string;
  tokens: number;
}

export function useFile(filePath: string | null) {
  const [data, setData] = useState<FileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!filePath) return;
    setLoading(true);
    setSaved(false);
    try {
      const result = await invoke<FileData>('read_file', { path: filePath });
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [filePath]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (content: string) => {
    if (!filePath) return;
    setSaving(true);
    setSaved(false);
    try {
      await invoke('write_file', { path: filePath, content });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [filePath, load]);

  return { data, loading, error, saving, saved, save, reload: load };
}
