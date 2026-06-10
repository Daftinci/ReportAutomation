import { useState, useEffect, useRef } from 'react';
import type { Client } from '../data/appData';
import type { Upload, SectionData } from './Upload';
import * as api from '../api/client';
import { CpuChart, type CpuChartHandle } from './CpuChart';

const CPU_CHUNK_SIZE = 500;

interface Props {
  open: boolean;
  upload: Upload | null;
  accent: string;
  onClose: () => void;
  clients: Client[];
  onSave?: (uploadId: string, sections: Record<string, SectionData>) => void;
}

const TEMPLATES = [
  { id: 'snapshot-std',  label: 'Snapshot · Standard',  desc: 'Summary + key findings + all default sections' },
  { id: 'snapshot-exec', label: 'Snapshot · Executive',  desc: '1-page brief, no tables, exec-level summary' },
  { id: 'snapshot-deep', label: 'Snapshot · Deep dive',  desc: 'All sections including optional appendices' },
];

const REQUIRED_FILES = [
  { name: 'dba_snapshot_*.html',       role: 'Primary snapshot (HTML)',  req: true,  status: 'detected' },
  { name: 'mountpoint.txt',            role: 'Filesystem usage',         req: true,  status: 'detected' },
  { name: 'hostnamectl.txt',           role: 'Server metadata',          req: true,  status: 'detected' },
  { name: 'cpu-count-linux.txt',       role: 'CPU info',                 req: true,  status: 'detected' },
  { name: 'etc-host.txt',              role: 'IP / hostname lookup',     req: false, status: 'optional' },
  { name: '1_status.txt',              role: 'DB status fallback',       req: false, status: 'optional' },
  { name: 'cpu_utils.txt',             role: 'CPU chart data',           req: false, status: 'detected' },
  { name: 'asm_usage.txt',             role: 'ASM disk groups',          req: false, status: 'optional' },
];

const FIELD_ROWS_DEFAULT = [
  { source: 'hostnamectl.txt → hostname',       target: 'serverInfo.hostname',              type: 'String', confidence: 99 },
  { source: 'etc-host.txt → ip lookup',         target: 'serverInfo.ip',                   type: 'String', confidence: 88 },
  { source: 'hostnamectl.txt → OS',             target: 'serverInfo.os',                   type: 'String', confidence: 97 },
  { source: 'hostnamectl.txt → kernel',         target: 'serverInfo.kernel',               type: 'String', confidence: 97 },
  { source: 'cpu-count-linux.txt → count',      target: 'serverInfo.cpus',                 type: 'Number', confidence: 96 },
  { source: 'cpu-count-linux.txt → model',      target: 'serverInfo.systemModel',          type: 'String', confidence: 92 },
  { source: 'memtotal-linux-mb.txt → total',    target: 'serverInfo.totalMemory',          type: 'String', confidence: 98 },
  { source: 'instance_overview → name',         target: 'databaseInfo.instanceName',       type: 'String', confidence: 98 },
  { source: 'database_overview → version',      target: 'databaseInfo.instanceVersion',    type: 'String', confidence: 95 },
  { source: 'database_overview → name',         target: 'databaseInfo.databaseName',       type: 'String', confidence: 99 },
  { source: 'instance_overview → open mode',    target: 'databaseInfo.openMode',           type: 'String', confidence: 97 },
  { source: 'instance_overview → archive',      target: 'databaseInfo.archiveMode',        type: 'String', confidence: 96 },
  { source: 'database_overview → charset',      target: 'databaseInfo.characterSet',       type: 'String', confidence: 94 },
  { source: 'tablespaces (HTML)',               target: 'sections[tablespace].tableRows',  type: 'Array',  confidence: 99 },
  { source: 'rman_backup_jobs (HTML)',          target: 'sections[rman].tableRows',        type: 'Array',  confidence: 97 },
  { source: 'mountpoint.txt',                  target: 'sections[mountpoint].tableRows',  type: 'Array',  confidence: 90 },
  { source: 'current_sessions (HTML)',          target: 'sections[sessions].tableRows',    type: 'Array',  confidence: 93 },
  { source: 'sga_information (HTML)',           target: 'sections[sga].tableRows',         type: 'Array',  confidence: 88 },
  { source: 'cpu_utils.txt',                   target: 'sections[cpu].cpuData',           type: 'Chart',  confidence: 85 },
];

const SECTIONS_DEFAULT = [
  { id: 'cpu',        label: 'CPU Utilization',       source: 'cpu_utils.txt',             type: 'Chart', on: false  },
  { id: 'mountpoint', label: 'Mountpoint Usage',       source: 'mountpoint.txt',            type: 'Table', on: true  },
  { id: 'tablespace', label: 'Tablespace Usage',       source: 'tablespaces',               type: 'Table', on: true  },
  { id: 'rman',       label: 'RMAN Backup Status',     source: 'rman_backup_jobs',          type: 'Table', on: true  },
  { id: 'sessions',   label: 'Session Count',          source: 'current_sessions',          type: 'Table', on: true  },
  { id: 'sessions_matrix',   label: 'User Session Matrix',          source: 'sessions_matrix',          type: 'Table', on: true  },
  { id: 'sga',        label: 'SGA Memory',             source: 'sga_information',           type: 'Table', on: true  },
  { id: 'fileio',     label: 'File I/O Statistics',    source: 'file_io_statistics',        type: 'Table', on: true },
  { id: 'invalid',    label: 'Invalid Objects',        source: 'invalid_objects',           type: 'Table', on: true  },
  { id: 'initparams', label: 'Init Parameters',        source: 'initialization_parameters', type: 'Table', on: true },
  { id: 'datafiles',  label: 'Data Files',             source: 'data_files',                type: 'Table', on: true },
  { id: 'dbgrowth',   label: 'Database Growth',        source: 'database_growth',           type: 'Table', on: true  },
  { id: 'redo',       label: 'Redo Log Switches',      source: 'redo_log_switches',         type: 'Table', on: true },
  { id: 'dataguard',  label: 'DataGuard Status',       source: 'instance_overview',         type: 'Table', on: true  },
  { id: 'parameter_review',  label: 'Parameter Review',       source: 'parameter_review',          type: 'Table', on: true  },
  { id: 'online_redo',       label: 'Online Redo Logs',       source: 'online_redo',               type: 'Table', on: true  },
  { id: 'performance_review', label: 'Performance Review',    source: 'performance_review',        type: 'Table', on: true  },
];

