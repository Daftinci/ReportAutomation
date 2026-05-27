import { useState, useRef, useEffect, useMemo } from 'react';
import * as api from '../api/client';

export interface UploadTree {
  kind: 'folder' | 'file';
  name: string;
  files?: number;
  size?: string;
}

export interface SectionData {
  tableColumns: string[];
  tableRows: string[][];
  screenshots?: string[];
  contentType?: 'table' | 'image' | 'table+image';
  recommendation?: string;
  cpuData?: { columns: string[]; rows: string[][] };
  chartImageDataList?: string[];
}

export interface Upload {
  id: string;
  name: string;
  source: string;
  sizeMb: number;
  fileCount: number;
  clientGuess: string;
  dbGuess: string;
  status: 'queued' | 'extracting' | 'extracted' | 'failed';
  progress: number;
  stage?: string;
  extractedAt: string | null;
  error?: string;
  tree: UploadTree[];
  findings: { message: string; severity: 'critical' | 'warning' }[];
  sections?: Record<string, SectionData>;
}

// ─── Status pill ──────────────────────────────────────────────────────────────

const STATUS_META = {
  queued:     { label: 'Queued',     color: '#64748b', bg: '#f1f5f9' },
  extracting: { label: 'Extracting', color: '#2563eb', bg: '#dbeafe' },
  extracted:  { label: 'Extracted',  color: '#059669', bg: '#d1fae5' },
  failed:     { label: 'Failed',     color: '#dc2626', bg: '#fee2e2' },
};

function StatusPill({ status }: { status: Upload['status'] }) {
  const m = STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-[3px] rounded-full uppercase tracking-wider"
      style={{ color: m.color, background: m.bg }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.color }}></span>
      {m.label}
    </span>
  );
}

