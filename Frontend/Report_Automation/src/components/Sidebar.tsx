import { useState } from 'react';
import type { Client } from '../data/appData';
import type { Upload } from './Upload';

export interface Group {
  id: string;
  name: string;
  clientName: string;
  extractionIds: string[];
}

export interface Filter {
  kind: 'all' | 'shared' | 'client' | 'db' | 'group';
  clientId?: string;
  dbId?: string;
  groupId?: string;
}

interface Props {
  clients: Client[];
  uploads: Upload[];
  trashedCount: number;
  filter: Filter;
  setFilter: (f: Filter) => void;
  accent: string;
  page: string;
  setPage: (p: string) => void;
  groups: Group[];
  onCreateGroup: (name: string, clientName: string) => void;
  onDeleteGroup: (id: string) => void;
  onRenameGroup: (id: string, name: string) => void;
  isAdmin?: boolean;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10"
      className={'transition-transform duration-200 ' + (open ? 'rotate-90' : '')}>
      <path d="M3 1l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 3h12v7H2zM2 9.5h3l1 1.5h4l1-1.5h3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function DbIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <ellipse cx="7" cy="3" rx="4.6" ry="1.6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2.4 3v8c0 .9 2 1.6 4.6 1.6S11.6 11.9 11.6 11V3" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2.4 7c0 .9 2 1.6 4.6 1.6S11.6 7.9 11.6 7" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function FolderIcon({ filled }: { filled?: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="shrink-0">
      <path d="M1.5 3h3.2l1 1.2H11.5v6.8H1.5z"
        stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"
        fill={filled ? 'currentColor' : 'none'} fillOpacity={filled ? 0.15 : 0} />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2.5 4h9M5 4V2.6h4V4M3.5 4l.7 8h5.6l.7-8"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="5.5" cy="4.5" r="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1 12c0-2 2-3.5 4.5-3.5S10 10 10 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M10.5 5.5c1 0 2 .8 2 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M10.5 3.5a1.5 1.5 0 1 1 0 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5.4" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5.5 5.6c0-1 .8-1.6 1.6-1.6.9 0 1.6.5 1.6 1.4 0 .8-.7 1.2-1.4 1.5-.4.2-.4.6-.4 1M7 9.5v.4"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function UploadNavIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 4h3l1 1.2h6V12H2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M7 6v3.4M5.4 7.6L7 6l1.6 1.6" stroke="currentColor" strokeWidth="1.3"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Sidebar({
  clients, uploads, trashedCount, filter, setFilter, accent, page, setPage,
  groups, onCreateGroup, onDeleteGroup, onRenameGroup, isAdmin,
}: Props) {
  const [openClients, setOpenClients] = useState<Record<string, boolean>>({});
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  // key = client.name, value = true when the inline create input is showing for that client
  const [creatingGroupForClient, setCreatingGroupForClient] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const isActive = (f: Filter) =>
    page !== 'upload' && page !== 'trash' &&
    f.kind === filter.kind &&
    f.clientId === filter.clientId &&
    f.dbId === filter.dbId &&
    f.groupId === filter.groupId;

  const countAll = uploads.filter((u) => u.status === 'extracted').length;
  const countFor = (clientId: string, dbId?: string) => {
    const client = clients.find((c) => c.id === clientId);
    const db = dbId ? client?.databases.find((d) => d.id === dbId) : undefined;
    return uploads.filter(
      (u) =>
        u.status === 'extracted' &&
        u.clientGuess === client?.name &&
        (dbId ? u.dbGuess === db?.name : true)
    ).length;
  };

  const countForGroup = (g: Group) =>
    uploads.filter((u) => u.status === 'extracted' && g.extractionIds.includes(u.id)).length;

  const activeUploads = uploads.filter((u) => u.status === 'queued' || u.status === 'extracting').length;

  const pillBase = 'flex items-center gap-2 w-full text-left rounded-lg transition-colors';

  const commitCreate = (clientName: string) => {
    if (newGroupName.trim()) onCreateGroup(newGroupName.trim(), clientName);
    setCreatingGroupForClient(null);
    setNewGroupName('');
  };

  return (
    <aside className="w-[260px] shrink-0 bg-white border-r border-slate-200/70 flex flex-col h-full">
      <div className="px-5 pt-6 pb-3">
        <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400 font-semibold">
          Shared with you
        </div>
        <button
          onClick={() => setFilter({ kind: 'shared' })}
          className={pillBase + ' mt-2 px-3 py-2 text-[13.5px] ' +
            (filter.kind === 'shared' && page !== 'upload' && page !== 'trash'
              ? 'bg-slate-100 text-slate-900 font-medium'
              : 'text-slate-600 hover:bg-slate-50')}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }}></span>
          <span className="flex-1">Cross-team reports</span>
          <ChevronIcon open={false} />
        </button>
      </div>