const STEP_DEFS = [
  { id: 'source',     label: 'Source',        n: 1 },
  { id: 'fields',     label: 'Field mapping', n: 2 },
  { id: 'data',       label: 'Data review',   n: 3 },
  { id: 'template',   label: 'Template',      n: 4 },
  { id: 'thresholds', label: 'Thresholds',    n: 5 },
];

function Field({ label, children, help }: { label: string; children: React.ReactNode; help?: string }) {
  return (
    <label className="block">
      <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-1">{label}</div>
      {children}
      {help && <div className="text-[11px] text-slate-400 mt-1">{help}</div>}
    </label>
  );
}

function SelectInput({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 pl-3 pr-8 rounded-lg border border-slate-200 bg-white text-[13px] outline-none focus:border-slate-400 appearance-none">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <svg width="10" height="10" viewBox="0 0 10 10"
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
        <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function TextInput({ value, onChange, placeholder, readOnly }: {
  value: string; onChange: (v: string) => void; placeholder?: string; readOnly?: boolean;
}) {
  return (
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} readOnly={readOnly}
      className={'w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-[13px] outline-none focus:border-slate-400 ' +
        (readOnly ? 'bg-slate-50 text-slate-500 cursor-default' : '')} />
  );
}

function ConfBadge({ pct }: { pct: number }) {
  const color = pct >= 90 ? '#059669' : pct >= 75 ? '#b45309' : '#dc2626';
  const bg    = pct >= 90 ? '#d1fae5' : pct >= 75 ? '#fef3c7' : '#fee2e2';
  return (
    <span className="inline-flex items-center text-[10.5px] font-bold px-1.5 py-[3px] rounded uppercase tracking-wider"
      style={{ color, background: bg }}>{pct}%</span>
  );
}

function Toggle({ on, onChange, accent }: { on: boolean; onChange: (v: boolean) => void; accent: string }) {
  return (
    <button onClick={() => onChange(!on)}
      className={'relative w-9 h-5 rounded-full transition-colors shrink-0 ' + (on ? '' : 'bg-slate-200')}
      style={on ? { background: accent } : undefined}
      aria-pressed={on}>
      <span className={'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ' + (on ? 'left-[18px]' : 'left-0.5')}></span>
    </button>
  );
}

function SliderRow({ label, value, onChange, min, max, color, suffix = '%' }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; color?: string; suffix?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[12.5px] font-semibold text-slate-700">{label}</div>
        <div className="text-[12.5px] font-bold tabular-nums" style={{ color: color ?? '#0f172a' }}>{value}{suffix}</div>
      </div>
      <input type="range" min={min} max={max} value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full" style={{ accentColor: color ?? '#5538ee' }} />
    </div>
  );
}

const PREVIEW_ROWS = 10;

