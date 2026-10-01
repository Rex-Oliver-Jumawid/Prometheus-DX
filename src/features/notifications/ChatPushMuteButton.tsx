import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
    },
  });

  if (!accessToken) return null;

  const muted = preference.data?.muted ?? false;
  const busy = preference.isPending || update.isPending;

  return (
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
      onClick={() => update.mutate(!muted)}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 18h6" />
        <path d="M10 21h4" />
        <path d="M6.8 8.5a5.2 5.2 0 0 1 10.4 0c0 5 2.1 5.8 2.1 5.8H4.7s2.1-.8 2.1-5.8Z" />
        {muted && <path d="m5 5 14 14" />}
      </svg>
    </button>
  );
}
