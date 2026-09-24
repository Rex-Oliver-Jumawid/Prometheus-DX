import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import {
  CreateProjectAnnouncementSchema,
  ProjectAnnouncementSchema,
  ProjectAnnouncementsResponseSchema,
  UpdateProjectAnnouncementPinSchema,
  type ProjectAnnouncement,
} from '../../../shared/contracts/project-announcement';
import { apiFetch } from '../../lib/api';
import './project-collaboration.css';

function displayTime(value: string) {
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Please try again.';
}

export function ProjectAnnouncementsPanel({
  projectId,
  accessToken,
}: {
  projectId: string;
  accessToken?: string;
}) {
  const queryClient = useQueryClient();
  const queryKey = ['projects', projectId, 'announcements'] as const;
  const [composeOpen, setComposeOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const announcements = useQuery({
    queryKey,
    queryFn: () =>
      apiFetch(
        '/projects/' + projectId + '/announcements',
        ProjectAnnouncementsResponseSchema,
        { accessToken },
      ),
    enabled: Boolean(accessToken),
    staleTime: 60_000,
    gcTime: 15 * 60_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const create = useMutation({
    mutationFn: (input: { title: string; body: string }) =>
      apiFetch(
        '/projects/' + projectId + '/announcements',
        ProjectAnnouncementSchema,
        {
          accessToken,
          method: 'POST',
          body: CreateProjectAnnouncementSchema.parse(input),
        },
      ),
    onSuccess: async () => {
      setTitle('');
      setBody('');
      setComposeOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({
          queryKey: ['projects', projectId, 'activity'],
        }),
      ]);
    },
  });

  const pin = useMutation({
    mutationFn: (input: { announcement: ProjectAnnouncement; pinned: boolean }) =>
      apiFetch(
        '/projects/' +
          projectId +
          '/announcements/' +
          input.announcement.id +
          '/pin',
        ProjectAnnouncementSchema,
        {
          accessToken,
          method: 'PATCH',
          body: UpdateProjectAnnouncementPinSchema.parse({
            pinned: input.pinned,
          }),
        },
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({
          queryKey: ['projects', projectId, 'activity'],
        }),
      ]);
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !body.trim() || create.isPending) return;
    create.mutate({ title, body });
  }

  return (
    <section className="pw-announcements" aria-label="Project announcements">
      <header className="pw-announcements-heading">
        <div>
          <h2>Announcements</h2>
          <p>Project-wide updates. Pinned announcements stay visible at the top.</p>
        </div>
        {announcements.data?.canManage && (
          <button
            type="button"
            className="pw-announce-button"
            aria-expanded={composeOpen}
            onClick={() => {
              create.reset();
              setComposeOpen((current) => !current);
            }}
          >
            <span aria-hidden="true">+</span>
            Announce
          </button>
        )}
      </header>

      {composeOpen && (
        <form className="pw-announcement-compose" onSubmit={submit}>
          <input
            aria-label="Announcement title"
            value={title}
            maxLength={160}
            placeholder="Announcement title"
            onChange={(event) => setTitle(event.target.value)}
            disabled={create.isPending}
          />
          <textarea
            aria-label="Announcement details"
            value={body}
            maxLength={1200}
            rows={3}
            placeholder="Share a project-wide update..."
            onChange={(event) => setBody(event.target.value)}
            disabled={create.isPending}
          />
          <div>
            <button
              type="button"
              disabled={create.isPending}
              onClick={() => setComposeOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary"
              disabled={create.isPending || !title.trim() || !body.trim()}
            >
              {create.isPending ? 'Posting...' : 'Post'}
            </button>
          </div>
          {create.isError && (
            <small className="pw-announcement-error" role="alert">
              {errorMessage(create.error)}
            </small>
          )}
        </form>
      )}

      {announcements.isPending ? (
        <div className="pw-announcement-skeleton" role="status" aria-label="Loading announcements">
          <span className="sr-only">Loading announcements...</span>
          <div className="pw-announcement-skeleton-card" aria-hidden="true">
            <span className="pw-chat-skeleton-line" />
            <span className="pw-chat-skeleton-line" />
            <span className="pw-chat-skeleton-line" />
            <span className="pw-chat-skeleton-line" />
          </div>
          <div className="pw-announcement-skeleton-card pw-announcement-skeleton-card--secondary" aria-hidden="true">
            <span className="pw-chat-skeleton-line" />
            <span className="pw-chat-skeleton-line" />
            <span className="pw-chat-skeleton-line" />
          </div>
        </div>
      ) : announcements.isError ? (
        <div className="pw-announcement-state" role="alert">
          <strong>Announcements could not be loaded.</strong>
          <p>{errorMessage(announcements.error)}</p>
          <button
            type="button"
            className="pw-announce-retry"
            onClick={() => void announcements.refetch()}
          >
            Try again
          </button>
        </div>
      ) : announcements.data.items.length ? (
        <div className="pw-announcement-list">
          {announcements.data.items.map((announcement) => {
            const pinned = Boolean(announcement.pinnedAt);
            const updating =
              pin.isPending &&
              pin.variables?.announcement.id === announcement.id;
            return (
              <article
                className={
                  pinned
                    ? 'pw-announcement-card pw-announcement-card--pinned'
                    : 'pw-announcement-card'
                }
                key={announcement.id}
              >
                <div className="pw-announcement-card-top">
                  <span>
                    <b aria-hidden="true">⚑</b>
                    {pinned ? 'Pinned announcement' : 'Announcement'}
                  </span>
                  {announcements.data.canManage && (
                    <button
                      type="button"
                      aria-label={
                        pinned ? 'Unpin announcement' : 'Pin announcement'
                      }
                      title={pinned ? 'Unpin announcement' : 'Pin announcement'}
                      disabled={updating}
                      onClick={() =>
                        pin.mutate({ announcement, pinned: !pinned })
                      }
                    >
                      {pinned ? '◆' : '◇'}
                    </button>
                  )}
                </div>
                <h3>{announcement.title}</h3>
                <p>{announcement.body}</p>
                <footer>
                  {announcement.author.fullName} · {pinned ? 'Project guidance' : displayTime(announcement.createdAt)}
                </footer>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="pw-announcement-state">No announcements yet.</div>
      )}

      {pin.isError && (
        <small className="pw-announcement-error" role="alert">
          {errorMessage(pin.error)}
        </small>
      )}
    </section>
  );
}
