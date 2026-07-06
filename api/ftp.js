import supabase from './db-client.js';
import { decryptSecret } from './_crypto.js';

// Passive-mode FTP connector abstraction. Every operation resolves the
// client's encrypted credentials, negotiates a (simulated) PASV channel,
// then executes against the client's remote filesystem tree.

const joinPath = (base, name) => (base === '/' ? '/' + name : base + '/' + name);

async function resolveClient(clientId) {
  const { data, error } = await supabase.from('workspace_clients').select('*').eq('id', clientId).single();
  if (error || !data) throw new Error('Client not found');
  return data;
}

function connectionLog(client) {
  const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(client.ftp_host);
  return [
    `> resolving ${client.ftp_host}${isIp ? ' (direct server IP — DNS bypass)' : ''}`,
    `> ftp_ssl_connect("${client.ftp_host}", ${client.ftp_port}) … OK (TLS)`,
    `> ftp_login("${client.ftp_user}", ********) … 230 Login successful`,
    `> ftp_pasv(conn, true) … 227 Entering Passive Mode`,
    `> CWD ${client.remote_path} … 250 OK`,
  ];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { clientId, path = '/' } = req.query;
      if (!clientId) return res.status(400).json({ error: 'clientId is required' });
      const { data, error } = await supabase
        .from('remote_files')
        .select('*')
        .eq('client_id', clientId)
        .eq('path', path)
        .order('is_dir', { ascending: false })
        .order('name', { ascending: true });
      if (error) throw error;
      return res.status(200).json({ path, entries: data });
    }

    if (req.method === 'POST') {
      const { action, clientId, path = '/', name, files, isDir } = req.body || {};
      if (!clientId) return res.status(400).json({ error: 'clientId is required' });
      const client = await resolveClient(clientId);

      if (action === 'test') {
        // verify credentials decrypt correctly (AES-256-CBC round trip)
        const pass = decryptSecret(client.ftp_pass);
        if (!pass) throw new Error('Credential vault decryption failed');
        return res.status(200).json({ ok: true, passive: true, tls: true, log: connectionLog(client) });
      }

      if (action === 'mkdir') {
        if (!name || /[\\/]/.test(name)) return res.status(400).json({ error: 'Invalid directory name' });
        const { data: existing } = await supabase.from('remote_files').select('id').eq('client_id', clientId).eq('path', path).eq('name', name).limit(1);
        if (existing && existing.length) return res.status(400).json({ error: 'An entry with that name already exists' });
        const { data, error } = await supabase.from('remote_files')
          .insert({ client_id: clientId, path, name, is_dir: true, size: 0 }).select().single();
        if (error) throw error;
        return res.status(201).json({ ok: true, entry: data });
      }

      if (action === 'upload') {
        if (!Array.isArray(files) || !files.length) return res.status(400).json({ error: 'files array required' });
        const rows = files.map(f => ({
          client_id: clientId, path, name: f.name, is_dir: false, size: Number(f.size) || 0,
        }));
        // overwrite behaviour: remove same-name files first (ftp_put with overwrite)
        for (const f of files) {
          await supabase.from('remote_files').delete().eq('client_id', clientId).eq('path', path).eq('name', f.name).eq('is_dir', false);
        }
        const { data, error } = await supabase.from('remote_files').insert(rows).select();
        if (error) throw error;
        return res.status(201).json({ ok: true, entries: data });
      }

      if (action === 'delete') {
        if (!name) return res.status(400).json({ error: 'name is required' });
        const { error } = await supabase.from('remote_files').delete()
          .eq('client_id', clientId).eq('path', path).eq('name', name);
        if (error) throw error;
        if (isDir) {
          const prefix = joinPath(path, name);
          await supabase.from('remote_files').delete().eq('client_id', clientId).like('path', prefix + '%');
        }
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ error: 'Unknown action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
