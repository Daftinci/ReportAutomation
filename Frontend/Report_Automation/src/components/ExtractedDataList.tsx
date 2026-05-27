import { useState, useRef, useEffect, useCallback } from 'react';
import type { Upload, SectionData } from './Upload';
import type { Filter } from './Sidebar';
import type { Group } from './Sidebar';
import type { Client } from '../data/appData';
import * as api from '../api/client';
import { CpuChart, type CpuChartHandle } from './CpuChart';

const SECTION_NAMES: Record<string, string> = {
  cpu: 'CPU Utilization', mountpoint: 'Mountpoint Usage', tablespace: 'Tablespace Usage',
  rman: 'RMAN Backup Status', sessions: 'Session Count', sessions_matrix: 'User Session Matrix',sga: 'SGA Memory',
  fileio: 'File I/O Statistics', invalid: 'Invalid Objects', initparams: 'Init Parameters',
  datafiles: 'Data Files', dbgrowth: 'Database Growth', redo: 'Redo Log Switches',
  dataguard: 'DataGuard Status',parameter_review: 'Parameter Review',
};
const SECTION_ORDER = [
  'cpu','mountpoint','tablespace','rman','sessions','sga',
  'fileio','invalid','initparams','datafiles','dbgrowth','redo','dataguard','parameter_review'
];

