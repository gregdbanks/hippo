import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { useState, useEffect, useCallback } from 'react';

type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';

export function useUpdater() {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [version, setVersion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkForUpdate = useCallback(async () => {
    try {
      setStatus('checking');
      const update = await check();
      if (update) {
        setVersion(update.version);
        setStatus('available');
      } else {
        setStatus('idle');
      }
    } catch (e) {
      setError(String(e));
      setStatus('error');
    }
  }, []);

  const installUpdate = useCallback(async () => {
    try {
      setStatus('downloading');
      const update = await check();
      if (!update) return;
      await update.downloadAndInstall();
      setStatus('ready');
      await relaunch();
    } catch (e) {
      setError(String(e));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    checkForUpdate();
  }, [checkForUpdate]);

  return { status, version, error, checkForUpdate, installUpdate };
}
