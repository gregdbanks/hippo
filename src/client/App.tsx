import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { useDiscovery } from './hooks/useDiscovery';
import Dashboard from './pages/Dashboard';
import Editor from './pages/Editor';
import MemoryBrowser from './pages/MemoryBrowser';
import SkillsBrowser from './pages/SkillsBrowser';
import SettingsEditor from './pages/SettingsEditor';
import DocsBrowser from './pages/DocsBrowser';
import SyncPage from './pages/SyncPage';
import HelpPage from './pages/HelpPage';

export default function App() {
  const { data, loading, error, refresh } = useDiscovery();
  const location = useLocation();

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <h2>Claude Config</h2>
        <p className="subtitle">Configuration Dashboard</p>
        <nav>
          <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
            Dashboard
          </NavLink>

          <div className="section-label">Config Files</div>
          {data?.globalClaude && (
            <NavLink
              to={`/edit?path=${encodeURIComponent(data.globalClaude.path)}`}
              className={location.pathname === '/edit' && location.search.includes('CLAUDE.md') && !location.search.includes('projects') ? 'active' : ''}
            >
              Global CLAUDE.md
            </NavLink>
          )}
          <NavLink to="/settings" className={({ isActive }) => isActive ? 'active' : ''}>
            Settings
          </NavLink>
          <NavLink to="/skills" className={({ isActive }) => isActive ? 'active' : ''}>
            Skills ({data?.skills.length || 0})
          </NavLink>
          <NavLink to="/docs" className={({ isActive }) => isActive ? 'active' : ''}>
            Docs
          </NavLink>
          <NavLink to="/sync" className={({ isActive }) => isActive ? 'active' : ''}>
            Sync
          </NavLink>

          <div className="section-label">Help</div>
          <NavLink to="/help" className={({ isActive }) => isActive ? 'active' : ''}>
            How to Use
          </NavLink>

          {data && data.projects.length > 0 && (
            <>
              <div className="section-label">Projects</div>
              {data.projects.map(p => {
                const name = p.realPath.split('/').pop() || p.slug;
                return (
                  <NavLink
                    key={p.slug}
                    to={`/memories/${encodeURIComponent(p.slug)}`}
                    className={({ isActive }) => isActive ? 'active' : ''}
                  >
                    {name} ({p.memoryCount})
                  </NavLink>
                );
              })}
            </>
          )}
        </nav>
      </aside>

      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard data={data} loading={loading} error={error} refresh={refresh} />} />
          <Route path="/edit" element={<Editor />} />
          <Route path="/memories/:slug" element={<MemoryBrowser />} />
          <Route path="/skills" element={<SkillsBrowser data={data} />} />
          <Route path="/settings" element={<SettingsEditor />} />
          <Route path="/docs" element={<DocsBrowser />} />
          <Route path="/sync" element={<SyncPage />} />
          <Route path="/help" element={<HelpPage />} />
        </Routes>
      </main>
    </div>
  );
}
