// Edit Mapping modal — full-screen overlay for tweaking how an extracted
// dataset maps to client/database/template/fields/thresholds.

const { useState: useStateEM } = React;

const TEMPLATES = [
  { id: "snapshot-std", label: "Snapshot · Standard", desc: "Summary + key findings + 6-month trend" },
  { id: "snapshot-exec", label: "Snapshot · Executive", desc: "1-page brief, no tables, exec-level summary" },
  { id: "snapshot-deep", label: "Snapshot · Deep dive", desc: "All sections + schema-level appendix" },
];

const FIELD_ROWS = [
  { source: "manifest.snapshot_date",       target: "report.generated_on",     type: "Date",   confidence: 99 },
  { source: "dba_data_files.total_gb",      target: "summary.size_gb",         type: "Number", confidence: 98 },
  { source: "dba_segments.utilization_pct", target: "summary.utilization_pct", type: "Number", confidence: 96 },
  { source: "dba_segments.table_count",     target: "summary.tables",          type: "Number", confidence: 94 },
  { source: "dba_segments.index_count",     target: "summary.indexes",         type: "Number", confidence: 93 },
  { source: "tablespaces.list",             target: "tables.tablespaces",      type: "Array",  confidence: 88 },
  { source: "schemas.list",                 target: "tables.top_consumers",    type: "Array",  confidence: 82 },
  { source: "awr_report.summary",           target: "findings.notes",          type: "Text",   confidence: 71 },
];

function Field({ label, children, help }) {
  return (
    <label className="block">
      <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-1">{label}</div>
      {children}
      {help && <div className="text-[11px] text-slate-400 mt-1">{help}</div>}
    </label>
  );
}

function Select({ value, onChange, options, accent }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 pl-3 pr-8 rounded-lg border border-slate-200 bg-white text-[13px] outline-none focus:border-slate-400 appearance-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <svg
        width="10" height="10" viewBox="0 0 10 10"
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
      >
        <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function Text({ value, onChange, placeholder }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-[13px] outline-none focus:border-slate-400"
    />
  );
}

function ConfBadge({ pct }) {
  const color = pct >= 90 ? "#059669" : pct >= 75 ? "#b45309" : "#dc2626";
  const bg    = pct >= 90 ? "#d1fae5" : pct >= 75 ? "#fef3c7" : "#fee2e2";
  return (
    <span
      className="inline-flex items-center gap-1 text-[10.5px] font-bold px-1.5 py-[3px] rounded uppercase tracking-wider"
      style={{ color, background: bg }}
    >
      {pct}%
    </span>
  );
}

function Toggle({ on, onChange }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={"relative w-9 h-5 rounded-full transition-colors " + (on ? "" : "bg-slate-200")}
      style={on ? { background: "#5538ee" } : undefined}
      aria-pressed={on}
    >
      <span
        className={"absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all " + (on ? "left-[18px]" : "left-0.5")}
      ></span>
    </button>
  );
}

