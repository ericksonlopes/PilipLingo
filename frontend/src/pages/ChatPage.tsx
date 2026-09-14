/**
 * Página /chat — aba de conversação assistida por IA.
 * Orquestra as sub-telas (ModeSelector, TopicSelector, GoalSelector, ChatView, CompletedView).
 */
import type { ProficiencyLevel } from "../lib/types";
import { useChatPage } from "../features/chat/useChatPage";
import ChatView from "../features/chat/components/ChatView";
import CompletedView from "../features/chat/components/CompletedView";
import GoalSelector from "../features/chat/components/GoalSelector";
import ModeSelector from "../features/chat/components/ModeSelector";
import TopicSelector from "../features/chat/components/TopicSelector";

interface ChatPageProps {
  level: ProficiencyLevel;
}

export default function ChatPage({ level }: ChatPageProps) {
  const {
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
    retryLoad,
    newConversation,
  } = useChatPage(level);

  // --- loading ---
  if (screen === "loading") {
    return (
      <div className="page page--center">
        <p className="level-picker__text">Carregando chat...</p>
      </div>
    );
  }

  // --- erro de carregamento ---
  if (loadError && screen === "mode-selector" && !conversation) {
    return (
      <div className="page">
        <div role="alert" className="alert alert--error">
          {loadError}
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={retryLoad}
          >
            Tentar novamente
          </button>
        </div>
        <ModeSelector
          onSelectMode={selectMode}
          onStartFree={startFree}
          disabled={false}
        />
      </div>
    );
  }

  // --- IA desabilitada (aviso global no selector) ---
  const aiUnavailable = chatStatus !== null && !chatStatus.enabled;

  // --- tela de seleção de modalidade ---
  if (screen === "mode-selector") {
    return (
      <div className="page">
        {aiUnavailable && (
          <div role="alert" className="alert alert--error">
            Serviço de IA indisponível. As conversas não estão disponíveis no momento.
          </div>
        )}
        {error && (
          <div role="alert" className="alert alert--error">
            {error}
          </div>
        )}
        <ModeSelector
          onSelectMode={selectMode}
          onStartFree={startFree}
          disabled={aiUnavailable}
        />
      </div>
    );
  }

  // --- seleção de tópico ---
  if (screen === "topic-selector") {
    return (
      <div className="page">
        {error && (
          <div role="alert" className="alert alert--error">
            {error}
          </div>
        )}
        <TopicSelector
          topics={topics}
          userLevel={level}
          onSelect={startWithTopic}
          onBack={goBack}
        />
      </div>
    );
  }

  // --- seleção de meta ---
  if (screen === "goal-selector") {
    return (
      <div className="page">
        {error && (
          <div role="alert" className="alert alert--error">
            {error}
          </div>
        )}
        <GoalSelector
          goals={goals}
          userLevel={level}
          onSelect={startWithGoal}
          onBack={goBack}
        />
      </div>
    );
  }

  // --- conversa encerrada ---
  if (screen === "completed") {
    const goalAchieved = conversation?.goal_status === "achieved";
    return (
      <div className="page">
        <CompletedView
          goalAchieved={goalAchieved}
          turnCount={turns.length}
          onNewConversation={newConversation}
        />
      </div>
    );
  }

  // --- conversa ativa ---
  if (screen === "chat-view" && conversation) {
    return (
      <ChatView
        conversation={conversation}
        turns={turns}
        isTyping={isTyping}
        chatStatus={chatStatus}
        error={error}
        onSend={sendMessage}
        onAbandon={abandonConversation}
      />
    );
  }

  // fallback
  return (
    <div className="page page--center">
      <p className="level-picker__text">Carregando...</p>
    </div>
  );
}
