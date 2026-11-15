import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ProjectCreateOptionsResponseSchema,
  ProjectSchema,
  type Project,
} from '../../../shared/contracts/project';
import { apiFetch } from '../../lib/api';

export function ProjectVenturesPanel({
  project,
  accessToken,
}: {
  project: Project;
  accessToken?: string;
}) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [ids, setIds] = useState(project.ventures.map((v) => v.id));
  const options = useQuery({
    queryKey: ['project-venture-options'],
    enabled: open,
    queryFn: () =>
      apiFetch('/projects/create-options', ProjectCreateOptionsResponseSchema, {
        accessToken,
      }),
  });
  const mutation = useMutation({
    mutationFn: () =>
      apiFetch(`/projects/${project.id}/ventures`, ProjectSchema, {
        method: 'PATCH',
        accessToken,
        body: { ventureIds: ids },
      }),
    onSuccess: async () => {
      await client.invalidateQueries();
    },
  });
  return (
    <details className="pw-project-meta-card" onToggle={e => setOpen(e.currentTarget.open)}>
      <summary>Manage project ventures</summary>
      <p>Grouping is optional. Project visibility and access stay unchanged.</p>
      {options.isPending && <p role="status">Loading venture options...</p>}
      {options.error && <p role="alert">{options.error.message}</p>}
      <fieldset disabled={mutation.isPending}>
        <legend>Project ventures</legend>
        {options.data?.ventures?.map((v) => (
          <label key={v.id}>
            <input
              type="checkbox"
              checked={ids.includes(v.id)}
              onChange={(e) =>
                setIds((current) =>
                  e.target.checked
                    ? [...current, v.id]
                    : current.filter((id) => id !== v.id),
                )
              }
            />
            {v.name}
          </label>
        ))}
      </fieldset>
      {mutation.error && <p role="alert">{mutation.error.message}</p>}
      <button
        disabled={!options.data || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? 'Saving...' : 'Save project ventures'}
      </button>
      {mutation.isSuccess && <p role="status">Project ventures saved.</p>}
    </details>
  );
}
