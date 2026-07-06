import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Client, Tab } from './types';
import { apiFetch } from './lib/api';
import Sidebar from './components/Sidebar';
import CrmHub from './components/CrmHub';
import FtpBrowser from './components/FtpBrowser';
// import DeployPackage from './components/DeployPackage';
import ClientModal from './components/ClientModal';
import { LayoutDashboard, FolderTree, PackageOpen, Menu, Wifi } from 'lucide-react';

export default function App() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>('crm');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const fetchClients = useCallback(async () => {
    try {
      setLoadError(null);
      const data = await apiFetch<Client[]>('/api/clients');
      setClients(data);
      setSelectedId(prev => {
        if (prev && data.some(c => c.id === prev)) return prev;
        return data.length ? data[0].id : null;
      });
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const selected = useMemo(() => clients.find(c => c.id === selectedId) ?? null, [clients, selectedId]);

  const openAdd = () => { setEditingClient(null); setModalOpen(true); };
  const openEdit = (c: Client) => { setEditingClient(c); setModalOpen(true); };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'crm', label: 'CRM Hub', icon: <LayoutDashboard size={15} /> },
    { id: 'ftp', label: 'Cloud Browser', icon: <FolderTree size={15} /> },
    { id: 'deploy', label: 'Deployment Package', icon: <PackageOpen size={15} /> },
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        open={sidebarOpen}
        clients={clients}
        loading={loading}
        selectedId={selectedId}
        onSelect={(id) => { setSelectedId(id); if (tab === 'deploy') setTab('crm'); }}
        onAdd={openAdd}
        onToggle={() => setSidebarOpen(o => !o)}
      />

      <div className="flex flex-1 min-w-0 flex-col">
        {/* Top bar */}
        <header className="flex items-center gap-2 border-b border-line bg-panel/60 px-3 py-2.5 backdrop-blur sm:px-5">
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="rounded-lg border border-line p-2 text-slate-400 transition hover:border-indigox/50 hover:text-indigo-300"
            title="Toggle sidebar"
          >
            <Menu size={16} />
          </button>
          <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-[13px] ${
                  tab === t.id
                    ? 'bg-indigox/15 text-indigo-300 ring-1 ring-indigox/40'
                    : 'text-slate-400 hover:bg-panel-2 hover:text-slate-200'
                }`}
              >
                {t.icon}{t.label}
              </button>
            ))}
          </nav>
          <div className="hidden items-center gap-2 rounded-full border border-emeraldx/30 bg-emeraldx/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-300 md:flex">
            <Wifi size={12} className="pulse-dot" /> PASV MODE · TLS
          </div>
        </header>

        {/* Workspace */}
        <main className="grid-bg flex-1 overflow-y-auto">
          {loadError ? (
            <div className="m-6 rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-300">
              <p className="font-bold">Workspace failed to load</p>
              <p className="mt-1 text-red-400/80">{loadError}</p>
              <button onClick={() => { setLoading(true); fetchClients(); }} className="mt-3 rounded-lg bg-red-500/20 px-4 py-2 text-xs font-bold text-red-200 hover:bg-red-500/30">Retry</button>
            </div>
          ) : tab === 'crm' ? (
            <CrmHub client={selected} clients={clients} loading={loading} onRefresh={fetchClients} onEdit={openEdit} onAdd={openAdd} />
          ) : tab === 'ftp' ? (
            <FtpBrowser client={selected} />
          ) : (
            <DeployPackage />
          )}
        </main>
      </div>

      {modalOpen && (
        <ClientModal
          client={editingClient}
          onClose={() => setModalOpen(false)}
          onSaved={async (id) => {
            setModalOpen(false);
            await fetchClients();
            if (id) setSelectedId(id);
          }}
        />
      )}
    </div>
  );
}
