import { useEffect } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { allFiles, useInventory } from './hooks/useInventory';
import { needsAttention } from './lib/format';
import Overview from './pages/Overview';
import ToolView from './pages/ToolView';
import Editor from './pages/Editor';
import MemoryBrowser from './pages/MemoryBrowser';
import HelpPage from './pages/HelpPage';
import SkillsPage from './pages/SkillsPage';

const navClass = ({ isActive }: { isActive: boolean }) => (isActive ? 'active' : '');

export default function App() {
  const { data } = useInventory();
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const flagged = data ? allFiles(data).filter(needsAttention).length : 0;

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <h2>Hippo</h2>
        <p className="subtitle">Claude and Cursor config</p>
        <nav>
          <NavLink to="/" end className={navClass}>
            Overview {flagged > 0 && <span className="nav-count">{flagged}</span>}
          </NavLink>
          <NavLink to="/claude" className={navClass}>Claude</NavLink>
          <NavLink to="/cursor" className={navClass}>Cursor</NavLink>
          <NavLink to="/skills" className={navClass}>Skills</NavLink>
          <div className="section-label">Help</div>
          <NavLink to="/help" className={navClass}>How it works</NavLink>
        </nav>
      </aside>

      <main className="main-content">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/claude" element={<ToolView key="claude" tool="claude" />} />
          <Route path="/cursor" element={<ToolView key="cursor" tool="cursor" />} />
          <Route path="/skills" element={<SkillsPage />} />
          <Route path="/edit" element={<Editor />} />
          <Route path="/memories/:slug" element={<MemoryBrowser />} />
          <Route path="/help" element={<HelpPage />} />
        </Routes>
      </main>
    </div>
  );
}