      <div className="px-5 pt-2 pb-4 flex-1 overflow-y-auto">
        <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400 font-semibold mb-2">
          Your reports
        </div>

        <div className="mt-1">
          <button
            onClick={() => setFilter({ kind: 'all' })}
            className={
              pillBase + ' px-3 py-2 text-[13.5px] mt-1 ' +
              (isActive({ kind: 'all' })
                ? 'text-white font-medium shadow-sm'
                : 'text-slate-700 hover:bg-slate-50')
            }
            style={isActive({ kind: 'all' }) ? { background: accent } : undefined}
          >
            <InboxIcon />
            <span className="flex-1">Extracted data</span>
            <span className={
              'text-[11px] font-semibold px-1.5 py-0.5 rounded ' +
              (isActive({ kind: 'all' }) ? 'bg-white/20' : 'bg-slate-100 text-slate-500')
            }>
              {countAll}
            </span>
          </button>

          <div className="mt-3 space-y-0.5">
            {clients.map((client) => {
              const open = !!openClients[client.id];
              const clientGroups = groups.filter((g) => g.clientName === client.name);
              return (
                <div key={client.id}>
                  <div className="flex items-stretch">
                    <button
                      onClick={() => setOpenClients((s) => ({ ...s, [client.id]: !s[client.id] }))}
                      className="px-1.5 py-1.5 text-slate-400 hover:text-slate-600"
                    >
                      <ChevronIcon open={open} />
                    </button>
                    <button
                      onClick={() => setFilter({ kind: 'client', clientId: client.id })}
                      className={
                        'flex-1 flex items-center gap-2 text-left px-2 py-1.5 rounded-lg text-[13px] ' +
                        (isActive({ kind: 'client', clientId: client.id })
                          ? 'text-white font-medium'
                          : 'text-slate-700 hover:bg-slate-50 font-medium')
                      }
                      style={isActive({ kind: 'client', clientId: client.id }) ? { background: accent } : undefined}
                    >
                      <span
                        className="uppercase text-[10px] tracking-wider font-bold w-5 h-5 inline-flex items-center justify-center rounded"
                        style={
                          isActive({ kind: 'client', clientId: client.id })
                            ? { background: 'rgba(255,255,255,0.18)' }
                            : { background: '#eef0fb', color: accent }
                        }
                      >
                        {client.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}
                      </span>
                      <span className="flex-1 truncate">{client.name}</span>
                      <span className={
                        'text-[11px] font-semibold ' +
                        (isActive({ kind: 'client', clientId: client.id }) ? 'text-white/80' : 'text-slate-400')
                      }>
                        {countFor(client.id)}
                      </span>
                    </button>
                  </div>

                  {open && (
                    <div className="ml-7 pl-3 border-l border-slate-200/80 space-y-0.5 mt-0.5 mb-1">
                      {/* Ungrouped DB rows — only DBs with no extractions in any group */}
                      {(() => {
                        const groupedIds = new Set(clientGroups.flatMap((g) => g.extractionIds));
                        return client.databases.filter((db) =>
                          uploads.some(
                            (u) => u.status === 'extracted' &&
                              u.clientGuess === client.name &&
                              u.dbGuess === db.name &&
                              !groupedIds.has(u.id)
                          )
                        ).map((db) => {
                          const active = isActive({ kind: 'db', clientId: client.id, dbId: db.id });
                          return (
                            <button
                              key={db.id}
                              onClick={() => setFilter({ kind: 'db', clientId: client.id, dbId: db.id })}
                              className={
                                'flex items-center gap-2 w-full text-left px-2.5 py-1.5 rounded-md text-[12.5px] transition-colors ' +
                                (active ? 'text-white font-medium' : 'text-slate-600 hover:bg-slate-50')
                              }
                              style={active ? { background: accent } : undefined}
                            >
                              <DbIcon />
                              <span className="flex-1 truncate">{db.name}</span>
                              <span className={'text-[10.5px] font-semibold ' + (active ? 'text-white/85' : 'text-slate-400')}>
                                {countFor(client.id, db.id)}
                              </span>
                            </button>
                          );
                        });
                      })()}

                      {/* Groups — expandable, show member DBs inside */}
                      {clientGroups.map((g) => {
                        const active = isActive({ kind: 'group', groupId: g.id });
                        const count = countForGroup(g);
                        const groupOpen = !!openGroups[g.id];
                        const memberUploads = uploads.filter(
                          (u) => u.status === 'extracted' && g.extractionIds.includes(u.id)
                        );
                        return (
                          <div key={g.id}>
                            <div className="group/grp flex items-center gap-0.5">
                              <button
                                onClick={() => setOpenGroups((s) => ({ ...s, [g.id]: !s[g.id] }))}
                                className="px-1 py-1.5 text-slate-400 hover:text-slate-600 shrink-0"
                              >
                                <ChevronIcon open={groupOpen} />
                              </button>
                              {renamingId === g.id ? (
                                <input
                                  autoFocus
                                  value={renameValue}
                                  onChange={(e) => setRenameValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      if (renameValue.trim()) onRenameGroup(g.id, renameValue.trim());
                                      setRenamingId(null);
                                    }
                                    if (e.key === 'Escape') setRenamingId(null);
                                  }}
                                  onBlur={() => {
                                    if (renameValue.trim()) onRenameGroup(g.id, renameValue.trim());
                                    setRenamingId(null);
                                  }}
                                  className="flex-1 h-7 px-2 rounded-md border border-slate-300 text-[12px] outline-none focus:border-[#5538ee] bg-white min-w-0"
                                />
                              ) : (
                                <>
                                  <button
                                    onClick={() => setFilter({ kind: 'group', groupId: g.id })}
                                    className={
                                      'flex-1 flex items-center gap-1.5 text-left px-1.5 py-1.5 rounded-md text-[12.5px] min-w-0 transition-colors ' +
                                      (active ? 'text-white font-medium' : 'text-slate-600 hover:bg-slate-50')
                                    }
                                    style={active ? { background: accent } : undefined}
                                  >
                                    <FolderIcon filled={active} />
                                    <span className="flex-1 truncate">{g.name}</span>
                                    <span className={'text-[10.5px] font-semibold shrink-0 ' + (active ? 'text-white/80' : 'text-slate-400')}>
                                      {count}
                                    </span>
                                  </button>
                                  <div className="flex items-center gap-0.5 opacity-0 group-hover/grp:opacity-100 transition-opacity shrink-0">
                                    <button
                                      onClick={() => { setRenamingId(g.id); setRenameValue(g.name); }}
                                      className="w-5 h-5 inline-flex items-center justify-center rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                                      title="Rename"
                                    >
                                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                        <path d="M1.5 8.5l.8-2.4L7.5 1l1.5 1.5-5.2 5.2z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                                      </svg>
                                    </button>
                                    <button
                                      onClick={() => onDeleteGroup(g.id)}
                                      className="w-5 h-5 inline-flex items-center justify-center rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50"
                                      title="Delete group"
                                    >
                                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                        <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                                      </svg>
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>

                            {/* Member DBs nested under the group */}
                            {groupOpen && memberUploads.length > 0 && (
                              <div className="ml-5 pl-3 border-l border-slate-200/60 space-y-0.5 mt-0.5 mb-0.5">
                                {memberUploads.map((u) => {
                                  const dbId = client.databases.find((d) => d.name === u.dbGuess)?.id ?? u.dbGuess;
                                  const active = isActive({ kind: 'db', clientId: client.id, dbId });
                                  return (
                                    <button
                                      key={u.id}
                                      onClick={() => setFilter({ kind: 'db', clientId: client.id, dbId })}
                                      className={
                                        'flex items-center gap-2 w-full text-left px-2 py-1 rounded-md text-[12px] transition-colors ' +
                                        (active ? 'text-white font-medium' : 'text-slate-500 hover:bg-slate-50')
                                      }
                                      style={active ? { background: accent } : undefined}
                                    >
                                      <DbIcon />
                                      <span className="flex-1 truncate">{u.dbGuess || u.name}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Inline create group input */}
                      {creatingGroupForClient === client.name ? (
                        <input
                          autoFocus
                          value={newGroupName}
                          onChange={(e) => setNewGroupName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitCreate(client.name);
                            if (e.key === 'Escape') { setCreatingGroupForClient(null); setNewGroupName(''); }
                          }}
                          onBlur={() => commitCreate(client.name)}
                          placeholder="Group name…"
                          className="w-full h-7 px-2 rounded-md border border-slate-300 text-[12px] outline-none focus:border-[#5538ee] bg-white"
                        />
                      ) : (
                        <button
                          onClick={() => { setCreatingGroupForClient(client.name); setNewGroupName(''); }}
                          className="flex items-center gap-1.5 w-full px-2 py-1 text-[11.5px] text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-md transition-colors"
                        >
                          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                            <path d="M4.5 1v7M1 4.5h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                          New group
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 space-y-0.5">
            <button
              onClick={() => setPage('upload')}
              className={
                pillBase + ' px-3 py-2 text-[13.5px] ' +
                (page === 'upload' ? 'text-white font-medium' : 'text-slate-600 hover:bg-slate-50')
              }
              style={page === 'upload' ? { background: accent } : undefined}
            >
              <UploadNavIcon />
              <span className="flex-1">Upload &amp; extract</span>
              {activeUploads > 0 && (
                <span className={'text-[11px] font-semibold ' + (page === 'upload' ? 'text-white/85' : 'text-slate-400')}>
                  {activeUploads}
                </span>
              )}
            </button>
            <button
              onClick={() => setPage('trash')}
              className={
                pillBase + ' px-3 py-2 text-[13.5px] ' +
                (page === 'trash' ? 'text-white font-medium' : 'text-slate-600 hover:bg-slate-50')
              }
              style={page === 'trash' ? { background: accent } : undefined}
            >
              <TrashIcon />
              <span className="flex-1">Trash</span>
              {trashedCount > 0 && (
                <span className={'text-[11px] font-semibold ' + (page === 'trash' ? 'text-white/85' : 'text-slate-400')}>
                  {trashedCount}
                </span>
              )}
            </button>
            {isAdmin && (
              <button
                onClick={() => setPage('users')}
                className={
                  pillBase + ' px-3 py-2 text-[13.5px] ' +
                  (page === 'users' ? 'text-white font-medium' : 'text-slate-600 hover:bg-slate-50')
                }
                style={page === 'users' ? { background: accent } : undefined}
              >
                <UsersIcon />
                <span className="flex-1">User management</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-5 py-4 border-t border-slate-200/70">
        <button className={pillBase + ' px-3 py-2 text-[13px] text-slate-500 hover:bg-slate-50'}>
          <HelpIcon /> <span>Help &amp; shortcuts</span>
        </button>
      </div>
    </aside>
  );
}
