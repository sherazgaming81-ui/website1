import { useState } from 'react';
import type { Client, ProjectStatus } from '../types';
import { apiFetch, isIpAddress } from '../lib/api';
import { X, ShieldCheck, Loader2 } from 'lucide-react';

interface Props {
  client: Client | null;
  onClose: () => void;
  onSaved: (id?: number) => void;
}

export default function ClientModal({ client, onClose, onSaved }: Props) {
  const editing = !!client;
  const [form, setForm] = useState({
    client_name: client?.client_name ?? '',
    project_status: (client?.project_status ?? 'Doing') as ProjectStatus,
    client_description: client?.client_description ?? '',
    ftp_host: client?.ftp_host ?? '',
    ftp_user: client?.ftp_user ?? '',
    ftp_pass: '',
    ftp_port: client?.ftp_port ?? 21,
    remote_path: client?.remote_path ?? '/public_html',
    billing_note: client?.billing_note ?? '',
    next_invoice: client?.next_invoice ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);

  const set = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.client_name.trim()) e.client_name = 'Client name is required';
    if (!form.ftp_host.trim()) e.ftp_host = 'FTP host or server IP is required';
    if (!form.ftp_user.trim()) e.ftp_user = 'FTP username is required';
    if (!editing && !form.ftp_pass.trim()) e.ftp_pass = 'FTP password is required';
    const port = Number(form.ftp_port);
    if (!port || port < 1 || port > 65535) e.ftp_port = 'Port must be 1–65535';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setApiError(null);
    try {
      const payload: Record<string, unknown> = { ...form, next_invoice: form.next_invoice || null };
      if (editing && !form.ftp_pass) delete payload.ftp_pass;
      if (editing) payload.id = client!.id;
      const saved = await apiFetch<Client>('/api/clients', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      onSaved(saved.id);
    } catch (err) {
      setApiError((err as Error).message);
      setSaving(false);
    }
  };

  const field = (label: string, key: keyof typeof form, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</label>
      <input
        value={form[key] as string | number}
        onChange={e => set(key, props.type === 'number' ? Number(e.target.value) : e.target.value)}
        className={`w-full rounded-lg border bg-ink/70 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder-slate-600 focus:ring-1 ${
          errors[key] ? 'border-red-500/60 focus:ring-red-500/40' : 'border-line focus:border-indigox/60 focus:ring-indigox/30'
        }`}
        {...props}
      />
      {errors[key] && <p className="mt-1 text-[11px] text-red-400">{errors[key]}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-line bg-panel shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-100">{editing ? 'Edit Client' : 'Add New Client'}</h2>
            <p className="mono mt-0.5 flex items-center gap-1.5 text-[10px] text-emerald-400">
              <ShieldCheck size={11} /> credentials encrypted with AES-256-CBC before storage
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-500 transition hover:bg-panel-2 hover:text-slate-200"><X size={18} /></button>
        </div>

        <form onSubmit={submit} className="space-y-4 px-6 py-5">
          {apiError && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-300">{apiError}</div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {field('Client Name *', 'client_name', { placeholder: 'Acme Digital Agency' })}
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Project Status</label>
              <select
                value={form.project_status}
                onChange={e => set('project_status', e.target.value)}
                className="w-full rounded-lg border border-line bg-ink/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigox/60 focus:ring-1 focus:ring-indigox/30"
              >
                <option>Doing</option><option>Completed</option><option>On Hold</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Description / Notes</label>
            <textarea
              value={form.client_description}
              onChange={e => set('client_description', e.target.value)}
              rows={2}
              placeholder="Project scope, contacts, CMS details…"
              className="w-full rounded-lg border border-line bg-ink/70 px-3 py-2 text-sm text-slate-100 outline-none placeholder-slate-600 focus:border-indigox/60 focus:ring-1 focus:ring-indigox/30"
            />
          </div>

          <div className="rounded-xl border border-emeraldx/20 bg-emeraldx/5 p-4">
            <p className="mono mb-3 text-[10px] uppercase tracking-widest text-emerald-400">FTP connection · domain or direct server IP supported</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                {field('FTP Host / Server IP *', 'ftp_host', { placeholder: 'ftp.example.com or 185.27.134.11' })}
                {isIpAddress(form.ftp_host) && (
                  <p className="mt-1 text-[11px] text-emerald-400">✓ Direct IP connection — DNS propagation bypass enabled</p>
                )}
              </div>
              {field('FTP Username *', 'ftp_user', { placeholder: 'u123456789' })}
              {field(editing ? 'FTP Password (leave blank to keep)' : 'FTP Password *', 'ftp_pass', { type: 'password', placeholder: '••••••••' })}
              {field('Port', 'ftp_port', { type: 'number', min: 1, max: 65535 })}
              {field('Remote Path', 'remote_path', { placeholder: '/public_html' })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {field('Billing Note', 'billing_note', { placeholder: '$450/mo retainer · Net 15' })}
            {field('Next Invoice Date', 'next_invoice', { type: 'date' })}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-line px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-panel-2">Cancel</button>
            <button
              type="submit"
              disabled={saving}
              className="glow-emerald flex items-center gap-2 rounded-lg bg-gradient-to-r from-emeraldx to-teal-500 px-6 py-2.5 text-sm font-bold text-slate-950 transition hover:brightness-110 disabled:opacity-60"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {editing ? 'Save Changes' : 'Create Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
