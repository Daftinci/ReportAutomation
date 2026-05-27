// Right preview panel — simulated report content

function StatTile({ label, value, sub, accent }) {
  return (
    <div className="rounded-lg border border-slate-200 px-4 py-3 bg-white">
      <div className="text-[10.5px] uppercase tracking-wider font-semibold text-slate-400">
        {label}
      </div>
      <div className="text-[20px] font-bold text-slate-900 mt-0.5 leading-tight">{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function MiniBars({ data, accent }) {
  const max = Math.max(...data.map((d) => d.gb));
  const min = Math.min(...data.map((d) => d.gb));
  const range = Math.max(1, max - min);
  return (
    <div className="flex items-end gap-2 h-20">
      {data.map((d, i) => {
        const pct = 0.25 + 0.75 * ((d.gb - min) / range);
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-t"
              style={{
                height: pct * 100 + "%",
                background: i === data.length - 1 ? accent : accent + "55",
              }}
            ></div>
            <div className="text-[9.5px] text-slate-400">{d.m}</div>
          </div>
        );
      })}
    </div>
  );
}

function ActionBtn({ children, primary, accent, onClick }) {
  return (
    <button
      onClick={onClick}
      className={
        "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-[12.5px] font-semibold transition-colors " +
        (primary
          ? "text-white"
          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50")
      }
      style={primary ? { background: accent } : undefined}
    >
      {children}
    </button>
  );
}

function PreviewPanel({ report, accent, onClose, onEditMapping, onGenerate }) {
  if (!report) {
    return (
      <aside className="w-[460px] shrink-0 border-l border-slate-200 bg-white flex items-center justify-center text-slate-400 text-[13px]">
        Select a report to preview
      </aside>
    );
  }
  const f = report.findings;
  const isPdf = report.format === "PDF";
  return (
    <aside className="w-[460px] shrink-0 border-l border-slate-200 bg-white flex flex-col">
      <div className="px-5 pt-5 pb-3 border-b border-slate-100 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-1">
            {report.type}
          </div>
          <h2 className="text-[16px] font-bold text-slate-900 truncate">{report.name}</h2>
          <div className="text-[11.5px] text-slate-500 mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span>{report.clientName}</span>
            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
            <span>{report.dbName}</span>
            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
            <span>{report.generatedOn}</span>
            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
            <span className="font-semibold" style={{ color: isPdf ? "#e11d48" : "#0284c7" }}>{report.format}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 inline-flex items-center justify-center rounded-md text-slate-400 hover:bg-slate-100"
          aria-label="Close preview"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Simulated page */}
        <div className="p-5">
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
            {/* Letterhead */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400 font-semibold">Snapshot Report</div>
                <div className="text-[15px] font-bold text-slate-900 mt-0.5">{report.dbName} · {report.clientName}</div>
              </div>
              <div
                className="w-9 h-9 rounded-md inline-flex items-center justify-center text-white text-[11px] font-bold"
                style={{ background: accent }}
              >
                RA
              </div>
            </div>

            {/* Database summary */}
            <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-2">
              Database summary
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <StatTile label="Total size" value={f.sizeGB.toLocaleString() + " GB"} sub={"Growth " + f.growthPct + "% MoM"} accent={accent} />
              <StatTile label="Utilization" value={f.utilizationPct + "%"} sub="Storage allocated" accent={accent} />
              <StatTile label="Tables" value={f.tables.toLocaleString()} sub={f.indexes.toLocaleString() + " indexes"} accent={accent} />
              <StatTile label="Last snapshot" value={report.generatedOn.split(",")[0]} sub={report.owner} accent={accent} />
            </div>

            {/* Key findings */}
            <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-2">
              Key findings
            </div>
            <ul className="space-y-1.5 mb-4">
              <li className="flex items-start gap-2 text-[12px] text-slate-700">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: f.utilizationPct >= 85 ? "#e11d48" : accent }}></span>
                <span>
                  Storage utilization at <b>{f.utilizationPct}%</b>
                  {f.utilizationPct >= 85 ? " — exceeds warning threshold (85%)." : " — within healthy bounds."}
                </span>
              </li>
              <li className="flex items-start gap-2 text-[12px] text-slate-700">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: accent }}></span>
                <span>
                  <b>{f.tablespaces.filter((t) => t.hot).length}</b> tablespaces over 85% used; largest:{" "}
                  <b>{f.tablespaces.filter((t) => t.hot).map((t) => t.name).join(", ") || "none"}</b>.
                </span>
              </li>
              <li className="flex items-start gap-2 text-[12px] text-slate-700">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: accent }}></span>
                <span>
                  Top consumer <b>{f.topConsumers[0].schema}</b> at <b>{f.topConsumers[0].sizeGB} GB</b> (Δ {f.topConsumers[0].deltaGB} GB MoM).
                </span>
              </li>
              <li className="flex items-start gap-2 text-[12px] text-slate-700">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: accent }}></span>
                <span>
                  Monthly growth tracking <b>+{f.growthPct}%</b>; 6-month trend shown below.
                </span>
              </li>
            </ul>

            {/* Storage trend */}
            <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-2">
              Storage trend (GB)
            </div>
            <MiniBars data={f.trend} accent={accent} />

            {/* Top consumers table */}
            <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mt-5 mb-2">
              Top schema consumers
            </div>
            <div className="overflow-hidden rounded-md border border-slate-100">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-left text-[10.5px] uppercase tracking-wider text-slate-400 bg-slate-50">
                    <th className="px-3 py-2 font-semibold">Schema</th>
                    <th className="px-3 py-2 font-semibold text-right">Size</th>
                    <th className="px-3 py-2 font-semibold text-right">Δ MoM</th>
                  </tr>
                </thead>
                <tbody>
                  {f.topConsumers.map((c, i) => (
                    <tr key={i} className={i % 2 ? "bg-slate-50/60" : "bg-white"}>
                      <td className="px-3 py-1.5 font-medium text-slate-700">{c.schema}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{c.sizeGB} GB</td>
                      <td className="px-3 py-1.5 text-right tabular-nums" style={{ color: parseFloat(c.deltaGB) > 10 ? "#e11d48" : "#475569" }}>
                        {c.deltaGB} GB
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 text-[10.5px] text-slate-400 flex items-center justify-between">
              <span>Generated by Report Automation</span>
              <span>Page 1 of 6</span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-5 py-4 border-t border-slate-100 flex items-center gap-2 flex-wrap">
        <ActionBtn primary accent={accent} onClick={onGenerate}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M2.5 6.5L5.5 9.5L10.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Generate report
        </ActionBtn>
        <ActionBtn accent={accent} onClick={onEditMapping}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M2 11l1-3 6-6 2 2-6 6zM8 3l2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Edit mapping
        </ActionBtn>
        <div className="flex-1"></div>
        <ActionBtn accent={accent}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M6.5 2v6.5M3.5 5.8l3 3 3-3M2 11h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          PDF
        </ActionBtn>
        <ActionBtn accent={accent}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M6.5 2v6.5M3.5 5.8l3 3 3-3M2 11h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          DOCX
        </ActionBtn>
      </div>
    </aside>
  );
}

window.PreviewPanel = PreviewPanel;
