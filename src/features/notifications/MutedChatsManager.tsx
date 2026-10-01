import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  ChatPushMutedChatsResponseSchema,
  ChatPushPreferenceRequestSchema,
  ChatPushPreferenceResponseSchema,
  type ChatPushMutedChat,
} from '../../../shared/contracts/notification';
import { apiFetch } from '../../lib/api';
import './chat-push-mute.css';

const mutedChatsQueryKey = ['notifications', 'muted-chats'] as const;

function kindLabel(kind: ChatPushMutedChat['kind']) {
  if (kind === 'project') return 'Project Chat';
  if (kind === 'department') return 'Department Chat';
  return 'VisiWork';
}

export function MutedChatsManager({
  accessToken,
}: {
  accessToken?: string;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const mutedChats = useQuery({
    queryKey: mutedChatsQueryKey,
    queryFn: () =>
      apiFetch(
        '/notifications/push/muted-chats',
        ChatPushMutedChatsResponseSchema,
        { accessToken },
      ),
    enabled: Boolean(accessToken),
    staleTime: 30_000,
  });

  const unmute = useMutation({
    mutationFn: (item: ChatPushMutedChat) =>
      apiFetch(
        '/notifications/push/chat-preference',
        ChatPushPreferenceResponseSchema,
        {
          accessToken,
          method: 'PUT',
          body: ChatPushPreferenceRequestSchema.parse({
            channelKey: item.channelKey,
            muted: false,
          }),
        },
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(
        ['notifications', 'chat-push-preference', data.channelKey],
        data,
      );
      void queryClient.invalidateQueries({ queryKey: mutedChatsQueryKey });
    },
  });

  if (!accessToken) return null;

  const items = Array.isArray(mutedChats.data?.items)
    ? mutedChats.data.items
    : [];
  const count = items.length;

  return (
    <>
      <button
        type="button"
        className="device-push-manage-muted"
        onClick={() => setOpen(true)}
      >
        Muted chats{count > 0 ? ` (${count})` : ''}
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="chat-push-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setOpen(false);
            }}
          >
            <section
              className="chat-push-modal chat-push-manager"
              role="dialog"
              aria-modal="true"
              aria-labelledby="muted-chats-title"
            >
              <div className="chat-push-manager-header">
                <div>
                  <span className="chat-push-modal-eyebrow">
                    DEVICE NOTIFICATIONS
                  </span>
                  <h2 id="muted-chats-title">Muted chats</h2>
                  <p>
                    Manage chats that are currently blocked from sending device
                    notification banners.
                  </p>
                </div>
                <button
                  type="button"
                  className="chat-push-manager-close"
                  aria-label="Close muted chats"
                  onClick={() => setOpen(false)}
                >
                  ×
                </button>
              </div>

              {mutedChats.isPending ? (
                <div className="chat-push-manager-state">Loading muted chats...</div>
              ) : mutedChats.isError ? (
                <div className="chat-push-manager-state error" role="alert">
                  <span>{mutedChats.error.message}</span>
                  <button
                    type="button"
                    onClick={() => void mutedChats.refetch()}
                  >
                    Try again
                  </button>
                </div>
              ) : items.length === 0 ? (
                <div className="chat-push-manager-state">
                  <strong>No muted chats</strong>
                  <span>All included chats can send device notification banners.</span>
                </div>
              ) : (
                <ul className="chat-push-manager-list">
                  {items.map((item) => (
                    <li key={item.channelKey}>
                      <div className="chat-push-manager-copy">
                        <strong>{item.label}</strong>
                        <span>{kindLabel(item.kind)}</span>
                      </div>
                      <div className="chat-push-manager-row-actions">
                        <Link to={item.path} onClick={() => setOpen(false)}>
                          Open
                        </Link>
                        <button
                          type="button"
                          disabled={
                            unmute.isPending &&
                            unmute.variables?.channelKey === item.channelKey
                          }
                          onClick={() => unmute.mutate(item)}
                        >
                          {unmute.isPending &&
                          unmute.variables?.channelKey === item.channelKey
                            ? 'Unmuting...'
                            : 'Unmute'}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="chat-push-modal-actions">
                <button type="button" onClick={() => setOpen(false)}>
                  Close
                </button>
              </div>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
