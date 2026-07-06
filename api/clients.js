import supabase from './db-client.js';
import { encryptSecret, decryptSecret } from './_crypto.js';

const mask = () => '••••••••••••';

function sanitize(row) {
  const { ftp_pass, ...rest } = row;
  return { ...rest, ftp_pass_masked: mask() };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { id, reveal } = req.query;
      if (id && reveal === '1') {
        const { data, error } = await supabase.from('workspace_clients').select('ftp_pass').eq('id', id).single();
        if (error) throw error;
        return res.status(200).json({ password: decryptSecret(data.ftp_pass) });
      }
      const { data, error } = await supabase.from('workspace_clients').select('*').order('id', { ascending: true });
      if (error) throw error;
      return res.status(200).json(data.map(sanitize));
    }

    if (req.method === 'POST') {
      const b = req.body || {};
      if (!b.client_name || !b.ftp_host || !b.ftp_user || !b.ftp_pass) {
        return res.status(400).json({ error: 'client_name, ftp_host, ftp_user and ftp_pass are required' });
      }
      const row = {
        client_name: b.client_name,
        project_status: b.project_status || 'Doing',
        client_description: b.client_description || null,
        ftp_host: b.ftp_host,
        ftp_user: b.ftp_user,
        ftp_pass: encryptSecret(b.ftp_pass),
        ftp_port: Number(b.ftp_port) || 21,
        remote_path: b.remote_path || '/public_html',
        billing_note: b.billing_note || null,
        next_invoice: b.next_invoice || null,
      };
      const { data, error } = await supabase.from('workspace_clients').insert(row).select().single();
      if (error) throw error;
      // seed remote root for the new client so the FTP browser has a filesystem
      await supabase.from('remote_files').insert([
        { client_id: data.id, path: '/', name: 'public_html', is_dir: true, size: 0 },
        { client_id: data.id, path: '/', name: 'logs', is_dir: true, size: 0 },
        { client_id: data.id, path: '/public_html', name: 'index.php', is_dir: false, size: 1240 },
      ]);
      return res.status(201).json(sanitize(data));
    }

    if (req.method === 'PUT') {
      const b = req.body || {};
      if (!b.id) return res.status(400).json({ error: 'id is required' });
      const set = {};
      const fields = ['client_name', 'project_status', 'client_description', 'ftp_host', 'ftp_user', 'ftp_port', 'remote_path', 'billing_note', 'next_invoice'];
      for (const f of fields) if (b[f] !== undefined) set[f] = b[f];
      if (b.ftp_pass) set.ftp_pass = encryptSecret(b.ftp_pass);
      const { data, error } = await supabase.from('workspace_clients').update(set).eq('id', b.id).select().single();
      if (error) throw error;
      return res.status(200).json(sanitize(data));
    }

    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      await supabase.from('remote_files').delete().eq('client_id', id);
      const { error } = await supabase.from('workspace_clients').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