function SectionDataTable({ columns, rows, onChange, onColumnsChange, accent }: {
  columns: string[];
  rows: string[][];
  onChange: (rows: string[][]) => void;
  onColumnsChange?: (cols: string[], rows: string[][]) => void;
  accent: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editingCol, setEditingCol] = useState<number | null>(null);
  const [colDraft, setColDraft] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ columns, rows, onChange });
  stateRef.current = { columns, rows, onChange };

  const isLong = rows.length > PREVIEW_ROWS;
  const visibleRows = isLong && !expanded ? rows.slice(0, PREVIEW_ROWS) : rows;
  const allSelected = visibleRows.length > 0 && visibleRows.every((_, i) => selected.has(i));

  // Paste from Excel — intercept in capture phase so multi-row paste overrides input default
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text/plain') ?? '';
      const lines = text.trim().split('\n').filter((l) => l.trim());
      if (lines.length <= 1) return;
      e.preventDefault();
      const { columns: cols, rows: cur, onChange: oc } = stateRef.current;
      const parsed = lines.map((line) =>
        line.split('\t').map((cell) => cell.replace(/\r$/, '').trim())
      );
      const normalized = parsed.map((r) => {
        const padded = [...r];
        while (padded.length < cols.length) padded.push('');
        return padded.slice(0, cols.length);
      });
      oc([...cur, ...normalized]);
    };
    el.addEventListener('paste', handler, { capture: true });
    return () => el.removeEventListener('paste', handler, { capture: true });
  }, []);

  const updateCell = (ri: number, ci: number, val: string) =>
    onChange(rows.map((r, i) => i === ri ? r.map((c, j) => j === ci ? val : c) : r));

  const addRow = () => onChange([...rows, columns.map(() => '')]);

  const removeRow = (ri: number) => {
    onChange(rows.filter((_, i) => i !== ri));
    setSelected((prev) => {
      const next = new Set<number>();
      prev.forEach((idx) => { if (idx < ri) next.add(idx); else if (idx > ri) next.add(idx - 1); });
      return next;
    });
  };

  const toggleSelect = (ri: number) =>
    setSelected((prev) => { const n = new Set(prev); n.has(ri) ? n.delete(ri) : n.add(ri); return n; });

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(visibleRows.map((_, i) => i)));

  const bulkDelete = () => { onChange(rows.filter((_, i) => !selected.has(i))); setSelected(new Set()); };

  const bulkDuplicate = () => {
    const sorted = [...selected].sort((a, b) => a - b);
    const last = sorted[sorted.length - 1];
    const copies = sorted.map((i) => [...rows[i]]);
    const next = [...rows];
    next.splice(last + 1, 0, ...copies);
    onChange(next);
    const ns = new Set<number>();
    sorted.forEach((_, idx) => ns.add(last + 1 + idx));
    setSelected(ns);
  };

  const startEditCol = (ci: number) => { setEditingCol(ci); setColDraft(columns[ci]); };
  const commitEditCol = () => {
    if (editingCol !== null && colDraft.trim() && onColumnsChange)
      onColumnsChange(columns.map((c, i) => i === editingCol ? colDraft.trim() : c), rows);
    setEditingCol(null); setColDraft('');
  };
  const addColumn = () => {
    if (!onColumnsChange) return;
    onColumnsChange([...columns, `Col ${columns.length + 1}`], rows.map((r) => [...r, '']));
  };
  const removeColumn = (ci: number) => {
    if (!onColumnsChange) return;
    onColumnsChange(columns.filter((_, i) => i !== ci), rows.map((r) => r.filter((_, i) => i !== ci)));
  };

  const hasSelected = selected.size > 0;

  return (
    <div ref={containerRef} className="rounded-lg border border-slate-200 overflow-hidden">
      {/* Selection action bar */}
      {hasSelected && (
        <div className="flex items-center gap-2 px-3 py-2 text-[12px]" style={{ background: '#1e293b' }}>
          <span className="font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>
            {selected.size} row{selected.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex-1" />
          <button onClick={bulkDuplicate}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11.5px] font-semibold transition-colors"
            style={{ color: 'rgba(255,255,255,0.75)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="3.5" y="0.5" width="8" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.2"/>
              <rect x="0.5" y="3.5" width="8" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.2" fill="#1e293b"/>
            </svg>
            Duplicate
          </button>
          <button onClick={bulkDelete}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11.5px] font-semibold transition-colors text-rose-300 hover:text-white hover:bg-rose-600/70">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1.5 3.5h9M4 3.5V2.2h4V3.5M3 3.5l.6 6.3h4.8L9 3.5"
                stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Delete
          </button>
          <button onClick={() => setSelected(new Set())} className="ml-1 transition-colors"
            style={{ color: 'rgba(255,255,255,0.35)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M2 2l7 7M9 2L2 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      )}

      <table className="w-full text-[12px]">
        <thead>
          <tr className="bg-slate-50 text-left text-[10.5px] uppercase tracking-wider text-slate-500 border-b border-slate-100">
            <th className="pl-3 pr-1 py-2 w-7">
              <input type="checkbox" checked={allSelected} onChange={toggleAll}
                className="rounded cursor-pointer" style={{ accentColor: accent }} />
            </th>
            {columns.map((col, ci) => (
              <th key={ci} className="px-3 py-2 font-semibold group/col">
                {editingCol === ci ? (
                  <input
                    autoFocus value={colDraft}
                    onChange={(e) => setColDraft(e.target.value)}
                    onBlur={commitEditCol}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitEditCol();
                      if (e.key === 'Escape') { setEditingCol(null); setColDraft(''); }
                    }}
                    className="w-full h-5 px-1 rounded border border-slate-300 outline-none text-[10.5px] uppercase tracking-wider font-semibold text-slate-700 bg-white min-w-0"
                  />
                ) : (
                  <div className="flex items-center gap-1 min-w-0">
                    <span
                      onClick={() => onColumnsChange && startEditCol(ci)}
                      className={'truncate ' + (onColumnsChange ? 'cursor-pointer hover:text-slate-800' : '')}>
                      {col}
                    </span>
                    {onColumnsChange && (
                      <button onClick={() => removeColumn(ci)} title="Remove column"
                        className="opacity-0 group-hover/col:opacity-100 shrink-0 transition-opacity text-slate-300 hover:text-rose-500">
                        <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                          <path d="M1 1l7 7M8 1L1 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </th>
            ))}
            {onColumnsChange && (
              <th className="px-2 py-2 w-8">
                <button onClick={addColumn} title="Add column"
                  className="text-slate-300 hover:text-slate-600 transition-colors">
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              </th>
            )}
            <th className="px-2 py-2 w-7"></th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row, ri) => {
            const isSelected = selected.has(ri);
            return (
              <tr
                key={ri}
                className={
                  'group transition-colors ' +
                  (isSelected ? 'bg-violet-50/60 ' : ri % 2 ? 'bg-slate-50/40 ' : 'bg-white ')
                }
              >
                <td className="pl-3 pr-1 py-1">
                  <input type="checkbox" checked={isSelected}
                    onChange={() => toggleSelect(ri)}
                    className="rounded cursor-pointer" style={{ accentColor: accent }} />
                </td>
                {row.map((cell, ci) => (
                  <td key={ci} className="px-1 py-1">
                    <input
                      value={cell}
                      onChange={(e) => updateCell(ri, ci, e.target.value)}
                      className="w-full h-7 px-2 rounded border border-transparent hover:border-slate-200 focus:border-slate-300 outline-none font-mono text-[11.5px] text-slate-800 bg-transparent"
                    />
                  </td>
                ))}
                {onColumnsChange && <td />}
                <td className="px-2 py-1">
                  <button onClick={() => removeRow(ri)} title="Remove row"
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-rose-500">
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <path d="M2 4h9M4.5 4V2.6h4V4M3.5 4l.7 7h4.6l.7-7"
                        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length + 2 + (onColumnsChange ? 1 : 0)}
                className="px-3 py-4 text-center text-[12px] text-slate-400 italic">
                No rows — paste from Excel or add a row below
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="px-3 py-2 border-t border-slate-100 flex items-center gap-3 flex-wrap">
        {isLong && (
          <button onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-slate-500 hover:text-slate-700 transition-colors">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none"
              className={'transition-transform ' + (expanded ? 'rotate-180' : '')}>
              <path d="M2 4l3.5 3.5L9 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {expanded ? 'Show less' : `${rows.length - PREVIEW_ROWS} more rows`}
          </button>
        )}
        <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 select-none">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <rect x="1" y="1" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M3.5 4h4M3.5 6h4M3.5 8h2" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
          </svg>
          Paste from Excel (Ctrl+V)
        </div>
        <div className="flex-1" />
        <button onClick={addRow}
          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded text-[12px] font-semibold border border-dashed transition-colors"
          style={{ borderColor: accent + '66', color: accent }}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Add row
        </button>
      </div>
    </div>
  );
}


function CreateTablePanel({ onCreate }: { onCreate: (columns: string[]) => void }) {
  const [colInput, setColInput] = useState('');

  const handleCreate = () => {
    const cols = colInput.split(',').map((c) => c.trim()).filter(Boolean);
    if (cols.length === 0) return;
    onCreate(cols);
    setColInput('');
  };

  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-4 py-4">
      <div className="text-[12px] font-semibold text-slate-600 mb-2">Create table</div>
      <div className="flex items-center gap-2">
        <input
          value={colInput}
          onChange={(e) => setColInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          placeholder="Column names, comma-separated  e.g.  Tablespace, Used %, Free %"
          className="flex-1 h-9 px-3 rounded-lg border border-slate-200 bg-white text-[13px] outline-none focus:border-[#5538ee]"
        />
        <button
          onClick={handleCreate}
          disabled={!colInput.trim()}
          className="h-9 px-4 rounded-lg text-[12.5px] font-semibold text-white disabled:opacity-40"
          style={{ background: '#5538ee' }}
        >
          Create
        </button>
      </div>
      <p className="text-[11px] text-slate-400 mt-1.5">Press Enter or click Create. You can rename columns later by editing cell content.</p>
    </div>
  );
}

function ScreenshotsPanel({ screenshots, onChange }: {
  screenshots: string[];
  onChange: (updated: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = '';
    const results: string[] = new Array(files.length);
    let loaded = 0;
    files.forEach((file, i) => {
      const reader = new FileReader();
      reader.onload = () => {
        results[i] = reader.result as string;
        loaded++;
        if (loaded === files.length) {
          onChange([...screenshots, ...results.filter(Boolean)]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const remove = (idx: number) => onChange(screenshots.filter((_, i) => i !== idx));

  return (
    <div className="mt-3">
      <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-2">Images</div>
      <div className="flex flex-wrap gap-2 items-start">
        {screenshots.map((src, i) => (
          <div key={i} className="relative group w-24 h-24 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 shrink-0">
            <img src={src} alt="" className="w-full h-full object-cover" />
            <button
              onClick={() => remove(i)}
              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-slate-900/60 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              title="Remove"
            >
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                <path d="M1.5 1.5l6 6M7.5 1.5l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ))}
        <button
          onClick={() => inputRef.current?.click()}
          className="w-24 h-24 rounded-lg border-2 border-dashed border-slate-200 bg-white hover:border-slate-300 flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-slate-500 transition-colors shrink-0"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M3 13.5V16.5H17V13.5M10 3V13M6 7L10 3L14 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[11px] font-medium">Add image</span>
        </button>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
      </div>
    </div>
  );
}

function resolveTarget(
  target: string,
  si: Record<string, unknown>,
  di: Record<string, unknown>
): string {
  const [ns, key] = target.split('.');
  if (!key) return '';
  const src = ns === 'serverInfo' ? si : ns === 'databaseInfo' ? di : null;
  const v = src?.[key];
  return v == null ? '' : String(v);
}

export default function EditMappingModal({ open, upload, accent, onClose, clients, onSave }: Props) {
  const initClientId = clients.find((c) => c.name === upload?.clientGuess)?.id ?? (clients[0]?.id ?? '');
  const [client, setClient] = useState(initClientId);
  const [db, setDb]         = useState(() => {
    const c = clients.find((cl) => cl.name === upload?.clientGuess);
    const d = c?.databases.find((d) => d.name === upload?.dbGuess);
    return d?.id ?? (c?.databases[0]?.id ?? '');
  });
  const [template, setTemplate]   = useState('snapshot-std');
  const [format, setFormat]       = useState('DOCX');
  const [delivery, setDelivery]   = useState('dl');
  const [notifyOnComplete, setNotifyOnComplete] = useState(true);
  const [rows, setRows]           = useState(FIELD_ROWS_DEFAULT.map((r) => ({ ...r, value: '' })));
  const [sections, setSections]   = useState(SECTIONS_DEFAULT);
  const [step, setStep]           = useState('source');
  const [sectionData, setSectionData] = useState<Record<string, SectionData>>(
    () => {
      const stored = localStorage.getItem(`sections_${upload?.id}`);
      return stored ? JSON.parse(stored) : (upload?.sections ?? {});
    }
  );

  const cpuChartRefs = useRef<(CpuChartHandle | null)[]>([]);

  const [tsWarn,   setTsWarn]   = useState(85);
  const [tsCrit,   setTsCrit]   = useState(95);
  const [rmanCheck, setRmanCheck] = useState(true);
  const [sessWarn, setSessWarn] = useState(90);
  const [sessCrit, setSessCrit] = useState(95);
  const [mpWarn,   setMpWarn]   = useState(85);
  const [mpCrit,   setMpCrit]   = useState(95);
  const [asmWarn,  setAsmWarn]  = useState(15);
  const [asmCrit,  setAsmCrit]  = useState(5);

  const [cpuExpanded, setCpuExpanded] = useState<Set<number>>(new Set([0]));
  const [cpuSelected, setCpuSelected] = useState<Set<number> | null>(null);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !upload?.id) return;
    const stored = localStorage.getItem(`sections_${upload.id}`);
    const hasLocal = !!stored;
    if (stored) {
      try { setSectionData(JSON.parse(stored)); } catch { setSectionData(upload?.sections ?? {}); }
    } else {
      setSectionData(upload?.sections ?? {});
    }
    setLoading(true);
    api.getReport(upload.id)
      .then((detail) => {
        const cu = (detail.cpu_utils as { columns: string[]; rows: string[][] } | undefined);
        if (!hasLocal) {
          const merged: Record<string, import('./Upload').SectionData> = {};
          if (detail.sections && Object.keys(detail.sections).length > 0) {
            Object.assign(merged, detail.sections);
          }
          if (cu?.rows?.length) {
            merged['cpu'] = { ...(merged['cpu'] ?? { tableColumns: [] as string[], tableRows: [] as string[][] }), cpuData: cu };
          }
          if (Object.keys(merged).length > 0) setSectionData(merged);
        } else if (cu?.rows?.length) {
          setSectionData((prev) => {
            if (prev['cpu']?.cpuData) return prev;
            return {
              ...prev,
              cpu: { ...(prev['cpu'] ?? { tableColumns: [] as string[], tableRows: [] as string[][] }), cpuData: cu },
            };
          });
        }

        // Populate field mapping rows with actual extracted values
        const savedInfo = localStorage.getItem(`info_${upload.id}`);
        if (savedInfo) {
          try {
            const { serverInfo: si, databaseInfo: di } = JSON.parse(savedInfo);
            setRows(FIELD_ROWS_DEFAULT.map((r) => ({
              ...r, value: resolveTarget(r.target, si || {}, di || {}),
            })));
          } catch { /* ignore corrupt data */ }
        } else {
          const si = (detail.server_info || {}) as Record<string, unknown>;
          const di = (detail.database_info || {}) as Record<string, unknown>;
          setRows(FIELD_ROWS_DEFAULT.map((r) => ({
            ...r, value: resolveTarget(r.target, si, di),
          })));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, upload?.id]);

  if (!open || !upload) return null;

  const handleSave = async () => {
    const cpuRawData = sectionData['cpu']?.cpuData;
    let chartImageDataList: string[] | undefined;
    if (cpuRawData?.rows.length) {
      const totalChunks = Math.ceil(cpuRawData.rows.length / CPU_CHUNK_SIZE);
      const exportIndices = cpuSelected
        ? [...cpuSelected].sort((a, b) => a - b)
        : Array.from({ length: totalChunks }, (_, i) => i);
      try {
        const captures = await Promise.all(
          exportIndices.map((ci) => cpuChartRefs.current[ci]?.capture() ?? Promise.resolve(null))
        );
        const valid = captures.filter((c): c is string => !!c);
        if (valid.length) chartImageDataList = valid;
      } catch {
        // chart capture failed — save proceeds without PNG images
      }
    }

    const annotated = Object.fromEntries(
      Object.entries(sectionData).map(([id, sd]) => {
        let contentType: import('./Upload').SectionData['contentType'];
        if (id === 'cpu') {
          contentType = 'image';
          return [id, { ...sd, contentType, ...(chartImageDataList ? { chartImageDataList } : {}) }] as const;
        }
        const hasTable = (sd.tableColumns ?? []).length > 0;
        const hasImages = (sd.screenshots ?? []).length > 0;
        contentType = hasTable && hasImages ? 'table+image'
          : hasImages ? 'image'
          : 'table';
        return [id, { ...sd, contentType }] as const;
      })
    );
    try {
      localStorage.setItem(`sections_${upload.id}`, JSON.stringify(annotated));
    } catch {
      // storage quota exceeded — sections not persisted but save continues
    }

    // Save field mapping overrides to localStorage
    const serverInfo: Record<string, string> = {};
    const databaseInfo: Record<string, string> = {};
    for (const r of rows) {
      if (r.type === 'Array' || r.type === 'Chart') continue;
      const [ns, key] = r.target.split('.');
      if (ns === 'serverInfo' && key) serverInfo[key] = r.value;
      if (ns === 'databaseInfo' && key) databaseInfo[key] = r.value;
    }
    try {
      localStorage.setItem(`info_${upload.id}`, JSON.stringify({ serverInfo, databaseInfo }));
    } catch {
      // storage quota exceeded — field mapping not persisted but save continues
    }

    onSave?.(upload.id, annotated);
    onClose();
  };

  const dbsOfClient = clients.find((c) => c.id === client)?.databases ?? [];

  const toggleSection = (id: string) =>
    setSections((prev) => prev.map((s) => s.id === id ? { ...s, on: !s.on } : s));

  return (
    <div className="fixed inset-0 z-50 flex items-stretch">
      <div onClick={onClose} className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"></div>

      <div className="relative ml-auto w-[960px] max-w-full bg-[#f7f7fb] h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-7 py-5 bg-white border-b border-slate-200 flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg inline-flex items-center justify-center shrink-0"
            style={{ background: accent + '1a', color: accent }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3 17l1.6-4.6 9-9 3 3-9 9zM12 3l3 3" stroke="currentColor" strokeWidth="1.6"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">Edit mapping</div>
            <h2 className="text-[18px] font-bold text-slate-900 truncate">{upload.name}</h2>
            <div className="text-[12px] text-slate-500 mt-0.5">
              Tune how extracted data maps to report fields, sections, and alert thresholds.
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-md inline-flex items-center justify-center text-slate-400 hover:bg-slate-100"
            aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2l-10 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Stepper */}
        <div className="bg-white border-b border-slate-200 px-7 py-3 flex items-center gap-1">
          {STEP_DEFS.map((s, i) => {
            const active = step === s.id;
            return (
              <div key={s.id} className="flex items-center gap-1">
                <button onClick={() => setStep(s.id)}
                  className={'flex items-center gap-2 h-8 px-3 rounded-md text-[12.5px] font-semibold transition-colors ' +
                    (active ? '' : 'text-slate-500 hover:text-slate-700')}
                  style={active ? { background: accent + '12', color: accent } : undefined}>
                  <span className={'w-5 h-5 rounded-full inline-flex items-center justify-center text-[10.5px] font-bold ' +
                    (active ? 'text-white' : 'bg-slate-100 text-slate-500')}
                    style={active ? { background: accent } : undefined}>
                    {s.n}
                  </span>
                  {s.label}
                </button>
                {i < STEP_DEFS.length - 1 && <span className="w-4 h-px bg-slate-200"></span>}
              </div>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-7 py-6 space-y-5">

          {step === 'source' && (
            <>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="text-[14px] font-bold text-slate-900 mb-1">Source identification</div>
                <div className="text-[12px] text-slate-500 mb-4">
                  Auto-detected from the uploaded folder. Override if the parser misclassified client or database.
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Client">
                    <SelectInput value={client}
                      onChange={(v) => { setClient(v); const d = clients.find((c) => c.id === v); if (d) setDb(d.databases[0].id); }}
                      options={clients.map((c) => ({ value: c.id, label: c.name }))} />
                  </Field>
                  <Field label="Database">
                    <SelectInput value={db} onChange={setDb}
                      options={dbsOfClient.map((d) => ({ value: d.id, label: d.name }))} />
                  </Field>
                  <Field label="Snapshot folder" help="Read-only — from upload name">
                    <TextInput value={upload.name} onChange={() => {}} readOnly />
                  </Field>
                  <Field label="Output filename">
                    <TextInput value={upload.name} onChange={() => {}} placeholder="e.g. merudb_snapshot_May2026" />
                  </Field>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="text-[14px] font-bold text-slate-900 mb-3">Required source files</div>
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  {REQUIRED_FILES.map((f, i) => (
                    <div key={i} className={
                      'flex items-center gap-3 px-3 py-2.5 text-[12.5px] border-b border-slate-100 last:border-0 ' +
                      (i % 2 ? 'bg-slate-50/60' : 'bg-white')
                    }>
                      <span className="font-mono text-slate-700 w-52 truncate">{f.name}</span>
                      <span className="flex-1 text-slate-500">{f.role}</span>
                      <span className={
                        'text-[10.5px] font-bold px-2 py-[3px] rounded-full ' +
                        (f.status === 'detected' ? '' : 'text-slate-400 bg-slate-100')
                      }
                        style={f.status === 'detected' ? { color: '#059669', background: '#d1fae5' } : undefined}>
                        {f.status === 'detected' ? '✓ detected' : 'ℹ optional'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 'fields' && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-[14px] font-bold text-slate-900">Field mapping</div>
                  <div className="text-[12px] text-slate-500">
                    Oracle snapshot source → report variable. Low-confidence rows may need review.
                  </div>
                </div>
                <button className="h-8 px-3 rounded-md text-[12px] font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
                  + Add field
                </button>
              </div>
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="text-left text-[10.5px] uppercase tracking-wider text-slate-500 bg-slate-50">
                      <th className="px-3 py-2 font-semibold">Source</th>
                      <th className="px-3 py-2 font-semibold text-slate-300">→</th>
                      <th className="px-3 py-2 font-semibold">Report variable</th>
                      <th className="px-3 py-2 font-semibold">Extracted value</th>
                      <th className="px-3 py-2 font-semibold">Type</th>
                      <th className="px-3 py-2 font-semibold">Conf.</th>
                      <th className="px-3 py-2 font-semibold w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className={i % 2 ? 'bg-slate-50/40' : 'bg-white'}>
                        <td className="px-3 py-1.5 font-mono text-[11.5px] text-slate-600 max-w-[200px] truncate">{r.source}</td>
                        <td className="px-3 py-1.5 text-slate-300 text-[11px]">→</td>
                        <td className="px-3 py-1.5">
                          <span className="font-mono text-[11.5px] text-slate-600">{r.target}</span>
                        </td>
                        <td className="px-3 py-1.5 min-w-[140px]">
                          {r.type === 'Array' || r.type === 'Chart' ? (
                            <span className="text-[11px] text-slate-400 italic">see Data Review</span>
                          ) : (
                            <input
                              value={r.value}
                              onChange={(e) => { const n = [...rows]; n[i] = { ...r, value: e.target.value }; setRows(n); }}
                              className="w-full h-7 px-2 rounded border border-transparent hover:border-slate-200 focus:border-slate-300 outline-none text-[12px] text-slate-800 bg-transparent"
                              placeholder="—"
                            />
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-slate-500 text-[11.5px] whitespace-nowrap">{r.type}</td>
                        <td className="px-3 py-1.5"><ConfBadge pct={r.confidence} /></td>
                        <td className="px-3 py-1.5 text-slate-300">
                          <button onClick={() => setRows(rows.filter((_, j) => j !== i))}
                            className="hover:text-rose-500" title="Remove">
                            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                              <path d="M2 4h9M4.5 4V2.6h4V4M3.5 4l.7 7h4.6l.7-7"
                                stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
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
                Saved mappings are reused on future extractions for{' '}
                <b>{clients.find((c) => c.id === client)?.name} · {dbsOfClient.find((d) => d.id === db)?.name}</b>.
              </div>
            </div>
          )}

          {step === 'data' && (
            <div className="space-y-5">
              <div className="text-[12px] text-slate-500 bg-white border border-slate-200 rounded-xl px-5 py-3">
                Review and correct the data extracted from the Oracle snapshot. Changes here flow directly into the generated report.
                Only sections that are toggled <b>on</b> in the Template step are shown.
              </div>
              {loading && (
                <div className="text-[12.5px] text-slate-500 text-center py-6 flex items-center justify-center gap-2">
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
                    <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Loading extracted data…
                </div>
              )}
              {sections.filter((s) => s.on).map((s) => {
                const sd = sectionData?.[s.id];
                return (
                  <div key={s.id} className="bg-white border border-slate-200 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="text-[14px] font-bold text-slate-900">{s.label}</div>
                      <span className="text-[10.5px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{s.source}</span>
                    </div>
                    {s.id === 'cpu' ? (
                      sd?.cpuData && sd.cpuData.rows.length > 0 ? (() => {
                        const chunks: string[][][] = [];
                        for (let i = 0; i < sd.cpuData!.rows.length; i += CPU_CHUNK_SIZE)
                          chunks.push(sd.cpuData!.rows.slice(i, i + CPU_CHUNK_SIZE));
                        const totalRows = sd.cpuData!.rows.length;
                        const allSelected = cpuSelected === null || cpuSelected.size === chunks.length;

                        const toggleSelect = (ci: number) => {
                          setCpuSelected((prev) => {
                            const base = prev ?? new Set(chunks.map((_, i) => i));
                            const next = new Set(base);
                            next.has(ci) ? next.delete(ci) : next.add(ci);
                            return next.size === chunks.length ? null : next;
                          });
                        };
                        const isSelected = (ci: number) => cpuSelected === null || cpuSelected.has(ci);
                        const toggleExpand = (ci: number) =>
                          setCpuExpanded((prev) => {
                            const next = new Set(prev);
                            next.has(ci) ? next.delete(ci) : next.add(ci);
                            return next;
                          });

                        return (
                          <div className="flex flex-col gap-2">
                            {chunks.length > 1 && (
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px] text-slate-500">
                                  {chunks.length} blocks · {totalRows} rows total
                                </span>
                                <button
                                  type="button"
                                  className="text-[11px] text-indigo-600 hover:underline"
                                  onClick={() => setCpuSelected(allSelected ? new Set() : null)}
                                >
                                  {allSelected ? 'Deselect all' : 'Select all'}
                                </button>
                              </div>
                            )}
                            {chunks.map((chunkRows, ci) => {
                              const expanded = cpuExpanded.has(ci);
                              const selected = isSelected(ci);
                              const rowStart = ci * CPU_CHUNK_SIZE + 1;
                              const rowEnd = Math.min((ci + 1) * CPU_CHUNK_SIZE, totalRows);
                              return (
                                <div key={ci} className="border border-slate-200 rounded-xl overflow-hidden">
                                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 select-none">
                                    <input
                                      type="checkbox"
                                      checked={selected}
                                      onChange={() => toggleSelect(ci)}
                                      title="Include in export"
                                      className="accent-indigo-600 cursor-pointer"
                                    />
                                    <button
                                      type="button"
                                      className="flex flex-1 items-center gap-1.5 text-left"
                                      onClick={() => toggleExpand(ci)}
                                    >
                                      <span className="text-[12px] font-semibold text-slate-700">
                                        Block {ci + 1}
                                        {chunks.length > 1 && (
                                          <span className="font-normal text-slate-400 ml-1.5">
                                            rows {rowStart}–{rowEnd}
                                          </span>
                                        )}
                                      </span>
                                      <svg
                                        className={`ml-auto w-3.5 h-3.5 text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
                                        viewBox="0 0 16 16" fill="none"
                                      >
                                        <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                      </svg>
                                    </button>
                                  </div>
                                  {expanded && (
                                    <div className="p-3 border-t border-slate-200">
                                      <SectionDataTable
                                        columns={sd.cpuData!.columns}
                                        rows={chunkRows}
                                        onChange={(updatedRows) => {
                                          const newRows = [...sd.cpuData!.rows];
                                          newRows.splice(ci * CPU_CHUNK_SIZE, CPU_CHUNK_SIZE, ...updatedRows);
                                          setSectionData((prev) => ({
                                            ...prev,
                                            cpu: {
                                              ...(prev.cpu ?? { tableColumns: [] as string[], tableRows: [] as string[][] }),
                                              cpuData: { columns: sd.cpuData!.columns, rows: newRows },
                                            },
                                          }));
                                        }}
                                        accent={accent}
                                      />
                                    </div>
                                  )}
                                  <div style={expanded ? { padding: '0 12px 12px' } : { position: 'fixed', left: '-9999px', top: 0, width: '550px', pointerEvents: 'none' }}>
                                    <CpuChart
                                      ref={(el) => { cpuChartRefs.current[ci] = el; }}
                                      cpuData={{ columns: sd.cpuData!.columns, rows: chunkRows }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })() : (
                        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-4 py-4 text-[12.5px] text-slate-500">
                          No CPU utilization data found. Include a <span className="font-mono text-slate-700">cpu_utils.txt</span> file in the snapshot folder.
                        </div>
                      )
                    ) : sd && sd.tableColumns.length > 0 ? (
                      <SectionDataTable
                        columns={sd.tableColumns}
                        rows={sd.tableRows}
                        onChange={(rows) =>
                          setSectionData((prev) => ({ ...prev, [s.id]: { ...sd, tableRows: rows } }))
                        }
                        onColumnsChange={(cols, newRows) =>
                          setSectionData((prev) => ({ ...prev, [s.id]: { ...sd, tableColumns: cols, tableRows: newRows } }))
                        }
                        accent={accent}
                      />
                    ) : (
                      <CreateTablePanel
                        onCreate={(columns) =>
                          setSectionData((prev) => ({
                            ...prev,
                            [s.id]: {
                              tableColumns: columns,
                              tableRows: [columns.map(() => '')],
                              screenshots: prev[s.id]?.screenshots ?? [],
                            },
                          }))
                        }
                      />
                    )}
                    <ScreenshotsPanel
                      screenshots={sd?.screenshots ?? []}
                      onChange={(screenshots) =>
                        setSectionData((prev) => ({
                          ...prev,
                          [s.id]: prev[s.id]
                            ? { ...prev[s.id], screenshots }
                            : { tableColumns: [], tableRows: [], screenshots },
                        }))
                      }
                    />
                  </div>
                );
              })}
            </div>
          )}

          {step === 'template' && (
            <>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="text-[14px] font-bold text-slate-900 mb-3">Report template</div>
                <div className="grid grid-cols-3 gap-3">
                  {TEMPLATES.map((t) => {
                    const on = template === t.id;
                    return (
                      <button key={t.id} onClick={() => setTemplate(t.id)}
                        className={'text-left rounded-xl border p-4 transition-colors ' + (on ? '' : 'border-slate-200 bg-white hover:border-slate-300')}
                        style={on ? { borderColor: accent, background: accent + '0d' } : undefined}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center"
                            style={{ borderColor: on ? accent : '#cbd5e1' }}>
                            {on && <div className="w-2 h-2 rounded-full" style={{ background: accent }}></div>}
                          </div>
                          <div className="text-[13px] font-bold text-slate-900">{t.label}</div>
                        </div>
                        <div className="text-[11.5px] text-slate-500">{t.desc}</div>
                        <div className="mt-3 rounded bg-slate-50 border border-slate-100 p-2 flex flex-col gap-1">
                          <div className="h-1.5 rounded w-3/4" style={{ background: on ? accent + '55' : '#e2e8f0' }}></div>
                          <div className="h-1 rounded bg-slate-200 w-full"></div>
                          <div className="h-1 rounded bg-slate-200 w-5/6"></div>
                          <div className="grid grid-cols-2 gap-1 mt-1">
                            <div className="h-3 rounded-sm" style={{ background: on ? accent + '22' : '#e2e8f0' }}></div>
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
                <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                  {sections.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 py-1.5">
                      <Toggle on={s.on} onChange={() => toggleSection(s.id)} accent={accent} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-slate-800">{s.label}</div>
                        <div className="text-[10.5px] text-slate-400 font-mono truncate">
                          {s.source} · {s.type}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="text-[14px] font-bold text-slate-900 mb-3">Output</div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Format">
                    <SelectInput value={format} onChange={setFormat} options={[
                      { value: 'DOCX', label: 'DOCX only' },
                      { value: 'PDF',  label: 'PDF only' },
                      { value: 'BOTH', label: 'PDF + DOCX' },
                    ]} />
                  </Field>
                  <Field label="Delivery">
                    <SelectInput value={delivery} onChange={setDelivery} options={[
                      { value: 'dl',   label: 'Download only' },
                      { value: 'mail', label: 'Email to client contacts' },
                      { value: 'both', label: 'Download + email' },
                    ]} />
                  </Field>
                </div>
                <div className="flex items-center gap-3 mt-4">
                  <Toggle on={notifyOnComplete} onChange={setNotifyOnComplete} accent={accent} />
                  <div className="text-[13px] text-slate-700">Notify me when generation completes</div>
                </div>
              </div>
            </>
          )}

          {step === 'thresholds' && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-[14px] font-bold text-slate-900 mb-1">Alert thresholds</div>
              <div className="text-[12px] text-slate-500 mb-5">
                These match the <span className="font-mono text-slate-600">analyze_database</span> checks in the backend.
                Red callouts appear in the report when thresholds are breached.
              </div>

              <div className="space-y-6">
                {/* 1. Tablespace */}
                <div className="rounded-lg border border-slate-200 p-4 space-y-3">
                  <div className="text-[13px] font-bold text-slate-800">1 · Tablespace used %</div>
                  <SliderRow label="Warning" value={tsWarn} onChange={setTsWarn} min={50} max={100} color={accent} />
                  <SliderRow label="Critical" value={tsCrit} onChange={setTsCrit} min={80} max={100} color="#dc2626" />
                  <div className="text-[11.5px] text-slate-400">
                    Triggers when any tablespace <b>used %</b> exceeds warning / critical level.
                  </div>
                </div>

                {/* 2. RMAN */}
                <div className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Toggle on={rmanCheck} onChange={setRmanCheck} accent={accent} />
                    <div className="text-[13px] font-bold text-slate-800">2 · RMAN backup status ≠ COMPLETED</div>
                  </div>
                  <div className="text-[11.5px] text-slate-400">
                    Always flags as <span className="text-red-500 font-semibold">critical</span> when any backup job did not complete successfully.
                    Disable only if RMAN is not in use.
                  </div>
                </div>

                {/* 3. Session utilization */}
                <div className="rounded-lg border border-slate-200 p-4 space-y-3">
                  <div className="text-[13px] font-bold text-slate-800">3 · Session utilization %</div>
                  <SliderRow label="Warning" value={sessWarn} onChange={setSessWarn} min={50} max={100} color={accent} />
                  <SliderRow label="Critical" value={sessCrit} onChange={setSessCrit} min={80} max={100} color="#dc2626" />
                  <div className="text-[11.5px] text-slate-400">
                    Compares current sessions against <b>max sessions</b> from <span className="font-mono">v$parameter</span>.
                  </div>
                </div>

                {/* 4. Mountpoint */}
                <div className="rounded-lg border border-slate-200 p-4 space-y-3">
                  <div className="text-[13px] font-bold text-slate-800">4 · Mountpoint used %</div>
                  <SliderRow label="Warning" value={mpWarn} onChange={setMpWarn} min={50} max={100} color={accent} />
                  <SliderRow label="Critical" value={mpCrit} onChange={setMpCrit} min={80} max={100} color="#dc2626" />
                  <div className="text-[11.5px] text-slate-400">
                    Parsed from <span className="font-mono">mountpoint.txt</span> or <span className="font-mono">total_mountpoint.txt</span>.
                  </div>
                </div>

                {/* 5. ASM free */}
                <div className="rounded-lg border border-slate-200 p-4 space-y-3">
                  <div className="text-[13px] font-bold text-slate-800">5 · ASM disk group free %</div>
                  <SliderRow label="Warning (below)" value={asmWarn} onChange={setAsmWarn} min={0} max={50} color={accent} />
                  <SliderRow label="Critical (below)" value={asmCrit} onChange={setAsmCrit} min={0} max={30} color="#dc2626" />
                  <div className="text-[11.5px] text-slate-400">
                    Flags when ASM free % falls <b>below</b> warning / critical. Parsed from{' '}
                    <span className="font-mono">asm_usage.txt</span>. Skipped if file absent.
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-lg p-3 text-[11.5px] flex items-start gap-2" style={{ background: accent + '10' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 mt-0.5" style={{ color: accent }}>
                  <circle cx="7" cy="7" r="5.6" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M7 4.5v3M7 9.2v.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                <span className="text-slate-700">
                  Thresholds apply to <b style={{ color: accent }}>this client / database pair</b> and are reused on future reports.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-7 py-4 bg-white border-t border-slate-200 flex items-center gap-2">
          <button onClick={onClose}
            className="h-9 px-4 rounded-lg text-[13px] font-semibold text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <div className="flex-1"></div>
          <div className="text-[11.5px] text-slate-400 mr-3 hidden sm:block">
            Auto-saved as draft · {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <button onClick={handleSave}
            className="h-9 px-4 rounded-lg text-[13px] font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
            Save mapping
          </button>
          <button onClick={handleSave}
            className="h-9 px-4 rounded-lg text-[13px] font-bold text-white inline-flex items-center gap-1.5"
            style={{ background: accent }}>
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
