import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  CreateProjectMessageSchema,
  DeleteProjectMessageSchema,
  EditProjectMessageSchema,
  ProjectMessageContextResponseSchema,
  ProjectMessagePageSchema,
  ProjectMessageSchema,
  ProjectMessageSearchResponseSchema,
  type ProjectMessage,
} from '../../../shared/contracts/project-chat';
import { ProjectMembersResponseSchema } from '../../../shared/contracts/project-workflow';
import { apiFetch } from '../../lib/api';
import './project-collaboration.css';

function messageTime(date: string) {
  return new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date));
}

function errorMessage(value: unknown) {
  return value instanceof Error ? value.message : 'Please try again.';
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
}

function MessageBody({ message }: { message: ProjectMessage }) {
  const names = message.mentions
    .map((mention) => mention.fullName)
    .sort((left, right) => right.length - left.length);

  if (!names.length) return <>{message.body}</>;

  const matcher = new RegExp(
    '(@(?:' + names.map(escapeRegExp).join('|') + '))',
    'gi',
  );

  return (
    <>
      {message.body.split(matcher).map((part, index) => {
        const isMention = names.some(
          (name) => part.toLowerCase() === '@' + name.toLowerCase(),
        );
        return isMention ? (
          <mark className="pw-chat-mention" key={index}>
            {part}
          </mark>
        ) : (
          part
        );
      })}
    </>
  );
}

