import { useCallback, useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabase';

type RealtimeInvalidationOptions = {
  topic: string;
  event?: string;
  onEvent: () => void;
};

export function useRealtimeInvalidation({
  topic,
  event = 'changed',
  onEvent,
}: RealtimeInvalidationOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const channel = supabase
      .channel(topic)
      .on('broadcast', { event }, () => onEventRef.current())
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current === channel) channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [event, topic]);

  return useCallback(() => {
    const channel = channelRef.current;
    if (!channel) return;

    void channel.send({
      type: 'broadcast',
      event,
      payload: {},
    });
  }, [event]);
}
