import { useCallback, useEffect, useRef, useState } from "react";
import {
  useSocket,
  type EventChatSocketMessage,
} from "~/contexts/SocketContext";
import { podsApi, type EventChatMessageData } from "~/lib/api";
import { useAuth } from "~/contexts/AuthContext";

interface UseEventChatOptions {
  podId: string;
  eventId: string;
}

export function useEventChat({ podId, eventId }: UseEventChatOptions) {
  const { user } = useAuth();
  const {
    joinEventChat,
    leaveEventChat,
    onEventChatMessage,
    isConnected,
  } = useSocket();
  const [messages, setMessages] = useState<EventChatMessageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [sending, setSending] = useState(false);
  const initialLoadDone = useRef(false);

  const loadInitialMessages = useCallback(async () => {
    if (!podId || !eventId) return;
    setLoading(true);
    const result = await podsApi.getChatMessages(podId, eventId, { limit: 50 });
    if (result.data) {
      setMessages(result.data.messages);
      setHasMore(result.data.hasMore);
    }
    setLoading(false);
    initialLoadDone.current = true;
  }, [podId, eventId]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || messages.length === 0) return;
    setLoadingMore(true);
    const oldestMessage = messages[0];
    const result = await podsApi.getChatMessages(podId, eventId, {
      before: oldestMessage.createdAt,
      limit: 50,
    });
    if (result.data) {
      setMessages((prev) => [...result.data!.messages, ...prev]);
      setHasMore(result.data.hasMore);
    }
    setLoadingMore(false);
  }, [podId, eventId, hasMore, loadingMore, messages]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || sending) return;
      setSending(true);
      const result = await podsApi.sendChatMessage(
        podId,
        eventId,
        content.trim(),
      );
      if (result.data) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === result.data!.id)) return prev;
          return [...prev, result.data!];
        });
      }
      setSending(false);
    },
    [podId, eventId, sending],
  );

  // Socket: join room, listen for messages, cleanup
  useEffect(() => {
    if (!eventId || !isConnected) return;

    joinEventChat(eventId);

    const unsubscribe = onEventChatMessage((msg: EventChatSocketMessage) => {
      if (msg.eventId !== eventId) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    return () => {
      leaveEventChat(eventId);
      unsubscribe();
    };
  }, [eventId, isConnected, joinEventChat, leaveEventChat, onEventChatMessage]);

  // Load initial messages on mount
  useEffect(() => {
    if (!initialLoadDone.current) {
      loadInitialMessages();
    }
  }, [loadInitialMessages]);

  return {
    messages,
    loading,
    loadingMore,
    hasMore,
    sending,
    sendMessage,
    loadMore,
    currentUserId: user?.id ?? null,
  };
}
