// Upload & extraction page — folder ingestion for report automation

const { useState: useStateUp, useRef: useRefUp, useEffect: useEffectUp } = React;

// Mock folder uploads with various states
const SEED_UPLOADS = [
  {
    id: "u-01",
    name: "pertamina_merudb_2026-05-09",
    source: "DBA workstation · 06:02",
    sizeMb: 412.6,
    fileCount: 1284,
    clientGuess: "Pertamina EP",
    dbGuess: "Merudb",
    status: "extracted",
    progress: 100,
    extractedAt: "2 min ago",
    tree: [
      { kind: "folder", name: "snapshots",  files: 12 },
      { kind: "folder", name: "tablespaces", files: 86 },
      { kind: "folder", name: "schemas",    files: 312 },
      { kind: "file",   name: "manifest.json", size: "12 KB" },
      { kind: "file",   name: "awr_report_20260509.html", size: "4.2 MB" },
      { kind: "file",   name: "alert_log.txt", size: "184 MB" },
      { kind: "file",   name: "dba_segments.csv", size: "62 MB" },
      { kind: "file",   name: "dba_data_files.csv", size: "1.1 MB" },
    ],
    findings: [
      "1,284 tables · 3,120 indexes detected",
      "Utilization 78% (warning thresholds OK)",
      "Top schema: PROD_FIN at 612 GB (+18.4 GB MoM)",
    ],
  },
  {
    id: "u-02",
    name: "pertamina_dwh_2026-05-09",
    source: "SFTP · 05:48",
    sizeMb: 2840.1,
    fileCount: 4220,
    clientGuess: "Pertamina EP",
    dbGuess: "DWH",
    status: "extracting",
    progress: 64,
    stage: "Parsing dba_segments.csv",
    extractedAt: null,
    tree: [],
    findings: [],
  },
  {
    id: "u-03",
    name: "kai_oracleexacc_2026-05-09",
    source: "SFTP · 05:34",
    sizeMb: 1180.4,
    fileCount: 2104,
    clientGuess: "KAI",
    dbGuess: "OracleExaCC",
    status: "queued",
    progress: 0,
    extractedAt: null,
    tree: [],
    findings: [],
  },
  {
    id: "u-04",
    name: "pertamina_soadb_2026-05-09",
    source: "DBA workstation · 04:11",
    sizeMb: 96.3,
    fileCount: 412,
    clientGuess: "Pertamina EP",
    dbGuess: "soadb",
    status: "failed",
    progress: 38,
    error: "Missing manifest.json — cannot identify snapshot date",
    extractedAt: null,
    tree: [],
    findings: [],
  },
  {
    id: "u-05",
    name: "pertamina_ext_2026-05-08",
    source: "Manual upload · 22:40",
    sizeMb: 38.2,
    fileCount: 184,
    clientGuess: "Pertamina EP",
    dbGuess: "EXT",
    status: "extracted",
    progress: 100,
    extractedAt: "10h ago",
    tree: [
      { kind: "folder", name: "snapshots",   files: 6 },
      { kind: "folder", name: "tablespaces", files: 24 },
      { kind: "file",   name: "manifest.json", size: "8 KB" },
      { kind: "file",   name: "awr_report.html", size: "1.8 MB" },
    ],
    findings: [
      "412 tables · 904 indexes detected",
      "Utilization 41% (healthy)",
      "Top schema: EXT_FEED at 412 GB",
    ],
  },
];

const STATUS_META = {
  queued:     { label: "Queued",     color: "#64748b", bg: "#f1f5f9" },
  extracting: { label: "Extracting", color: "#2563eb", bg: "#dbeafe" },
  extracted:  { label: "Extracted",  color: "#059669", bg: "#d1fae5" },
  failed:     { label: "Failed",     color: "#dc2626", bg: "#fee2e2" },
};

function StatusPill({ status }) {
  const m = STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-[3px] rounded-full uppercase tracking-wider"
      style={{ color: m.color, background: m.bg }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.color }}></span>
      {m.label}
    </span>
  );
}

