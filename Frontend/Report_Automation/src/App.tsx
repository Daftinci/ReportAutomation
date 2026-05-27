import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Client } from './data/appData';
import Sidebar, { type Filter, type Group } from './components/Sidebar';
import ExtractedDataList from './components/ExtractedDataList';
import ExtractedDataPreview from './components/ExtractedDataPreview';
import UploadPage, { type Upload } from './components/Upload';
import TrashPage from './components/TrashPage';
import EditMappingModal from './components/EditMapping';
import * as api from './api/client';

const ACCENT = '#5538ee';
const TOPBAR_BG = '#0b1130';

function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

// ─── Map API report to Upload interface ───────────────────────────────────────

function mapReport(r: api.ReportSummary): Upload {
  return {
    id: r.id,
    name: r.folder_name,
    source: r.extracted_at ? api.formatRelativeTime(r.extracted_at) : '',
    sizeMb: 0,
    fileCount: r.total_files,
    clientGuess: r.client_name || '',
    dbGuess: r.database_name || '',
    status: 'extracted',
    progress: 100,
    extractedAt: r.extracted_at ? api.formatRelativeTime(r.extracted_at) : null,
    tree: [],
    findings: (r.flags || []).map((f) => ({ message: f.message, severity: f.severity })),
    sections: undefined,
  };
}

// ─── Login page ───────────────────────────────────────────────────────────────

