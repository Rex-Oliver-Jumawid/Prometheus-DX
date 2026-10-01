import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChatPushPreferenceRequestSchema,
  ChatPushPreferenceResponseSchema,
} from '../../../shared/contracts/notification';
import { apiFetch } from '../../lib/api';
import './chat-push-mute.css';

export function ChatPushMuteButton({
  accessToken,
  channelKey,
  label,
}: {
  accessToken?: string;
  channelKey: string;
  label: string;
}) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const queryKey = ['notifications', 'chat-push-preference', channelKey] as const;
  const preference = useQuery({
    queryKey,
    queryFn: () =>
      apiFetch(
        '/notifications/push/chat-preference?channelKey=' +
          encodeURIComponent(channelKey),
        ChatPushPreferenceResponseSchema,
        { accessToken },
      ),
    enabled: Boolean(accessToken),
    staleTime: 60_000,
  });

  const update = useMutation({
    mutationFn: (muted: boolean) =>
      apiFetch(
        '/notifications/push/chat-preference',
        ChatPushPreferenceResponseSchema,
        {
          accessToken,
          method: 'PUT',
          body: ChatPushPreferenceRequestSchema.parse({
            channelKey,
            muted,
          }),
        },
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
      void queryClient.invalidateQueries({
        queryKey: ['notifications', 'muted-chats'],
      });
    },
  });

  if (!accessToken) return null;

  const muted = preference.data?.muted ?? false;
  const busy = preference.isPending || update.isPending;

  return (
    <>
      <button
        type="button"
        className={
          muted ? 'chat-push-mute-button is-muted' : 'chat-push-mute-button'
        }
        aria-label={(muted ? 'Unmute ' : 'Mute ') + label + ' notifications'}
        aria-pressed={muted}
        title={
          muted
            ? 'Unmute device notifications for this chat'
            : 'Mute device notifications for this chat'
        }
        disabled={busy}
        onClick={() => {
          if (muted) {
            update.mutate(false);
          } else {
            setConfirmOpen(true);
          }
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 18h6" />
          <path d="M10 21h4" />
          <path d="M6.8 8.5a5.2 5.2 0 0 1 10.4 0c0 5 2.1 5.8 2.1 5.8H4.7s2.1-.8 2.1-5.8Z" />
          {muted && <path d="m5 5 14 14" />}
        </svg>
      </button>

      {confirmOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="chat-push-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setConfirmOpen(false);
            }}
          >
            <section
              className="chat-push-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="chat-push-mute-title"
            >
              <span className="chat-push-modal-eyebrow">
                DEVICE NOTIFICATIONS
              </span>
              <h2 id="chat-push-mute-title">Mute {label}?</h2>
              <p>
                You will stop receiving device banners for new messages and
                mentions from this chat. Messages and your Prometheus
                Notifications inbox will stay unchanged.
              </p>
              <div className="chat-push-modal-actions">
                <button type="button" onClick={() => setConfirmOpen(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary"
                  disabled={update.isPending}
                  onClick={() => {
                    setConfirmOpen(false);
                    update.mutate(true);
                  }}
                >
                  Mute chat
                </button>
              </div>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