function FolderGlyph({ status, accent }) {
  const m = STATUS_META[status];
  return (
    <div
      className="w-10 h-10 rounded-lg inline-flex items-center justify-center shrink-0"
      style={{ background: m.bg }}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M2.5 5.5h4.6l1.4 1.6h9v9.4H2.5z"
          stroke={m.color}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function UploadRow({ u, selected, onClick, accent }) {
  return (
    <button
      onClick={onClick}
      className={
        "w-full text-left flex items-center gap-3 rounded-xl px-3 py-3 transition-colors border " +
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
      <FolderGlyph status={u.status} accent={accent} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div
            className="text-[13.5px] font-semibold truncate"
            style={selected ? { color: accent } : { color: "#0f172a" }}
          >
            {u.name}
          </div>
          <StatusPill status={u.status} />
        </div>
        <div className="text-[11.5px] text-slate-500 mt-0.5 flex items-center gap-1.5">
          <span>{u.clientGuess}</span>
          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
          <span>{u.dbGuess}</span>
          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
          <span>{u.fileCount.toLocaleString()} files · {u.sizeMb.toLocaleString()} MB</span>
        </div>
        {u.status === "extracting" && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: u.progress + "%", background: accent }}
              ></div>
            </div>
            <span className="text-[10.5px] text-slate-500 font-medium tabular-nums">{u.progress}%</span>
          </div>
        )}
        {u.status === "failed" && (
          <div className="mt-1 text-[11px] text-rose-600 truncate">⚠ {u.error}</div>
        )}
      </div>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-slate-300">
        <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function DropZone({ accent, onAdd }) {
  const [over, setOver] = useStateUp(false);
  const inputRef = useRefUp(null);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        // simulate drop
        onAdd && onAdd();
      }}
      className={
        "rounded-2xl border-2 border-dashed transition-colors px-6 py-7 flex items-center gap-5 " +
        (over ? "" : "border-slate-200 bg-white")
      }
      style={over ? { borderColor: accent, background: accent + "0d" } : undefined}
    >
      <div
        className="w-14 h-14 rounded-xl inline-flex items-center justify-center shrink-0"
        style={{ background: accent + "1a", color: accent }}
      >
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
          <path
            d="M3 8.5h7l2 2.4h11v12.5H3z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M13 11.5v8.5M9.5 15l3.5-3.5 3.5 3.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-semibold text-slate-900">
          Drop a snapshot folder here, or click to browse
        </div>
        <div className="text-[12.5px] text-slate-500 mt-1">
          We auto-detect <b>client</b> and <b>database</b> from the folder name and{" "}
          <span className="px-1 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[11px]">manifest.json</span>.
          Supported formats: .zip, .tar.gz, or raw folder.
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        webkitdirectory=""
        directory=""
        className="hidden"
        onChange={() => onAdd && onAdd()}
      />
      <button
        onClick={() => inputRef.current && inputRef.current.click()}
        className="h-10 px-4 rounded-lg text-white text-[13px] font-semibold shrink-0"
        style={{ background: accent }}
      >
        Choose folder
      </button>
      <button
        onClick={() => onAdd && onAdd()}
        className="h-10 px-4 rounded-lg border border-slate-200 bg-white text-slate-700 text-[13px] font-semibold shrink-0 hover:bg-slate-50"
      >
        Paste path…
      </button>
    </div>
  );
}

