import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  VentureDetailSchema,
  VentureListSchema,
  VentureWriteResponseSchema,
  VentureMembershipRequestSchema,
  VentureSettingsSchema,
  type VentureDetail,
  type VentureSettings,
} from '../../../shared/contracts/venture';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../auth/auth-context';
import '../registry/registry.css';
import './ventures.css';

export function VenturesPage() {
  const { session, member } = useAuth();
  const accessToken = session?.access_token;
  const client = useQueryClient();
  const [selected, setSelected] = useState('');
  const [creating, setCreating] = useState(false);
  const list = useQuery({
    queryKey: ['ventures', member?.id],
    queryFn: () => apiFetch('/ventures', VentureListSchema, { accessToken }),
  });
  const detail = useQuery({
    queryKey: ['venture', selected, member?.id],
    enabled: Boolean(selected),
    queryFn: () =>
      apiFetch(`/ventures/${selected}`, VentureDetailSchema, { accessToken }),
  });
  const refresh = async () => {
    await client.invalidateQueries();
  };
  return (
    <section className="registry-page venture-page">
      <header className="registry-page-header">
        <div>
          <p className="registry-kicker">WORKSPACE REGISTRY</p>
          <h1>Ventures</h1>
          <p>
            Businesses, people, and operational roles. Roles do not grant
            financial or equity rights.
          </p>
        </div>
        {member?.workspaceRole === 'ADMINISTRATOR' && !creating && (
          <button
            className="registry-primary-button"
            onClick={() => {
              setCreating(true);
              setSelected('');
            }}
          >
            Create venture
          </button>
        )}
      </header>
      {list.isPending && <p role="status">Loading ventures...</p>}
      {list.isError && (
        <div role="alert">
          <p>Ventures could not be loaded.</p>
          <button onClick={() => void list.refetch()}>Retry</button>
        </div>
      )}
      {list.isSuccess && !list.data.length && (
        <p>
          No ventures yet. An administrator can create one and assign members.
        </p>
      )}
      <nav className="venture-list" aria-label="Choose venture">
        {list.data?.map((v) => (
          <button
            key={v.id}
            className="registry-secondary-button"
            aria-pressed={selected === v.id}
            onClick={() => {
              setSelected(v.id);
              setCreating(false);
            }}
          >
            {v.name}
            {v.status === 'ARCHIVED' ? ' (archived)' : ''}
          </button>
        ))}
      </nav>
      {creating && (
        <VentureSettingsForm
          key="new"
          ventures={list.data ?? []}
          save={async (values) => {
            await apiFetch('/ventures', VentureWriteResponseSchema, {
              method: 'POST',
              accessToken,
              body: values,
            });
            setCreating(false);
            await refresh();
          }}
        />
      )}
      {selected && detail.isPending && (
        <p role="status">Loading venture details...</p>
      )}
      {selected && detail.isError && (
        <div role="alert">
          <p>Venture is unavailable or you do not have access.</p>
          <button onClick={() => void detail.refetch()}>Retry</button>
        </div>
      )}
      {selected && detail.data && (
        <div key={selected} className="venture-details">
          <h2>{detail.data.venture.name}</h2>
          {detail.data.venture.canManage ? (
            <VentureSettingsForm
              key={detail.data.venture.id + detail.data.venture.status}
              current={detail.data.venture}
              ventures={list.data ?? []}
              save={async (values) => {
                await apiFetch(
                  `/ventures/${selected}`,
                  VentureWriteResponseSchema,
                  { method: 'PATCH', accessToken, body: values },
                );
                await refresh();
              }}
            />
          ) : (
            <p>{detail.data.venture.description || 'No description yet.'}</p>
          )}
          <h3>Members &amp; Roles</h3>
          <p>
            A person may belong to several ventures and hold several roles in
            each.
          </p>
          <ul className="venture-member-list">
            {detail.data.members.map((m) => (
              <li key={m.id}>
                <strong>{m.fullName}</strong> ·{' '}
                {m.active ? m.memberStatus : 'Membership ended'}
                {m.founder ? ' · Founder' : ''}
                <span>{m.roles.join(', ') || 'No operational role'}</span>
              </li>
            ))}
          </ul>
          {!detail.data.members.length && <p>No members assigned.</p>}
          {detail.data.venture.canManageMembers &&
            detail.data.venture.status !== 'ARCHIVED' && (
              <MembershipForm
                detail={detail.data}
                save={async (values) => {
                  await apiFetch(
                    `/ventures/${selected}/members`,
                    VentureWriteResponseSchema,
                    { method: 'POST', accessToken, body: values },
                  );
                  await refresh();
                }}
              />
            )}
          <h3>Activity / History</h3>
          <p>
            Founder designation is a record of participation. It does not issue
            shares.
          </p>
          <ul>
            {detail.data.history.map((e) => (
              <li key={e.id}>
                {e.action.replaceAll('_', ' ')} ·{' '}
                {new Date(e.createdAt).toLocaleString('en-PH', {
                  timeZone: 'Asia/Manila',
                })}
              </li>
            ))}
          </ul>
          {!detail.data.history.length && <p>No recorded changes yet.</p>}
        </div>
      )}
    </section>
  );
}

