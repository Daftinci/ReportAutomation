// App shell — top bar + 3-panel layout

const { useState: useStateApp, useEffect: useEffectApp } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#5538ee",
  "topbarBg": "#0b1130",
  "density": "comfy",
  "showThumbnails": true
}/*EDITMODE-END*/;

const ACCENT_OPTIONS = ["#5538ee", "#4f46e5", "#7c3aed", "#0ea5e9", "#0f766e", "#db2777"];
const TOPBAR_OPTIONS = ["#0b1130", "#0f172a", "#111827", "#1e293b"];

function TopBar({ accent, topbarBg, page, setPage }) {
  const NavBtn = ({ id, children }) => (
    <button
      onClick={() => setPage(id)}
      className={
        "h-8 px-3 rounded-md text-[12.5px] font-semibold transition-colors " +
        (page === id ? "bg-white/15 text-white" : "text-white/60 hover:text-white")
      }
    >
      {children}
    </button>
  );
  return (
    <header
      className="h-14 flex items-center px-5 text-white shrink-0"
      style={{ background: topbarBg }}
    >
      <div className="flex items-center gap-2 mr-6">
        <div
          className="w-8 h-8 rounded-lg inline-flex items-center justify-center font-bold text-[14px]"
          style={{ background: accent }}
        >
          R
        </div>
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
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10.5px] text-white/40 border border-white/15 rounded px-1.5 py-0.5">⌘K</span>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <button className="text-white/70 hover:text-white relative">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M3 14h12l-1.4-1.6V9a4.6 4.6 0 1 0-9.2 0v3.4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M7.4 15.5a1.6 1.6 0 0 0 3.2 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <span className="absolute top-0 right-0 w-1.5 h-1.5 rounded-full" style={{ background: accent }}></span>
        </button>
        <button className="text-white/70 hover:text-white">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 2.4l1.8 3.7 4 .6-2.9 2.8.7 4L9 11.6 5.4 13.5l.7-4-2.9-2.8 4-.6z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
        </button>
        <button className="text-white/70 hover:text-white">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M2.5 14.5c.8-2.6 3.2-4.2 6.5-4.2s5.7 1.6 6.5 4.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <circle cx="9" cy="6" r="3" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        </button>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-300 to-rose-400"></div>
      </div>
    </header>
  );
}

function App() {
  const tw = (typeof useTweaks === "function") ? useTweaks(TWEAK_DEFAULTS) : [TWEAK_DEFAULTS, () => {}];
  const t = tw[0];
  const setTweak = tw[1];

  const { clients, reports } = window.AppData;
  const [filter, setFilter] = useStateApp({ kind: "all" });
  const [selectedId, setSelectedId] = useStateApp(reports[0].id);
  const [view, setView] = useStateApp("split"); // split shows preview; grid/list hides it
  const [page, setPage] = useStateApp("reports"); // "reports" | "upload"
  const [mappingOpen, setMappingOpen] = useStateApp(false);
  const [toast, setToast] = useStateApp(null);
  const selected = reports.find((r) => r.id === selectedId) || null;

  useEffectApp(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  // when filter changes, auto-select first visible report
  useEffectApp(() => {
    const filtered = reports.filter((r) => {
      if (filter.kind === "client" && r.clientId !== filter.clientId) return false;
      if (filter.kind === "db" && r.dbId !== filter.dbId) return false;
      return true;
    });
    if (filtered.length && !filtered.find((r) => r.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filter]);

  const accent = t.accent;
  const topbarBg = t.topbarBg;
  const showPreview = view === "split";

  return (
    <div className="h-screen flex flex-col bg-[#eef0fb]">
      <TopBar accent={accent} topbarBg={topbarBg} page={page} setPage={setPage} />
      <div className="flex-1 min-h-0 flex">
        <Sidebar
          clients={clients}
          reports={reports}
          filter={filter}
          setFilter={(f) => { setPage("reports"); setFilter(f); }}
          accent={accent}
          page={page}
          setPage={setPage}
        />
        {page === "reports" ? (
          <React.Fragment>
            <ReportsList
              reports={reports}
              filter={filter}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
              view={view}
              setView={setView}
              accent={accent}
              layout={view}
            />
            {showPreview && (
              <PreviewPanel
                report={selected}
                accent={accent}
                onClose={() => setView("list")}
                onEditMapping={() => setMappingOpen(true)}
                onGenerate={() => setToast("Report generation queued · " + (selected ? selected.name : ""))}
              />
            )}
          </React.Fragment>
        ) : (
          <UploadPage accent={accent} />
        )}
      </div>

      {typeof EditMappingModal === "function" && (
        <EditMappingModal
          open={mappingOpen}
          report={selected}
          accent={accent}
          onClose={() => setMappingOpen(false)}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white text-[12.5px] font-medium px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2.5 7l3 3L11 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {toast}
        </div>
      )}

      {/* Tweaks panel */}
      {typeof TweaksPanel === "function" && (
        <TweaksPanel title="Tweaks">
          <TweakSection label="Accent">
            <TweakColor
              label="Accent color"
              value={t.accent}
              options={ACCENT_OPTIONS}
              onChange={(v) => setTweak("accent", v)}
            />
            <TweakColor
              label="Topbar"
              value={t.topbarBg}
              options={TOPBAR_OPTIONS}
              onChange={(v) => setTweak("topbarBg", v)}
            />
          </TweakSection>
          <TweakSection label="Layout">
            <TweakRadio
              label="View"
              value={view}
              options={[
                { value: "split", label: "Split" },
                { value: "list",  label: "List"  },
                { value: "grid",  label: "Grid"  },
              ]}
              onChange={setView}
            />
          </TweakSection>
        </TweaksPanel>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