function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    setError('');
    try {
      if (mode === 'login') {
        await api.login(username.trim(), password);
      } else {
        await api.register(username.trim(), password);
      }
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-[#eef0fb]">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl inline-flex items-center justify-center font-bold text-[17px] text-white"
            style={{ background: ACCENT }}>R</div>
          <div>
            <div className="text-[17px] font-bold text-slate-900 tracking-tight">Report Automation</div>
            <div className="text-[11px] text-slate-500">DBA workspace</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <h1 className="text-[18px] font-bold text-slate-900 mb-1">
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </h1>
          <p className="text-[12.5px] text-slate-500 mb-6">
            {mode === 'login' ? 'Enter your credentials to continue.' : 'First-time setup — create the admin account.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-[13.5px] outline-none focus:border-[#5538ee] bg-slate-50"
                placeholder="admin"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-[13.5px] outline-none focus:border-[#5538ee] bg-slate-50"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="text-[12px] text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username.trim() || !password}
              className="w-full h-10 rounded-lg text-white text-[13.5px] font-semibold disabled:opacity-50 transition-opacity"
              style={{ background: ACCENT }}
            >
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
              className="text-[12px] text-slate-400 hover:text-slate-600 transition-colors"
            >
              {mode === 'login' ? 'No account yet? Register' : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Top bar ──────────────────────────────────────────────────────────────────

function TopBar({ page, setPage, sidebarOpen, onToggleSidebar, username, onLogout }: {
  page: string; setPage: (p: string) => void;
  sidebarOpen: boolean; onToggleSidebar: () => void;
  username: string; onLogout: () => void;
}) {
  const NavBtn = ({ id, children }: { id: string; children: React.ReactNode }) => (
    <button
      onClick={() => setPage(id)}
      className={
        'h-8 px-3 rounded-md text-[12.5px] font-semibold transition-colors ' +
        (page === id ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white')
      }
    >
      {children}
    </button>
  );

  return (
    <header className="h-14 flex items-center px-5 text-white shrink-0" style={{ background: TOPBAR_BG }}>
      <button
        onClick={onToggleSidebar}
        title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        className="w-8 h-8 mr-3 inline-flex items-center justify-center rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors shrink-0"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      <div className="flex items-center gap-2 mr-6">
        <div className="w-8 h-8 rounded-lg inline-flex items-center justify-center font-bold text-[14px]"
          style={{ background: ACCENT }}>R</div>
        <div className="leading-tight">
          <div className="text-[13.5px] font-bold tracking-tight">Report Automation</div>
          <div className="text-[10.5px] text-white/50 -mt-0.5">DBA workspace</div>
        </div>
      </div>

      <div className="flex items-center gap-0.5 mr-4">
        <NavBtn id="reports">Extracted data</NavBtn>
        <NavBtn id="upload">Upload &amp; extract</NavBtn>
      </div>

      <div className="flex-1 max-w-md">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.4" />
              <path d="M9.2 9.2L12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </span>
          <input
            placeholder="Search reports, databases, clients…"
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-white/10 text-[13px] placeholder-white/40 outline-none border border-white/5 focus:bg-white/15"
          />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <span className="text-[12px] text-white/50">{username}</span>
        <button
          onClick={onLogout}
          className="h-8 px-3 rounded-md text-[12px] text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          title="Sign out"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [token, setToken] = useState<string | null>(() => api.getToken());
  const [username, setUsername] = useState('');

  const [uploads, setUploads] = useState<Upload[]>([]);
  const [trashedUploads, setTrashedUploads] = useState<Upload[]>([]);

  const dynamicClients = useMemo<Client[]>(() => {
    const map = new Map<string, Set<string>>();
    for (const u of uploads) {
      if (!u.clientGuess) continue;
      if (!map.has(u.clientGuess)) map.set(u.clientGuess, new Set());
      if (u.dbGuess) map.get(u.clientGuess)!.add(u.dbGuess);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, dbs]) => ({
        id: slugify(name),
        name,
        databases: Array.from(dbs).sort().map((dbName) => ({
          id: slugify(name) + '--' + slugify(dbName),
          name: dbName,
        })),
      }));
  }, [uploads]);
  const [filter, setFilter] = useState<Filter>({ kind: 'all' });
  const [groups, setGroups] = useState<Group[]>(() => {
    try { return JSON.parse(localStorage.getItem('ra_groups') || '[]'); }
    catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem('ra_groups', JSON.stringify(groups));
  }, [groups]);

  const [selectedId, setSelectedId] = useState('');
  const [view, setView] = useState('split');
  const [page, setPage] = useState('reports');
  const [mappingOpen, setMappingOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Listen for 401 logout events from the API client
  useEffect(() => {
    const handler = () => { setToken(null); setUsername(''); setUploads([]); };
    window.addEventListener('ra:logout', handler);
    return () => window.removeEventListener('ra:logout', handler);
  }, []);

  // Load reports from API when logged in
  const loadReports = useCallback(async () => {
    if (!api.getToken()) return;
    try {
      const reports = await api.listReports({ limit: 200 });
      const serverData = reports.map(mapReport);
      const serverIds = new Set(serverData.map((r) => r.id));
      setUploads((prev) => {
        // Preserve in-progress local uploads (local-xxx IDs) not yet in server data
        const localInProgress = prev.filter(
          (u) => !serverIds.has(u.id) && u.status !== 'extracted'
        );
        return [...localInProgress, ...serverData];
      });
      setSelectedId((prev) => {
        if (serverIds.has(prev)) return prev; // keep current if it's a real server entry
        return reports.length > 0 ? reports[0].id : prev;
      });
    } catch {
      // Token may be invalid — handled by 401 event
    }
  }, []);

  useEffect(() => {
    if (token) {
      // Decode username from token (JWT payload is base64url)
      try {
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        setUsername(payload.sub || '');
      } catch {
        setUsername('');
      }
      loadReports();
    }
  }, [token, loadReports]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const handleLogin = () => {
    setToken(api.getToken());
  };

  const handleLogout = () => {
    api.clearToken();
    setToken(null);
    setUsername('');
    setUploads([]);
  };

  const handleDiscard = (id: string) => {
    const item = uploads.find((u) => u.id === id);
    if (!item) return;
    setUploads((prev) => prev.filter((u) => u.id !== id));
    setTrashedUploads((prev) => [item, ...prev]);
    if (selectedId === id) setSelectedId('');
  };

  const handleDeletePermanent = async (id: string) => {
    try {
      await api.deleteReport(id);
    } catch {
      // Best-effort
    }
    setTrashedUploads((prev) => prev.filter((u) => u.id !== id));
  };

  const handleRestore = (id: string) => {
    const item = trashedUploads.find((u) => u.id === id);
    if (!item) return;
    setTrashedUploads((prev) => prev.filter((u) => u.id !== id));
    setUploads((prev) => [item, ...prev]);
  };

  const handleEmptyTrash = async () => {
    for (const u of trashedUploads) {
      await api.deleteReport(u.id).catch(() => {});
    }
    setTrashedUploads([]);
  };

  const handleCreateGroup = (name: string, clientName: string) => {
    setGroups((prev) => [...prev, { id: crypto.randomUUID(), name, clientName, extractionIds: [] }]);
  };

  const handleDeleteGroup = (id: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== id));
    if (filter.kind === 'group' && filter.groupId === id) {
      setFilter({ kind: 'all' });
    }
  };

  const handleRenameGroup = (id: string, name: string) => {
    setGroups((prev) => prev.map((g) => g.id === id ? { ...g, name } : g));
  };

  const handleAddToGroup = (groupId: string, extractionId: string) => {
    setGroups((prev) => prev.map((g) =>
      g.id === groupId && !g.extractionIds.includes(extractionId)
        ? { ...g, extractionIds: [...g.extractionIds, extractionId] }
        : g
    ));
  };

  const handleRemoveFromGroup = (groupId: string, extractionId: string) => {
    setGroups((prev) => prev.map((g) =>
      g.id === groupId
        ? { ...g, extractionIds: g.extractionIds.filter((eid) => eid !== extractionId) }
        : g
    ));
  };

  const selected = uploads.find((u) => u.id === selectedId) ?? null;
  const showPreview = view === 'split' && page === 'reports';

  if (!token) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="h-screen flex flex-col bg-[#eef0fb]">
      <TopBar
        page={page}
        setPage={setPage}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        username={username}
        onLogout={handleLogout}
      />

      <div className="flex-1 min-h-0 flex">
        <div style={{ width: sidebarOpen ? 260 : 0, flexShrink: 0, overflow: 'hidden', transition: 'width 0.22s ease' }}>
          <Sidebar
            clients={dynamicClients}
            uploads={uploads}
            trashedCount={trashedUploads.length}
            filter={filter}
            setFilter={(f) => { setPage('reports'); setFilter(f); }}
            accent={ACCENT}
            page={page}
            setPage={setPage}
            groups={groups}
            onCreateGroup={handleCreateGroup}
            onDeleteGroup={handleDeleteGroup}
            onRenameGroup={handleRenameGroup}
          />
        </div>

        {page === 'reports' && (
          <>
            <ExtractedDataList
              uploads={uploads}
              filter={filter}
              clients={dynamicClients}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
              view={view}
              setView={setView}
              accent={ACCENT}
              groups={groups}
              onAddToGroup={handleAddToGroup}
              onRemoveFromGroup={handleRemoveFromGroup}
              onTrash={handleDiscard}
            />
            {showPreview && (
              <ExtractedDataPreview
                upload={selected}
                accent={ACCENT}
                onClose={() => setView('list')}
                onEditMapping={() => setMappingOpen(true)}
                onDiscard={handleDiscard}
              />
            )}
          </>
        )}

        {page === 'upload' && (
          <UploadPage
            accent={ACCENT}
            uploads={uploads}
            setUploads={setUploads}
            onExtractionComplete={loadReports}
          />
        )}

        {page === 'trash' && (
          <TrashPage
            uploads={trashedUploads}
            onRestore={handleRestore}
            onDeletePermanent={handleDeletePermanent}
            onEmptyTrash={handleEmptyTrash}
            accent={ACCENT}
          />
        )}
      </div>

      <EditMappingModal
        open={mappingOpen}
        upload={selected}
        accent={ACCENT}
        onClose={() => setMappingOpen(false)}
        clients={dynamicClients}
        onSave={(id, sections) =>
          setUploads((prev) => prev.map((u) => u.id === id ? { ...u, sections } : u))
        }
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white text-[12.5px] font-medium px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2.5 7l3 3L11 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {toast}
        </div>
      )}
    </div>
  );
}
