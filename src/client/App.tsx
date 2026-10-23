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
import SearchPage from './pages/SearchPage';
import GuidesPage from './pages/GuidesPage';
import hippoLogo from './hippo-logo.svg';
import MapPage from './pages/MapPage';
import { WelcomeTour } from './components/WelcomeTour';

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
        <div className="sidebar-brand">
          <img src={hippoLogo} alt="" className="sidebar-logo" />
          <h2>Hippo</h2>
        </div>
        <p className="subtitle">Claude and Cursor config</p>
        <nav>
          <NavLink to="/" end className={navClass}>
            Overview {flagged > 0 && <span className="nav-count">{flagged}</span>}
          </NavLink>
          <NavLink to="/claude" className={navClass}>Claude</NavLink>
          <NavLink to="/cursor" className={navClass}>Cursor</NavLink>
          <NavLink to="/skills" className={navClass}>Skills</NavLink>
          <NavLink to="/map" className={navClass}>Where things live</NavLink>
          <NavLink to="/search" className={navClass}>Search</NavLink>
          <div className="section-label">Help</div>
          <NavLink to="/guides" className={navClass}>Guides</NavLink>
          <NavLink to="/help" className={navClass}>How it works</NavLink>
        </nav>
      </aside>

      <WelcomeTour />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/claude" element={<ToolView key="claude" tool="claude" />} />
          <Route path="/cursor" element={<ToolView key="cursor" tool="cursor" />} />
          <Route path="/skills" element={<SkillsPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/edit" element={<Editor />} />
          <Route path="/memories/:slug" element={<MemoryBrowser />} />
          <Route path="/guides" element={<GuidesPage />} />
          <Route path="/help" element={<HelpPage />} />
        </Routes>
      </main>
    </div>
  );
}