export function ProjectChatPanel({
  projectId,
  projectName,
  projectLead,
  currentMemberId,
  accessToken,
  initialMessageId,
}: {
  projectId: string;
  projectName: string;
  projectLead?: { id: string; fullName: string; email: string };
  currentMemberId?: string;
  accessToken?: string;
  initialMessageId?: string | null;
}) {
  const queryClient = useQueryClient();
  const queryKey = ['projects', projectId, 'chat'] as const;
  const [body, setBody] = useState('');
  const [selectedMentions, setSelectedMentions] = useState<
    Array<{ id: string; fullName: string }>
  >([]);
  const [replyTo, setReplyTo] = useState<ProjectMessage | null>(null);
  const [editing, setEditing] = useState<{
    id: string;
    body: string;
    expectedEditedAt: string | null;
    mentions: Array<{ id: string; fullName: string }>;
  } | null>(null);
  const [messageMenuId, setMessageMenuId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ProjectMessage | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [targetMessageId, setTargetMessageId] = useState<string | null>(initialMessageId ?? null);
  const threadRef = useRef<HTMLOListElement>(null);
  const pinnedToBottom = useRef(true);
  const initiallyScrolled = useRef(false);
  const olderScroll = useRef<{ top: number; height: number; pageCount: number } | null>(null);

  useEffect(() => {
    setTargetMessageId(initialMessageId ?? null);
    if (initialMessageId) pinnedToBottom.current = false;
  }, [initialMessageId]);

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

  const members = useQuery({
    queryKey: ['projects', 'members', projectId],
    queryFn: () =>
      apiFetch('/projects/' + projectId + '/members', ProjectMembersResponseSchema, {
        accessToken,
      }),
    enabled: Boolean(accessToken),
    retry: false,
    staleTime: 30_000,
  });

  const search = useQuery({
    queryKey: ['projects', projectId, 'chat-search', searchTerm.trim()],
    queryFn: () =>
      apiFetch(
        '/projects/' + projectId + '/messages/search?q=' +
          encodeURIComponent(searchTerm.trim()),
        ProjectMessageSearchResponseSchema,
        { accessToken },
      ),
    enabled: Boolean(accessToken && searchOpen && searchTerm.trim()),
    staleTime: 5_000,
  });

  const context = useQuery({
    queryKey: ['projects', projectId, 'chat-context', targetMessageId],
    queryFn: () =>
      apiFetch(
        '/projects/' + projectId + '/messages/' + targetMessageId + '/context',
        ProjectMessageContextResponseSchema,
        { accessToken },
      ),
    enabled: Boolean(accessToken && targetMessageId),
    staleTime: 5_000,
    retry: false,
  });

  const send = useMutation({
    mutationFn: (input: {
      body: string;
      parentMessageId: string | null;
      mentionMemberIds: string[];
    }) =>
      apiFetch(
        '/projects/' + projectId + '/messages',
        ProjectMessageSchema,
        {
          accessToken,
          method: 'POST',
          body: CreateProjectMessageSchema.parse(input),
        },
      ),
    onSuccess: async () => {
      setBody('');
      setSelectedMentions([]);
      setReplyTo(null);
      pinnedToBottom.current = true;
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const edit = useMutation({
    mutationFn: (input: {
      id: string;
      body: string;
      expectedEditedAt: string | null;
      mentionMemberIds: string[];
    }) =>
      apiFetch(
        '/projects/' + projectId + '/messages/' + input.id,
        ProjectMessageSchema,
        {
          accessToken,
          method: 'PATCH',
          body: EditProjectMessageSchema.parse({
            body: input.body,
            expectedEditedAt: input.expectedEditedAt,
            mentionMemberIds: input.mentionMemberIds,
          }),
        },
      ),
    onSuccess: async () => {
      setEditing(null);
      setMessageMenuId(null);
      await queryClient.invalidateQueries({ queryKey });
      if (targetMessageId) {
        await queryClient.invalidateQueries({
          queryKey: ['projects', projectId, 'chat-context', targetMessageId],
        });
      }
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const remove = useMutation({
    mutationFn: (message: ProjectMessage) =>
      apiFetch(
        '/projects/' + projectId + '/messages/' + message.id,
        ProjectMessageSchema,
        {
          accessToken,
          method: 'DELETE',
          body: DeleteProjectMessageSchema.parse({
            expectedEditedAt: message.editedAt,
          }),
        },
      ),
    onSuccess: async () => {
      setPendingDelete(null);
      setMessageMenuId(null);
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey });
      if (targetMessageId) {
        await queryClient.invalidateQueries({
          queryKey: ['projects', projectId, 'chat-context', targetMessageId],
        });
      }
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const memberChoices = [
    ...(projectLead ? [projectLead] : []),
    ...(members.data?.members?.map((item) => item.member) ?? []),
  ].filter(
    (candidate, index, all) =>
      all.findIndex((item) => item.id === candidate.id) === index,
  );

  const mentionMatch = body.match(/(?:^|\s)@([^@\n]*)$/);
  const mentionQuery = mentionMatch?.[1]?.trim().toLowerCase() ?? null;
  const mentionSuggestions =
    mentionQuery === null
      ? []
      : memberChoices
          .filter(
            (candidate) =>
              candidate.id !== currentMemberId &&
              candidate.fullName.toLowerCase().includes(mentionQuery) &&
              !selectedMentions.some((selected) => selected.id === candidate.id),
          )
          .slice(0, 6);

  const editMentionMatch = editing?.body.match(/(?:^|\s)@([^@\n]*)$/);
  const editMentionQuery = editMentionMatch?.[1]?.trim().toLowerCase() ?? null;
  const editMentionSuggestions =
    !editing || editMentionQuery === null
      ? []
      : memberChoices
          .filter(
            (candidate) =>
              candidate.id !== currentMemberId &&
              candidate.fullName.toLowerCase().includes(editMentionQuery) &&
              !editing.mentions.some((selected) => selected.id === candidate.id),
          )
          .slice(0, 6);

  const loaded: ProjectMessage[] = (
    messages.data?.pages.flatMap((page) => page.items) ?? []
  ).map((message) => ProjectMessageSchema.parse(message));
  const contextual: ProjectMessage[] = (context.data?.items ?? []).map(
    (message) => ProjectMessageSchema.parse(message),
  );
  const unique = new Map(
    [...contextual, ...loaded].map((message) => [message.id, message]),
  );
  const ordered = [...unique.values()].sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
  const canWrite = messages.data?.pages[0]?.canWrite ?? false;
  const pageCount = messages.data?.pages.length ?? 0;
  const firstMessageId = ordered[0]?.id;
  const lastMessageId = ordered[ordered.length - 1]?.id;

  useLayoutEffect(() => {
    const thread = threadRef.current;
    if (!thread || ordered.length === 0) return;
    const previous = olderScroll.current;
    if (previous) {
      if (pageCount <= previous.pageCount) {
        previous.top = thread.scrollTop;
        previous.height = thread.scrollHeight;
        return;
      }
      thread.scrollTop = previous.top + thread.scrollHeight - previous.height;
      olderScroll.current = null;
      pinnedToBottom.current =
        thread.scrollHeight - thread.scrollTop - thread.clientHeight < 80;
    } else if (!initiallyScrolled.current || pinnedToBottom.current) {
      thread.scrollTop = thread.scrollHeight;
    }
    initiallyScrolled.current = true;
  }, [pageCount, ordered.length, firstMessageId, lastMessageId]);

  useLayoutEffect(() => {
    if (!targetMessageId || !context.data) return;
    const frame = window.requestAnimationFrame(() => {
      const target = threadRef.current?.querySelector<HTMLElement>(
        '[data-message-id="' + targetMessageId + '"]',
      );
      target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [context.data, targetMessageId]);

  function updateBody(value: string) {
    setBody(value);
    setSelectedMentions((current) =>
      current.filter((mention) => value.includes('@' + mention.fullName)),
    );
  }

  function selectMention(mention: { id: string; fullName: string }) {
    const match = body.match(/(?:^|\s)@([^@\n]*)$/);
    if (!match || match.index === undefined) return;
    const prefixLength = match[0].startsWith(' ') ? 1 : 0;
    const start = match.index + prefixLength;
    const next =
      body.slice(0, start) +
      '@' +
      mention.fullName +
      ' ' +
      body.slice(match.index + match[0].length);
    setBody(next);
    setSelectedMentions((current) => [...current, mention]);
  }

  function updateEditBody(value: string) {
    if (!editing) return;
    setEditing({
      ...editing,
      body: value,
      mentions: editing.mentions.filter((mention) =>
        value.includes('@' + mention.fullName),
      ),
    });
  }

  function selectEditMention(mention: { id: string; fullName: string }) {
    if (!editing) return;
    const match = editing.body.match(/(?:^|\s)@([^@\n]*)$/);
    if (!match || match.index === undefined) return;
    const prefixLength = match[0].startsWith(' ') ? 1 : 0;
    const start = match.index + prefixLength;
    const next =
      editing.body.slice(0, start) +
      '@' +
      mention.fullName +
      ' ' +
      editing.body.slice(match.index + match[0].length);
    setEditing({
      ...editing,
      body: next,
      mentions: [...editing.mentions, mention],
    });
  }

  function beginEdit(message: ProjectMessage) {
    edit.reset();
    setMessageMenuId(null);
    setEditing({
      id: message.id,
      body: message.body,
      expectedEditedAt: message.editedAt,
      mentions: message.mentions,
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim() || body.length > 4000 || !canWrite || send.isPending) return;
    send.mutate({
      body,
      parentMessageId: replyTo?.id ?? null,
      mentionMemberIds: selectedMentions.map((mention) => mention.id),
    });
  }

  function jumpToMessage(message: ProjectMessage) {
    pinnedToBottom.current = false;
    setTargetMessageId(message.id);
    setSearchOpen(false);
  }

  return (
    <section className="pw-collaboration-panel pw-chat-panel" aria-label="Project chat">
      <div className="pw-chat-channel-heading">
        <div>
          <strong>{projectName}</strong>
          <span>Project channel</span>
        </div>
        <button
          type="button"
          className={searchOpen ? 'pw-chat-search-toggle is-active' : 'pw-chat-search-toggle'}
          aria-label="Search project conversation"
          title="Search messages"
          aria-expanded={searchOpen}
          onClick={() => setSearchOpen((current) => !current)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4 4" />
          </svg>
        </button>
      </div>

      {searchOpen && (
        <section className="pw-chat-search" aria-label="Search project messages">
          <div className="pw-chat-search-input">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4 4" />
            </svg>
            <input
              autoFocus
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={'Search ' + projectName + '...'}
              aria-label="Search project messages"
            />
            {searchTerm && (
              <button type="button" onClick={() => setSearchTerm('')}>Clear</button>
            )}
          </div>
          <div className="pw-chat-search-results">
            {!searchTerm.trim() ? (
              <p>Search the conversation and jump back to the matching message.</p>
            ) : search.isPending ? (
              <p>Searching...</p>
            ) : search.isError ? (
              <p role="alert">{errorMessage(search.error)}</p>
            ) : search.data.items.length ? (
              search.data.items.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  className="pw-chat-search-result"
                  onClick={() => jumpToMessage(ProjectMessageSchema.parse(result))}
                >
                  <span>
                    <strong>{result.author.fullName}</strong>
                    <time dateTime={result.createdAt}>{messageTime(result.createdAt)}</time>
                  </span>
                  <p>{result.body}</p>
                </button>
              ))
            ) : (
              <p>No matching messages.</p>
            )}
          </div>
        </section>
      )}

      {messages.isPending ? (
        <div role="status" className="pw-chat-loading" aria-label="Loading project messages">
          <span />
          <span />
          <span />
          <span />
        </div>
      ) : messages.isError && ordered.length === 0 ? (
        <div className="pw-chat-load-error" role="alert">
          <strong>Project chat could not be loaded.</strong>
          <p>{errorMessage(messages.error)}</p>
          <button type="button" onClick={() => void messages.refetch()}>Try again</button>
        </div>
      ) : (
        <>
          {messages.hasNextPage && (
            <button
              type="button"
              className="pw-collaboration-load-more"
              onClick={() => {
                const thread = threadRef.current;
                if (thread) {
                  olderScroll.current = {
                    top: thread.scrollTop,
                    height: thread.scrollHeight,
                    pageCount,
                  };
                }
                pinnedToBottom.current = false;
                void messages.fetchNextPage().then((result) => {
                  if (result.isError) {
                    olderScroll.current = null;
                    const current = threadRef.current;
                    if (current) {
                      pinnedToBottom.current =
                        current.scrollHeight - current.scrollTop - current.clientHeight < 80;
                    }
                  }
                });
              }}
              disabled={messages.isFetchingNextPage}
            >
              {messages.isFetchingNextPage ? 'Loading…' : 'Load earlier messages'}
            </button>
          )}

          {context.isError && targetMessageId && (
            <p className="pw-collaboration-warning" role="alert">
              The selected search result could not be loaded.
            </p>
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
              {ordered.map((message) => {
                const targeted = message.id === targetMessageId;
                return (
                  <li
                    key={message.id}
                    data-message-id={message.id}
                    className={[
                      message.canEdit ? 'pw-chat-message pw-chat-message--own' : 'pw-chat-message',
                      targeted ? 'pw-chat-message--targeted' : '',
                      message.deletedAt ? 'pw-chat-message--deleted' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <div className="pw-chat-avatar" aria-hidden="true">
                      {initials(message.author.fullName) || '?'}
                    </div>
                    <div className="pw-chat-body">
                      <div className="pw-chat-message-meta">
                        <strong>{message.author.fullName}</strong>
                        <time dateTime={message.createdAt}>{messageTime(message.createdAt)}</time>
                        {message.editedAt && !message.deletedAt && (
                          <span className="pw-chat-edited">Edited</span>
                        )}
                        {canWrite && (message.canEdit || message.canDelete) && !message.deletedAt && (
                          <div className="pw-chat-message-options">
                            <button
                              type="button"
                              aria-label="Message options"
                              aria-expanded={messageMenuId === message.id}
                              onClick={() =>
                                setMessageMenuId((current) =>
                                  current === message.id ? null : message.id,
                                )
                              }
                            >
                              ⋯
                            </button>
                            {messageMenuId === message.id && (
                              <div className="pw-chat-message-menu">
                                {message.canEdit && (
                                  <button type="button" onClick={() => beginEdit(message)}>
                                    Edit message
                                  </button>
                                )}
                                {message.canDelete && (
                                  <button
                                    type="button"
                                    className="danger"
                                    onClick={() => {
                                      setMessageMenuId(null);
                                      setPendingDelete(message);
                                    }}
                                  >
                                    Delete message
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
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
                            if (!editing.body.trim() || edit.isPending) return;
                            edit.mutate({
                              id: editing.id,
                              body: editing.body,
                              expectedEditedAt: editing.expectedEditedAt,
                              mentionMemberIds: editing.mentions.map((mention) => mention.id),
                            });
                          }}
                        >
                          <div className="pw-chat-edit-input">
                            <textarea
                              aria-label="Edit message"
                              value={editing.body}
                              onChange={(event) => updateEditBody(event.target.value)}
                              onKeyDown={(event) => {
                                if (
                                  editMentionSuggestions.length > 0 &&
                                  event.key === 'Tab'
                                ) {
                                  event.preventDefault();
                                  selectEditMention(editMentionSuggestions[0]);
                                }
                                if (event.key === 'Escape') setEditing(null);
                              }}
                              maxLength={4000}
                              disabled={edit.isPending}
                              required
                            />
                            {editMentionSuggestions.length > 0 && (
                              <div className="pw-chat-mention-menu" role="listbox">
                                {editMentionSuggestions.map((candidate) => (
                                  <button
                                    key={candidate.id}
                                    type="button"
                                    role="option"
                                    onClick={() => selectEditMention(candidate)}
                                  >
                                    <span>{initials(candidate.fullName)}</span>
                                    <strong>{candidate.fullName}</strong>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
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
                          <p className="pw-chat-message-text">
                            {message.deletedAt ? (
                              <em>Message deleted</em>
                            ) : (
                              <MessageBody message={message} />
                            )}
                          </p>
                          {canWrite && !message.deletedAt && (
                            <div className="pw-chat-actions">
                              <button type="button" onClick={() => setReplyTo(message)}>Reply</button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
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
              <label htmlFor="pw-chat-input" className="sr-only">Message</label>
              <div className="pw-chat-compose-row">
                <div className="pw-chat-input-wrap">
                  <textarea
                    id="pw-chat-input"
                    placeholder="Message the project..."
                    rows={1}
                    maxLength={4000}
                    value={body}
                    onChange={(event) => updateBody(event.target.value)}
                    onKeyDown={(event) => {
                      if (
                        mentionSuggestions.length > 0 &&
                        (event.key === 'Enter' || event.key === 'Tab')
                      ) {
                        event.preventDefault();
                        selectMention(mentionSuggestions[0]);
                      }
                    }}
                    disabled={send.isPending}
                  />
                  {mentionSuggestions.length > 0 && (
                    <div className="pw-chat-mention-menu" role="listbox">
                      {mentionSuggestions.map((candidate) => (
                        <button
                          key={candidate.id}
                          type="button"
                          role="option"
                          onClick={() => selectMention(candidate)}
                        >
                          <span>{initials(candidate.fullName)}</span>
                          <strong>{candidate.fullName}</strong>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button type="submit" aria-label="Send message" disabled={send.isPending || !body.trim()}>
                  {send.isPending ? 'Sending…' : 'Send'}
                </button>
              </div>
              <span className="sr-only" aria-live="polite">{body.length} / 4000 characters</span>
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

      {pendingDelete && (
        <div
          className="pw-chat-delete-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !remove.isPending) {
              setPendingDelete(null);
            }
          }}
        >
          <div
            className="pw-chat-delete-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pw-chat-delete-title"
            aria-describedby="pw-chat-delete-description"
          >
            <span className="pw-chat-delete-icon" aria-hidden="true">×</span>
            <div>
              <h3 id="pw-chat-delete-title">Delete message?</h3>
              <p id="pw-chat-delete-description">
                This removes the message for everyone while keeping replies connected to a deleted-message placeholder.
              </p>
            </div>
            <div className="pw-chat-delete-actions">
              <button
                type="button"
                disabled={remove.isPending}
                onClick={() => setPendingDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="danger"
                disabled={remove.isPending}
                onClick={() => remove.mutate(pendingDelete)}
              >
                {remove.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
            {remove.isError && (
              <p className="pw-collaboration-warning" role="alert">
                {errorMessage(remove.error)}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
