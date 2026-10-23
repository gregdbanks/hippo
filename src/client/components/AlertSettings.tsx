import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart';

interface AlertsView {
  enabled: boolean;
  items: { key: string }[];
}

export function AlertSettings() {
  const [alerts, setAlerts] = useState<boolean | null>(null);
  const [atLogin, setAtLogin] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    invoke<AlertsView>('get_alerts').then(v => setAlerts(v.enabled)).catch(e => setError(String(e)));
    isEnabled().then(setAtLogin).catch(() => setAtLogin(false));
  }, []);

  const toggleAlerts = async () => {
    try {
      setAlerts(await invoke<boolean>('set_alerts_enabled', { enabled: !alerts }));
    } catch (e) {
      setError(String(e));
    }
  };

  const toggleLogin = async () => {
    try {
      if (atLogin) await disable();
      else await enable();
      setAtLogin(await isEnabled());
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="alert-settings">
      <label className="toggle">
        <input type="checkbox" role="switch" checked={!!alerts} disabled={alerts === null} onChange={toggleAlerts} />
        Alerts: notify me when a file crosses a limit, plus a daily summary while something needs attention
      </label>
      <label className="toggle">
        <input type="checkbox" role="switch" checked={!!atLogin} disabled={atLogin === null} onChange={toggleLogin} />
        Open Hippo at login, so alerts keep working after a restart
      </label>
      <p className="muted small">Hippo checks every 5 minutes while it's running in the menu bar. The menu bar icon shows how many things need attention.</p>
      {error && <p className="text-over small">{error}</p>}
    </div>
  );
}
