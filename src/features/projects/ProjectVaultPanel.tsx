import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  SaveVaultItemRequestSchema, VaultAccessResponseSchema, VaultItemSchema,
  VaultListResponseSchema, VaultRevealResponseSchema, VaultVersionsResponseSchema,
  type SaveVaultItemRequest, type VaultItem,
} from '../../../shared/contracts/project-vault';
import { apiFetch } from '../../lib/api';
import './project-vault.css';

type Kind = SaveVaultItemRequest['kind'];
type Environment = SaveVaultItemRequest['environment'];
const kinds: { value: Kind; label: string }[] = [
  { value: 'ENV_FILE', label: 'Environment file' }, { value: 'API_KEY', label: 'API key' },
  { value: 'CREDENTIAL', label: 'Credentials' }, { value: 'SECURE_NOTE', label: 'Secure note' },
  { value: 'FILE', label: 'Other file' },
];
const environments: Environment[] = ['GENERAL', 'DEVELOPMENT', 'STAGING', 'PRODUCTION'];
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Vault operation failed.';

function encodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.slice(i, i + 8192));
  return btoa(binary);
}
function decodeBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
function isFile(kind: Kind) { return kind === 'ENV_FILE' || kind === 'FILE'; }

export function ProjectVaultPanel({ projectId, accessToken, isLead }: {
  projectId: string; accessToken?: string; isLead: boolean;
}) {
  const client = useQueryClient();
  const prefix = '/projects/' + projectId + '/vault';
  const accessKey = ['projects', projectId, 'vault', 'access'];
  const itemsKey = ['projects', projectId, 'vault', 'items'];
  const access = useQuery({
    queryKey: accessKey,
    queryFn: () => apiFetch(prefix + '/access', VaultAccessResponseSchema, { accessToken }),
    enabled: Boolean(accessToken), staleTime: 0, refetchOnWindowFocus: true,
  });
  const list = useQuery({
    queryKey: itemsKey,
    queryFn: () => apiFetch(prefix, VaultListResponseSchema, { accessToken }),
    enabled: Boolean(accessToken && access.data?.canRead), staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const [editing, setEditing] = useState<VaultItem | 'new' | null>(null);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<Kind>('SECURE_NOTE');
  const [environment, setEnvironment] = useState<Environment>('GENERAL');
  const [description, setDescription] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);
  const [revealed, setRevealed] = useState<{ itemId: string; value: string } | null>(null);
  const [selected, setSelected] = useState<VaultItem | null>(null);
  const [localError, setLocalError] = useState('');

  // Discard plaintext as soon as the user changes the selection or leaves the tab.
  useEffect(() => () => { setRevealed(null); setContent(''); setFileBytes(null); }, []);
  function clearSensitive() { setRevealed(null); setContent(''); setFileBytes(null); }
  function closeEditor() { clearSensitive(); setEditing(null); setLocalError(''); }
  function begin(item?: VaultItem) {
    clearSensitive(); setLocalError('');
    setEditing(item ?? 'new'); setTitle(item?.title ?? '');
    setKind(item?.kind ?? 'SECURE_NOTE');
    setEnvironment(item?.environment ?? 'GENERAL');
    setDescription(item?.description ?? '');
    setFileName(item?.fileName ?? null);
  }
  const save = useMutation({
    mutationFn: (input: SaveVaultItemRequest) => apiFetch(
      editing && editing !== 'new' ? prefix + '/' + editing.id : prefix,
      VaultItemSchema, { accessToken, method: editing && editing !== 'new' ? 'PATCH' : 'POST', body: input }),
    onSuccess: async () => { closeEditor(); await client.invalidateQueries({ queryKey: itemsKey }); },
  });
  const remove = useMutation({
    mutationFn: (item: VaultItem) => apiFetch(prefix + '/' + item.id,
      VaultDeleteSchema, { accessToken, method: 'DELETE' }),
    onSuccess: async () => { setSelected(null); clearSensitive(); await client.invalidateQueries({ queryKey: itemsKey }); },
  });
  const approve = useMutation({
    mutationFn: ({ memberId, approved }: { memberId: string; approved: boolean }) =>
      apiFetch(prefix + '/access/' + memberId,
        VaultDeleteSchema, { accessToken, method: 'PATCH', body: { approved } }),
    onSuccess: async () => {
      await Promise.all([client.invalidateQueries({ queryKey: accessKey }),
        client.invalidateQueries({ queryKey: itemsKey })]);
    },
  });
  const reveal = useMutation({
    mutationFn: ({ item, purpose }: { item: VaultItem; purpose: 'REVEAL' | 'DOWNLOAD' }) =>
      apiFetch(prefix + '/' + item.id + '/reveal', VaultRevealResponseSchema,
        { accessToken, method: 'POST', body: { purpose } }),
    onSuccess: async (response, { item, purpose }) => {
      const bytes = decodeBytes(response.contentBase64);
      if (purpose === 'DOWNLOAD') {
        const blob = new Blob([bytes as BlobPart], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        try {
          const link = document.createElement('a');
          link.href = url; link.download = response.fileName ?? 'vault-item.txt';
          link.click();
        } finally { URL.revokeObjectURL(url); }
      } else if (isFile(item.kind)) {
        setRevealed({ itemId: item.id, value: new TextDecoder('utf-8', { fatal: false }).decode(bytes) });
      } else {
        setRevealed({ itemId: item.id, value: new TextDecoder().decode(bytes) });
      }
    },
  });
  const versions = useQuery({
    queryKey: ['projects', projectId, 'vault', 'versions', selected?.id],
    queryFn: () => apiFetch(prefix + '/' + selected!.id + '/versions',
      VaultVersionsResponseSchema, { accessToken }),
    enabled: Boolean(selected && access.data?.canRead),
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLocalError('');
    try {
      if (editing && editing !== 'new' && !content && !fileBytes) {
        setLocalError('Enter replacement contents before saving a new version.');
        return;
      }
      const bytes = isFile(kind) ? fileBytes : new TextEncoder().encode(content);
      if (!bytes || !bytes.byteLength || bytes.byteLength > 262144) {
        setLocalError('Provide content between 1 byte and 256 KiB.');
        return;
      }
      const input = SaveVaultItemRequestSchema.parse({
        title, kind, environment, description,
        fileName: isFile(kind) ? fileName : null,
        contentBase64: encodeBytes(bytes),
      });
      await save.mutateAsync(input);
    } catch (error) { setLocalError(errorText(error)); }
  }

  async function pickFile(file?: File) {
    setLocalError('');
    if (!file) return;
    if (file.size > 262144 || !file.size) { setLocalError('File must be between 1 byte and 256 KiB.'); return; }
    setFileName(file.name);
    setFileBytes(new Uint8Array(await file.arrayBuffer()));
  }

  if (access.isPending) return <section className="pv-card" role="status">Checking vault permissions…</section>;
  if (access.isError || !access.data) return <section className="pv-card" role="alert">Unable to load Vault access. {errorText(access.error)}</section>;
  const canRead = access.data.canRead;
  return <section className="pv-root" aria-label="Project Vault">
    <header className="pv-header">
      <div><p className="projects-kicker">PROJECT RESOURCES</p>
        <h2>Project Vault</h2><p>Credentials and sensitive files, visible only to approved project members.</p></div>
      {canRead && access.data.canWrite && <button className="pv-primary" type="button" onClick={() => begin()}>+ Add Item</button>}
    </header>
    {!canRead ? <div className="pv-card" role="status">
      <h3>Vault access requires approval</h3>
      <p>Ask your Project Lead to approve your access. Joining an outcome does not automatically unlock secrets.</p>
    </div> : <>
      {list.isPending ? <div className="pv-card" role="status">Loading vault entries…</div>
        : list.isError ? <div className="pv-card" role="alert">Could not load Vault. {errorText(list.error)}</div>
        : !list.data?.items.length ? <div className="pv-card">No vault items yet. Add an environment file, credential, or secure note.</div>
        : <div className="pv-items">{list.data.items.map(item => <button
          className="pv-item" type="button" key={item.id}
          onClick={() => { setSelected(item); clearSensitive(); reveal.reset(); }}>
          <span className="pv-item-icon" aria-hidden="true">♙</span>
          <span className="pv-item-name"><strong>{item.title}</strong><small>{kinds.find(k => k.value === item.kind)?.label} · {item.environment}</small></span>
          <span className="pv-item-version">v{item.currentVersion}</span>
        </button>)}</div>}
      {selected && <div className="pv-card pv-details">
        <header className="pv-details-header"><div><h3>{selected.title}</h3>
          <p>{selected.description || 'No description'} · {selected.environment}</p></div>
          <button type="button" onClick={() => { setSelected(null); clearSensitive(); }}>Close</button></header>
        <div className="pv-actions">
          <button type="button" disabled={reveal.isPending} onClick={() => {
            if (revealed?.itemId === selected.id) setRevealed(null);
            else { clearSensitive(); reveal.mutate({ item: selected, purpose: 'REVEAL' }); }
          }}>{revealed?.itemId === selected.id ? 'Hide' : 'Reveal'}</button>
          <button type="button" disabled={reveal.isPending}
            onClick={() => { clearSensitive(); reveal.mutate({ item: selected, purpose: 'DOWNLOAD' }); }}>Download</button>
          {access.data.canWrite && <><button type="button" onClick={() => begin(selected)}>Replace / Edit</button>
            <button type="button" className="pv-danger" disabled={remove.isPending} onClick={() => {
              if (window.confirm('Delete this vault item?')) remove.mutate(selected);
            }}>Delete</button></>}
        </div>
        {revealed?.itemId === selected.id && <div className="pv-revealed">
          <pre>{revealed.value}</pre>
          <button type="button" onClick={() => void navigator.clipboard.writeText(revealed.value)}>Copy value</button>
        </div>}
        {reveal.isError && <p role="alert" className="pv-error">{errorText(reveal.error)}</p>}
        {remove.isError && <p role="alert" className="pv-error">{errorText(remove.error)}</p>}
        <p className="pv-version-note">{versions.data?.versions.length ?? '…'} saved version(s)</p>
      </div>}
    </>}
    {isLead && <div className="pv-card">
      <h3>Vault access approvals</h3>
      <p>Members must receive explicit approval before they can read vault contents.</p>
      {access.data.members.length === 0 && <p>No project members are currently assigned.</p>}
      {access.data.members.map(m => <div className="pv-member" key={m.memberId}>
        <span><strong>{m.name}</strong><small>{m.accessLevel === 'CAN_EDIT' ? 'Editor' : 'Viewer'} · {m.approved ? 'Approved' : 'Not approved'}</small></span>
        <button type="button" disabled={approve.isPending}
          onClick={() => approve.mutate({ memberId: m.memberId, approved: !m.approved })}>
          {m.approved ? 'Revoke' : 'Approve'}
        </button>
      </div>)}
      {approve.isError && <p role="alert" className="pv-error">{errorText(approve.error)}</p>}
    </div>}
    {editing && <div className="pv-overlay" role="presentation">
      <div className="pv-modal" role="dialog" aria-modal="true" aria-label={editing === 'new' ? 'Add vault item' : 'Edit vault item'}>
        <h3>{editing === 'new' ? 'Add vault item' : 'Update vault item'}</h3>
        <p>Content is encrypted on the server and never included in item listings.</p>
        <form onSubmit={event => void submit(event)}>
          <label>Title<input value={title} onChange={e => setTitle(e.target.value)} maxLength={160} required /></label>
          <label>Type<select value={kind} onChange={e => { setKind(e.target.value as Kind); setFileBytes(null); setFileName(null); setContent(''); }}>
            {kinds.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}</select></label>
          <label>Environment<select value={environment} onChange={e => setEnvironment(e.target.value as Environment)}>
            {environments.map(e => <option key={e} value={e}>{e}</option>)}</select></label>
          <label>Description<textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={1000} rows={2}/></label>
          {isFile(kind) ? <label>File (maximum 256 KiB)<input type="file" onChange={e => void pickFile(e.target.files?.[0])} /></label>
            : <label>Secret content<textarea value={content} onChange={e => setContent(e.target.value)}
                rows={6} required autoComplete="off" spellCheck={false} /></label>}
          {editing !== 'new' && <p>Saving creates a new encrypted version. Existing content cannot be loaded into this form automatically.</p>}
          {localError && <p className="pv-error" role="alert">{localError}</p>}
          {save.isError && <p className="pv-error" role="alert">{errorText(save.error)}</p>}
          <div className="pv-actions"><button type="button" disabled={save.isPending} onClick={closeEditor}>Cancel</button>
            <button className="pv-primary" type="submit" disabled={save.isPending}>{save.isPending ? 'Encrypting…' : 'Save securely'}</button></div>
        </form>
      </div>
    </div>}
  </section>;
}
const VaultDeleteSchema = { parse: (value: unknown) => {
  if (value && typeof value === 'object' && 'success' in value && value.success === true) return value as { success: true };
  throw new Error('Invalid response.');
}} as import('zod').ZodType<{ success: true }>;
