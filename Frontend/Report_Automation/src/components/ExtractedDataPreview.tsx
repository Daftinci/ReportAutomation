import { useState, useEffect, useRef } from 'react';
import type { Upload, SectionData } from './Upload';
import * as api from '../api/client';
import { CpuChart, type CpuChartHandle } from './CpuChart';

const SECTION_NAMES: Record<string, string> = {
  cpu: 'CPU Utilization',
  mountpoint: 'Mountpoint Usage',
  tablespace: 'Tablespace Usage',
  rman: 'RMAN Backup Status',
  sessions: 'Session Count',
  sessions_matrix: 'User Session Matrix',
  sga: 'SGA Memory',
  fileio: 'File I/O Statistics',
  invalid: 'Invalid Objects',
  initparams: 'Init Parameters',
  datafiles: 'Data Files',
  dbgrowth: 'Database Growth',
  redo: 'Redo Log Switches',
  dataguard: 'DataGuard Status',
  online_redo: 'Online Redo Logs',
  performance_review: 'Performance Review',
};

const SECTION_ORDER = [
  'cpu','mountpoint','tablespace','rman','sessions','sessions_matrix','sga',
  'fileio','invalid','initparams','datafiles','dbgrowth','redo','dataguard',
  'online_redo','performance_review',
];

function buildSectionsForGenerate(raw: Record<string, SectionData>): api.GenerateSection[] {
  const ids = SECTION_ORDER.filter((id) => id in raw);
  // Also include any extracted sections not in the canonical list
  for (const id of Object.keys(raw)) {
    if (!ids.includes(id)) ids.push(id);
  }
  return ids.map((id) => {
    const sd = raw[id];
    return {
      id,
      name: SECTION_NAMES[id] ?? id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      tableColumns: sd.tableColumns,
      tableRows: sd.tableRows,
      contentType: sd.contentType,
      recommendation: sd.recommendation || '',
      screenshots: sd.screenshots || [],
      ...(sd.cpuData ? { cpuData: sd.cpuData } : {}),
      ...(sd.chartImageDataList?.length ? { chartImageDataList: sd.chartImageDataList } : {}),
    };
  });
}

interface Props {
  upload: Upload | null;
  accent: string;
  onClose: () => void;
  onEditMapping: () => void;
  onDiscard: (id: string) => void;
}

// ─── Logo helpers ─────────────────────────────────────────────────────────────

const logoKey = (clientName: string) =>
  `ra_logo_${clientName.trim().toLowerCase().replace(/\s+/g, '_')}`;

