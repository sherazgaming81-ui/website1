import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Client, Tab } from './types';
import { apiFetch } from './lib/api';
import Sidebar from './components/Sidebar';
import CrmHub from './components/CrmHub';
import FtpBrowser from './components/FtpBrowser';
import ClientModal from './components/ClientModal';
import { LayoutDashboard, FolderTree, Menu, Wifi } from 'lucide-react';

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
      setLoading(true);
      const data = await apiFetch('/api/clients');
      setClients(data);
      if (data.length > 0 && !selectedId) {
        setSelectedId(data[0].id);
      }
      setLoadError(null);
    } catch (err: any) {
      setLoadError(err.message || 'Failed to fetch clients');
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const activeClient = useMemo(() => {
    return clients.find((c) => c.id === selectedId) || null;
  }, [clients, selectedId]);

  const handleAddClient = () => {
    setEditingClient(null);
    setModalOpen(true);
  };

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setModalOpen(true);
  };

  const handleSaveClient = async () => {
    setModalOpen(false);
    await fetchClients();
  };

  if (loading && clients.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-slate-400">Loading workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <Sidebar
        clients={clients}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onAdd={handleAddClient}
        open={sidebarOpen}
        setOpen={setSidebarOpen}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-slate-900 bg-slate-950 px-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-slate-400 hover:text-slate-100">
              <Menu size={20} />
            </button>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <LayoutDashboard className="text-indigo-500" size={22} />
              FTP Client & CRM Workspace
            </h1>
          </div>
          {activeClient && (
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2 text-slate-400">
                <Wifi size={16} className="text-emerald-500" />
                <span>Host: <strong className="text-slate-200">{activeClient.ftp_host}</strong></span>
              </div>
              <div className="flex rounded-lg bg-slate-900 p-1">
                <button
                  onClick={() => setTab('crm')}
                  className={`rounded-md px-4 py-1.5 font-medium transition-all ${tab === 'crm' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  CRM Hub
                </button>
                <button
                  onClick={() => setTab('ftp')}
                  className={`rounded-md px-4 py-1.5 font-medium transition-all flex items-center gap-1.5 ${tab === 'ftp' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  <FolderTree size={14} />
                  Web-FTP
                </button>
              </div>
            </div>
          )}
        </header>

        <main className="flex-1 overflow-y-auto bg-slate-950 p-6">
          {loadError && (
            <div className="mb-4 rounded-lg bg-red-950/50 border border-red-900 p-4 text-red-400 text-sm">
              {loadError}
            </div>
          )}

          {activeClient ? (
            <div className="h-full">
              {tab === 'crm' && <CrmHub client={activeClient} onEdit={handleEditClient} onRefresh={fetchClients} />}
              {tab === 'ftp' && <FtpBrowser client={activeClient} />}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-center">
              <div>
                <p className="text-slate-500">No client selected. Add or select a client lead from the sidebar.</p>
                <button onClick={handleAddClient} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20">
                  Add Your First Client
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {modalOpen && (
        <ClientModal
          client={editingClient}
          onClose={() => setModalOpen(false)}
          onSave={handleSaveClient}
        />
      )}
    </div>
  );
}
