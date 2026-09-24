import {
  useInfiniteQuery,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { OutcomeWorkSchema, type OutcomeWork } from '../../../shared/contracts/outcome-work';
import {
  CreateVisiWorkMessageSchema,
  SetVisiWorkPresenceRequestSchema,
  UpdateVisiWorkMessageSchema,
  VisiWorkMessageContextResponseSchema,
  VisiWorkMessagePageSchema,
  VisiWorkMessageSchema,
  VisiWorkMessageSearchResponseSchema,
  VisiWorkPresenceResponseSchema,
  type VisiWorkMessage,
} from '../../../shared/contracts/visiwork';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../auth/auth-context';
import {
  projectWorkflowQuery,
  projectsListQuery,
} from '../projects/project-queries';
import {
  teamWorkKeys,
  teamWorkSummaryQuery,
} from '../work-sessions/work-session-queries';
import {
  buildVisiWorkModel,
  departmentStages,
  groupDepartmentProjects,
  projectStatusLabel,
  type VisiWorkDepartment,
  type VisiWorkOutcome,
  type VisiWorkProject,
  type VisiWorkStatusGroup,
} from './visiwork-model';
import './visiwork.css';

const groupLabels: Record<VisiWorkStatusGroup, string> = {
  PLANNING: 'Planning',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function DepartmentGlyph({ index }: { index: number }) {
  return (
    <span className="visiwork-department-glyph" aria-hidden="true">
      {index % 3 === 0 ? '⌁' : index % 3 === 1 ? '✦' : '◇'}
    </span>
  );
}

function WorkingChip({ name }: { name: string }) {
  return (
    <span className="visiwork-person-chip">
      <i aria-hidden="true" />
      {name}
    </span>
  );
}

function messageTime(value: string): string {
  return new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function chatError(value: unknown): string {
  return value instanceof Error ? value.message : 'Please try again.';
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
}

function MessageBody({ message }: { message: VisiWorkMessage }) {
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
          <mark className="visiwork-message-mention" key={index}>
            {part}
          </mark>
        ) : (
          part
        );
      })}
    </>
  );
}
function RoomPanel({
  roomType,
  title,
  subtitle,
  accessToken,
  currentMemberId,
  departmentId,
  mentionMembers,
}: {
  roomType: string;
  title: string;
  subtitle: string;
  accessToken?: string;
  currentMemberId?: string;
  departmentId?: string;
  mentionMembers: Array<{ id: string; fullName: string }>;
}) {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [body, setBody] = useState('');
  const [selectedMentions, setSelectedMentions] = useState<
    Array<{ id: string; fullName: string }>
  >([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [messageMenuId, setMessageMenuId] = useState<string | null>(null);
  const [pendingDeleteMessage, setPendingDeleteMessage] =
    useState<VisiWorkMessage | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const [editMentions, setEditMentions] = useState<
    Array<{ id: string; fullName: string }>
  >([]);
  const feedRef = useRef<HTMLDivElement>(null);
  const pinnedToBottom = useRef(true);
  const initiallyScrolled = useRef(false);
  const roomKey = departmentId ?? 'general';
  const queryKey = ['visiwork', 'messages', roomKey] as const;
  const basePath = departmentId
    ? '/visiwork/departments/' + departmentId + '/messages'
    : '/visiwork/messages';
  const targetMessageId = searchParams.get('message');

  const messages = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) =>
      apiFetch(
        basePath +
          (pageParam ? '?cursor=' + encodeURIComponent(pageParam) : ''),
        VisiWorkMessagePageSchema,
        { accessToken },
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: Boolean(accessToken),
    staleTime: 750,
    refetchInterval: 1_500,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  });

  const context = useQuery({
    queryKey: ['visiwork', 'message-context', targetMessageId],
    queryFn: () =>
      apiFetch(
        '/visiwork/messages/' + targetMessageId + '/context',
        VisiWorkMessageContextResponseSchema,
        { accessToken },
      ),
    enabled: Boolean(accessToken && targetMessageId),
    staleTime: 750,
    refetchInterval: targetMessageId ? 1_500 : false,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
    retry: false,
  });

  const search = useQuery({
    queryKey: ['visiwork', 'message-search', roomKey, searchTerm.trim()],
    queryFn: () => {
      const params = new URLSearchParams({ q: searchTerm.trim() });
      if (departmentId) params.set('departmentId', departmentId);
      return apiFetch(
        '/visiwork/messages/search?' + params.toString(),
        VisiWorkMessageSearchResponseSchema,
        { accessToken },
      );
    },
    enabled: Boolean(accessToken && searchOpen && searchTerm.trim()),
    staleTime: 5_000,
  });

  const send = useMutation({
    mutationFn: (input: { body: string; mentionMemberIds: string[] }) =>
      apiFetch(basePath, VisiWorkMessageSchema, {
        accessToken,
        method: 'POST',
        body: CreateVisiWorkMessageSchema.parse(input),
      }),
    onSuccess: async () => {
      setBody('');
      setSelectedMentions([]);
      pinnedToBottom.current = true;
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const editMessage = useMutation({
    mutationFn: (input: {
      messageId: string;
      body: string;
      mentionMemberIds: string[];
    }) =>
      apiFetch(
        '/visiwork/messages/' + input.messageId,
        VisiWorkMessageSchema,
        {
          accessToken,
          method: 'PATCH',
          body: UpdateVisiWorkMessageSchema.parse({
            body: input.body,
            mentionMemberIds: input.mentionMemberIds,
          }),
        },
      ),
    onSuccess: async () => {
      setEditingMessageId(null);
      setEditBody('');
      setEditMentions([]);
      setMessageMenuId(null);
      await queryClient.invalidateQueries({ queryKey: ['visiwork'] });
    },
  });

  const deleteMessage = useMutation({
    mutationFn: (messageId: string) =>
      apiFetch('/visiwork/messages/' + messageId, VisiWorkMessageSchema, {
        accessToken,
        method: 'DELETE',
      }),
    onSuccess: async () => {
      setMessageMenuId(null);
      setPendingDeleteMessage(null);
      setEditingMessageId(null);
      await queryClient.invalidateQueries({ queryKey: ['visiwork'] });
    },
  });

  const loaded = messages.data?.pages.flatMap((page) => page.items) ?? [];
  const contextual =
    context.data?.departmentId === (departmentId ?? null)
      ? context.data.items
      : [];
  const unique = new Map(
    [...contextual, ...loaded].map((message) => [message.id, message]),
  );
  const ordered = [...unique.values()].sort(
    (left, right) =>
      left.createdAt.localeCompare(right.createdAt) ||
      left.id.localeCompare(right.id),
  );
  const canWrite = messages.data?.pages[0]?.canWrite ?? !departmentId;
  const latestMessageId = ordered.at(-1)?.id;

  const mentionMatch = body.match(/(?:^|\s)@([^@\n]*)$/);
  const mentionQuery = mentionMatch?.[1]?.trim().toLowerCase() ?? null;
  const mentionSuggestions =
    mentionQuery === null
      ? []
      : mentionMembers
          .filter(
            (candidate) =>
              candidate.id !== currentMemberId &&
              candidate.fullName.toLowerCase().includes(mentionQuery) &&
              !selectedMentions.some((selected) => selected.id === candidate.id),
          )
          .slice(0, 6);

  const editMentionMatch = editBody.match(/(?:^|\s)@([^@\n]*)$/);
  const editMentionQuery =
    editMentionMatch?.[1]?.trim().toLowerCase() ?? null;
  const editMentionSuggestions =
    editMentionQuery === null
      ? []
      : mentionMembers
          .filter(
            (candidate) =>
              candidate.id !== currentMemberId &&
              candidate.fullName.toLowerCase().includes(editMentionQuery) &&
              !editMentions.some((selected) => selected.id === candidate.id),
          )
          .slice(0, 6);

  useLayoutEffect(() => {
    const feed = feedRef.current;
    if (!feed || ordered.length === 0) return;
    if (!initiallyScrolled.current || pinnedToBottom.current) {
      feed.scrollTop = feed.scrollHeight;
    }
    initiallyScrolled.current = true;
  }, [ordered.length, latestMessageId]);

  useLayoutEffect(() => {
    if (
      !targetMessageId ||
      !context.data ||
      context.data.departmentId !== (departmentId ?? null)
    ) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      const element = feedRef.current?.querySelector<HTMLElement>(
        '[data-message-id="' + targetMessageId + '"]',
      );
      element?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [departmentId, targetMessageId, context.data]);

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
    setEditBody(value);
    setEditMentions((current) =>
      current.filter((mention) => value.includes('@' + mention.fullName)),
    );
  }

  function selectEditMention(mention: { id: string; fullName: string }) {
    const match = editBody.match(/(?:^|\s)@([^@\n]*)$/);
    if (!match || match.index === undefined) return;
    const prefixLength = match[0].startsWith(' ') ? 1 : 0;
    const start = match.index + prefixLength;
    const next =
      editBody.slice(0, start) +
      '@' +
      mention.fullName +
      ' ' +
      editBody.slice(match.index + match[0].length);
    setEditBody(next);
    setEditMentions((current) => [...current, mention]);
  }

  function beginEdit(message: VisiWorkMessage) {
    setEditingMessageId(message.id);
    setEditBody(message.body);
    setEditMentions(message.mentions);
    setMessageMenuId(null);
  }

  function cancelEdit() {
    setEditingMessageId(null);
    setEditBody('');
    setEditMentions([]);
  }

  function submitEdit(event: FormEvent<HTMLFormElement>, messageId: string) {
    event.preventDefault();
    const trimmed = editBody.trim();
    if (!trimmed || trimmed.length > 2000 || editMessage.isPending) return;
    editMessage.mutate({
      messageId,
      body: trimmed,
      mentionMemberIds: editMentions.map((mention) => mention.id),
    });
  }

  function requestDelete(message: VisiWorkMessage) {
    setMessageMenuId(null);
    setPendingDeleteMessage(message);
  }

  function confirmDelete() {
    if (!pendingDeleteMessage || deleteMessage.isPending) return;
    deleteMessage.mutate(pendingDeleteMessage.id);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || trimmed.length > 2000 || !canWrite || send.isPending) {
      return;
    }
    send.mutate({
      body: trimmed,
      mentionMemberIds: selectedMentions.map((mention) => mention.id),
    });
  }

  function jumpToMessage(message: VisiWorkMessage) {
    const next = new URLSearchParams(searchParams);
    next.set('message', message.id);
    if (message.departmentId) next.set('department', message.departmentId);
    else next.delete('department');
    next.delete('view');
    pinnedToBottom.current = false;
    setSearchParams(next);
    setSearchOpen(false);
  }

  return (
    <aside className="visiwork-room" aria-label={title}>
      <header className="visiwork-room-header">
        <div>
          <span>{roomType}</span>
          <strong>{title}</strong>
          <small>{subtitle}</small>
        </div>
        <div className="visiwork-room-header-actions">
          <b>● LIVE</b>
          <button
            type="button"
            className={searchOpen ? 'active' : ''}
            aria-label={'Search ' + title}
            title="Search messages"
            onClick={() => setSearchOpen((current) => !current)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4 4" />
            </svg>
          </button>
        </div>
      </header>

      {searchOpen && (
        <section className="visiwork-chat-search" aria-label="Search messages">
          <div className="visiwork-chat-search-input">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4 4" />
            </svg>
            <input
              autoFocus
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={'Search ' + title + '...'}
              aria-label={'Search messages in ' + title}
            />
            {searchTerm && (
              <button type="button" onClick={() => setSearchTerm('')}>
                Clear
              </button>
            )}
          </div>
          <div className="visiwork-chat-search-results">
            {!searchTerm.trim() ? (
              <p>Search messages from this room.</p>
            ) : search.isPending ? (
              <p>Searching...</p>
            ) : search.isError ? (
              <p role="alert">{chatError(search.error)}</p>
            ) : search.data.items.length ? (
              search.data.items.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  className="visiwork-chat-search-result"
                  onClick={() => jumpToMessage(result)}
                >
                  <span>
                    <strong>{result.author.fullName}</strong>
                    <time dateTime={result.createdAt}>
                      {messageTime(result.createdAt)}
                    </time>
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

      <div
        className="visiwork-room-feed"
        ref={feedRef}
        onScroll={(event) => {
          const feed = event.currentTarget;
          pinnedToBottom.current =
            feed.scrollHeight - feed.scrollTop - feed.clientHeight < 70;
        }}
      >
        {messages.hasNextPage && (
          <button
            className="visiwork-chat-earlier"
            type="button"
            disabled={messages.isFetchingNextPage}
            onClick={() => void messages.fetchNextPage()}
          >
            {messages.isFetchingNextPage ? 'Loading...' : 'Load earlier'}
          </button>
        )}

        {context.isError && targetMessageId && (
          <div className="visiwork-chat-warning" role="alert">
            The linked message could not be loaded.
          </div>
        )}

        {messages.isPending ? (
          <div className="visiwork-room-empty" role="status">
            <span>Loading conversation...</span>
          </div>
        ) : messages.isError && ordered.length === 0 ? (
          <div className="visiwork-room-empty" role="alert">
            <span>Chat could not be loaded.</span>
            <small>{chatError(messages.error)}</small>
            <button type="button" onClick={() => void messages.refetch()}>
              Retry
            </button>
          </div>
        ) : ordered.length ? (
          ordered.map((message: VisiWorkMessage) => {
            const ownMessage = message.author.id === currentMemberId;
            const highlighted = message.id === targetMessageId;
            return (
              <div
                className={[
                  ownMessage
                    ? 'visiwork-room-message own'
                    : 'visiwork-room-message',
                  highlighted ? 'targeted' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                data-message-id={message.id}
                key={message.id}
              >
                {!ownMessage && (
                  <span className="visiwork-room-avatar">
                    {initials(message.author.fullName)}
                  </span>
                )}
                <div className={message.deletedAt ? 'deleted' : ''}>
                  <div className="visiwork-message-meta">
                    <small>
                      {ownMessage ? 'You' : message.author.fullName}
                      {' · '}
                      {messageTime(message.createdAt)}
                    </small>
                    <div className="visiwork-message-meta-right">
                      {message.editedAt && !message.deletedAt && (
                        <span
                          className="visiwork-message-edited"
                          title={
                            'Edited ' +
                            new Intl.DateTimeFormat('en-PH', {
                              hour: 'numeric',
                              minute: '2-digit',
                            }).format(new Date(message.editedAt))
                          }
                        >
                          Edited
                        </span>
                      )}
                      {ownMessage && !message.deletedAt && (
                        <div className="visiwork-message-actions">
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
                            <div className="visiwork-message-menu">
                              <button
                                type="button"
                                onClick={() => beginEdit(message)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="danger"
                                disabled={deleteMessage.isPending}
                                onClick={() => requestDelete(message)}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {editingMessageId === message.id ? (
                    <form
                      className="visiwork-message-edit-form"
                      onSubmit={(event) => submitEdit(event, message.id)}
                    >
                      <div className="visiwork-message-edit-input">
                        <textarea
                          autoFocus
                          value={editBody}
                          maxLength={2000}
                          disabled={editMessage.isPending}
                          onChange={(event) => updateEditBody(event.target.value)}
                          onKeyDown={(event) => {
                            if (
                              editMentionSuggestions.length > 0 &&
                              event.key === 'Tab'
                            ) {
                              event.preventDefault();
                              selectEditMention(editMentionSuggestions[0]);
                            }
                            if (event.key === 'Escape') cancelEdit();
                          }}
                        />
                        {editMentionSuggestions.length > 0 && (
                          <div className="visiwork-mention-menu" role="listbox">
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
                      <div className="visiwork-message-edit-actions">
                        <button type="button" onClick={cancelEdit}>
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={editMessage.isPending || !editBody.trim()}
                        >
                          {editMessage.isPending ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                      {editMessage.isError && (
                        <small className="visiwork-chat-send-error" role="alert">
                          {chatError(editMessage.error)}
                        </small>
                      )}
                    </form>
                  ) : (
                    <p>
                      {message.deletedAt ? (
                        <em>Message deleted</em>
                      ) : (
                        <MessageBody message={message} />
                      )}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="visiwork-room-empty">
            <span>No messages yet.</span>
            <small>Start the conversation in {title}.</small>
          </div>
        )}

        {messages.isError && ordered.length > 0 && (
          <div className="visiwork-chat-warning" role="alert">
            New messages could not be refreshed.
          </div>
        )}
      </div>

      {canWrite ? (
        <form className="visiwork-room-composer" onSubmit={submit}>
          <div className="visiwork-chat-input-wrap">
            <input
              aria-label={'Message ' + title}
              placeholder={
                departmentId ? 'Message this department...' : 'Message everyone...'
              }
              value={body}
              maxLength={2000}
              disabled={send.isPending}
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
            />
            {mentionSuggestions.length > 0 && (
              <div className="visiwork-mention-menu" role="listbox">
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
          <button
            type="submit"
            disabled={send.isPending || !body.trim()}
          >
            {send.isPending ? 'Sending' : 'Send'}
          </button>
          {send.isError && (
            <small className="visiwork-chat-send-error" role="alert">
              {chatError(send.error)}
            </small>
          )}
        </form>
      ) : (
        <div className="visiwork-chat-readonly">
          Join this department to send messages.
        </div>
      )}

      {pendingDeleteMessage && (
        <div
          className="visiwork-delete-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deleteMessage.isPending) {
              setPendingDeleteMessage(null);
            }
          }}
        >
          <div
            className="visiwork-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="visiwork-delete-title"
            aria-describedby="visiwork-delete-description"
          >
            <span className="visiwork-delete-modal-icon" aria-hidden="true">
              ×
            </span>
            <div>
              <h2 id="visiwork-delete-title">Delete message?</h2>
              <p id="visiwork-delete-description">
                This will remove the message for everyone in this chat.
              </p>
            </div>
            <div className="visiwork-delete-modal-actions">
              <button
                type="button"
                disabled={deleteMessage.isPending}
                onClick={() => setPendingDeleteMessage(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="danger"
                disabled={deleteMessage.isPending}
                onClick={confirmDelete}
              >
                {deleteMessage.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
            {deleteMessage.isError && (
              <small className="visiwork-delete-modal-error" role="alert">
                {chatError(deleteMessage.error)}
              </small>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}

function ViewSwitcher({ projectView }: { projectView: boolean }) {
  const [, setSearchParams] = useSearchParams();

  return (
    <div className="visiwork-switcher" aria-label="VisiWork view">
      <button
        type="button"
        className={projectView ? '' : 'active'}
        aria-pressed={!projectView}
        onClick={() => setSearchParams({})}
      >
        Department
      </button>
      <button
        type="button"
        className={projectView ? 'active' : ''}
        aria-pressed={projectView}
        onClick={() => setSearchParams({ view: 'projects' })}
      >
        Projects
      </button>
    </div>
  );
}

function BirdViewBreadcrumb({ projectView }: { projectView: boolean }) {
  return (
    <nav className="visiwork-breadcrumb" aria-label="VisiWork breadcrumb">
      <span>VisiWork</span>
      <i>/</i>
      <strong>{projectView ? 'Projects' : "Bird's View"}</strong>
    </nav>
  );
}

function DepartmentCard({
  department,
  index,
  joined,
  joining,
  joinError,
  onJoin,
  onEnter,
}: {
  department: VisiWorkDepartment;
  index: number;
  joined: boolean;
  joining: boolean;
  joinError: string | null;
  onJoin: () => void;
  onEnter: () => void;
}) {
  const visibleMembers = department.members.slice(0, 3);
  const visibleProjects = department.projects.slice(0, 4);

  return (
    <article className="visiwork-department-card">
      <header>
        <div className="visiwork-department-title">
          <DepartmentGlyph index={index} />
          <div>
            <strong>{department.name}</strong>
            <small>Projects, people, and delivery activity.</small>
          </div>
        </div>
        <span className="visiwork-working-count">
          <i aria-hidden="true" />
          {department.workingMembers.length} working
        </span>
      </header>

      <div className="visiwork-presence-row">
        {visibleMembers.length ? (
          visibleMembers.map((member) => (
            <div className="visiwork-presence-card" key={member.id}>
              <strong title={member.fullName}>{member.fullName}</strong>
              <span className={member.workingNow ? 'working' : ''}>
                <i aria-hidden="true" />
                {member.workingNow ? 'Currently working' : 'Not working'}
              </span>
            </div>
          ))
        ) : (
          <div className="visiwork-card-empty">No active members assigned.</div>
        )}
      </div>

      <div className="visiwork-department-projects">
        {visibleProjects.length ? (
          visibleProjects.map((project) => (
            <div className="visiwork-mini-project" key={project.id}>
              <span
                className="visiwork-mini-progress"
                style={{ width: clampPercent(project.progress) + '%' }}
                aria-hidden="true"
              />
              <div className="visiwork-mini-project-heading">
                <strong title={project.name}>{project.name}</strong>
                <b>{clampPercent(project.progress)}%</b>
              </div>
              <p title={project.description}>{project.description}</p>
              <div className="visiwork-mini-project-people">
                {(project.workingMemberNames.length
                  ? project.workingMemberNames
                  : project.memberNames
                )
                  .slice(0, 2)
                  .map((name) => (
                    <WorkingChip key={name} name={name} />
                  ))}
              </div>
            </div>
          ))
        ) : (
          <div className="visiwork-card-empty">No active projects assigned.</div>
        )}
      </div>

      <footer>
        <span>
          {department.projects.length} active project
          {department.projects.length === 1 ? '' : 's'}
        </span>
        <button
          className={joined ? 'visiwork-join-button joined' : 'visiwork-join-button'}
          type="button"
          disabled={joining || joined}
          aria-pressed={joined}
          title={joinError ?? (joined ? 'You are working in this department.' : undefined)}
          onClick={onJoin}
        >
          {joining ? 'Joining...' : joined ? 'Joined' : 'Join'}
        </button>
        <button className="visiwork-enter-button" type="button" onClick={onEnter}>
          Enter {department.shortLabel} →
        </button>
      </footer>
    </article>
  );
}

function ProjectCard({ project }: { project: VisiWorkProject }) {
  const participants = project.workingMemberNames.length
    ? project.workingMemberNames
    : project.memberNames;

  return (
    <article className="visiwork-project-card">
      <header>
        <span>{project.isParticipating ? 'PRIMARY WORKSPACE' : 'COMPANY PROJECT'}</span>
        <b>{projectStatusLabel(project.status).toUpperCase()}</b>
      </header>
      <h2>{project.name}</h2>
      <p>{project.description}</p>

      <div className="visiwork-project-progress">
        <div>
          <span>OVERALL PROJECT PROGRESS</span>
          <strong>{clampPercent(project.progress)}%</strong>
        </div>
        <div className="visiwork-progress-track" aria-hidden="true">
          <i style={{ width: clampPercent(project.progress) + '%' }} />
        </div>
      </div>

      <div className="visiwork-project-metrics">
        <div>
          <span>OPEN OUTCOMES</span>
          <strong>
            {project.openOutcomes} / {project.totalOutcomes} outcomes
          </strong>
        </div>
        <div>
          <span>ACTIVE STAGES</span>
          <strong>
            {project.activeStagesCount} stage
            {project.activeStagesCount === 1 ? '' : 's'}
          </strong>
        </div>
      </div>

      <div className="visiwork-tag-row">
        {project.departments.slice(0, 4).map((department) => (
          <span key={department.id}>{department.shortLabel}</span>
        ))}
      </div>
      <div className="visiwork-project-people">
        {participants.slice(0, 3).map((name) => (
          <WorkingChip key={name} name={name} />
        ))}
      </div>
      <div className="visiwork-current-stage">
        <strong>Current:</strong>{' '}
        <span>{project.currentStageName ?? 'No active stage'}</span>
      </div>

      <footer>
        <span>
          {project.departments.length} department
          {project.departments.length === 1 ? '' : 's'} involved
        </span>
        <Link to={'/projects/' + project.id}>Open Workspace →</Link>
      </footer>
    </article>
  );
}

function outcomeState(
  outcome: VisiWorkOutcome,
  work: OutcomeWork | undefined,
): { label: string; progress: number } {
  if (outcome.lifecycleStatus === 'ACCEPTED') {
    return { label: 'Accepted', progress: 100 };
  }
  const progress = clampPercent(work?.progress ?? 0);
  if (outcome.lifecycleStatus === 'NEEDS_REVISION') {
    return { label: 'Needs revision', progress };
  }
  if (progress > 0) return { label: 'In progress', progress };
  return { label: 'Planned', progress };
}

function DepartmentProjectDetail({
  project,
  departmentId,
  workByOutcome,
}: {
  project: VisiWorkProject;
  departmentId: string;
  workByOutcome: Map<string, OutcomeWork>;
}) {
  const stages = departmentStages(project, departmentId);
  const [expanded, setExpanded] = useState(false);
  const detailsId = `visiwork-project-details-${project.id}`;

  return (
    <article
      className={
        expanded
          ? 'visiwork-department-project-detail expanded'
          : 'visiwork-department-project-detail'
      }
    >
      <button
        type="button"
        className="visiwork-department-project-summary"
        aria-expanded={expanded}
        aria-controls={detailsId}
        onClick={() => setExpanded((current) => !current)}
      >
        <span className="visiwork-project-disclosure" aria-hidden="true">
          {expanded ? '▼' : '▶'}
        </span>
        <span className="visiwork-department-project-copy">
          <strong>{project.name}</strong>
          <p>{project.description}</p>
        </span>
        <span className="visiwork-project-inline-progress">
          <span className="visiwork-progress-track" aria-hidden="true">
            <i style={{ width: clampPercent(project.progress) + '%' }} />
          </span>
          <span>{clampPercent(project.progress)}%</span>
        </span>
      </button>

      {expanded && (
        <div className="visiwork-project-details" id={detailsId}>
          {stages.length ? (
            stages.map((stage) => {
              const openCount = stage.outcomes.filter(
                (outcome) => outcome.lifecycleStatus !== 'ACCEPTED',
              ).length;
              return (
                <section className="visiwork-stage" key={stage.id}>
                  <header>
                    <strong>{stage.name}</strong>
                    <span>
                      {openCount} open / {stage.outcomes.length} assigned
                    </span>
                  </header>
                  <div className="visiwork-outcome-list">
                    {stage.outcomes.map((outcome) => {
                      const state = outcomeState(
                        outcome,
                        workByOutcome.get(outcome.id),
                      );
                      return (
                        <div className="visiwork-outcome" key={outcome.id}>
                          <div>
                            <strong>{outcome.title}</strong>
                            <div className="visiwork-outcome-people">
                              {outcome.memberNames.slice(0, 3).map((name) => (
                                <span key={name}>{name}</span>
                              ))}
                            </div>
                          </div>
                          <span>
                            {state.label} · {state.progress}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })
          ) : (
            <div className="visiwork-detail-empty">
              No outcomes are assigned to this department in this project yet.
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function DepartmentView({
  department,
  workByOutcome,
  accessToken,
  currentMemberId,
  onBack,
}: {
  department: VisiWorkDepartment;
  workByOutcome: Map<string, OutcomeWork>;
  accessToken?: string;
  currentMemberId?: string;
  onBack: () => void;
}) {
  const groups = groupDepartmentProjects(department);
  const [expanded, setExpanded] = useState<Record<VisiWorkStatusGroup, boolean>>({
    PLANNING: true,
    IN_PROGRESS: false,
    DONE: true,
  });

  return (
    <div className="visiwork-department-view">
      <div className="visiwork-detail-toolbar">
        <button type="button" onClick={onBack}>
          ← Back to Bird&apos;s View
        </button>
        <nav className="visiwork-breadcrumb" aria-label="VisiWork breadcrumb">
          <span>VisiWork</span>
          <i>/</i>
          <button type="button" onClick={onBack}>
            Bird&apos;s View
          </button>
          <i>›</i>
          <strong>{department.shortLabel}</strong>
        </nav>
      </div>

      <div className="visiwork-main-grid visiwork-detail-grid">
        <section className="visiwork-detail-panel">
          <header className="visiwork-detail-heading">
            <div>
              <h1>{department.name} Department View</h1>
              <p>Projects, stages, and outcomes this department is responsible for.</p>
            </div>
            <span>VIEW ONLY</span>
          </header>

          <div className="visiwork-status-groups">
            {(Object.keys(groupLabels) as VisiWorkStatusGroup[]).map((status) => {
              const isExpanded = expanded[status];
              return (
                <section className="visiwork-status-group" key={status}>
                  <button
                    type="button"
                    className="visiwork-status-heading"
                    aria-expanded={isExpanded}
                    onClick={() =>
                      setExpanded((current) => ({
                        ...current,
                        [status]: !current[status],
                      }))
                    }
                  >
                    <span>{isExpanded ? '▼' : '▶'}</span>
                    <i className={status.toLowerCase()} aria-hidden="true">
                      {status === 'DONE' ? '✓' : ''}
                    </i>
                    <strong>{groupLabels[status]}</strong>
                    <b>{groups[status].length}</b>
                  </button>
                  {isExpanded && (
                    <div className="visiwork-status-body">
                      {groups[status].length ? (
                        groups[status].map((project) => (
                          <DepartmentProjectDetail
                            key={project.id}
                            project={project}
                            departmentId={department.id}
                            workByOutcome={workByOutcome}
                          />
                        ))
                      ) : (
                        <div className="visiwork-detail-empty">
                          No {groupLabels[status].toLowerCase()} projects.
                        </div>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </section>

        <RoomPanel
          roomType="DEPARTMENT ROOM"
          title={department.shortLabel + ' Chat'}
          subtitle={department.workingMembers.length + ' members currently working'}
          accessToken={accessToken}
          currentMemberId={currentMemberId}
          departmentId={department.id}
          mentionMembers={department.members.map((departmentMember) => ({
            id: departmentMember.id,
            fullName: departmentMember.fullName,
          }))}
        />
      </div>
    </div>
  );
}

function VisiWorkSkeleton() {
  return (
    <section className="visiwork-page visiwork-skeleton" role="status" aria-label="Loading VisiWork">
      <div className="visiwork-skeleton-toolbar" />
      <div className="visiwork-main-grid">
        <div className="visiwork-birds-panel">
          <div className="visiwork-department-grid">
            {Array.from({ length: 4 }, (_, index) => (
              <div className="visiwork-skeleton-card" key={index} />
            ))}
          </div>
        </div>
        <div className="visiwork-skeleton-room" />
      </div>
    </section>
  );
}

export function VisiWorkPage() {
  const { member, session } = useAuth();
  const queryClient = useQueryClient();
  const accessToken = session?.access_token;
  const [searchParams, setSearchParams] = useSearchParams();
  const projectView = searchParams.get('view') === 'projects';
  const selectedDepartmentId = searchParams.get('department');

  const projects = useQuery(projectsListQuery(accessToken));
  const team = useQuery({
    ...teamWorkSummaryQuery(accessToken),
    refetchInterval: 30_000,
  });
  const joinDepartment = useMutation({
    mutationFn: (departmentId: string) =>
      apiFetch('/visiwork/presence', VisiWorkPresenceResponseSchema, {
        accessToken,
        method: 'PUT',
        body: SetVisiWorkPresenceRequestSchema.parse({ departmentId }),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: teamWorkKeys.all }),
  });
  const workflowQueries = useQueries({
    queries: (projects.data ?? []).map((project) =>
      projectWorkflowQuery(project.id, accessToken),
    ),
  });

  const workflows = workflowQueries.flatMap((query) =>
    query.data ? [query.data] : [],
  );
  const waitingForWorkflows =
    Boolean(projects.data?.length) && workflowQueries.some((query) => query.isPending);
  const workflowError = workflowQueries.find(
    (query) => query.isError && !query.data,
  )?.error;

  const model = team.data
    ? buildVisiWorkModel(projects.data ?? [], workflows, team.data)
    : null;

  const selectedDepartment = model?.departments.find(
    (department) => department.id === selectedDepartmentId,
  );

  const departmentOutcomeRefs = (() => {
    if (!selectedDepartment) return [];
    const refs = new Map<string, { projectId: string; outcomeId: string }>();
    for (const project of selectedDepartment.projects) {
      for (const stage of departmentStages(project, selectedDepartment.id)) {
        for (const outcome of stage.outcomes) {
          refs.set(outcome.id, {
            projectId: project.id,
            outcomeId: outcome.id,
          });
        }
      }
    }
    return [...refs.values()];
  })();

  const outcomeWorkQueries = useQueries({
    queries: departmentOutcomeRefs.map((ref) => ({
      queryKey: ['visiwork', 'outcome-work', ref.projectId, ref.outcomeId],
      queryFn: () =>
        apiFetch(
          '/projects/' + ref.projectId + '/outcomes/' + ref.outcomeId + '/work',
          OutcomeWorkSchema,
          { accessToken },
        ),
      staleTime: 15_000,
      retry: false,
      enabled: Boolean(accessToken),
    })),
  });

  const workByOutcome = new Map<string, OutcomeWork>();
  departmentOutcomeRefs.forEach((ref, index) => {
    const data = outcomeWorkQueries[index]?.data;
    if (data) workByOutcome.set(ref.outcomeId, data);
  });

  if (projects.isPending || team.isPending || waitingForWorkflows) {
    return <VisiWorkSkeleton />;
  }

  if (
    (projects.isError && !projects.data) ||
    (team.isError && !team.data) ||
    workflowError ||
    !team.data ||
    !model
  ) {
    const message =
      projects.error?.message ??
      team.error?.message ??
      (workflowError instanceof Error ? workflowError.message : null) ??
      'VisiWork data could not be loaded.';
    return (
      <section className="visiwork-state" role="alert">
        <span>OPERATIONAL VISIBILITY</span>
        <h1>VisiWork could not be loaded</h1>
        <p>{message}</p>
        <button
          type="button"
          onClick={() => {
            void projects.refetch();
            void team.refetch();
            workflowQueries.forEach((query) => void query.refetch());
          }}
        >
          Try again
        </button>
      </section>
    );
  }

  const currentTeamMember = team.data.members.find(
    (teamMember) => teamMember.id === member?.id,
  );
  const joinedDepartmentId = currentTeamMember?.visiworkDepartmentId ?? null;

  if (selectedDepartmentId) {
    if (!selectedDepartment) {
      return (
        <section className="visiwork-state">
          <span>OPERATIONAL VISIBILITY</span>
          <h1>Department not found</h1>
          <p>The selected department is no longer available in VisiWork.</p>
          <button type="button" onClick={() => setSearchParams({})}>
            Back to Bird&apos;s View
          </button>
        </section>
      );
    }

    return (
      <DepartmentView
        department={selectedDepartment}
        workByOutcome={workByOutcome}
        accessToken={accessToken}
        currentMemberId={member?.id}
        onBack={() => setSearchParams({})}
      />
    );
  }

  return (
    <section className="visiwork-page" aria-label="VisiWork Bird's View">
      <div className="visiwork-toolbar">
        <ViewSwitcher projectView={projectView} />
        <BirdViewBreadcrumb projectView={projectView} />
      </div>

      <div className="visiwork-main-grid">
        <section className="visiwork-birds-panel">
          {projectView ? (
            model.projects.length ? (
              <div className="visiwork-project-grid">
                {model.projects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            ) : (
              <div className="visiwork-empty-state">No projects are available yet.</div>
            )
          ) : model.departments.length ? (
            <div className="visiwork-department-grid">
              {model.departments.map((department, index) => (
                <DepartmentCard
                  key={department.id}
                  department={department}
                  index={index}
                  joined={joinedDepartmentId === department.id}
                  joining={
                    joinDepartment.isPending &&
                    joinDepartment.variables === department.id
                  }
                  joinError={
                    joinDepartment.isError &&
                    joinDepartment.variables === department.id
                      ? joinDepartment.error.message
                      : null
                  }
                  onJoin={() => joinDepartment.mutate(department.id)}
                  onEnter={() =>
                    setSearchParams({ department: department.id })
                  }
                />
              ))}
            </div>
          ) : (
            <div className="visiwork-empty-state">No departments are available yet.</div>
          )}
        </section>

        <RoomPanel
          roomType="GENERAL ROOM"
          title="General Chat"
          subtitle={team.data.summary.workingNowCount + ' working now · company-wide'}
          accessToken={accessToken}
          currentMemberId={member?.id}
          mentionMembers={team.data.members.map((teamMember) => ({
            id: teamMember.id,
            fullName: teamMember.fullName,
          }))}
        />
      </div>
    </section>
  );
}
