import { useMemo, useState } from 'react';
import type { Client, ProjectStatus } from '../types';
import { Plus, Search, TerminalSquare, Server } from 'lucide-react';
import { isIpAddress } from '../lib/api';

export const STATUS_STYLES: Record<ProjectStatus, string> = {
  Doing: 'bg-indigox/15 text-indigo-300 ring-indigox/40',
  Completed: 'bg-emeraldx/15 text-emerald-300 ring-emeraldx/40',
  'On Hold': 'bg-amber-500/15 text-amber-300 ring-amber-500/40',
};

export const STATUS_DOT: Record<ProjectStatus, string> = {
  Doing: 'bg-indigo-400',
  Completed: 'bg-emerald-400',
  'On Hold': 'bg-amber-400',
};

interface Props {
  open: boolean;
  clients: Client[];
  loading: boolean;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onAdd: () => void;
  onToggle: () => void;
}

export default function Sidebar({ open, clients, loading, selectedId, onSelect, onAdd }: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(c =>
      c.client_name.toLowerCase().includes(q) ||
      c.ftp_host.toLowerCase().includes(q) ||
      c.project_status.toLowerCase().includes(q)
    );
  }, [clients, query]);

  return (
    <aside
      className={`flex h-full flex-col border-r border-line bg-panel/80 backdrop-blur transition-all duration-300 ${
        open ? 'w-72' : 'w-0 overflow-hidden border-r-0'
      }`}
    >
      <div className="flex w-72 shrink-0 items-center gap-3 border-b border-line px-4 py-4">
        <div className="glow-emerald flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emeraldx to-indigox">
          <TerminalSquare size={20} className="text-slate-950" />
        </div>
        <div>
          <h1 className="text-sm font-extrabold tracking-tight text-slate-100">FTP WORKSPACE</h1>
          <p className="mono text-[10px] uppercase tracking-widest text-emerald-400">client &amp; lead manager</p>
        </div>
      </div>

      <div className="w-72 shrink-0 space-y-3 px-4 py-4">
        <button
          onClick={onAdd}
          className="glow-indigo flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigox to-violet-500 px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98]"
        >
          <Plus size={16} strokeWidth={3} /> Add New Client
        </button>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Instant search clients…"
            className="w-full rounded-lg border border-line bg-ink/70 py-2 pl-9 pr-3 text-xs text-slate-200 placeholder-slate-500 outline-none transition focus:border-emeraldx/50 focus:ring-1 focus:ring-emeraldx/30"
          />
        </div>
      </div>

      <div className="w-72 flex-1 overflow-y-auto px-3 pb-4">
        <p className="mono px-2 pb-2 text-[10px] uppercase tracking-widest text-slate-500">
          Saved clients · {filtered.length}
        </p>
        {loading ? (
          <div className="space-y-2 px-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-panel-2/60" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mx-1 rounded-xl border border-dashed border-line p-4 text-center text-xs text-slate-500">
            {query ? 'No clients match your search.' : 'No clients yet. Add your first client to begin.'}
          </div>
        ) : (
          <ul className="space-y-1.5">
            {filtered.map((c, i) => (
              <li key={c.id}>
                <button
                  onClick={() => onSelect(c.id)}
                  className={`group w-full rounded-xl border px-3 py-2.5 text-left transition ${
                    selectedId === c.id
                      ? 'border-emeraldx/40 bg-emeraldx/8 ring-1 ring-emeraldx/25'
                      : 'border-transparent hover:border-line hover:bg-panel-2/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="mono text-[10px] text-slate-500">#{String(i + 1).padStart(2, '0')}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ring-1 ${STATUS_STYLES[c.project_status]}`}>
                      {c.project_status}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-[13px] font-bold text-slate-100">{c.client_name}</p>
                  <p className="mono mt-0.5 flex items-center gap-1.5 truncate text-[10px] text-slate-500">
                    <Server size={10} className={isIpAddress(c.ftp_host) ? 'text-emerald-400' : ''} />
                    {c.ftp_host}:{c.ftp_port}
                    {isIpAddress(c.ftp_host) && <span className="rounded bg-emeraldx/15 px-1 text-[8px] font-bold text-emerald-300">IP</span>}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="w-72 shrink-0 border-t border-line px-4 py-3">
        <p className="mono flex items-center gap-2 text-[10px] text-slate-500">
          <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
          AES-256-CBC vault active
        </p>
      </div>
    </aside>
  );
}
