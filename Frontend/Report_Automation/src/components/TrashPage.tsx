import type { Upload } from './Upload';

interface Props {
  uploads: Upload[];
  onRestore: (id: string) => void;
  onDeletePermanent: (id: string) => void;
  onEmptyTrash: () => void;
  accent: string;
}

export default function TrashPage({ uploads, onRestore, onDeletePermanent, onEmptyTrash, accent }: Props) {
  if (uploads.length === 0) {
    return (
      <main className="flex-1 min-w-0 flex flex-col items-center justify-center bg-[#f7f7fb] text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 inline-flex items-center justify-center mb-4 text-slate-400">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M5 10h22M10 10V7h12v3M7 10l1.4 16h15.2L25 10"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="text-[16px] font-semibold text-slate-600 mb-1">Trash is empty</div>
        <div className="text-[12.5px] text-slate-400">Discarded snapshots will appear here</div>
      </main>
    );
  }

  return (
    <main className="flex-1 min-w-0 flex flex-col bg-[#f7f7fb] overflow-hidden">
      <div className="px-7 py-5 border-b border-slate-200 bg-white flex items-center gap-3 shrink-0">
        <div className="flex-1">
          <h1 className="text-[20px] font-bold text-slate-900 tracking-tight">Trash</h1>
          <div className="text-[12px] text-slate-500 mt-0.5">
            {uploads.length} {uploads.length === 1 ? 'item' : 'items'} · Restore or permanently delete discarded snapshots
          </div>
        </div>
        <button
          onClick={onEmptyTrash}
          className="h-9 px-4 rounded-lg text-[13px] font-semibold text-rose-600 border border-rose-200 bg-white hover:bg-rose-50 transition-colors"
        >
          Empty trash
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="space-y-2">
          {uploads.map((u) => (
            <div
              key={u.id}
              className="group flex items-center gap-3 rounded-xl px-4 py-3 bg-white border border-slate-200 hover:border-slate-300 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg inline-flex items-center justify-center shrink-0 bg-slate-100">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M2.5 5.5h4.6l1.4 1.6h9v9.4H2.5z" stroke="#94a3b8" strokeWidth="1.6" strokeLinejoin="round" />
                </svg>
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-semibold text-slate-500 truncate">{u.name}</div>
                <div className="text-[11.5px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                  <span>{u.clientGuess}</span>
                  <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                  <span>{u.dbGuess}</span>
                  <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                  <span className="text-rose-400 font-medium">Deleted just now</span>
                </div>
              </div>

              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  onClick={() => onRestore(u.id)}
                  className="h-8 px-3 rounded-md text-[12px] font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  style={{ color: accent }}
                >
                  Restore
                </button>
                <button
                  onClick={() => onDeletePermanent(u.id)}
                  className="h-8 px-3 rounded-md text-[12px] font-semibold border border-rose-200 bg-white text-rose-600 hover:bg-rose-50"
                >
                  Delete permanently
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
