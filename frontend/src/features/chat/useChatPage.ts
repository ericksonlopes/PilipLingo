/**
 * Main hook for the chat page.
 * Manages state: AI status, active conversation, turns, loading, and errors.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { chatApi } from "../../lib/api";
import type {
  ChatGoal,
  ChatStatus,
  ChatTopic,
  Conversation,
  ConversationMode,
  ConversationTurn,
  ProficiencyLevel,
} from "../../lib/types";

export type ChatScreen =
  | "loading"
  | "mode-selector"
  | "topic-selector"
  | "goal-selector"
  | "chat-view"
  | "completed";

export interface UseChatPageReturn {
  screen: ChatScreen;
  chatStatus: ChatStatus | null;
  topics: ChatTopic[];
  goals: ChatGoal[];
  conversation: Conversation | null;
  turns: ConversationTurn[];
  isTyping: boolean;
  error: string | null;
  loadError: string | null;
  selectMode: (mode: ConversationMode) => void;
  goBack: () => void;
  startWithTopic: (topic: string) => Promise<void>;
  startWithGoal: (goal: string, goals?: string[]) => Promise<void>;
  startFree: () => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  abandonConversation: () => Promise<void>;
  completeConversation: () => Promise<void>;
  retryLoad: () => void;
  newConversation: () => void;
}

export function useChatPage(level: ProficiencyLevel): UseChatPageReturn {
  const [screen, setScreen] = useState<ChatScreen>("loading");
  const [chatStatus, setChatStatus] = useState<ChatStatus | null>(null);
  const [topics, setTopics] = useState<ChatTopic[]>([]);
  const [goals, setGoals] = useState<ChatGoal[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setScreen("loading");
    setLoadError(null);

    try {
      const [statusData, topicsData, goalsData, convPage] = await Promise.all([
        chatApi.status(ctrl.signal),
        chatApi.topics(ctrl.signal),
        chatApi.goals(ctrl.signal),
        chatApi.listConversations({ limit: 1, status: "active", signal: ctrl.signal }),
      ]);

      if (ctrl.signal.aborted) return;

      setChatStatus(statusData);
      setTopics(topicsData);
      setGoals(goalsData);

      if (convPage.items.length > 0) {
        const activeConv = convPage.items[0];
        setConversation(activeConv);

        const turnsData = await chatApi.listTurns(activeConv.id, ctrl.signal);
        if (ctrl.signal.aborted) return;

        setTurns(turnsData);

        if (activeConv.status === "completed") {
          setScreen("completed");
        } else {
          setScreen("chat-view");
        }
      } else {
        setScreen("mode-selector");
      }
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setLoadError(
        err instanceof Error ? err.message : "Erro ao carregar o chat.",
      );
      setScreen("mode-selector");
    }
  }, []);

  useEffect(() => {
    load();
    return () => {
      abortRef.current?.abort();
    };
  }, [load]);

  const selectMode = useCallback((mode: ConversationMode) => {
    if (mode === "TOPIC") {
      setScreen("topic-selector");
    } else if (mode === "GOAL") {
      setScreen("goal-selector");
    }
  }, []);

  const startConversation = useCallback(
    async (mode: ConversationMode, topic?: string, goal?: string, goals?: string[]) => {
      setError(null);
      try {
        const conv = await chatApi.createConversation({
          mode,
          level,
          topic: topic ?? null,
          goal: goal ?? null,
          goals: goals ?? null,
        });
        setConversation(conv);
        setTurns([]);
        setScreen("chat-view");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao criar conversa.");
      }
    },
    [level],
  );

  const startFree = useCallback(
    () => startConversation("FREE"),
    [startConversation],
  );

  const startWithTopic = useCallback(
    (topic: string) => startConversation("TOPIC", topic),
    [startConversation],
  );

  const startWithGoal = useCallback(
    (goal: string, goals?: string[]) => startConversation("GOAL", undefined, goal, goals),
    [startConversation],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!conversation || isTyping) return;
      setError(null);
      setIsTyping(true);

      const optimistic: ConversationTurn = {
        id: `tmp-${Date.now()}`,
        conversation_id: conversation.id,
        turn_index: turns.length + 1,
        user_message: text,
        ai_reply: "",
        feedback: null,
        created_at: new Date().toISOString(),
      };
      setTurns((prev) => [...prev, optimistic]);

      try {
        const result = await chatApi.sendTurn(conversation.id, text);

        setTurns((prev) => [
          ...prev.slice(0, -1),
          result.turn,
        ]);

        if (result.goals_progress) {
          setConversation((c) =>
            c
              ? {
                  ...c,
                  goals_progress: result.goals_progress!,
                  goal_status: result.goal_achieved ? "achieved" : c.goal_status,
                }
              : c,
          );
        }

        if (result.conversation_completed) {
          setConversation((c) => (c ? { ...c, status: "completed" } : c));
          setScreen("completed");
        }
      } catch (err) {
        setTurns((prev) => prev.slice(0, -1));
        setError(
          err instanceof Error ? err.message : "Erro ao enviar mensagem.",
        );
      } finally {
        setIsTyping(false);
      }
    },
    [conversation, isTyping, turns.length],
  );

  const abandonConversation = useCallback(async () => {
    if (!conversation) return;
    setError(null);
    try {
      await chatApi.deleteConversation(conversation.id);
      setConversation(null);
      setTurns([]);
      setScreen("mode-selector");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao encerrar conversa.",
      );
    }
  }, [conversation]);

  const completeConversation = useCallback(async () => {
    if (!conversation) return;
    setError(null);
    try {
      const updated = await chatApi.completeConversation(conversation.id);
      setConversation(updated);
      setScreen("completed");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao concluir conversa.",
      );
    }
  }, [conversation]);

  const retryLoad = useCallback(() => {
    load();
  }, [load]);

  const goBack = useCallback(() => {
    setError(null);
    setScreen("mode-selector");
  }, []);

  const newConversation = useCallback(() => {
    setConversation(null);
    setTurns([]);
    setError(null);
    setScreen("mode-selector");
  }, []);

  return {
    screen,
    chatStatus,
    topics,
    goals,
    conversation,
    turns,
    isTyping,
    error,
    loadError,
    selectMode,
    goBack,
    startWithTopic,
    startWithGoal,
    startFree,
    sendMessage,
    abandonConversation,
    completeConversation,
    retryLoad,
    newConversation,
  };
}