function VentureSettingsForm({
  current,
  ventures,
  save,
}: {
  current?: VentureSettings & { id: string };
  ventures: (VentureSettings & { id: string })[];
  save: (values: VentureSettings) => Promise<void>;
}) {
  const mutation = useMutation({ mutationFn: save });
  const [error, setError] = useState('');
  return (
    <form
      className="venture-form registry-panel"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const values = VentureSettingsSchema.safeParse({
          name: form.get('name'),
          shortLabel: form.get('shortLabel'),
          description: form.get('description') || null,
          parentId: form.get('parentId') || null,
          status: form.get('status'),
        });
        if (!values.success) {
          setError(values.error.issues[0]?.message ?? 'Check venture details.');
          return;
        }
        setError('');
        mutation.mutate(values.data);
      }}
    >
      <label>
        Name
        <input
          name="name"
          required
          maxLength={120}
          defaultValue={current?.name ?? ''}
        />
      </label>
      <label>
        Short label
        <input
          name="shortLabel"
          required
          maxLength={12}
          defaultValue={current?.shortLabel ?? ''}
        />
      </label>
      <label>
        Description
        <textarea
          name="description"
          maxLength={2000}
          defaultValue={current?.description ?? ''}
        />
      </label>
      <label>
        Parent venture
        <select name="parentId" defaultValue={current?.parentId ?? ''}>
          <option value="">No parent venture</option>
          {ventures
            .filter((v) => v.id !== current?.id && v.status === 'ACTIVE')
            .map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
        </select>
      </label>
      <label>
        Status
        <select name="status" defaultValue={current?.status ?? 'ACTIVE'}>
          <option value="ACTIVE">Active</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </label>
      {(error || mutation.error) && (
        <p role="alert">{error || mutation.error?.message}</p>
      )}
      <button className="registry-primary-button" disabled={mutation.isPending}>
        {mutation.isPending
          ? 'Saving...'
          : current
            ? 'Save venture'
            : 'Create venture'}
      </button>
      {mutation.isSuccess && <p role="status">Venture saved.</p>}
    </form>
  );
}

function MembershipForm({
  detail,
  save,
}: {
  detail: VentureDetail;
  save: (
    values: ReturnType<typeof VentureMembershipRequestSchema.parse>,
  ) => Promise<void>;
}) {
  const [memberId, setMemberId] = useState('');
  const existing = detail.members.find((m) => m.memberId === memberId);
  const mutation = useMutation({ mutationFn: save });
  const [error, setError] = useState('');
  const candidates = new Map(
    [
      ...detail.candidates,
      ...detail.members.map((m) => ({ id: m.memberId, fullName: m.fullName })),
    ].map((m) => [m.id, m]),
  );
  return (
    <form
      className="venture-form registry-panel"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const parsed = VentureMembershipRequestSchema.safeParse({
          memberId,
          founder: form.has('founder'),
          roles: form.getAll('roles'),
          permissions: detail.venture.canGrantPermissions
            ? form.getAll('permissions')
            : existing?.active
              ? existing.permissions
              : [],
          active: form.get('active') === 'true',
        });
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message ?? 'Check membership.');
          return;
        }
        setError('');
        mutation.mutate(parsed.data);
      }}
    >
      <label>
        Member
        <select
          required
          value={memberId}
          onChange={(e) => {
            setMemberId(e.target.value);
            mutation.reset();
          }}
        >
          <option value="">Choose member</option>
          {[...candidates.values()].map((m) => (
            <option key={m.id} value={m.id}>
              {m.fullName}
            </option>
          ))}
        </select>
      </label>
      <fieldset
        key={memberId + JSON.stringify(existing)}
        disabled={!memberId || mutation.isPending}
      >
        <legend>Venture membership</legend>
        <label>
          <input
            type="checkbox"
            name="founder"
            defaultChecked={existing?.founder}
          />
          Founder
        </label>
        <fieldset>
          <legend>Operational roles</legend>
          {['CEO', 'CTO', 'COO', 'DEVOPS'].map((role) => (
            <label key={role}>
              <input
                type="checkbox"
                name="roles"
                value={role}
                defaultChecked={existing?.roles.includes(role as 'CEO')}
              />
              {role === 'DEVOPS' ? 'DevOps' : role}
            </label>
          ))}
        </fieldset>
        {detail.venture.canGrantPermissions && (
          <fieldset>
            <legend>Application permissions</legend>
            {['venture.manage', 'venture.members.manage'].map((permission) => (
              <label key={permission}>
                <input
                  type="checkbox"
                  name="permissions"
                  value={permission}
                  defaultChecked={existing?.permissions.includes(
                    permission as 'venture.manage',
                  )}
                />
                {permission}
              </label>
            ))}
          </fieldset>
        )}
        <label>
          Membership status
          <select
            name="active"
            defaultValue={existing && !existing.active ? 'false' : 'true'}
          >
            <option value="true">Active</option>
            <option value="false">Ended</option>
          </select>
        </label>
      </fieldset>
      {(error || mutation.error) && (
        <p role="alert">{error || mutation.error?.message}</p>
      )}
      <button
        className="registry-primary-button"
        disabled={!memberId || mutation.isPending}
      >
        {mutation.isPending ? 'Saving...' : 'Save membership'}
      </button>
      {mutation.isSuccess && <p role="status">Membership saved.</p>}
    </form>
  );
}