function ExtractionDetails({ u, accent, onGenerate }) {
  if (!u) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-[13px] bg-white border border-slate-200 rounded-2xl">
        Select an upload to inspect its extracted contents
      </div>
    );
  }
  const m = STATUS_META[u.status];
  return (
    <div className="flex-1 min-w-0 bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2 mb-1.5">
          <StatusPill status={u.status} />
          <span className="text-[11px] text-slate-400">{u.source}</span>
        </div>
        <div className="text-[18px] font-bold text-slate-900 truncate">{u.name}</div>
        <div className="text-[12.5px] text-slate-500 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span><span className="text-slate-400">Client</span> <b className="text-slate-700">{u.clientGuess}</b></span>
          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
          <span><span className="text-slate-400">Database</span> <b className="text-slate-700">{u.dbGuess}</b></span>
          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
          <span><span className="text-slate-400">Size</span> <b className="text-slate-700">{u.sizeMb.toLocaleString()} MB</b></span>
          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
          <span><span className="text-slate-400">Files</span> <b className="text-slate-700">{u.fileCount.toLocaleString()}</b></span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {/* Progress / status block */}
        {u.status === "extracting" && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 mb-5">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[12.5px] font-semibold text-slate-800">{u.stage}</div>
              <div className="text-[12px] text-slate-500 tabular-nums">{u.progress}% complete</div>
            </div>
            <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: u.progress + "%", background: accent }}></div>
            </div>
            <div className="text-[11px] text-slate-500 mt-2">Estimated finish in 4 min · 142 / 220 files processed</div>
          </div>
        )}

        {u.status === "queued" && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 mb-5 text-[12.5px] text-slate-600 flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-slate-400">
              <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 4.5V8l2.4 1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Waiting in extraction queue · position 2 of 3
          </div>
        )}

        {u.status === "failed" && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 mb-5">
            <div className="text-[12.5px] font-semibold text-rose-700 mb-1">Extraction failed</div>
            <div className="text-[12px] text-rose-700/80">{u.error}</div>
            <div className="mt-2 flex gap-2">
              <button className="h-8 px-3 rounded-md bg-white border border-rose-200 text-rose-700 text-[12px] font-semibold hover:bg-rose-100/60">
                Retry extraction
              </button>
              <button className="h-8 px-3 rounded-md bg-white border border-slate-200 text-slate-600 text-[12px] font-semibold hover:bg-slate-50">
                View log
              </button>
            </div>
          </div>
        )}

        {/* Auto-detected mapping */}
        <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-2">
          Auto-detected
        </div>
        <div className="grid grid-cols-2 gap-2 mb-5">
          <div className="rounded-lg border border-slate-200 px-3 py-2.5">
            <div className="text-[10.5px] uppercase tracking-wider font-semibold text-slate-400">Client</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[13.5px] font-bold text-slate-900">{u.clientGuess}</span>
              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">match</span>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 px-3 py-2.5">
            <div className="text-[10.5px] uppercase tracking-wider font-semibold text-slate-400">Database</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[13.5px] font-bold text-slate-900">{u.dbGuess}</span>
              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">match</span>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 px-3 py-2.5">
            <div className="text-[10.5px] uppercase tracking-wider font-semibold text-slate-400">Snapshot date</div>
            <div className="text-[13.5px] font-bold text-slate-900 mt-0.5">May 09, 2026</div>
          </div>
          <div className="rounded-lg border border-slate-200 px-3 py-2.5">
            <div className="text-[10.5px] uppercase tracking-wider font-semibold text-slate-400">Output format</div>
            <div className="text-[13.5px] font-bold text-slate-900 mt-0.5">PDF + DOCX</div>
          </div>
        </div>

        {/* Extracted tree */}
        {u.tree.length > 0 && (
          <>
            <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-2">
              Extracted contents
            </div>
            <div className="rounded-lg border border-slate-200 overflow-hidden mb-5">
              {u.tree.map((it, i) => (
                <div
                  key={i}
                  className={
                    "flex items-center gap-2.5 px-3 py-2 text-[12.5px] " +
                    (i % 2 ? "bg-slate-50/60" : "bg-white") +
                    " border-b border-slate-100 last:border-0"
                  }
                >
                  {it.kind === "folder" ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: accent }}>
                      <path d="M1.5 3.5h3.4l1 1.2H12.5v7.8H1.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-slate-400">
                      <path d="M3 1.5h5L11 4.5v8H3z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                      <path d="M8 1.5v3h3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                    </svg>
                  )}
                  <span className={"flex-1 truncate " + (it.kind === "folder" ? "font-semibold text-slate-800" : "font-mono text-slate-700")}>
                    {it.name}
                  </span>
                  <span className="text-[11px] text-slate-400 tabular-nums">
                    {it.kind === "folder" ? it.files + " files" : it.size}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Findings preview */}
        {u.findings.length > 0 && (
          <>
            <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-2">
              Preview findings
            </div>
            <ul className="space-y-1.5">
              {u.findings.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-[12.5px] text-slate-700">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: accent }}></span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Action footer */}
      <div className="px-6 py-4 border-t border-slate-100 flex items-center gap-2">
        <button
          onClick={onGenerate}
          disabled={u.status !== "extracted"}
          className={
            "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-[12.5px] font-semibold transition-colors " +
            (u.status !== "extracted" ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "text-white")
          }
          style={u.status === "extracted" ? { background: accent } : undefined}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M2 6.5l3 3L11 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Extract data
        </button>
        <button className="h-9 px-3.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-[12.5px] font-semibold hover:bg-slate-50">
          Re-extract
        </button>
        <button className="h-9 px-3.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-[12.5px] font-semibold hover:bg-slate-50">
          Edit mapping
        </button>
        <div className="flex-1"></div>
        <button className="h-9 px-3 rounded-lg text-slate-500 text-[12.5px] font-medium hover:bg-slate-50">
          Discard
        </button>
      </div>
    </div>
  );
}

function UploadPage({ accent }) {
  const [uploads, setUploads] = useStateUp(SEED_UPLOADS);
  const [selectedId, setSelectedId] = useStateUp(SEED_UPLOADS[0].id);
  const selected = uploads.find((u) => u.id === selectedId);

  // Simulate extraction progress on the "extracting" item
  useEffectUp(() => {
    const t = setInterval(() => {
      setUploads((arr) =>
        arr.map((u) => {
          if (u.status === "extracting") {
            const next = Math.min(100, u.progress + 1);
            if (next >= 100) {
              return {
                ...u,
                status: "extracted",
                progress: 100,
                extractedAt: "just now",
                tree: [
                  { kind: "folder", name: "snapshots", files: 24 },
                  { kind: "folder", name: "tablespaces", files: 142 },
                  { kind: "file", name: "manifest.json", size: "18 KB" },
                  { kind: "file", name: "awr_report.html", size: "8.4 MB" },
                ],
                findings: [
                  "3,220 tables · 7,240 indexes detected",
                  "Utilization 91% — exceeds warning threshold",
                  "Top schema: DWH_FACT_SALES at 2,840 GB (+62.0 GB MoM)",
                ],
              };
            }
            return { ...u, progress: next };
          }
          return u;
        })
      );
    }, 220);
    return () => clearInterval(t);
  }, []);

  const counts = {
    all: uploads.length,
    extracting: uploads.filter((u) => u.status === "extracting").length,
    queued:     uploads.filter((u) => u.status === "queued").length,
    extracted:  uploads.filter((u) => u.status === "extracted").length,
    failed:     uploads.filter((u) => u.status === "failed").length,
  };
  const [tab, setTab] = useStateUp("all");
  const visible = uploads.filter((u) => tab === "all" ? true : u.status === tab);

  const handleAdd = () => {
    const id = "u-" + (uploads.length + 1).toString().padStart(2, "0");
    const fresh = {
      id,
      name: "new_upload_" + Date.now().toString().slice(-5),
      source: "Manual upload · just now",
      sizeMb: 124.5,
      fileCount: 312,
      clientGuess: "Pertamina EP",
      dbGuess: "Merudb",
      status: "extracting",
      progress: 3,
      stage: "Unpacking archive",
      tree: [],
      findings: [],
    };
    setUploads([fresh, ...uploads]);
    setSelectedId(id);
  };

  const Tab = ({ id, label }) => (
    <button
      onClick={() => setTab(id)}
      className={
        "h-8 px-3 rounded-lg text-[12.5px] font-semibold transition-colors inline-flex items-center gap-1.5 " +
        (tab === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800")
      }
      style={tab === id ? { color: accent } : undefined}
    >
      {label}
      <span
        className={
          "text-[10.5px] px-1.5 py-0.5 rounded font-bold " +
          (tab === id ? "" : "bg-slate-100 text-slate-500")
        }
        style={tab === id ? { background: accent + "1a", color: accent } : undefined}
      >
        {counts[id]}
      </span>
    </button>
  );

  return (
    <section className="flex-1 min-w-0 flex flex-col bg-[#f7f7fb] overflow-y-auto">
      <div className="px-7 pt-6 pb-4">
        <div className="flex items-end justify-between mb-5">
          <div>
            <h1 className="text-[26px] font-bold text-slate-900 tracking-tight leading-tight">
              Upload &amp; extract
            </h1>
            <div className="text-[13px] text-slate-500 mt-0.5">
              Drop database snapshot folders to parse, classify, and queue for reporting.
            </div>
          </div>
          <div className="flex items-center gap-2 text-[12px] text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Extraction worker · idle
            </span>
            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
            <span>Avg parse 2m 14s</span>
          </div>
        </div>

        <DropZone accent={accent} onAdd={handleAdd} />

        {/* Tabs row */}
        <div className="mt-6 flex items-center justify-between">
          <div className="inline-flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <Tab id="all"        label="All" />
            <Tab id="extracting" label="Extracting" />
            <Tab id="queued"     label="Queued" />
            <Tab id="extracted"  label="Ready" />
            <Tab id="failed"     label="Failed" />
          </div>
          <div className="text-[12px] text-slate-500">
            Last sync · just now
          </div>
        </div>
      </div>

      {/* Two-column: list + details */}
      <div className="flex-1 min-h-0 px-5 pb-6 flex gap-4">
        <div className="w-[420px] shrink-0 flex flex-col">
          <div className="space-y-1.5 px-2">
            {visible.map((u) => (
              <UploadRow
                key={u.id}
                u={u}
                selected={u.id === selectedId}
                onClick={() => setSelectedId(u.id)}
                accent={accent}
              />
            ))}
            {visible.length === 0 && (
              <div className="text-center text-slate-400 text-[13px] py-16">No uploads in this state.</div>
            )}
          </div>
        </div>

        <ExtractionDetails u={selected} accent={accent} />
      </div>
    </section>
  );
}

window.UploadPage = UploadPage;
