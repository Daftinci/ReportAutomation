import { useState, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

export const CPU_COLORS = ['#d44444', '#1b9aaa', '#f59e0b', '#8b5cf6', '#22c55e'];

export async function svgToPng(svg: SVGElement): Promise<string | null> {
  const rect = svg.getBoundingClientRect();
  const w = rect.width || 550;
  const h = rect.height || 240;
  const scale = 2;
  const serialized = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

export interface CpuChartHandle { capture: () => Promise<string | null>; }

export const CpuChart = forwardRef<CpuChartHandle, {
  cpuData: { columns: string[]; rows: string[][] };
  hideControls?: boolean;
}>(function CpuChart({ cpuData, hideControls }, ref) {
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const [yMin, setYMin] = useState(0);
  const [yMax, setYMax] = useState(100);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    async capture(): Promise<string | null> {
      const svg = containerRef.current?.querySelector('svg');
      if (!svg) return null;
      return svgToPng(svg as SVGElement);
    },
  }));

  const cols = cpuData.columns;
  const rows = cpuData.rows;
  if (!rows.length || !cols.length) return null;

  const findCol = (pat: RegExp) => cols.findIndex((c) => pat.test(c));
  const lIdx  = Math.max(0, findCol(/begin|snap/i));
  const mIdx  = findCol(/max/i);
  const aIdx  = findCol(/avg/i);
  const iIdx  = findCol(/instance/i);
  const toNum = (v: string) => { const n = parseFloat(v); return isNaN(n) ? null : n; };

  const instances = iIdx >= 0
    ? [...new Set(rows.map((r) => r[iIdx]).filter(Boolean))]
    : [];

  type ChartRow = Record<string, string | number | null>;
  let chartData: ChartRow[];
  let series: { key: string; label: string; color: string }[];

  if (instances.length > 1) {
    const map = new Map<string, ChartRow>();
    rows.forEach((r) => {
      const label = (r[lIdx] || '').slice(0, 16);
      if (!map.has(label)) map.set(label, { label });
      const inst = r[iIdx] || 'Unknown';
      if (mIdx >= 0) map.get(label)![`${inst}_max`] = toNum(r[mIdx]);
    });
    chartData = [...map.values()];
    series = instances.map((inst, i) => ({
      key: `${inst}_max`, label: `${inst} Max%`, color: CPU_COLORS[i % CPU_COLORS.length],
    }));
  } else {
    chartData = rows.map((r, i) => ({
      label: (r[lIdx] || String(i)).slice(0, 16),
      ...(mIdx >= 0 ? { max: toNum(r[mIdx]) } : {}),
      ...(aIdx >= 0 ? { avg: toNum(r[aIdx]) } : {}),
    }));
    series = [
      ...(mIdx >= 0 ? [{ key: 'max', label: 'Max CPU%', color: '#d44444' }] : []),
      ...(aIdx >= 0 ? [{ key: 'avg', label: 'Avg CPU%', color: '#1b9aaa' }] : []),
    ];
  }

  const visible = series.filter((s) => !hidden.has(s.key));
  const tickInterval = Math.max(1, Math.floor(chartData.length / 10));
  const yDomain: [number, number] = [yMin, yMax > yMin ? yMax : yMin + 1];

  const toggleSeries = (key: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const axisProps = {
    data: chartData,
    margin: { top: 4, right: 16, bottom: 44, left: 0 } as const,
  };
  const xAxis = (
    <XAxis dataKey="label" tick={{ fontSize: 9 }} angle={-40} textAnchor="end" interval={tickInterval} />
  );
  const yAxis = <YAxis domain={yDomain} tick={{ fontSize: 9 }} unit="%" width={38} />;
  const grid  = <CartesianGrid strokeDasharray="3 3" stroke="#e8f1f5" />;
  const tip   = <Tooltip formatter={(v) => `${v}%`} />;

  return (
    <div ref={containerRef} className="mt-3 rounded-lg border border-slate-200 bg-white p-4">
      {!hideControls && (
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mr-1">Chart preview</span>

          <div className="flex rounded-md border border-slate-200 overflow-hidden text-[11px] shrink-0">
            {(['line', 'bar'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setChartType(t)}
                className={'px-2.5 py-1 font-semibold transition-colors ' +
                  (chartType === t ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50')}
              >
                {t === 'line' ? 'Line' : 'Bar'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 shrink-0">
            <span className="font-semibold">Y</span>
            <input
              type="number"
              value={yMin}
              onChange={(e) => setYMin(Number(e.target.value))}
              className="w-14 h-6 px-1.5 rounded border border-slate-200 text-center text-[11px] outline-none focus:border-slate-400 bg-slate-50"
            />
            <span>–</span>
            <input
              type="number"
              value={yMax}
              onChange={(e) => setYMax(Number(e.target.value))}
              className="w-14 h-6 px-1.5 rounded border border-slate-200 text-center text-[11px] outline-none focus:border-slate-400 bg-slate-50"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {series.map((s) => {
              const on = !hidden.has(s.key);
              return (
                <button
                  key={s.key}
                  onClick={() => toggleSeries(s.key)}
                  className={'flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-colors ' +
                    (on ? 'border-transparent text-white' : 'border-slate-200 text-slate-400 bg-white')}
                  style={on ? { background: s.color } : undefined}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: on ? 'rgba(255,255,255,0.7)' : s.color }} />
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <ResponsiveContainer width="100%" height={240}>
        {chartType === 'line' ? (
          <LineChart {...axisProps}>
            {grid}{xAxis}{yAxis}{tip}
            {visible.map((s) => (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.label}
                stroke={s.color} strokeWidth={1.5} dot={false} connectNulls />
            ))}
          </LineChart>
        ) : (
          <BarChart {...axisProps} barCategoryGap="30%">
            {grid}{xAxis}{yAxis}{tip}
            {visible.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} maxBarSize={20} radius={[2, 2, 0, 0]} />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
});