function EditMappingModal({ open, report, accent, onClose }) {
  if (!open || !report) return null;

  const [client, setClient]   = useStateEM(report.clientId);
  const [db, setDb]           = useStateEM(report.dbId);
  const [template, setTemplate] = useStateEM("snapshot-std");
  const [format, setFormat]   = useStateEM(report.format);
  const [thresholdWarn, setThresholdWarn] = useStateEM(85);
  const [thresholdCrit, setThresholdCrit] = useStateEM(95);
  const [includeSchemas, setIncludeSchemas] = useStateEM(true);
  const [includeTablespaces, setIncludeTablespaces] = useStateEM(true);
  const [includeTrend, setIncludeTrend] = useStateEM(true);
  const [includeAWR, setIncludeAWR] = useStateEM(false);
  const [reportName, setReportName] = useStateEM(report.name.replace(/\.(pdf|docx)$/i, ""));
  const [notifyOnComplete, setNotifyOnComplete] = useStateEM(true);
  const [rows, setRows] = useStateEM(FIELD_ROWS);

  const { clients } = window.AppData;
  const dbsOfClient = clients.find((c) => c.id === client)?.databases || [];

  // Step nav inside the modal
  const [step, setStep] = useStateEM("source"); // source | fields | template | thresholds

  const stepDefs = [
    { id: "source",     label: "Source",      n: 1 },
    { id: "fields",     label: "Field mapping", n: 2 },
    { id: "template",   label: "Template",    n: 3 },
    { id: "thresholds", label: "Thresholds",  n: 4 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-stretch">
      {/* Scrim */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
      ></div>

      {/* Sheet */}
      <div className="relative ml-auto w-[920px] max-w-full bg-[#f7f7fb] h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-7 py-5 bg-white border-b border-slate-200 flex items-start gap-4">
          <div
            className="w-10 h-10 rounded-lg inline-flex items-center justify-center shrink-0"
            style={{ background: accent + "1a", color: accent }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3 17l1.6-4.6 9-9 3 3-9 9zM12 3l3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">Edit mapping</div>
            <h2 className="text-[18px] font-bold text-slate-900 truncate">{report.name}</h2>
            <div className="text-[12px] text-slate-500 mt-0.5">
              Tune how this extracted dataset maps to the report — fields, template, and thresholds.
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md inline-flex items-center justify-center text-slate-400 hover:bg-slate-100"
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2l-10 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Stepper */}
        <div className="bg-white border-b border-slate-200 px-7 py-3 flex items-center gap-1">
          {stepDefs.map((s, i) => {
            const active = step === s.id;
            return (
              <React.Fragment key={s.id}>
                <button
                  onClick={() => setStep(s.id)}
                  className={
                    "flex items-center gap-2 h-8 px-3 rounded-md text-[12.5px] font-semibold transition-colors " +
                    (active ? "text-slate-900" : "text-slate-500 hover:text-slate-700")
                  }
                  style={active ? { background: accent + "12", color: accent } : undefined}
                >
                  <span
                    className={
                      "w-5 h-5 rounded-full inline-flex items-center justify-center text-[10.5px] font-bold " +
                      (active ? "text-white" : "bg-slate-100 text-slate-500")
                    }
                    style={active ? { background: accent } : undefined}
                  >
                    {s.n}
                  </span>
                  {s.label}
                </button>
                {i < stepDefs.length - 1 && (
                  <span className="w-4 h-px bg-slate-200"></span>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-7 py-6 space-y-5">
          {step === "source" && (
            <>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="text-[14px] font-bold text-slate-900 mb-1">Source identification</div>
                <div className="text-[12px] text-slate-500 mb-4">
                  We auto-detected these from the upload's <span className="font-mono">manifest.json</span>. Override if needed.
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Client">
                    <Select
                      value={client}
                      onChange={(v) => { setClient(v); const d = clients.find((c) => c.id === v); if (d) setDb(d.databases[0].id); }}
                      options={clients.map((c) => ({ value: c.id, label: c.name }))}
                      accent={accent}
                    />
                  </Field>
                  <Field label="Database">
                    <Select
                      value={db}
                      onChange={setDb}
                      options={dbsOfClient.map((d) => ({ value: d.id, label: d.name }))}
                      accent={accent}
                    />
                  </Field>
                  <Field label="Snapshot date" help="Parsed from manifest.json · editable">
                    <Text value="2026-05-09" onChange={() => {}} />
                  </Field>
                  <Field label="Output filename">
                    <Text value={reportName} onChange={setReportName} placeholder="Merudb_snapshot_May2026" />
                  </Field>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="text-[14px] font-bold text-slate-900 mb-3">Detected source files</div>
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  {[
                    { name: "manifest.json", role: "Snapshot metadata", size: "12 KB" },
                    { name: "dba_data_files.csv", role: "Tablespace inventory", size: "1.1 MB" },
                    { name: "dba_segments.csv", role: "Schema sizes", size: "62 MB" },
                    { name: "awr_report_20260509.html", role: "Performance summary", size: "4.2 MB" },
                    { name: "alert_log.txt", role: "Optional · ignored", size: "184 MB", muted: true },
                  ].map((f, i) => (
                    <div
                      key={i}
                      className={
                        "flex items-center gap-3 px-3 py-2 text-[12.5px] border-b border-slate-100 last:border-0 " +
                        (i % 2 ? "bg-slate-50/60" : "bg-white") +
                        (f.muted ? " opacity-50" : "")
                      }
                    >
                      <span className="font-mono text-slate-700 w-56 truncate">{f.name}</span>
                      <span className="flex-1 text-slate-500">{f.role}</span>
                      <span className="text-slate-400 tabular-nums">{f.size}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === "fields" && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-[14px] font-bold text-slate-900">Field mapping</div>
                  <div className="text-[12px] text-slate-500">Connect source columns to report variables. Low-confidence rows are worth a quick review.</div>
                </div>
                <button
                  className="h-8 px-3 rounded-md text-[12px] font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                >
                  + Add field
                </button>
              </div>
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="text-left text-[10.5px] uppercase tracking-wider text-slate-500 bg-slate-50">
                      <th className="px-3 py-2 font-semibold">Source field</th>
                      <th className="px-3 py-2 font-semibold">→</th>
                      <th className="px-3 py-2 font-semibold">Report variable</th>
                      <th className="px-3 py-2 font-semibold">Type</th>
                      <th className="px-3 py-2 font-semibold">Confidence</th>
                      <th className="px-3 py-2 font-semibold w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className={i % 2 ? "bg-slate-50/40" : "bg-white"}>
                        <td className="px-3 py-2 font-mono text-slate-700">{r.source}</td>
                        <td className="px-3 py-2 text-slate-300">→</td>
                        <td className="px-3 py-2">
                          <input
                            value={r.target}
                            onChange={(e) => {
                              const next = [...rows];
                              next[i] = { ...r, target: e.target.value };
                              setRows(next);
                            }}
                            className="w-full h-7 px-2 rounded border border-transparent hover:border-slate-200 focus:border-slate-300 outline-none font-mono text-slate-800 bg-transparent"
                          />
                        </td>
                        <td className="px-3 py-2 text-slate-500">{r.type}</td>
                        <td className="px-3 py-2"><ConfBadge pct={r.confidence} /></td>
                        <td className="px-3 py-2 text-slate-300">
                          <button
                            onClick={() => setRows(rows.filter((_, j) => j !== i))}
                            className="hover:text-rose-500"
                            title="Remove"
                          >
                            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                              <path d="M2 4h9M4.5 4V2.6h4V4M3.5 4l.7 7h4.6l.7-7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-[11.5px] text-slate-500 mt-3 flex items-center gap-1.5">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ color: accent }}>
                  <circle cx="6.5" cy="6.5" r="5.2" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M6.5 4.2v3M6.5 9v.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                Saved mappings are reused on future extractions for <b>{clients.find((c) => c.id === client)?.name} · {dbsOfClient.find((d) => d.id === db)?.name}</b>.
              </div>
            </div>
          )}

          {step === "template" && (
            <>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="text-[14px] font-bold text-slate-900 mb-3">Report template</div>
                <div className="grid grid-cols-3 gap-3">
                  {TEMPLATES.map((t) => {
                    const on = template === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setTemplate(t.id)}
                        className={
                          "text-left rounded-xl border p-4 transition-colors " +
                          (on ? "" : "border-slate-200 bg-white hover:border-slate-300")
                        }
                        style={on ? { borderColor: accent, background: accent + "0d" } : undefined}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            className="w-4 h-4 rounded-full border-2 flex items-center justify-center"
                            style={{ borderColor: on ? accent : "#cbd5e1" }}
                          >
                            {on && <div className="w-2 h-2 rounded-full" style={{ background: accent }}></div>}
                          </div>
                          <div className="text-[13px] font-bold text-slate-900">{t.label}</div>
                        </div>
                        <div className="text-[11.5px] text-slate-500">{t.desc}</div>
                        {/* mini preview */}
                        <div className="mt-3 rounded bg-slate-50 border border-slate-100 p-2 flex flex-col gap-1">
                          <div className="h-1.5 rounded w-3/4" style={{ background: on ? accent + "55" : "#e2e8f0" }}></div>
                          <div className="h-1 rounded bg-slate-200 w-full"></div>
                          <div className="h-1 rounded bg-slate-200 w-5/6"></div>
                          <div className="grid grid-cols-2 gap-1 mt-1">
                            <div className="h-3 rounded-sm" style={{ background: on ? accent + "22" : "#e2e8f0" }}></div>
                            <div className="h-3 rounded-sm bg-slate-200"></div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="text-[14px] font-bold text-slate-900 mb-3">Sections</div>
                <div className="space-y-3">
                  {[
                    ["Database summary tiles",   true,  () => {},         null],
                    ["Top schema consumers",     includeSchemas, setIncludeSchemas, null],
                    ["Tablespace utilization",   includeTablespaces, setIncludeTablespaces, null],
                    ["6-month storage trend",    includeTrend, setIncludeTrend, null],
                    ["AWR appendix",             includeAWR, setIncludeAWR, "Adds ~3 pages from awr_report.html"],
                  ].map(([label, val, set, help], i) => (
                    <div key={i} className="flex items-center gap-3 py-1.5">
                      <Toggle on={val} onChange={set} />
                      <div className="flex-1">
                        <div className="text-[13px] font-semibold text-slate-800">{label}</div>
                        {help && <div className="text-[11.5px] text-slate-500">{help}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="text-[14px] font-bold text-slate-900 mb-3">Output</div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Format">
                    <Select
                      value={format}
                      onChange={setFormat}
                      options={[
                        { value: "PDF",  label: "PDF only" },
                        { value: "DOCX", label: "DOCX only" },
                        { value: "BOTH", label: "PDF + DOCX" },
                      ]}
                    />
                  </Field>
                  <Field label="Delivery">
                    <Select
                      value="dl"
                      onChange={() => {}}
                      options={[
                        { value: "dl",   label: "Download only" },
                        { value: "mail", label: "Email to client contacts" },
                        { value: "both", label: "Download + email" },
                      ]}
                    />
                  </Field>
                </div>
                <div className="flex items-center gap-3 mt-4">
                  <Toggle on={notifyOnComplete} onChange={setNotifyOnComplete} />
                  <div className="text-[13px] text-slate-700">Notify me when generation completes</div>
                </div>
              </div>
            </>
          )}

          {step === "thresholds" && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-[14px] font-bold text-slate-900 mb-1">Alert thresholds</div>
              <div className="text-[12px] text-slate-500 mb-4">
                Drive the colored callouts in the report. Anything above the critical line flags as red in key findings.
              </div>

              <div className="space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[12.5px] font-semibold text-slate-700">Tablespace utilization · warning</div>
                    <div className="text-[12.5px] font-bold text-slate-900 tabular-nums">{thresholdWarn}%</div>
                  </div>
                  <input
                    type="range" min="50" max="100" value={thresholdWarn}
                    onChange={(e) => setThresholdWarn(parseInt(e.target.value, 10))}
                    className="w-full"
                    style={{ accentColor: accent }}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[12.5px] font-semibold text-slate-700">Tablespace utilization · critical</div>
                    <div className="text-[12.5px] font-bold text-rose-600 tabular-nums">{thresholdCrit}%</div>
                  </div>
                  <input
                    type="range" min="80" max="100" value={thresholdCrit}
                    onChange={(e) => setThresholdCrit(parseInt(e.target.value, 10))}
                    className="w-full"
                    style={{ accentColor: "#e11d48" }}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[12.5px] font-semibold text-slate-700">MoM growth flag (any schema)</div>
                    <div className="text-[12.5px] font-bold text-slate-900 tabular-nums">+10.0 GB</div>
                  </div>
                  <input
                    type="range" min="0" max="50" defaultValue="10"
                    className="w-full"
                    style={{ accentColor: accent }}
                  />
                </div>
              </div>

              <div className="mt-5 rounded-lg p-3 text-[11.5px] flex items-start gap-2" style={{ background: accent + "10", color: accent }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 mt-0.5">
                  <circle cx="7" cy="7" r="5.6" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M7 4.5v3M7 9.2v.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                <span className="text-slate-700">
                  Thresholds apply to <b style={{ color: accent }}>this client/database pair</b> on future reports too — save once, reuse forever.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-7 py-4 bg-white border-t border-slate-200 flex items-center gap-2">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-lg text-[13px] font-semibold text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <div className="flex-1"></div>
          <div className="text-[11.5px] text-slate-400 mr-3 hidden sm:block">
            Auto-saved as draft · {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
          <button
            className="h-9 px-4 rounded-lg text-[13px] font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            onClick={onClose}
          >
            Save mapping
          </button>
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-lg text-[13px] font-bold text-white inline-flex items-center gap-1.5"
            style={{ background: accent }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M2.5 6.5L5.5 9.5L10.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Save &amp; generate report
          </button>
        </div>
      </div>
    </div>
  );
}

window.EditMappingModal = EditMappingModal;
