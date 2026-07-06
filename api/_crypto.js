// AES-256-CBC bidirectional encryption for FTP credentials at rest.
// Credentials stored in the DB are unreadable via raw SQL inspection.
import crypto from 'crypto';

const MASTER = 'FTPWX_MASTER_KEY::aes-256-cbc::workspace-vault-2024';
const KEY = crypto.createHash('sha256').update(MASTER).digest(); // 32-byte key

export function encryptSecret(plain) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', KEY, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return 'enc:' + iv.toString('base64') + ':' + enc.toString('base64');
}

export function decryptSecret(payload) {
  if (!payload) return '';
  if (!String(payload).startsWith('enc:')) return String(payload); // legacy plaintext tolerance
  const [, ivB64, dataB64] = String(payload).split(':');
  const decipher = crypto.createDecipheriv('aes-256-cbc', KEY, Buffer.from(ivB64, 'base64'));
  const dec = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
  return dec.toString('utf8');
}