function LogoUploadField({ value, onChange }: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <label className="block text-[11.5px] font-semibold text-slate-600 mb-1">Client logo</label>
      {value ? (
        <div className="flex items-center gap-3">
          <img
            src={value}
            alt="Client logo"
            className="h-12 w-auto max-w-[120px] object-contain rounded border border-slate-200 bg-white p-1"
          />
          <button
            onClick={() => onChange(null)}
            className="text-[11.5px] text-slate-500 hover:text-rose-600 transition-colors"
          >
            Remove
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 h-9 px-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 text-[12.5px] text-slate-500 hover:border-slate-400 hover:text-slate-600 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1.5 9.5v2.5h11V9.5M7 1v8M4 4l3-3 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Upload logo
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

// ─── Generate modal ───────────────────────────────────────────────────────────

function GenerateModal({
  upload, accent, onClose,
}: { upload: Upload; accent: string; onClose: () => void }) {
  const [clientName, setClientName] = useState(upload.clientGuess || '');
  const [period, setPeriod] = useState('');
  const [authorName, setAuthorName] = useState('');
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const [docDate, setDocDate] = useState(today);
  const [docVersion, setDocVersion] = useState('1.0');
  const [dataCollectionDate, setDataCollectionDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [clientLogoData, setClientLogoData] = useState<string | null>(() =>
    localStorage.getItem(logoKey(upload.clientGuess || '')) || null
  );
  const [autoCpuData, setAutoCpuData] = useState<{ columns: string[]; rows: string[][] } | null>(null);
  const autoCpuRefs = useRef<(CpuChartHandle | null)[]>([]);

  useEffect(() => {
    setClientLogoData(localStorage.getItem(logoKey(clientName)) || null);
  }, [clientName]);

  // Pre-render recharts charts for auto-capture on generate (avoids matplotlib fallback)
  useEffect(() => {
    const hasCaptured = (() => {
      const raw: Record<string, SectionData> | null = (() => {
        if (upload.sections && Object.keys(upload.sections as object).length > 0)
          return upload.sections as Record<string, SectionData>;
        try {
          const s = localStorage.getItem(`sections_${upload.id}`);
          return s ? JSON.parse(s) : null;
        } catch { return null; }
      })();
      return !!(raw?.cpu?.chartImageDataList?.length);
    })();
    if (hasCaptured) return;
    api.getReport(upload.id)
      .then((detail) => {
        const cu = detail.cpu_utils as { columns: string[]; rows: string[][] } | undefined;
        if (cu?.rows?.length) setAutoCpuData(cu);
      })
      .catch(() => {});
  }, [upload.id]);

  const handleLogoChange = (v: string | null) => {
    setClientLogoData(v);
    if (v) localStorage.setItem(logoKey(clientName), v);
    else localStorage.removeItem(logoKey(clientName));
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    try {
      // Use edited sections from App state or localStorage (survives page refresh)
      const rawSections: Record<string, SectionData> | null = (() => {
        if (upload.sections && Object.keys(upload.sections as object).length > 0)
          return upload.sections as Record<string, SectionData>;
        try {
          const stored = localStorage.getItem(`sections_${upload.id}`);
          return stored ? JSON.parse(stored) : null;
        } catch { return null; }
      })();

      const savedInfo = (() => {
        try {
          const raw = localStorage.getItem(`info_${upload.id}`);
          return raw ? JSON.parse(raw) : null;
        } catch { return null; }
      })();

      // Auto-capture recharts charts if not already saved via EditMapping
      let capturedImages: string[] | undefined;
      if (autoCpuData && !rawSections?.cpu?.chartImageDataList?.length) {
        const captures = await Promise.all(
          autoCpuRefs.current.map((r) => r?.capture() ?? Promise.resolve(null))
        );
        const valid = captures.filter((c): c is string => !!c);
        if (valid.length) capturedImages = valid;
      }

      await api.generateReport({
        extraction_id: upload.id,
        clientName,
        period,
        authorName,
        docDate,
        docVersion,
        dataCollectionDate,
        sections: rawSections ? buildSectionsForGenerate(rawSections) : undefined,
        clientLogoData,
        ...(savedInfo?.serverInfo ? { serverInfo: savedInfo.serverInfo } : {}),
        ...(savedInfo?.databaseInfo ? { databaseInfo: savedInfo.databaseInfo } : {}),
        ...(capturedImages ? { cpu_chart_images: capturedImages } : {}),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="relative bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm p-6">
        <h2 className="text-[16px] font-bold text-slate-900 mb-1">Generate report</h2>
        <p className="text-[12px] text-slate-500 mb-5">
          Fill in report metadata. Leave blank to use defaults.
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-[11.5px] font-semibold text-slate-600 mb-1">Client name</label>
            <input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-200 text-[13px] outline-none focus:border-[#5538ee] bg-slate-50"
              placeholder={upload.clientGuess || 'e.g. PT Pertamina EP'}
            />
          </div>
          <div>
            <label className="block text-[11.5px] font-semibold text-slate-600 mb-1">Reporting period</label>
            <input
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-200 text-[13px] outline-none focus:border-[#5538ee] bg-slate-50"
              placeholder="e.g. April 2026"
            />
          </div>
          <div>
            <label className="block text-[11.5px] font-semibold text-slate-600 mb-1">Author name</label>
            <input
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-200 text-[13px] outline-none focus:border-[#5538ee] bg-slate-50"
              placeholder="DBA engineer name"
            />
          </div>
          <div>
            <label className="block text-[11.5px] font-semibold text-slate-600 mb-1">Document date</label>
            <input
              value={docDate}
              onChange={(e) => setDocDate(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-200 text-[13px] outline-none focus:border-[#5538ee] bg-slate-50"
              placeholder="e.g. 13 May 2026"
            />
          </div>
          <div>
            <label className="block text-[11.5px] font-semibold text-slate-600 mb-1">Doc version</label>
            <input
              value={docVersion}
              onChange={(e) => setDocVersion(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-200 text-[13px] outline-none focus:border-[#5538ee] bg-slate-50"
              placeholder="e.g. 1.0"
            />
          </div>
          <div>
            <label className="block text-[11.5px] font-semibold text-slate-600 mb-1">Data collection date</label>
            <input
              value={dataCollectionDate}
              onChange={(e) => setDataCollectionDate(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-200 text-[13px] outline-none focus:border-[#5538ee] bg-slate-50"
              placeholder="e.g. 10 May 2026"
            />
          </div>
          <LogoUploadField value={clientLogoData} onChange={handleLogoChange} />
        </div>

        {error && (
          <div className="mt-3 text-[12px] text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="mt-5 flex items-center gap-2">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="flex-1 h-9 rounded-lg text-white text-[13px] font-semibold disabled:opacity-50"
            style={{ background: accent }}
          >
            {loading ? 'Generating…' : 'Download .docx'}
          </button>
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-lg border border-slate-200 text-slate-700 text-[13px] font-semibold hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </div>
      {/* Hidden off-screen charts for auto recharts capture */}
      {autoCpuData && (() => {
        const chunks: { columns: string[]; rows: string[][] }[] = [];
        for (let i = 0; i < autoCpuData.rows.length; i += 500)
          chunks.push({ columns: autoCpuData.columns, rows: autoCpuData.rows.slice(i, i + 500) });
        return (
          <div style={{ position: 'fixed', left: '-9999px', top: 0, width: '550px', pointerEvents: 'none' }}
               aria-hidden="true">
            {chunks.map((chunk, ci) => (
              <CpuChart key={ci} ref={(el) => { autoCpuRefs.current[ci] = el; }}
                cpuData={chunk} hideControls />
            ))}
          </div>
        );
      })()}
    </div>
  );
}

// ─── Preview panel ────────────────────────────────────────────────────────────

export default function ExtractedDataPreview({ upload, accent, onClose, onEditMapping, onDiscard }: Props) {
  const [generateOpen, setGenerateOpen] = useState(false);
  const [detailSections, setDetailSections] = useState<Record<string, { tableColumns: string[]; tableRows: string[][] }> | null>(null);
  const [hasCpu, setHasCpu] = useState(false);

  useEffect(() => {
    if (!upload?.id) return;
    setDetailSections(null);
    setHasCpu(false);
    api.getReport(upload.id)
      .then((d) => {
        if (d.sections) setDetailSections(d.sections);
        if ((d.cpu_utils as { rows?: unknown[] } | undefined)?.rows?.length) setHasCpu(true);
      })
      .catch(() => {});
  }, [upload?.id]);

  if (!upload) {
    return (
      <aside className="w-[460px] shrink-0 border-l border-slate-200 bg-white flex items-center justify-center text-slate-400 text-[13px]">
        Select a snapshot to preview
      </aside>
    );
  }

  return (
    <>
      <aside className="w-[460px] shrink-0 border-l border-slate-200 bg-white flex flex-col">
        <div className="px-5 pt-5 pb-3 border-b border-slate-100 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-[3px] rounded-full uppercase tracking-wider"
                style={{ color: '#059669', background: '#d1fae5' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#059669' }}></span>
                Extracted
              </span>
              {upload.extractedAt && (
                <span className="text-[11px] text-slate-400">{upload.extractedAt}</span>
              )}
            </div>
            <h2 className="text-[15px] font-bold text-slate-900 truncate">{upload.name}</h2>
            <div className="text-[11.5px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <span>{upload.clientGuess || '—'}</span>
              <span className="w-1 h-1 rounded-full bg-slate-300"></span>
              <span>{upload.dbGuess || '—'}</span>
              {upload.fileCount > 0 && <>
                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                <span>{upload.fileCount.toLocaleString()} files</span>
              </>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 inline-flex items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 shrink-0"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="grid grid-cols-2 gap-2">
            {([
              ['Client',   upload.clientGuess || '—'],
              ['Database', upload.dbGuess || '—'],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-200 px-3 py-2.5">
                <div className="text-[10.5px] uppercase tracking-wider font-semibold text-slate-400">{label}</div>
                <div className="text-[14px] font-bold text-slate-900 mt-0.5">{value}</div>
              </div>
            ))}
          </div>

          {upload.findings.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-2">Findings</div>
              <ul className="space-y-1.5">
                {upload.findings.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12.5px] text-slate-700">
                    <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${f.severity === 'critical' ? 'bg-red-500' : 'bg-amber-400'}`}></span>
                    <span>
                      <span className={`inline-block mr-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide leading-none ${
                        f.severity === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {f.severity}
                      </span>
                      {f.message}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(detailSections || hasCpu) && (() => {
            const orderedIds = SECTION_ORDER.filter((id) =>
              id === 'cpu' ? hasCpu : detailSections && id in detailSections
            );
            for (const id of Object.keys(detailSections ?? {})) {
              if (!orderedIds.includes(id)) orderedIds.push(id);
            }
            return (
              <div>
                <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-2">
                  Sections
                  <span className="ml-2 px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold normal-case tracking-normal">
                    {orderedIds.length}
                  </span>
                </div>
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  {orderedIds.map((id, i) => {
                    const sec = id === 'cpu' ? null : detailSections?.[id];
                    const rowCount = sec?.tableRows?.length ?? 0;
                    const isChart = id === 'cpu';
                    return (
                      <div key={id} className={
                        'flex items-center gap-2.5 px-3 py-2 text-[12.5px] border-b border-slate-100 last:border-0 ' +
                        (i % 2 ? 'bg-slate-50/60' : 'bg-white')
                      }>
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: accent }} />
                        <span className="flex-1 text-slate-700 font-medium">
                          {SECTION_NAMES[id] ?? id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                        </span>
                        <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                          {isChart ? 'chart' : `${rowCount} row${rowCount !== 1 ? 's' : ''}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {upload.tree.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-2">Source files</div>
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                {upload.tree.map((it, i) => (
                  <div key={i} className={
                    'flex items-center gap-2.5 px-3 py-2 text-[12.5px] border-b border-slate-100 last:border-0 ' +
                    (i % 2 ? 'bg-slate-50/60' : 'bg-white')
                  }>
                    {it.kind === 'folder'
                      ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: accent }}><path d="M1.5 3.5h3.4l1 1.2H12.5v7.8H1.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
                      : <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-slate-400"><path d="M3 1.5h5L11 4.5v8H3z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /><path d="M8 1.5v3h3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
                    }
                    <span className={'flex-1 truncate ' + (it.kind === 'folder' ? 'font-semibold text-slate-800' : 'font-mono text-slate-700')}>
                      {it.name}
                    </span>
                    <span className="text-[11px] text-slate-400 tabular-nums">
                      {it.kind === 'folder' ? it.files + ' files' : it.size}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setGenerateOpen(true)}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-[12.5px] font-semibold text-white transition-colors"
            style={{ background: accent }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M2.5 6.5L5.5 9.5L10.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Generate report
          </button>
          <button
            onClick={onEditMapping}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-[12.5px] font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M2 11l1-3 6-6 2 2-6 6zM8 3l2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Edit mapping
          </button>
          <div className="flex-1"></div>
          <button
            onClick={() => onDiscard(upload.id)}
            className="h-9 px-3 rounded-lg text-[12.5px] font-medium text-rose-600 hover:bg-rose-50 transition-colors"
          >
            Discard
          </button>
        </div>
      </aside>

      {generateOpen && (
        <GenerateModal
          upload={upload}
          accent={accent}
          onClose={() => setGenerateOpen(false)}
        />
      )}
    </>
  );
}