function FolderGlyph({ status }: { status: Upload['status'] }) {
  const m = STATUS_META[status];
  return (
    <div className="w-10 h-10 rounded-lg inline-flex items-center justify-center shrink-0" style={{ background: m.bg }}>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M2.5 5.5h4.6l1.4 1.6h9v9.4H2.5z" stroke={m.color} strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// ─── Upload row ───────────────────────────────────────────────────────────────

function UploadRow({ u, selected, onClick, accent }: {
  u: Upload; selected: boolean; onClick: () => void; accent: string;
}) {
  return (
    <button
      onClick={onClick}
      className={
        'w-full text-left flex items-center gap-3 rounded-xl px-3 py-3 transition-colors border ' +
        (selected ? 'border-transparent' : 'border-transparent hover:bg-slate-50')
      }
      style={selected ? { background: accent + '12', borderColor: accent + '33' } : undefined}
    >
      <FolderGlyph status={u.status} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="text-[13.5px] font-semibold truncate"
            style={selected ? { color: accent } : { color: '#0f172a' }}>{u.name}</div>
          <StatusPill status={u.status} />
        </div>
        <div className="text-[11.5px] text-slate-500 mt-0.5 flex items-center gap-1.5">
          <span>{u.clientGuess || '—'}</span>
          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
          <span>{u.dbGuess || '—'}</span>
          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
          <span>{u.fileCount.toLocaleString()} files</span>
        </div>
        {u.status === 'extracting' && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full bg-slate-200 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: u.progress + '%', background: accent }}></div>
            </div>
            <span className="text-[10.5px] text-slate-500 font-medium tabular-nums">{u.progress}%</span>
          </div>
        )}
        {u.status === 'failed' && (
          <div className="mt-1 text-[11px] text-rose-600 truncate">⚠ {u.error}</div>
        )}
      </div>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-slate-300">
        <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

// ─── Extraction detail panel ─────────────────────────────────────────────────

function ExtractionDetails({ u, accent }: { u: Upload | undefined; accent: string }) {
  if (!u) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-[13px] bg-white border border-slate-200 rounded-2xl">
        Select an upload to inspect its extracted contents
      </div>
    );
  }
  return (
    <div className="flex-1 min-w-0 bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden">
      <div className="px-6 pt-5 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2 mb-1.5">
          <StatusPill status={u.status} />
          <span className="text-[11px] text-slate-400">{u.source}</span>
        </div>
        <div className="text-[18px] font-bold text-slate-900 truncate">{u.name}</div>
        <div className="text-[12.5px] text-slate-500 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span><span className="text-slate-400">Client</span> <b className="text-slate-700">{u.clientGuess || '—'}</b></span>
          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
          <span><span className="text-slate-400">Database</span> <b className="text-slate-700">{u.dbGuess || '—'}</b></span>
          {u.fileCount > 0 && <>
            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
            <span><span className="text-slate-400">Files</span> <b className="text-slate-700">{u.fileCount.toLocaleString()}</b></span>
          </>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {u.status === 'extracting' && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 mb-5">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[12.5px] font-semibold text-slate-800">{u.stage || 'Parsing snapshot…'}</div>
              <div className="text-[12px] text-slate-500 tabular-nums">{u.progress}% complete</div>
            </div>
            <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: u.progress + '%', background: accent }}></div>
            </div>
          </div>
        )}
        {u.status === 'queued' && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 mb-5 text-[12.5px] text-slate-600 flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-slate-400">
              <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 4.5V8l2.4 1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Waiting for extraction to start…
          </div>
        )}
        {u.status === 'failed' && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 mb-5">
            <div className="text-[12.5px] font-semibold text-rose-700 mb-1">Extraction failed</div>
            <div className="text-[12px] text-rose-700/80">{u.error}</div>
          </div>
        )}

        {u.findings.length > 0 && (
          <>
            <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-2">Findings</div>
            <ul className="space-y-1.5 mb-5">
              {u.findings.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-[12.5px] text-slate-700">
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${f.severity === 'critical' ? 'bg-red-500' : 'bg-amber-400'}`}></span>
                  <span>{f.message}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        {u.tree.length > 0 && (
          <>
            <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-2">Source files</div>
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              {u.tree.map((it, i) => (
                <div key={i} className={
                  'flex items-center gap-2.5 px-3 py-2 text-[12.5px] border-b border-slate-100 last:border-0 ' +
                  (i % 2 ? 'bg-slate-50/60' : 'bg-white')
                }>
                  {it.kind === 'folder'
                    ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: accent }}><path d="M1.5 3.5h3.4l1 1.2H12.5v7.8H1.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
                    : <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-slate-400"><path d="M3 1.5h5L11 4.5v8H3z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /><path d="M8 1.5v3h3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
                  }
                  <span className={'flex-1 truncate ' + (it.kind === 'folder' ? 'font-semibold text-slate-800' : 'font-mono text-slate-700')}>{it.name}</span>
                  <span className="text-[11px] text-slate-400 tabular-nums">{it.kind === 'folder' ? it.files + ' files' : it.size}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Drop zone ────────────────────────────────────────────────────────────────

function DropZone({ accent, onFiles, disabled }: {
  accent: string;
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) onFiles(files);
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const files = Array.from(e.target.files || []);
    if (files.length > 0) onFiles(files);
    e.target.value = '';
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
      className={
        'rounded-2xl border-2 border-dashed transition-colors px-6 py-7 flex items-center gap-5 ' +
        (disabled ? 'opacity-50 pointer-events-none ' : 'cursor-pointer ') +
        (over ? '' : 'border-slate-200 bg-white')
      }
      style={over ? { borderColor: accent, background: accent + '0d' } : undefined}
      onClick={() => { if (!disabled) inputRef.current?.click(); }}
    >
      <div className="w-14 h-14 rounded-xl inline-flex items-center justify-center shrink-0"
        style={{ background: accent + '1a', color: accent }}>
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
          <path d="M3 8.5h7l2 2.4h11v12.5H3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M13 11.5v8.5M9.5 15l3.5-3.5 3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-semibold text-slate-900">
          Drop snapshot files here, or click to browse
        </div>
        <div className="text-[12.5px] text-slate-500 mt-1">
          Select all files from one Oracle snapshot folder at once.
          Required:{' '}
          <span className="px-1 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[11px]">dba_snapshot*.html</span>{' '}
          or{' '}
          <span className="px-1 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[11px]">lite_snapshot*.html</span>
        </div>
      </div>
      {/* webkitdirectory allows selecting a whole folder in Chrome/Edge */}
      <input
        ref={inputRef}
        type="file"
        multiple
        // @ts-expect-error – non-standard but widely supported
        webkitdirectory=""
        className="hidden"
        onChange={handleInput}
        onClick={(e) => e.stopPropagation()}
      />
      <button
        disabled={disabled}
        onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
        className="h-10 px-4 rounded-lg text-white text-[13px] font-semibold shrink-0 disabled:opacity-50"
        style={{ background: accent }}
      >
        Choose folder
      </button>
    </div>
  );
}

// ─── Upload page ──────────────────────────────────────────────────────────────

interface UploadPageProps {
  accent: string;
  uploads: Upload[];
  setUploads: React.Dispatch<React.SetStateAction<Upload[]>>;
  onExtractionComplete: () => void;
}

export default function UploadPage({ accent, uploads, setUploads, onExtractionComplete }: UploadPageProps) {
  const [selectedId, setSelectedId] = useState(uploads[0]?.id ?? '');
  const [tab, setTab] = useState<'all' | Upload['status']>('all');
  const [clientName, setClientName] = useState('');
  const selected = uploads.find((u) => u.id === selectedId);

  const existingClients = useMemo(() => {
    const names = uploads.map((u) => u.clientGuess).filter((n): n is string => !!n);
    return [...new Set(names)].sort();
  }, [uploads]);

  // Polls for in-progress jobs and updates state
  const activeJobs = useRef<Map<string, string>>(new Map()); // jobId → uploadId

  useEffect(() => {
    const interval = setInterval(async () => {
      if (activeJobs.current.size === 0) return;
      for (const [jobId, uploadId] of activeJobs.current) {
        try {
          const job = await api.getJobStatus(jobId);
          setUploads((prev) => prev.map((u) => {
            if (u.id !== uploadId) return u;
            if (job.status === 'done' && job.extraction_id) {
              activeJobs.current.delete(jobId);
              onExtractionComplete();
              return { ...u, status: 'extracted' as const, progress: 100, extractedAt: 'just now' };
            }
            if (job.status === 'failed') {
              activeJobs.current.delete(jobId);
              return { ...u, status: 'failed' as const, error: job.error || 'Extraction failed' };
            }
            const stage = job.progress < 20 ? 'Reading snapshot files…'
              : job.progress < 50 ? 'Parsing HTML sections…'
              : job.progress < 80 ? 'Extracting table data…'
              : 'Saving to database…';
            return { ...u, status: 'extracting' as const, progress: job.progress, stage };
          }));
        } catch {
          // transient error — retry next tick
        }
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [setUploads, onExtractionComplete]);

  const uploadSingleBatch = async (files: File[], dbFolderName: string | null) => {
    const uploadId = 'local-' + Date.now();
    const folderName = dbFolderName
      || files[0]?.webkitRelativePath?.split('/')[0]
      || files[0]?.name
      || 'upload';

    const fresh: Upload = {
      id: uploadId,
      name: folderName,
      source: 'Manual upload · just now',
      sizeMb: Math.round(files.reduce((s, f) => s + f.size, 0) / 1024 / 1024 * 10) / 10,
      fileCount: files.length,
      clientGuess: clientName,
      dbGuess: '',
      status: 'queued',
      progress: 0,
      extractedAt: null,
      tree: files.slice(0, 8).map((f) => ({ kind: 'file' as const, name: f.name, size: _fmtSize(f.size) })),
      findings: [],
    };
    setUploads((prev) => [fresh, ...prev]);
    setSelectedId(uploadId);

    try {
      const res = await api.uploadFiles(files, clientName);
      setUploads((prev) => prev.map((u) =>
        u.id === uploadId
          ? { ...u, status: 'extracting' as const, progress: 5, stage: 'Upload complete, parsing…' }
          : u,
      ));
      activeJobs.current.set(res.job_id, uploadId);
    } catch (err) {
      setUploads((prev) => prev.map((u) =>
        u.id === uploadId
          ? { ...u, status: 'failed' as const, error: err instanceof Error ? err.message : 'Upload failed' }
          : u,
      ));
    }
  };

  const handleFiles = async (files: File[]) => {
    // Group files by DB subfolder: parts[0]=parent, parts[1]=DB subfolder (if 3+ parts)
    const dbMap = new Map<string, File[]>();
    for (const f of files) {
      const rel = (f as any).webkitRelativePath || '';
      const parts = rel.split('/');
      const key = parts.length >= 3 ? parts[1] : '__root__';
      if (!dbMap.has(key)) dbMap.set(key, []);
      dbMap.get(key)!.push(f);
    }

    if (dbMap.size > 1) {
      for (const [dbFolder, dbFiles] of dbMap) {
        await uploadSingleBatch(dbFiles, dbFolder === '__root__' ? null : dbFolder);
      }
    } else {
      await uploadSingleBatch(files, null);
    }
  };

  const counts = {
    all:        uploads.length,
    extracting: uploads.filter((u) => u.status === 'extracting').length,
    queued:     uploads.filter((u) => u.status === 'queued').length,
    extracted:  uploads.filter((u) => u.status === 'extracted').length,
    failed:     uploads.filter((u) => u.status === 'failed').length,
  };
  const visible = uploads.filter((u) => tab === 'all' ? true : u.status === tab);

  type TabId = 'all' | Upload['status'];
  const Tab = ({ id, label }: { id: TabId; label: string }) => (
    <button
      onClick={() => setTab(id)}
      className={
        'h-8 px-3 rounded-lg text-[12.5px] font-semibold transition-colors inline-flex items-center gap-1.5 ' +
        (tab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800')
      }
      style={tab === id ? { color: accent } : undefined}
    >
      {label}
      <span
        className={'text-[10.5px] px-1.5 py-0.5 rounded font-bold ' + (tab === id ? '' : 'bg-slate-100 text-slate-500')}
        style={tab === id ? { background: accent + '1a', color: accent } : undefined}
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
            <h1 className="text-[26px] font-bold text-slate-900 tracking-tight leading-tight">Upload &amp; extract</h1>
            <div className="text-[13px] text-slate-500 mt-0.5">
              Drop Oracle snapshot folders to parse, classify, and queue for reporting.
            </div>
          </div>
          <div className="flex items-center gap-2 text-[12px] text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Backend online
            </span>
          </div>
        </div>

        {/* Client name — required before uploading */}
        <div className="mb-4 bg-white border border-slate-200 rounded-xl px-5 py-4">
          <label className="block">
            <div className="flex items-center gap-1 text-[12px] font-semibold text-slate-600 mb-1.5">
              Client name <span className="text-rose-500 ml-0.5">*</span>
            </div>
            <input
              list="upload-client-datalist"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g. Pertamina EP"
              autoComplete="off"
              className={
                'w-full max-w-xs h-10 px-3 rounded-lg border text-[13.5px] outline-none bg-slate-50 ' +
                (clientName.trim()
                  ? 'border-slate-200 focus:border-[#5538ee]'
                  : 'border-rose-200 focus:border-rose-400')
              }
            />
            <datalist id="upload-client-datalist">
              {existingClients.map((n) => <option key={n} value={n} />)}
            </datalist>
            {!clientName.trim() && (
              <p className="text-[11px] text-rose-500 mt-1">Required before uploading.</p>
            )}
          </label>
        </div>

        <DropZone accent={accent} disabled={!clientName.trim()} onFiles={handleFiles} />

        <div className="mt-6 flex items-center justify-between">
          <div className="inline-flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <Tab id="all"        label="All" />
            <Tab id="extracting" label="Extracting" />
            <Tab id="queued"     label="Queued" />
            <Tab id="extracted"  label="Ready" />
            <Tab id="failed"     label="Failed" />
          </div>
          <div className="text-[12px] text-slate-500">
            {uploads.filter((u) => u.status === 'extracting').length > 0
              ? `${uploads.filter((u) => u.status === 'extracting').length} job(s) running…`
              : 'Idle'}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 px-5 pb-6 flex gap-4">
        <div className="w-[420px] shrink-0 flex flex-col">
          <div className="space-y-1.5 px-2">
            {visible.map((u) => (
              <UploadRow key={u.id} u={u} selected={u.id === selectedId}
                onClick={() => setSelectedId(u.id)} accent={accent} />
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

function _fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
