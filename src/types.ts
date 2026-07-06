export type ProjectStatus = 'Doing' | 'Completed' | 'On Hold';

export interface Client {
  id: number;
  client_name: string;
  project_status: ProjectStatus;
  client_description: string | null;
  ftp_host: string;
  ftp_user: string;
  ftp_pass_masked: string;
  ftp_port: number;
  remote_path: string;
  billing_note: string | null;
  next_invoice: string | null;
  created_at: string;
}

export interface RemoteEntry {
  id: number;
  client_id: number;
  path: string;
  name: string;
  is_dir: boolean;
  size: number;
  created_at: string;
}

export interface StagingFile {
  id: number;
  name: string;
  size: number;
  kind: string;
  created_at: string;
}

export type Tab = 'crm' | 'ftp' | 'deploy';
