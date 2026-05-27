// Sidebar — hierarchical client/database navigation
const { useState } = React;

function ChevronIcon({ open }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      className={"transition-transform duration-200 " + (open ? "rotate-90" : "")}
    >
      <path d="M3 1l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
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
function FolderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M1.8 4.2h4.2l1.2 1.4h7v7.2H1.8z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
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
function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2.5 4h9M5 4V2.6h4V4M3.5 4l.7 8h5.6l.7-8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ScheduleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5.2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7 4v3.2L9 8.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
function HelpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5.4" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5.5 5.6c0-1 .8-1.6 1.6-1.6.9 0 1.6.5 1.6 1.4 0 .8-.7 1.2-1.4 1.5-.4.2-.4.6-.4 1M7 9.5v.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function UploadNavIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 4h3l1 1.2h6V12H2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M7 6v3.4M5.4 7.6L7 6l1.6 1.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Sidebar({ clients, reports, filter, setFilter, accent, page, setPage }) {
  const [openClients, setOpenClients] = useState({ pertamina: true, kai: true });
  const [yourOpen, setYourOpen] = useState(true);

  const isActive = (f) =>
    page !== "upload" &&
    f.kind === filter.kind && f.clientId === filter.clientId && f.dbId === filter.dbId;

  const countAll = reports.length;
  const countFor = (clientId, dbId) =>
    reports.filter(
      (r) => r.clientId === clientId && (dbId ? r.dbId === dbId : true)
    ).length;

  const pillBase =
    "flex items-center gap-2 w-full text-left rounded-lg transition-colors";

  return (
    <aside className="w-[260px] shrink-0 bg-white border-r border-slate-200/70 flex flex-col">
      <div className="px-5 pt-6 pb-3">
        <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400 font-semibold">
          Shared with you
        </div>
        <button
          onClick={() => setFilter({ kind: "shared" })}
          className={pillBase + " mt-2 px-3 py-2 text-[13.5px] " +
            (filter.kind === "shared"
              ? "bg-slate-100 text-slate-900 font-medium"
              : "text-slate-600 hover:bg-slate-50")}
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

        {true && (
          <div className="mt-1">
            {/* Extracted data */}
            <button
              onClick={() => setFilter({ kind: "all" })}
              className={
                pillBase +
                " px-3 py-2 text-[13.5px] mt-1 " +
                (isActive({ kind: "all" }) && page !== "upload"
                  ? "text-white font-medium shadow-sm"
                  : "text-slate-700 hover:bg-slate-50")
              }
              style={
                isActive({ kind: "all" }) && page !== "upload"
                  ? { background: accent }
                  : undefined
              }
            >
              <InboxIcon />
              <span className="flex-1">Extracted data</span>
              <span
                className={
                  "text-[11px] font-semibold px-1.5 py-0.5 rounded " +
                  (isActive({ kind: "all" }) && page !== "upload"
                    ? "bg-white/20"
                    : "bg-slate-100 text-slate-500")
                }
              >
                {countAll}
              </span>
            </button>

            {/* Clients */}
            <div className="mt-3 space-y-0.5">
              {clients.map((client) => {
                const open = !!openClients[client.id];
                return (
                  <div key={client.id}>
                    <div className="flex items-stretch">
                      <button
                        onClick={() =>
                          setOpenClients((s) => ({
                            ...s,
                            [client.id]: !s[client.id],
                          }))
                        }
                        className="px-1.5 py-1.5 text-slate-400 hover:text-slate-600"
                      >
                        <ChevronIcon open={open} />
                      </button>
                      <button
                        onClick={() =>
                          setFilter({ kind: "client", clientId: client.id })
                        }
                        className={
                          "flex-1 flex items-center gap-2 text-left px-2 py-1.5 rounded-lg text-[13px] " +
                          (isActive({ kind: "client", clientId: client.id })
                            ? "text-white font-medium"
                            : "text-slate-700 hover:bg-slate-50 font-medium")
                        }
                        style={
                          isActive({ kind: "client", clientId: client.id })
                            ? { background: accent }
                            : undefined
                        }
                      >
                        <span className="uppercase text-[10px] tracking-wider font-bold w-5 h-5 inline-flex items-center justify-center rounded"
                          style={
                            isActive({ kind: "client", clientId: client.id })
                              ? { background: "rgba(255,255,255,0.18)" }
                              : { background: "#eef0fb", color: accent }
                          }
                        >
                          {client.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                        </span>
                        <span className="flex-1 truncate">{client.name}</span>
                        <span
                          className={
                            "text-[11px] font-semibold " +
                            (isActive({ kind: "client", clientId: client.id })
                              ? "text-white/80"
                              : "text-slate-400")
                          }
                        >
                          {countFor(client.id)}
                        </span>
                      </button>
                    </div>

                    {open && (
                      <div className="ml-7 pl-3 border-l border-slate-200/80 space-y-0.5 mt-0.5 mb-1">
                        {client.databases.map((db) => {
                          const active = isActive({
                            kind: "db",
                            clientId: client.id,
                            dbId: db.id,
                          });
                          return (
                            <button
                              key={db.id}
                              onClick={() =>
                                setFilter({
                                  kind: "db",
                                  clientId: client.id,
                                  dbId: db.id,
                                })
                              }
                              className={
                                "flex items-center gap-2 w-full text-left px-2.5 py-1.5 rounded-md text-[12.5px] transition-colors " +
                                (active
                                  ? "text-white font-medium"
                                  : "text-slate-600 hover:bg-slate-50")
                              }
                              style={active ? { background: accent } : undefined}
                            >
                              <DbIcon />
                              <span className="flex-1 truncate">{db.name}</span>
                              <span
                                className={
                                  "text-[10.5px] font-semibold " +
                                  (active ? "text-white/85" : "text-slate-400")
                                }
                              >
                                {countFor(client.id, db.id)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 space-y-0.5">
              <button
                onClick={() => setPage && setPage("upload")}
                className={
                  pillBase +
                  " px-3 py-2 text-[13.5px] " +
                  (page === "upload"
                    ? "text-white font-medium"
                    : "text-slate-600 hover:bg-slate-50")
                }
                style={page === "upload" ? { background: accent } : undefined}
              >
                <UploadNavIcon /> <span className="flex-1">Upload &amp; extract</span>
                <span
                  className={
                    "text-[11px] font-semibold " +
                    (page === "upload" ? "text-white/85" : "text-slate-400")
                  }
                >
                  5
                </span>
              </button>
              <button className={pillBase + " px-3 py-2 text-[13.5px] text-slate-600 hover:bg-slate-50"}>
                <ScheduleIcon /> <span className="flex-1">Scheduled</span>
                <span className="text-[11px] font-semibold text-slate-400">6</span>
              </button>
              <button className={pillBase + " px-3 py-2 text-[13.5px] text-slate-600 hover:bg-slate-50"}>
                <TrashIcon /> <span className="flex-1">Trash</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="px-5 py-4 border-t border-slate-200/70">
        <button className={pillBase + " px-3 py-2 text-[13px] text-slate-500 hover:bg-slate-50"}>
          <HelpIcon /> <span>Help &amp; shortcuts</span>
        </button>
      </div>
    </aside>
  );
}

window.Sidebar = Sidebar;
