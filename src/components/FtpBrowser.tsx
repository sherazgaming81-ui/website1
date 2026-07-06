import { useCallback, useEffect, useState } from 'react';
import type { Client, RemoteEntry, StagingFile } from '../types';
import { apiFetch, formatBytes, isIpAddress } from '../lib/api';
import {
  Folder, File, FileCode, FileImage, FileArchive, FileText, Trash2, ArrowLeft,
  FolderPlus, UploadCloud, Loader2, HardDrive, Globe, RefreshCw, ChevronRight, MoveRight,
} from 'lucide-react';

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['php', 'js', 'ts', 'html', 'css', 'json', 'sql'].includes(ext)) return <FileCode size={17} className="text-indigo-400" />;
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext)) return <FileImage size={17} className="text-emerald-400" />;
  if (['zip', 'tar', 'gz', 'rar'].includes(ext)) return <FileArchive size={17} className="text-amber-400" />;
  if (['txt', 'md', 'log', 'htaccess'].includes(ext)) return <FileText size={17} className="text-slate-400" />;
  return <File size={17} className="text-slate-400" />;
}

interface Props { client: Client | null; }

export default function FtpBrowser({ client }: Props) {
  // remote pane state
  const [path, setPath] = useState('/');
  const [entries, setEntries] = useState<RemoteEntry[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  // staging pane state
  const [staging, setStaging] = useState<StagingFile[]>([]);
  const [stagingLoading, setStagingLoading] = useState(true);
  // ui state
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dropRemote, setDropRemote] = useState(false);
  const [dropStaging, setDropStaging] = useState(false);
  const [mkdirOpen, setMkdirOpen] = useState(false);
  const [mkdirName, setMkdirName] = useState('');

  const loadRemote = useCallback(async (p: string) => {
    if (!client) return;
    setRemoteLoading(true); setError(null);
    try {
      const r = await apiFetch<{ entries: RemoteEntry[] }>(`/api/ftp?clientId=${client.id}&path=${encodeURIComponent(p)}`);
      setEntries(r.entries);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRemoteLoading(false);
    }
  }, [client]);

  const loadStaging = useCallback(async () => {
    try {
      const data = await apiFetch<StagingFile[]>('/api/staging');
      setStaging(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setStagingLoading(false);
    }
  }, []);

  useEffect(() => { setPath('/'); if (client) loadRemote('/'); }, [client, loadRemote]);
  useEffect(() => { loadStaging(); }, [loadStaging]);

  if (!client) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <Globe size={40} className="mb-3 text-slate-600" />
        <h2 className="text-lg font-extrabold text-slate-100">No remote host connected</h2>
        <p className="mt-1 max-w-sm text-sm text-slate-400">Select or create a client in the sidebar to open its remote directory tree.</p>
      </div>
    );
  }

  const navigate = (p: string) => { setPath(p); loadRemote(p); };
  const enterDir = (name: string) => navigate(path === '/' ? '/' + name : path + '/' + name);
  const goUp = () => {
    if (path === '/') return;
    const parts = path.split('/').filter(Boolean);
    parts.pop();
    navigate(parts.length ? '/' + parts.join('/') : '/');
  };

  const crumbs = path.split('/').filter(Boolean);

  const deleteRemote = async (entry: RemoteEntry) => {
    if (!confirm(`Delete ${entry.is_dir ? 'directory' : 'file'} "${entry.name}" from the remote host?`)) return;
    setBusy(`del-${entry.id}`);
    try {
      await apiFetch('/api/ftp', {
        method: 'POST',
        body: JSON.stringify({ action: 'delete', clientId: client.id, path, name: entry.name, isDir: entry.is_dir }),
      });
      await loadRemote(path);
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(null); }
  };

  const deleteStaging = async (f: StagingFile) => {
    setBusy(`stg-${f.id}`);
    try {
      await apiFetch('/api/staging', { method: 'DELETE', body: JSON.stringify({ id: f.id }) });
      await loadStaging();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(null); }
  };

  const makeDir = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = mkdirName.trim();
    if (!name) return;
    setBusy('mkdir');
    try {
      await apiFetch('/api/ftp', {
        method: 'POST',
        body: JSON.stringify({ action: 'mkdir', clientId: client.id, path, name }),
      });
      setMkdirName(''); setMkdirOpen(false);
      await loadRemote(path);
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(null); }
  };

  // push a staging file to the remote host (ftp_put)
  const uploadToRemote = async (files: { name: string; size: number }[]) => {
    if (!files.length) return;
    setBusy('upload');
    try {
      await apiFetch('/api/ftp', {
        method: 'POST',
        body: JSON.stringify({ action: 'upload', clientId: client.id, path, files }),
      });
      await loadRemote(path);
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(null); }
  };

  // add local OS files to virtual staging
  const addToStaging = async (fileList: FileList) => {
    const files = Array.from(fileList).map(f => ({ name: f.name, size: f.size, kind: f.type || 'file' }));
    if (!files.length) return;
    setBusy('stage');
    try {
      await apiFetch('/api/staging', { method: 'POST', body: JSON.stringify({ files }) });
      await loadStaging();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(null); }
  };

  /* ---- drag & drop handlers ---- */
  const onRemoteDrop = async (e: React.DragEvent) => {
    e.preventDefault(); setDropRemote(false);
    // dragged from staging pane
    const payload = e.dataTransfer.getData('application/x-staging-file');
    if (payload) {
      const f = JSON.parse(payload) as StagingFile;
      await uploadToRemote([{ name: f.name, size: f.size }]);
      return;
    }
    // dragged from OS → upload directly to remote
    if (e.dataTransfer.files.length) {
      await uploadToRemote(Array.from(e.dataTransfer.files).map(f => ({ name: f.name, size: f.size })));
    }
  };

  const onStagingDrop = async (e: React.DragEvent) => {
    e.preventDefault(); setDropStaging(false);
    if (e.dataTransfer.files.length) await addToStaging(e.dataTransfer.files);
  };

  return (
    <div className="flex h-full flex-col p-3 sm:p-5">
      {/* connection strip */}
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-panel/80 px-4 py-2.5 backdrop-blur">
        <span className="flex items-center gap-2 text-xs font-bold text-slate-200">
          <span className="pulse-dot h-2 w-2 rounded-full bg-emerald-400" />
          {client.client_name}
        </span>
        <span className="mono text-[11px] text-slate-500">
          ftps://{client.ftp_user}@{client.ftp_host}:{client.ftp_port}{client.remote_path}
        </span>
        {isIpAddress(client.ftp_host) && <span className="rounded bg-emeraldx/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">DIRECT IP</span>}
        <span className="ml-auto rounded-full bg-indigox/15 px-2.5 py-1 text-[10px] font-bold text-indigo-300 ring-1 ring-indigox/40">PASSIVE MODE</span>
      </div>

      {error && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-300">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold hover:text-red-100">✕</button>
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
        {/* LEFT — Virtual Staging */}
        <section
          onDragOver={e => { e.preventDefault(); setDropStaging(true); }}
          onDragLeave={() => setDropStaging(false)}
          onDrop={onStagingDrop}
          className={`flex min-h-[320px] flex-col overflow-hidden rounded-2xl border border-line bg-panel/70 backdrop-blur transition ${dropStaging ? 'drop-active' : ''}`}
        >
          <header className="flex items-center gap-2 border-b border-line px-4 py-3">
            <HardDrive size={15} className="text-emerald-400" />
            <h3 className="text-[13px] font-extrabold text-slate-100">Virtual Staging Files</h3>
            <label className="ml-auto flex cursor-pointer items-center gap-1.5 rounded-lg bg-emeraldx/15 px-2.5 py-1.5 text-[10px] font-bold text-emerald-300 ring-1 ring-emeraldx/40 transition hover:bg-emeraldx/25">
              <UploadCloud size={12} /> Add files
              <input type="file" multiple className="hidden" onChange={e => e.target.files && addToStaging(e.target.files)} />
            </label>
          </header>
          <p className="border-b border-line/60 px-4 py-1.5 text-[10px] text-slate-500">
            Drop files here, then drag them onto the remote pane to deploy →
          </p>
          <div className="flex-1 overflow-y-auto p-2">
            {stagingLoading ? (
              <PaneLoader />
            ) : staging.length === 0 ? (
              <EmptyPane text="Staging area is empty. Drop files from your computer here." />
            ) : (
              <ul className="space-y-1">
                {staging.map(f => (
                  <li
                    key={f.id}
                    draggable
                    onDragStart={e => e.dataTransfer.setData('application/x-staging-file', JSON.stringify(f))}
                    className="group flex cursor-grab items-center gap-3 rounded-lg px-3 py-2 transition hover:bg-panel-2/70 active:cursor-grabbing"
                  >
                    {fileIcon(f.name)}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-slate-200">{f.name}</p>
                      <p className="mono text-[10px] text-slate-500">{formatBytes(f.size)}</p>
                    </div>
                    <button
                      onClick={() => uploadToRemote([{ name: f.name, size: f.size }])}
                      title="Deploy to remote (current folder)"
                      className="rounded-md p-1.5 text-slate-500 opacity-0 transition hover:bg-indigox/20 hover:text-indigo-300 group-hover:opacity-100"
                    ><MoveRight size={14} /></button>
                    <button
                      onClick={() => deleteStaging(f)}
                      title="Remove from staging"
                      className="rounded-md p-1.5 text-slate-500 opacity-0 transition hover:bg-red-500/20 hover:text-red-400 group-hover:opacity-100"
                    >
                      {busy === `stg-${f.id}` ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* RIGHT — Remote host */}
        <section
          onDragOver={e => { e.preventDefault(); setDropRemote(true); }}
          onDragLeave={() => setDropRemote(false)}
          onDrop={onRemoteDrop}
          className={`flex min-h-[320px] flex-col overflow-hidden rounded-2xl border border-line bg-panel/70 backdrop-blur transition ${dropRemote ? 'drop-active' : ''}`}
        >
          <header className="flex items-center gap-2 border-b border-line px-4 py-3">
            <Globe size={15} className="text-indigo-400" />
            <h3 className="text-[13px] font-extrabold text-slate-100">Remote Host Directory</h3>
            <div className="ml-auto flex items-center gap-1.5">
              <button onClick={() => setMkdirOpen(o => !o)} title="New folder" className="rounded-lg bg-indigox/15 p-1.5 text-indigo-300 ring-1 ring-indigox/40 transition hover:bg-indigox/25"><FolderPlus size={13} /></button>
              <button onClick={() => loadRemote(path)} title="Refresh (ftp_nlist)" className="rounded-lg border border-line p-1.5 text-slate-400 transition hover:text-slate-200"><RefreshCw size={13} className={remoteLoading ? 'animate-spin' : ''} /></button>
            </div>
          </header>

          {/* breadcrumbs */}
          <div className="flex items-center gap-1 overflow-x-auto border-b border-line/60 px-3 py-1.5">
            <button onClick={goUp} disabled={path === '/'} title="Up one level (..)" className="rounded-md p-1 text-slate-400 transition hover:bg-panel-2 hover:text-slate-100 disabled:opacity-30"><ArrowLeft size={13} /></button>
            <button onClick={() => navigate('/')} className="mono rounded px-1.5 py-0.5 text-[11px] text-slate-400 hover:text-emerald-300">root</button>
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                <ChevronRight size={11} className="text-slate-600" />
                <button
                  onClick={() => navigate('/' + crumbs.slice(0, i + 1).join('/'))}
                  className={`mono rounded px-1.5 py-0.5 text-[11px] ${i === crumbs.length - 1 ? 'font-bold text-emerald-300' : 'text-slate-400 hover:text-emerald-300'}`}
                >{c}</button>
              </span>
            ))}
            {busy === 'upload' && <span className="mono ml-auto flex items-center gap-1 text-[10px] text-indigo-300"><Loader2 size={11} className="animate-spin" /> ftp_put…</span>}
          </div>

          {mkdirOpen && (
            <form onSubmit={makeDir} className="flex items-center gap-2 border-b border-line/60 bg-ink/40 px-3 py-2">
              <FolderPlus size={13} className="text-indigo-400" />
              <input
                autoFocus
                value={mkdirName}
                onChange={e => setMkdirName(e.target.value)}
                placeholder="new-directory-name"
                className="mono flex-1 rounded-md border border-line bg-ink/70 px-2.5 py-1.5 text-[12px] text-slate-200 outline-none focus:border-indigox/60"
              />
              <button type="submit" disabled={busy === 'mkdir' || !mkdirName.trim()} className="rounded-md bg-indigox px-3 py-1.5 text-[11px] font-bold text-white transition hover:brightness-110 disabled:opacity-50">
                {busy === 'mkdir' ? <Loader2 size={12} className="animate-spin" /> : 'mkdir'}
              </button>
            </form>
          )}

          <div className="flex-1 overflow-y-auto p-2">
            {remoteLoading ? (
              <PaneLoader />
            ) : entries.length === 0 ? (
              <EmptyPane text="Directory is empty. Drag staging files here to upload, or create a folder." />
            ) : (
              <ul className="space-y-1">
                {entries.map(en => (
                  <li
                    key={en.id}
                    onClick={() => en.is_dir && enterDir(en.name)}
                    className={`group flex items-center gap-3 rounded-lg px-3 py-2 transition hover:bg-panel-2/70 ${en.is_dir ? 'cursor-pointer' : ''}`}
                  >
                    {en.is_dir ? <Folder size={17} className="fill-indigo-400/20 text-indigo-400" /> : fileIcon(en.name)}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-slate-200">{en.name}</p>
                      <p className="mono text-[10px] text-slate-500">{en.is_dir ? 'directory' : formatBytes(en.size)}</p>
                    </div>
                    {en.is_dir && <ChevronRight size={14} className="text-slate-600 opacity-0 transition group-hover:opacity-100" />}
                    <button
                      onClick={e => { e.stopPropagation(); deleteRemote(en); }}
                      title="Delete on remote (ftp_delete)"
                      className="rounded-md p-1.5 text-slate-500 opacity-0 transition hover:bg-red-500/20 hover:text-red-400 group-hover:opacity-100"
                    >
                      {busy === `del-${en.id}` ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function PaneLoader() {
  return (
    <div className="space-y-2 p-2">
      {[...Array(5)].map((_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-panel-2/60" />)}
    </div>
  );
}

function EmptyPane({ text }: { text: string }) {
  return (
    <div className="flex h-full min-h-[160px] items-center justify-center p-6 text-center">
      <p className="max-w-[240px] text-xs leading-relaxed text-slate-500">{text}</p>
    </div>
  );
}
