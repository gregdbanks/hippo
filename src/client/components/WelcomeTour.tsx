import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import hippoLogo from '../hippo-logo.svg';

const SEEN = 'hippo-tour-seen';

function seen(): boolean {
  try {
    return localStorage.getItem(SEEN) === '1';
  } catch {
    return true;
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN, '1');
  } catch {
    return;
  }
}

export function WelcomeTour() {
  const [show, setShow] = useState(() => !seen());
  const navigate = useNavigate();
  if (!show) return null;

  const close = (start: boolean) => {
    markSeen();
    setShow(false);
    if (start) navigate('/help?tour=getting-around');
  };

  return (
    <div className="welcome-backdrop" role="dialog" aria-label="Welcome to Hippo">
      <div className="welcome">
        <img src={hippoLogo} alt="" className="welcome-logo" />
        <h2>Welcome to Hippo</h2>
        <p>Hippo keeps your Claude and Cursor config files in one place, checks them against their size limits, and keeps the two tools in sync.</p>
        <p className="muted small">The name is short for hippocampus, the part of the brain that stores memories. Hippo is the one place for everything your coding tools remember between sessions.</p>
        <p className="muted small">Take the one-minute tour to see where everything is. You can rerun it any time from How it works.</p>
        <div className="row">
          <button className="btn btn-primary" onClick={() => close(true)}>Take the tour</button>
          <button className="btn btn-ghost" onClick={() => close(false)}>Not now</button>
        </div>
      </div>
    </div>
  );
}
