import { useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CreateProjectMessageSchema,
  EditProjectMessageSchema,
  ProjectMessagePageSchema,
  ProjectMessageSchema,
  type ProjectMessage,
} from '../../../shared/contracts/project-chat';
import { apiFetch } from '../../lib/api';
import './project-collaboration.css';

function messageTime(date: string) {
  return new Date(date).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function errorMessage(value: unknown) {
  return value instanceof Error ? value.message : 'Please try again.';
}

export function ProjectChatPanel({
  projectId,
  accessToken,
}: {
  projectId: string;
  accessToken?: string;
}) {
  const queryClient = useQueryClient();
  const queryKey = ['projects', projectId, 'chat'];
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState<ProjectMessage | null>(null);
  const [editing, setEditing] = useState<{ id: string; body: string; expectedEditedAt: string | null } | null>(null);
  const threadRef = useRef<HTMLOListElement>(null);
  const pinnedToBottom = useRef(true);
  const initiallyScrolled = useRef(false);
  const olderScroll = useRef<{ top: number; height: number } | null>(null);

  const messages = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) =>
      apiFetch(
        '/projects/' + projectId + '/messages' +
          (pageParam ? '?cursor=' + encodeURIComponent(pageParam) : ''),
        ProjectMessagePageSchema,
        { accessToken },
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: Boolean(accessToken),
    staleTime: 3_000,
    refetchInterval: 8_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const send = useMutation({
    mutationFn: (input: { body: string; parentMessageId: string | null }) =>
      apiFetch(
        '/projects/' + projectId + '/messages',
        ProjectMessageSchema,
        { accessToken, method: 'POST', body: CreateProjectMessageSchema.parse(input) },
      ),
    onSuccess: async () => {
      setBody('');
      setReplyTo(null);
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const edit = useMutation({
    mutationFn: (input: { id: string; body: string; expectedEditedAt: string | null }) =>
      apiFetch(
        '/projects/' + projectId + '/messages/' + input.id,
        ProjectMessageSchema,
        {
          accessToken,
          method: 'PATCH',
          body: EditProjectMessageSchema.parse({
            body: input.body,
            expectedEditedAt: input.expectedEditedAt,
          }),
        },
      ),
    onSuccess: async () => {
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const loaded = messages.data?.pages.flatMap((page) => page.items) ?? [];
  const unique = new Map(loaded.map((message) => [message.id, message]));
  const ordered = [...unique.values()].sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
  const canWrite = messages.data?.pages[0]?.canWrite ?? false;

  // Show the newest conversation on entry. Preserve a reader's scroll position
  // when earlier messages are prepended, and follow new messages only if pinned.
  useLayoutEffect(() => {
    const thread = threadRef.current;
    if (!thread || ordered.length === 0) return;
    const previous = olderScroll.current;
    if (previous) {
      thread.scrollTop = previous.top + thread.scrollHeight - previous.height;
      olderScroll.current = null;
    } else if (!initiallyScrolled.current || pinnedToBottom.current) {
      thread.scrollTop = thread.scrollHeight;
    }
    initiallyScrolled.current = true;
  }, [ordered.length, ordered[0]?.id, ordered[ordered.length - 1]?.id]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim() || body.length > 4000 || !canWrite || send.isPending) return;
    send.mutate({ body, parentMessageId: replyTo?.id ?? null });
  }

  return (
    <section className="pw-collaboration-panel pw-chat-panel" aria-label="Project chat">
      <header className="pw-collaboration-heading">
        <div>
          <span className="pw-collaboration-eyebrow">TEAM CONVERSATION</span>
          <h2>Project chat</h2>
          <p>Share updates and discuss project work with your team.</p>
        </div>
        <button
          className="projects-secondary-button"
          type="button"
          onClick={() => void messages.refetch()}
          disabled={messages.isFetching}
        >
          {messages.isFetching ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      {messages.isPending ? (
        <p role="status" className="pw-collaboration-state">Loading project messages…</p>
      ) : messages.isError && ordered.length === 0 ? (
        <div className="pw-collaboration-state" role="alert">
          <strong>Project chat could not be loaded.</strong>
          <p>{errorMessage(messages.error)}</p>
          <button type="button" onClick={() => void messages.refetch()}>Retry</button>
        </div>
      ) : (
        <>
          {messages.hasNextPage && (
            <button
              type="button"
              className="pw-collaboration-load-more"
              onClick={() => {
                const thread = threadRef.current;
                if (thread) olderScroll.current = {
                  top: thread.scrollTop,
                  height: thread.scrollHeight,
                };
                pinnedToBottom.current = false;
                void messages.fetchNextPage().then((result) => {
                  if (result.isError) olderScroll.current = null;
                });
              }}
              disabled={messages.isFetchingNextPage}
            >
              {messages.isFetchingNextPage ? 'Loading…' : 'Load earlier messages'}
            </button>
          )}
          {ordered.length === 0 ? (
            <p className="pw-collaboration-state">No messages yet. Start the conversation.</p>
          ) : (
            <ol
              className="pw-chat-thread"
              aria-label="Project messages"
              ref={threadRef}
              onScroll={(event) => {
                const thread = event.currentTarget;
                pinnedToBottom.current =
                  thread.scrollHeight - thread.scrollTop - thread.clientHeight < 80;
              }}
            >
              {ordered.map((message) => (
                <li key={message.id} className="pw-chat-message">
                  <div className="pw-chat-avatar" aria-hidden="true">
                    {message.author.fullName.trim().slice(0, 1).toUpperCase() || '?'}
                  </div>
                  <div className="pw-chat-body">
                    <div className="pw-chat-message-meta">
                      <strong>{message.author.fullName}</strong>
                      <time dateTime={message.createdAt}>
                        {messageTime(message.createdAt)}
                      </time>
                      {message.editedAt && <span>Edited</span>}
                    </div>
                    {message.replyTo && (
                      <div className="pw-chat-in-reply-to">
                        Reply to {message.replyTo.authorName}: {message.replyTo.preview}
                      </div>
                    )}
                    {editing?.id === message.id ? (
                      <form
                        className="pw-chat-edit"
                        onSubmit={(event) => {
                          event.preventDefault();
                          if (editing.body.trim() && !edit.isPending)
                            edit.mutate(editing);
                        }}
                      >
                        <textarea
                          aria-label="Edit message"
                          value={editing.body}
                          onChange={(event) =>
                            setEditing({ ...editing, body: event.target.value })
                          }
                          maxLength={4000}
                          disabled={edit.isPending}
                          required
                        />
                        {edit.isError && (
                          <p className="pw-collaboration-warning" role="alert">
                            {errorMessage(edit.error)}
                          </p>
                        )}
                        <div className="pw-chat-actions">
                          <button type="submit" disabled={edit.isPending || !editing.body.trim()}>
                            {edit.isPending ? 'Saving…' : 'Save'}
                          </button>
                          <button type="button" disabled={edit.isPending} onClick={() => setEditing(null)}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <p className="pw-chat-message-text">{message.body}</p>
                        {canWrite && (
                          <div className="pw-chat-actions">
                            <button type="button" onClick={() => setReplyTo(message)}>Reply</button>
                            {message.canEdit && (
                              <button
                                type="button"
                                onClick={() => {
                                  edit.reset();
                                  setEditing({ id: message.id, body: message.body, expectedEditedAt: message.editedAt });
                                }}
                              >
                                Edit
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
          {messages.isError && ordered.length > 0 && (
            <p className="pw-collaboration-warning" role="alert">
              New messages could not be refreshed. Showing saved messages.
            </p>
          )}
          {canWrite ? (
            <form className="pw-chat-composer" onSubmit={submit}>
              {replyTo && (
                <div className="pw-chat-reply-banner">
                  <span>Replying to {replyTo.author.fullName}</span>
                  <button type="button" onClick={() => setReplyTo(null)}>Cancel reply</button>
                </div>
              )}
              <label htmlFor="pw-chat-input">Message</label>
              <textarea
                id="pw-chat-input"
                placeholder="Write a message to your project team…"
                rows={3}
                maxLength={4000}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                disabled={send.isPending}
              />
              <div className="pw-chat-composer-footer">
                <span>{body.length} / 4000</span>
                <button type="submit" disabled={send.isPending || !body.trim()}>
                  {send.isPending ? 'Sending…' : 'Send message'}
                </button>
              </div>
              {send.isError && (
                <p className="pw-collaboration-warning" role="alert">
                  {errorMessage(send.error)}
                </p>
              )}
            </form>
          ) : (
            <p className="pw-collaboration-state">
              Project members and the Project Lead can send messages. You can read this conversation.
            </p>
          )}
        </>
      )}
    </section>
  );
}
