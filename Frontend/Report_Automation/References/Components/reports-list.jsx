// Center panel — reports list with list / grid / split views

function FmtBadge({ format, accent }) {
  const isPdf = format === "PDF";
  return (
    <span
      className={
        "inline-flex items-center gap-1 text-[10.5px] font-bold px-1.5 py-[3px] rounded uppercase tracking-wider " +
        (isPdf ? "text-rose-600 bg-rose-50" : "text-sky-700 bg-sky-50")
      }
    >
      {format}
    </span>
  );
}

function FileGlyph({ format }) {
  const isPdf = format === "PDF";
  const tint = isPdf ? "#e11d48" : "#0284c7";
  const bg = isPdf ? "#fee5ea" : "#e0f2fe";
  return (
    <div
      className="w-9 h-11 rounded-md flex items-end justify-center pb-1 shrink-0"
      style={{ background: bg }}
    >
      <span className="text-[9.5px] font-extrabold tracking-wider" style={{ color: tint }}>
        {format}
      </span>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.4" />
      <path d="M9.2 9.2L12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ViewToggle({ view, setView, accent }) {
  const Btn = ({ id, children }) => (
    <button
      onClick={() => setView(id)}
      className={
        "w-8 h-8 inline-flex items-center justify-center rounded-md transition-colors " +
        (view === id
          ? "bg-white text-slate-900 shadow-sm"
          : "text-slate-400 hover:text-slate-700")
      }
      style={view === id ? { color: accent } : undefined}
      aria-label={id}
    >
      {children}
    </button>
  );
  return (
    <div className="inline-flex items-center bg-slate-100 rounded-lg p-0.5">
      <Btn id="grid">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1.5" y="1.5" width="4.5" height="4.5" rx="0.6" stroke="currentColor" strokeWidth="1.3" />
          <rect x="8" y="1.5" width="4.5" height="4.5" rx="0.6" stroke="currentColor" strokeWidth="1.3" />
          <rect x="1.5" y="8" width="4.5" height="4.5" rx="0.6" stroke="currentColor" strokeWidth="1.3" />
          <rect x="8" y="8" width="4.5" height="4.5" rx="0.6" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      </Btn>
      <Btn id="list">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 3.5h10M2 7h10M2 10.5h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </Btn>
      <Btn id="split">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1.5" y="1.5" width="4.5" height="11" rx="0.6" stroke="currentColor" strokeWidth="1.3" />
          <rect x="8" y="1.5" width="4.5" height="11" rx="0.6" stroke="currentColor" strokeWidth="1.3" fill="currentColor" />
        </svg>
      </Btn>
    </div>
  );
}

function FilterButton({ accent }) {
  return (
    <button
      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-[13px] font-medium transition-colors"
      style={{
        color: accent,
        borderColor: accent + "55",
        background: "white",
      }}
    >
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <path d="M1.5 2.5h10l-3.6 4.6V11l-2.8.7V7.1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
      Filter
    </button>
  );
}

function ReportRow({ report, selected, onClick, accent, density }) {
  const padY = density === "compact" ? "py-2.5" : "py-3.5";
  return (
    <button
      onClick={onClick}
      className={
        "w-full text-left flex items-center gap-3 rounded-xl px-3 " + padY + " transition-colors border " +
        (selected
          ? "border-transparent"
          : "border-transparent hover:bg-slate-50")
      }
      style={
        selected
          ? { background: accent + "12", borderColor: accent + "33" }
          : undefined
      }
    >
      <FileGlyph format={report.format} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div
            className={
              "text-[13.5px] font-semibold truncate " +
              (selected ? "" : "text-slate-900")
            }
            style={selected ? { color: accent } : undefined}
          >
            {report.name}
          </div>
          <FmtBadge format={report.format} accent={accent} />
        </div>
        <div className="text-[11.5px] text-slate-500 mt-0.5 flex items-center gap-1.5">
          <span className="truncate">{report.clientName}</span>
          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
          <span className="truncate">{report.dbName}</span>
          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
          <span className="truncate">{report.relative}</span>
        </div>
      </div>
    </button>
  );
}

function ReportCard({ report, selected, onClick, accent }) {
  return (
    <button
      onClick={onClick}
      className={
        "text-left rounded-xl p-3 transition-colors border bg-white " +
        (selected ? "" : "border-slate-200 hover:border-slate-300")
      }
      style={selected ? { borderColor: accent, boxShadow: "0 0 0 3px " + accent + "1a" } : undefined}
    >
      <div className="aspect-[4/3] rounded-lg mb-3 relative overflow-hidden"
           style={{ background: report.format === "PDF" ? "#fff1f2" : "#f0f9ff" }}>
        <div className="absolute inset-3 bg-white rounded-md shadow-sm p-2 flex flex-col gap-1">
          <div className="h-1.5 rounded-full bg-slate-200 w-2/3"></div>
          <div className="h-1 rounded-full bg-slate-200 w-full"></div>
          <div className="h-1 rounded-full bg-slate-200 w-full"></div>
          <div className="h-1 rounded-full bg-slate-200 w-4/5"></div>
          <div className="mt-auto grid grid-cols-2 gap-1">
            <div className="h-3 rounded-sm" style={{ background: accent + "22" }}></div>
            <div className="h-3 rounded-sm bg-slate-100"></div>
          </div>
        </div>
        <div className="absolute top-2 right-2">
          <FmtBadge format={report.format} accent={accent} />
        </div>
      </div>
      <div className="text-[12.5px] font-semibold text-slate-900 truncate">{report.name}</div>
      <div className="text-[11px] text-slate-500 truncate">{report.dbName} · {report.relative}</div>
    </button>
  );
}

function ReportsList({ reports, filter, selectedId, setSelectedId, view, setView, accent, layout }) {
  const [q, setQ] = React.useState("");
  const filtered = reports.filter((r) => {
    if (filter.kind === "client" && r.clientId !== filter.clientId) return false;
    if (filter.kind === "db" && r.dbId !== filter.dbId) return false;
    if (q && !r.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const headerLabel =
    filter.kind === "client"
      ? reports.find((r) => r.clientId === filter.clientId)?.clientName + " · Extracted data"
      : filter.kind === "db"
      ? reports.find((r) => r.dbId === filter.dbId)?.dbName + " · Extracted data"
      : "Extracted data";

  return (
    <section className={"flex-1 min-w-0 flex flex-col bg-[#f7f7fb] " + (layout === "split" ? "" : "")}>
      <div className="px-7 pt-6 pb-3 flex items-end justify-between">
        <div>
          <h1 className="text-[26px] font-bold text-slate-900 tracking-tight leading-tight">
            {headerLabel}
          </h1>
          <div className="text-[13px] text-slate-500 mt-0.5">
            You have <span className="font-semibold text-slate-700">{filtered.length}</span> extracted datasets — preview and generate reports below
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
              <SearchIcon />
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter…"
              className="h-9 w-44 pl-7.5 pr-3 pl-8 rounded-lg border border-slate-200 bg-white text-[13px] outline-none focus:border-slate-300"
            />
          </div>
          <ViewToggle view={view} setView={setView} accent={accent} />
          <FilterButton accent={accent} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {view === "grid" ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 px-2">
            {filtered.map((r) => (
              <ReportCard
                key={r.id}
                report={r}
                selected={r.id === selectedId}
                onClick={() => setSelectedId(r.id)}
                accent={accent}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-1.5 px-2">
            {filtered.map((r) => (
              <ReportRow
                key={r.id}
                report={r}
                selected={r.id === selectedId}
                onClick={() => setSelectedId(r.id)}
                accent={accent}
                density={view === "split" ? "compact" : "comfy"}
              />
            ))}
          </div>
        )}
        {filtered.length === 0 && (
          <div className="text-center text-slate-400 text-[13px] py-16">No reports match your filter.</div>
        )}
      </div>
    </section>
  );
}

window.ReportsList = ReportsList;
