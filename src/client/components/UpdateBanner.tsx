import { useUpdater } from '../hooks/useUpdater';

export function UpdateBanner() {
  const { status, version, error, installUpdate } = useUpdater();

  if (status === 'idle' || status === 'checking') return null;

  if (status === 'error') {
    return (
      <div style={{
        padding: '0.5rem 1rem',
        background: 'rgba(231, 76, 60, 0.1)',
        borderBottom: '1px solid rgba(231, 76, 60, 0.3)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '0.8rem',
      }}>
        <span style={{ color: '#e74c3c' }}>Update check failed: {error}</span>
      </div>
    );
  }

  if (status === 'downloading' || status === 'ready') {
    return (
      <div style={{
        padding: '0.5rem 1rem',
        background: 'rgba(110, 168, 254, 0.1)',
        borderBottom: '1px solid rgba(110, 168, 254, 0.3)',
        fontSize: '0.8rem',
        color: '#6ea8fe',
      }}>
        {status === 'downloading' ? 'Downloading update...' : 'Installing...'}
      </div>
    );
  }

  if (status === 'available') {
    return (
      <div style={{
        padding: '0.5rem 1rem',
        background: 'rgba(39, 174, 96, 0.1)',
        borderBottom: '1px solid rgba(39, 174, 96, 0.3)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '0.8rem',
      }}>
        <span style={{ color: '#27ae60' }}>
          Version {version} is available
        </span>
        <button
          onClick={installUpdate}
          style={{
            background: '#27ae60',
            color: '#000',
            border: 'none',
            padding: '0.3rem 0.75rem',
            borderRadius: '6px',
            fontSize: '0.78rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Update & Restart
        </button>
      </div>
    );
  }

  return null;
}
