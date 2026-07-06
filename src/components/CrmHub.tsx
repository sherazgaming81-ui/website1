import { useEffect, useState } from 'react';
import type { Client, ProjectStatus } from '../types';
import { apiFetch, isIpAddress } from '../lib/api';
import { STATUS_STYLES, STATUS_DOT } from './Sidebar';
import {
  Pencil, Trash2, Eye, EyeOff, Server, User, KeyRound, FolderOpen,
  CalendarClock, Receipt, StickyNote, Loader2, Plug, Download, Plus, Copy, Check,
} from 'lucide-react';

interface Props {
  client: Client | null;
  clients: Client[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  onEdit: (c: Client) => void;
  onAdd: () => void;
}

export default function CrmHub({ client, clients, loading, onRefresh, onEdit, onAdd }: Props) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testLog, setTestLog] = useState<string[] | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => { setRevealed(null); setTestLog(null); setTestError(null); }, [client?.id]);

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <div className="h-32 animate-pulse rounded-2xl bg-panel/80" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-64 animate-pulse rounded-2xl bg-panel/80" />
          <div className="h-64 animate-pulse rounded-2xl bg-panel/80" />
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <div className="glow-indigo mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigox to-violet-600">
          <Server size={28} className="text-white" />
        </div>
        <h2 className="text-lg font-extrabold text-slate-100">No client selected</h2>
        <p className="mt-1 max-w-sm text-sm text-slate-400">Add your first client to start managing FTP connections, leads and billing from one workspace.</p>
        <button onClick={onAdd} className="glow-emerald mt-5 flex items-center gap-2 rounded-xl bg-gradient-to-r from-emeraldx to-teal-500 px-6 py-2.5 text-sm font-bold text-slate-950 transition hover:brightness-110">
          <Plus size={16} strokeWidth={3} /> Add New Client
        </button>
      </div>
    );
  }

  const revealPassword = async () => {
    if (revealed) { setRevealed(null); return; }
    setRevealing(true);
    try {
      const { password } = await apiFetch<{ password: string }>(`/api/clients?id=${client.id}&reveal=1`);
      setRevealed(password);
    } catch (err) {
      setTestError((err as Error).message);
    } finally {
      setRevealing(false);
    }
  };

  const copyPassword = async () => {
    if (!revealed) return;
    await navigator.clipboard.writeText(revealed).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const testConnection = async () => {
    setTesting(true); setTestLog(null); setTestError(null);
    try {
      const r = await apiFetch<{ log: string[] }>('/api/ftp', {
        method: 'POST',
        body: JSON.stringify({ action: 'test', clientId: client.id }),
      });
      setTestLog(r.log);
    } catch (err) {
      setTestError((err as Error).message);
    } finally {
      setTesting(false);
    }
  };

  const changeStatus = async (status: ProjectStatus) => {
    setStatusSaving(true);
    try {
      await apiFetch('/api/clients', { method: 'PUT', body: JSON.stringify({ id: client.id, project_status: status }) });
      await onRefresh();
    } catch (err) {
      setTestError((err as Error).message);
    } finally {
      setStatusSaving(false);
    }
  };

  const deleteClient = async () => {
    if (!confirm(`Delete "${client.client_name}" and all remote file records? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await apiFetch('/api/clients', { method: 'DELETE', body: JSON.stringify({ id: client.id }) });
      await onRefresh();
    } catch (err) {
      setTestError((err as Error).message);
      setDeleting(false);
    }
  };

  const exportCsv = () => {
    const headers = ['id', 'client_name', 'project_status', 'client_description', 'ftp_host', 'ftp_user', 'ftp_port', 'remote_path', 'billing_note', 'next_invoice', 'created_at'];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [headers.join(','), ...clients.map(c => headers.map(h => esc((c as unknown as Record<string, unknown>)[h])).join(','))];
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `client-leads-backup-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const ipMode = isIpAddress(client.ftp_host);

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      {/* Header card */}
      <div className="rounded-2xl border border-line bg-panel/80 p-5 backdrop-blur sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="truncate text-xl font-extrabold tracking-tight text-slate-50 sm:text-2xl">{client.client_name}</h2>
              <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ${STATUS_STYLES[client.project_status]}`}>
                <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${STATUS_DOT[client.project_status]}`} />
                {client.project_status}
              </span>
            </div>
            <p className="mono mt-1.5 text-[11px] text-slate-500">
              Client record #{client.id} · added {new Date(client.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={exportCsv} title="Download all client leads as CSV backup" className="flex items-center gap-2 rounded-lg border border-emeraldx/40 bg-emeraldx/10 px-3.5 py-2 text-xs font-bold text-emerald-300 transition hover:bg-emeraldx/20">
              <Download size={13} /> Export CSV
            </button>
            <button onClick={() => onEdit(client)} className="flex items-center gap-2 rounded-lg border border-line px-3.5 py-2 text-xs font-bold text-slate-300 transition hover:border-indigox/50 hover:text-indigo-300">
              <Pencil size={13} /> Edit
            </button>
            <button onClick={deleteClient} disabled={deleting} className="flex items-center gap-2 rounded-lg border border-red-500/30 px-3.5 py-2 text-xs font-bold text-red-400 transition hover:bg-red-500/10 disabled:opacity-50">
              {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Delete
            </button>
          </div>
        </div>

        {/* quick status switcher */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Set status:</span>
          {(['Doing', 'Completed', 'On Hold'] as ProjectStatus[]).map(s => (
            <button
              key={s}
              disabled={statusSaving || s === client.project_status}
              onClick={() => changeStatus(s)}
              className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase ring-1 transition disabled:cursor-default ${
                s === client.project_status ? STATUS_STYLES[s] : 'text-slate-500 ring-line hover:text-slate-300 hover:ring-slate-500'
              }`}
            >{s}</button>
          ))}
          {statusSaving && <Loader2 size={12} className="animate-spin text-slate-400" />}
        </div>
      </div>

      {testError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">{testError}</div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Server metadata */}
        <div className="rounded-2xl border border-line bg-panel/80 p-5 backdrop-blur">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-100"><Server size={15} className="text-emerald-400" /> Server Metadata</h3>
            <button onClick={testConnection} disabled={testing} className="flex items-center gap-1.5 rounded-lg bg-indigox/15 px-3 py-1.5 text-[11px] font-bold text-indigo-300 ring-1 ring-indigox/40 transition hover:bg-indigox/25 disabled:opacity-50">
              {testing ? <Loader2 size={12} className="animate-spin" /> : <Plug size={12} />} Test Connection
            </button>
          </div>
          <dl className="space-y-3 text-sm">
            <Row icon={<Server size={13} />} label="Host">
              <span className="mono">{client.ftp_host}</span>
              {ipMode && <span className="ml-2 rounded bg-emeraldx/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">DIRECT IP</span>}
            </Row>
            <Row icon={<Plug size={13} />} label="Port"><span className="mono">{client.ftp_port}</span></Row>
            <Row icon={<User size={13} />} label="Username"><span className="mono">{client.ftp_user}</span></Row>
            <Row icon={<KeyRound size={13} />} label="Password">
              <span className="mono">{revealed ?? client.ftp_pass_masked}</span>
              <button onClick={revealPassword} disabled={revealing} className="ml-2 text-slate-500 transition hover:text-emerald-400" title={revealed ? 'Hide' : 'Decrypt & reveal'}>
                {revealing ? <Loader2 size={13} className="animate-spin" /> : revealed ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
              {revealed && (
                <button onClick={copyPassword} className="ml-1.5 text-slate-500 transition hover:text-emerald-400" title="Copy">
                  {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                </button>
              )}
            </Row>
            <Row icon={<FolderOpen size={13} />} label="Remote path"><span className="mono">{client.remote_path}</span></Row>
          </dl>

          {testLog && (
            <div className="mono mt-4 space-y-1 rounded-lg border border-emeraldx/25 bg-ink/80 p-3 text-[11px] text-emerald-300">
              {testLog.map((l, i) => <p key={i}>{l}</p>)}
              <p className="font-bold text-emerald-400">✓ Connection healthy · passive mode · credentials decrypted OK</p>
            </div>
          )}
        </div>

        {/* Notes + billing */}
        <div className="space-y-5">
          <div className="rounded-2xl border border-line bg-panel/80 p-5 backdrop-blur">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-slate-100"><StickyNote size={15} className="text-indigo-400" /> Project Notes</h3>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
              {client.client_description || <span className="italic text-slate-500">No notes yet — click Edit to add project details.</span>}
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-panel/80 p-5 backdrop-blur">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-slate-100"><Receipt size={15} className="text-amber-400" /> Billing Reminder</h3>
            <div className="space-y-2.5 text-sm">
              <p className="text-slate-300">{client.billing_note || <span className="italic text-slate-500">No billing note set.</span>}</p>
              {client.next_invoice && (
                <p className="flex items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300">
                  <CalendarClock size={13} />
                  Next invoice: {new Date(client.next_invoice + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' })}
                  {(() => {
                    const days = Math.ceil((new Date(client.next_invoice!).getTime() - Date.now()) / 86400000);
                    return <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${days < 0 ? 'bg-red-500/20 text-red-300' : days <= 7 ? 'bg-amber-500/20 text-amber-200' : 'bg-emeraldx/15 text-emerald-300'}`}>{days < 0 ? `${-days}d overdue` : days === 0 ? 'due today' : `in ${days}d`}</span>;
                  })()}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-line/60 pb-2.5 last:border-0 last:pb-0">
      <dt className="flex w-28 shrink-0 items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">{icon}{label}</dt>
      <dd className="flex min-w-0 flex-1 items-center truncate text-[13px] text-slate-200">{children}</dd>
    </div>
  );
}