function buildSectionsForGenerate(raw: Record<string, SectionData>): api.GenerateSection[] {
  const ids = SECTION_ORDER.filter((id) => id in raw);
  for (const id of Object.keys(raw)) { if (!ids.includes(id)) ids.push(id); }
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

function getSavedSections(upload: Upload): api.GenerateSection[] | null {
  const raw: Record<string, SectionData> | null = (() => {
    if (upload.sections && Object.keys(upload.sections as object).length > 0)
      return upload.sections as Record<string, SectionData>;
    try {
      const stored = localStorage.getItem(`sections_${upload.id}`);
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  })();
  return raw ? buildSectionsForGenerate(raw) : null;
}

interface Props {
  uploads: Upload[];
  filter: Filter;
  clients: Client[];
  selectedId: string;
  setSelectedId: (id: string) => void;
  view: string;
  setView: (v: string) => void;
  accent: string;
  groups: Group[];
  onAddToGroup: (groupId: string, extractionId: string) => void;
  onRemoveFromGroup: (groupId: string, extractionId: string) => void;
  onTrash: (id: string) => void;
}

function ListIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 4h10M2 7h10M2 10h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1.5" y="1.5" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.3" />
      <rect x="8.5" y="1.5" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.3" />
      <rect x="1.5" y="8.5" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.3" />
      <rect x="8.5" y="8.5" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function SplitIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="1.5" width="5" height="11" rx="0.8" stroke="currentColor" strokeWidth="1.3" />
      <rect x="8" y="1.5" width="5" height="11" rx="0.8" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
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

function GroupMenu({ uploadId, clientName, groups, onAdd, onRemove, accent }: {
  uploadId: string;
  clientName: string;
  groups: Group[];
  onAdd: (groupId: string) => void;
  onRemove: (groupId: string) => void;
  accent: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Only show groups belonging to this upload's client
  const clientGroups = groups.filter((g) => g.clientName === clientName);
  const memberOf = clientGroups.filter((g) => g.extractionIds.includes(uploadId));

  if (clientGroups.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="h-6 px-2 rounded text-[11px] font-semibold border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors flex items-center gap-1"
        title="Add to group"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M1 2.5h2.6l.8 1H9V8H1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
        </svg>
        {memberOf.length > 0 ? memberOf.length : '+'}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[160px]">
          <div className="px-3 py-1 text-[10.5px] uppercase tracking-wider font-semibold text-slate-400">Groups</div>
          {clientGroups.map((g) => {
            const inGroup = g.extractionIds.includes(uploadId);
            return (
              <button
                key={g.id}
                onClick={(e) => {
                  e.stopPropagation();
                  inGroup ? onRemove(g.id) : onAdd(g.id);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[12.5px] hover:bg-slate-50 text-left"
              >
                <span className={'w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ' +
                  (inGroup ? 'border-transparent' : 'border-slate-300')
                } style={inGroup ? { background: accent } : undefined}>
                  {inGroup && (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </span>
                <span className="flex-1 truncate text-slate-700">{g.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CombinedGenerateModal({
  uploads, accent, onClose,
}: { uploads: Upload[]; accent: string; onClose: () => void }) {
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const [selected, setSelected] = useState<Set<string>>(new Set(uploads.map((u) => u.id)));
  const [clientName, setClientName] = useState(uploads[0]?.clientGuess || '');
  const [period, setPeriod] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [docDate, setDocDate] = useState(today);
  const [docVersion, setDocVersion] = useState('1.0');
  const [dataCollectionDate, setDataCollectionDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [clientLogoData, setClientLogoData] = useState<string | null>(() =>
    localStorage.getItem(logoKey(uploads[0]?.clientGuess || '')) || null
  );
  const [autoCpuMap, setAutoCpuMap] = useState<Map<string, { columns: string[]; rows: string[][] }>>(new Map());
  const autoCpuRefs = useRef<Map<string, (CpuChartHandle | null)[]>>(new Map());

  useEffect(() => {
    setClientLogoData(localStorage.getItem(logoKey(clientName)) || null);
  }, [clientName]);

  // Pre-fetch cpu_utils for selected uploads that lack captured charts
  useEffect(() => {
    for (const upload of uploads.filter((u) => selected.has(u.id))) {
      const sections = getSavedSections(upload);
      const hasCaptured = sections?.some((s) => s.id === 'cpu' && s.chartImageDataList?.length);
      if (!hasCaptured && !autoCpuMap.has(upload.id)) {
        api.getReport(upload.id).then((detail) => {
          const cu = detail.cpu_utils as { columns: string[]; rows: string[][] } | undefined;
          if (cu?.rows?.length)
            setAutoCpuMap((prev) => new Map(prev).set(upload.id, cu!));
        }).catch(() => {});
      }
    }
  }, [selected]);

  const handleLogoChange = (v: string | null) => {
    setClientLogoData(v);
    if (v) localStorage.setItem(logoKey(clientName), v);
    else localStorage.removeItem(logoKey(clientName));
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleGenerate = async () => {
    const selectedUploads = uploads.filter((u) => selected.has(u.id));
    const ids = selectedUploads.map((u) => u.id);
    if (ids.length < 2) { setError('Select at least 2 databases.'); return; }
    const dbsSections = selectedUploads.map((u) => getSavedSections(u));
    const firstUpload = selectedUploads[0];
    const savedInfo = (() => {
      try {
        const raw = localStorage.getItem(`info_${firstUpload.id}`);
        return raw ? JSON.parse(raw) : null;
      } catch { return null; }
    })();

    // Auto-capture recharts charts per DB if not already saved via EditMapping
    const cpuImagesPerDb = await Promise.all(
      selectedUploads.map(async (u) => {
        const sections = getSavedSections(u);
        const existing = sections?.find((s) => s.id === 'cpu')?.chartImageDataList;
        if (existing?.length) return existing;
        const refs = autoCpuRefs.current.get(u.id) ?? [];
        const captures = await Promise.all(refs.map((r) => r?.capture() ?? Promise.resolve(null)));
        const valid = captures.filter((c): c is string => !!c);
        return valid.length ? valid : null;
      })
    );
    const hasAnyImages = cpuImagesPerDb.some(Boolean);

    setLoading(true);
    setError('');
    try {
      await api.generateCombined(ids, {
        extraction_id: '',
        clientName, period, authorName, docDate, docVersion, dataCollectionDate,
        dbsSections,
        clientLogoData,
        ...(savedInfo?.serverInfo ? { serverInfo: savedInfo.serverInfo } : {}),
        ...(savedInfo?.databaseInfo ? { databaseInfo: savedInfo.databaseInfo } : {}),
        ...(hasAnyImages ? { cpu_chart_images_per_db: cpuImagesPerDb } : {}),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm flex flex-col max-h-[90vh]">
        {/* Fixed header */}
        <div className="px-6 pt-6 pb-3 shrink-0">
          <h2 className="text-[16px] font-bold text-slate-900 mb-1">Generate combined report</h2>
          <p className="text-[12px] text-slate-500">Select databases to include and fill report metadata.</p>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 pb-2">
          <div className="mb-4">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-2">Databases</div>
            <div className="space-y-1">
              {uploads.map((u) => (
                <label key={u.id} className="flex items-center gap-2.5 cursor-pointer rounded-lg px-2 py-1.5 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={selected.has(u.id)}
                    onChange={() => toggle(u.id)}
                    className="rounded"
                    style={{ accentColor: accent }}
                  />
                  <span className="text-[13px] font-semibold text-slate-800 flex-1 truncate">{u.dbGuess || u.name}</span>
                  <span className="text-[11px] text-slate-400 shrink-0">{u.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {([
              ['Client name', clientName, setClientName, 'e.g. PT Pertamina EP'],
              ['Reporting period', period, setPeriod, 'e.g. April 2026'],
              ['Author name', authorName, setAuthorName, 'DBA engineer name'],
              ['Document date', docDate, setDocDate, 'e.g. 13 May 2026'],
              ['Doc version', docVersion, setDocVersion, 'e.g. 1.0'],
              ['Data collection date', dataCollectionDate, setDataCollectionDate, 'e.g. 10 May 2026'],
            ] as [string, string, (v: string) => void, string][]).map(([label, value, setter, placeholder]) => (
              <div key={label}>
                <label className="block text-[11.5px] font-semibold text-slate-600 mb-1">{label}</label>
                <input
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  placeholder={placeholder}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-[13px] outline-none focus:border-[#5538ee] bg-slate-50"
                />
              </div>
            ))}
            <LogoUploadField value={clientLogoData} onChange={handleLogoChange} />
          </div>
        </div>

        {/* Fixed footer */}
        <div className="px-6 pb-6 pt-3 shrink-0">
          {error && (
            <div className="mb-3 text-[12px] text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerate}
              disabled={loading || selected.size < 2}
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
      </div>
      {/* Hidden off-screen charts for auto recharts capture per DB */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0, width: '550px', pointerEvents: 'none' }}
           aria-hidden="true">
        {[...autoCpuMap.entries()].map(([uid, cpuData]) => {
          const chunks: { columns: string[]; rows: string[][] }[] = [];
          for (let i = 0; i < cpuData.rows.length; i += 500)
            chunks.push({ columns: cpuData.columns, rows: cpuData.rows.slice(i, i + 500) });
          if (!autoCpuRefs.current.has(uid)) autoCpuRefs.current.set(uid, []);
          return chunks.map((chunk, ci) => (
            <CpuChart
              key={`${uid}-${ci}`}
              ref={(el) => { autoCpuRefs.current.get(uid)![ci] = el; }}
              cpuData={chunk}
              hideControls
            />
          ));
        })}
      </div>
    </div>
  );
}

export default function ExtractedDataList({
  uploads, filter, clients, selectedId, setSelectedId, view, setView, accent,
  groups, onAddToGroup, onRemoveFromGroup, onTrash,
}: Props) {
  const [combinedOpen, setCombinedOpen] = useState(false);
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set());
  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);
  const groupDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!groupDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (groupDropdownRef.current && !groupDropdownRef.current.contains(e.target as Node))
        setGroupDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [groupDropdownOpen]);

  const toggleMultiSelect = useCallback((id: string) =>
    setMultiSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    }), []);

  const currentGroup = filter.kind === 'group'
    ? groups.find((g) => g.id === filter.groupId) ?? null
    : null;

  const extracted = uploads.filter((u) => {
    if (u.status !== 'extracted') return false;
    if (filter.kind === 'group') {
      return currentGroup?.extractionIds.includes(u.id) ?? false;
    }
    if (filter.kind === 'client') {
      const client = clients.find((c) => c.id === filter.clientId);
      if (!client || u.clientGuess !== client.name) return false;
    } else if (filter.kind === 'db') {
      const client = clients.find((c) => c.id === filter.clientId);
      const db = client?.databases.find((d) => d.id === filter.dbId);
      if (!db || u.dbGuess !== db.name) return false;
    }
    return true;
  });

  const allVisibleSelected = extracted.length > 0 && extracted.every((u) => multiSelected.has(u.id));
  const toggleSelectAll = () =>
    setMultiSelected(allVisibleSelected ? new Set() : new Set(extracted.map((u) => u.id)));

  const ViewBtn = ({ id, children }: { id: string; children: React.ReactNode }) => (
    <button
      onClick={() => setView(id)}
      className={
        'w-8 h-8 inline-flex items-center justify-center rounded-md transition-colors ' +
        (view === id ? 'bg-white shadow-sm' : 'text-slate-500 hover:text-slate-700')
      }
      style={view === id ? { color: accent } : undefined}
    >
      {children}
    </button>
  );

  const FolderBadge = () => (
    <div className="w-10 h-10 rounded-lg inline-flex items-center justify-center shrink-0"
      style={{ background: '#d1fae5' }}>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M2.5 5.5h4.6l1.4 1.6h9v9.4H2.5z" stroke="#059669" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    </div>
  );

  const ExtractedPill = () => (
    <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-[3px] rounded-full uppercase tracking-wider shrink-0"
      style={{ color: '#059669', background: '#d1fae5' }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#059669' }}></span>
      Extracted
    </span>
  );

  const filterLabel =
    filter.kind === 'client'
      ? (clients.find((c) => c.id === filter.clientId)?.name ?? '')
      : filter.kind === 'db'
      ? (() => {
          const c = clients.find((c) => c.id === filter.clientId);
          return c?.databases.find((d) => d.id === filter.dbId)?.name ?? '';
        })()
      : filter.kind === 'group'
      ? (currentGroup?.name ?? '')
      : '';

  return (
    <>
    <main className="flex-1 min-w-0 flex flex-col border-r border-slate-200 bg-white overflow-hidden">
      <div className="px-5 pt-5 pb-3 border-b border-slate-100 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded shrink-0"
              style={{ accentColor: accent }}
            />
            <div>
              <h1 className="text-[18px] font-bold text-slate-900 tracking-tight leading-tight">
                Extracted data
                {filterLabel && (
                  <span className="text-[14px] font-normal text-slate-400 ml-2">· {filterLabel}</span>
                )}
              </h1>
              <div className="text-[11.5px] text-slate-500 mt-0.5">
                {extracted.length} {extracted.length === 1 ? 'snapshot' : 'snapshots'} ready for report generation
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(filter.kind === 'client' || filter.kind === 'group') && extracted.length >= 2 && (
              <button
                onClick={() => setCombinedOpen(true)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-semibold text-white"
                style={{ background: accent }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6h8M6 2v8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                Generate combined
              </button>
            )}
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              <ViewBtn id="list"><ListIcon /></ViewBtn>
              <ViewBtn id="grid"><GridIcon /></ViewBtn>
              <ViewBtn id="split"><SplitIcon /></ViewBtn>
            </div>
          </div>
        </div>
      </div>

      <div className={'flex-1 min-h-0 overflow-y-auto ' + (view === 'grid' ? 'p-5' : 'p-2')}>
        {extracted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 inline-flex items-center justify-center mb-4 text-slate-400">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M3.5 7.5h6.4l2 2.2H24.5v13H3.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="text-[15px] font-semibold text-slate-700 mb-1">No extracted snapshots</div>
            <div className="text-[12.5px] text-slate-400">
              {filter.kind !== 'all' && filter.kind !== 'shared'
                ? 'No extractions match this filter.'
                : 'Upload & extract Oracle snapshots to get started.'}
            </div>
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-2 gap-3">
            {extracted.map((u) => {
              const active = u.id === selectedId;
              return (
                <div
                  key={u.id}
                  className={
                    'text-left rounded-xl border p-4 transition-colors ' +
                    (active ? '' : 'border-slate-200 bg-white hover:border-slate-300')
                  }
                  style={active ? { borderColor: accent, background: accent + '0a' } : undefined}
                >
                  <div className="flex items-start justify-between mb-3">
                    <input
                      type="checkbox"
                      checked={multiSelected.has(u.id)}
                      onChange={() => toggleMultiSelect(u.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 rounded mt-0.5 shrink-0"
                      style={{ accentColor: accent }}
                    />
                    <GroupMenu
                      uploadId={u.id}
                      clientName={u.clientGuess || ''}
                      groups={groups}
                      onAdd={(gid) => onAddToGroup(gid, u.id)}
                      onRemove={(gid) => onRemoveFromGroup(gid, u.id)}
                      accent={accent}
                    />
                  </div>
                  <button
                    onClick={() => setSelectedId(u.id)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center gap-2.5 mb-3">
                      <FolderBadge />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-bold text-slate-900 truncate">{u.name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate">{u.clientGuess} · {u.dbGuess}</div>
                      </div>
                    </div>
                    {u.findings.slice(0, 2).map((f, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-[11.5px] text-slate-600 mb-1 last:mb-0">
                        <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${f.severity === 'critical' ? 'bg-red-500' : 'bg-amber-400'}`}></span>
                        <span className="line-clamp-1">{f.message}</span>
                      </div>
                    ))}
                    {u.findings.length === 0 && (
                      <div className="text-[11.5px] text-slate-400 italic">No findings preview</div>
                    )}
                    {u.findings.length > 0 && (() => {
                      const critCount = u.findings.filter((f) => f.severity === 'critical').length;
                      const warnCount = u.findings.filter((f) => f.severity === 'warning').length;
                      return (
                        <div className="flex gap-1.5 mt-1.5 mb-0.5">
                          {critCount > 0 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
                              {critCount} critical
                            </span>
                          )}
                          {warnCount > 0 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">
                              {warnCount} warning{warnCount > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                    <div className="text-[10.5px] text-slate-400 mt-2">{u.extractedAt}</div>
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-0.5">
            {extracted.map((u) => {
              const active = u.id === selectedId;
              return (
                <div
                  key={u.id}
                  className={
                    'w-full text-left flex items-center gap-3 rounded-xl px-3 py-3 transition-colors border ' +
                    (active ? 'border-transparent' : 'border-transparent hover:bg-slate-50')
                  }
                  style={active ? { background: accent + '12', borderColor: accent + '33' } : undefined}
                >
                  <input
                    type="checkbox"
                    checked={multiSelected.has(u.id)}
                    onChange={() => toggleMultiSelect(u.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 rounded shrink-0"
                    style={{ accentColor: accent }}
                  />
                  <button
                    onClick={() => setSelectedId(u.id)}
                    className="flex-1 flex items-center gap-3 min-w-0 text-left"
                  >
                    <FolderBadge />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 min-w-0">
                        <div
                          className="text-[13.5px] font-semibold truncate"
                          style={active ? { color: accent } : { color: '#0f172a' }}
                        >
                          {u.name}
                        </div>
                        <ExtractedPill />
                      </div>
                      <div className="text-[11.5px] text-slate-500 flex items-center gap-1.5">
                        <span>{u.clientGuess}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                        <span>{u.dbGuess}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                        <span>{u.extractedAt}</span>
                      </div>
                    </div>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <GroupMenu
                      uploadId={u.id}
                      clientName={u.clientGuess || ''}
                      groups={groups}
                      onAdd={(gid) => onAddToGroup(gid, u.id)}
                      onRemove={(gid) => onRemoveFromGroup(gid, u.id)}
                      accent={accent}
                    />
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-slate-300">
                      <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {multiSelected.size > 0 && (
        <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-3 flex items-center gap-3">
          <span className="text-[13px] font-semibold text-slate-700">{multiSelected.size} selected</span>
          <button
            onClick={() => setMultiSelected(new Set())}
            className="h-7 w-7 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          <div className="flex-1" />
          <div ref={groupDropdownRef} className="relative">
            <button
              onClick={() => setGroupDropdownOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 3h3.2l1 1.2H11V10H1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
              </svg>
              Add to group
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </button>
            {groupDropdownOpen && (
              <div className="absolute bottom-full mb-1 right-0 z-50 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[180px]">
                {groups.length === 0 ? (
                  <div className="px-3 py-2 text-[12px] text-slate-400">No groups yet</div>
                ) : (
                  groups.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => {
                        [...multiSelected].forEach((id) => onAddToGroup(g.id, id));
                        setGroupDropdownOpen(false);
                        setMultiSelected(new Set());
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-[12.5px] text-slate-700 hover:bg-slate-50 text-left"
                    >
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                        <path d="M1 2.8h3.4l1 1.1H10V9H1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                      </svg>
                      {g.name}
                      <span className="text-[10.5px] text-slate-400 ml-auto">{g.clientName}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => {
              [...multiSelected].forEach((id) => onTrash(id));
              setMultiSelected(new Set());
            }}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-rose-200 text-[12.5px] font-semibold text-rose-600 hover:bg-rose-50"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 3h8M5 3V2h2v1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3 3l.5 6.5h5L9 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Move to trash
          </button>
        </div>
      )}
    </main>

    {combinedOpen && (
      <CombinedGenerateModal
        uploads={extracted}
        accent={accent}
        onClose={() => setCombinedOpen(false)}
      />
    )}
    </>
  );
}
