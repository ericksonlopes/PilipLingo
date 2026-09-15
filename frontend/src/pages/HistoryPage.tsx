import { useEffect, useRef, useState } from "react";

import { useStudyHistory } from "../hooks/useStudyHistory";
import { isSpeechSupported, speak, stopSpeaking } from "../lib/speech";
import type { ProficiencyLevel, SeenWord, StudyCard } from "../lib/types";

interface HistoryPageProps {
  level: ProficiencyLevel;
}

type Tab = "sentences" | "words";

export default function HistoryPage({ level: _level }: HistoryPageProps) {
  const [activeTab, setActiveTab] = useState<Tab>("sentences");
  const [playingItemId, setPlayingItemId] = useState<string | null>(null);
  const playbackIdRef = useRef(0);
  const { history, isLoading, error, reload } = useStudyHistory(true);
  const canSpeak = isSpeechSupported();

  useEffect(() => () => {
    playbackIdRef.current += 1;
    stopSpeaking();
  }, []);

  function selectTab(tab: Tab) {
    if (tab !== activeTab && playingItemId !== null) {
      playbackIdRef.current += 1;
      stopSpeaking();
      setPlayingItemId(null);
    }
    setActiveTab(tab);
  }

  async function toggleAudio(itemId: string, text: string) {
    if (!canSpeak) return;

    if (playingItemId === itemId) {
      playbackIdRef.current += 1;
      stopSpeaking();
      setPlayingItemId(null);
      return;
    }

    const playbackId = playbackIdRef.current + 1;
    playbackIdRef.current = playbackId;
    setPlayingItemId(itemId);

    await speak(text);
    if (playbackIdRef.current === playbackId) {
      setPlayingItemId(null);
    }
  }

  return (
    <section className="page">
      <div className="history-tabs" role="tablist" aria-label="Tipo de historico">
        <button
          id="history-sentences-tab"
          role="tab"
          type="button"
          aria-selected={activeTab === "sentences"}
          aria-controls="history-panel"
          className={`history-tab${activeTab === "sentences" ? " history-tab--active" : ""}`}
          onClick={() => selectTab("sentences")}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              d="M6 5.5A2.5 2.5 0 0 1 8.5 3H20v15.5H8.5A2.5 2.5 0 0 0 6 21.5m0-16v16M6 5.5A2.5 2.5 0 0 0 3.5 3H2v15.5h1.5A2.5 2.5 0 0 1 6 21.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
          Frases
          {history ? (
            <span className="history-tab__count">{history.sentences_total}</span>
          ) : null}
        </button>
        <button
          id="history-words-tab"
          role="tab"
          type="button"
          aria-selected={activeTab === "words"}
          aria-controls="history-panel"
          className={`history-tab${activeTab === "words" ? " history-tab--active" : ""}`}
          onClick={() => selectTab("words")}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              d="M4 5h16M8 3v2m4 0v16m-5 0 5-16 5 16m-8.5-5h7"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
          Palavras
          {history ? (
            <span className="history-tab__count">{history.words_total}</span>
          ) : null}
        </button>
      </div>

      <div
        id="history-panel"
        role="tabpanel"
        aria-labelledby={`history-${activeTab}-tab`}
      >
        {isLoading ? (
          <p className="page__meta">Carregando historico...</p>
        ) : error ? (
          <div className="alert alert--error" role="alert">
            <span>{error}</span>
            <button type="button" className="btn btn--sm" onClick={reload}>
              Tentar de novo
            </button>
          </div>
        ) : !history ||
          (activeTab === "sentences" && history.sentences.length === 0) ||
          (activeTab === "words" && history.words.length === 0) ? (
          <div className="empty">
            <p className="empty__title">Nenhum historico ainda</p>
            <p className="empty__text">
              {activeTab === "sentences"
                ? "As frases que voce estudar aparecao aqui."
                : "As palavras praticadas aparecerao aqui."}
            </p>
          </div>
        ) : activeTab === "sentences" ? (
          <SentenceList
            cards={history.sentences}
            canSpeak={canSpeak}
            playingItemId={playingItemId}
            onPlay={toggleAudio}
          />
        ) : (
          <WordList
            words={history.words}
            canSpeak={canSpeak}
            playingItemId={playingItemId}
            onPlay={toggleAudio}
          />
        )}
      </div>
    </section>
  );
}

// ---------- sub-componentes ----------

interface SentenceListProps {
  cards: StudyCard[];
  canSpeak: boolean;
  playingItemId: string | null;
  onPlay: (itemId: string, text: string) => Promise<void>;
}

function SentenceList({ cards, canSpeak, playingItemId, onPlay }: SentenceListProps) {
  return (
    <ul className="card-list history-card-list" aria-label="Frases estudadas">
      {cards.map((card) => {
        const itemId = `sentence:${card.id}`;
        const isPlaying = playingItemId === itemId;
        const actionLabel = isPlaying
          ? `Parar reprodução: ${card.sentence}`
          : `Ouvir a frase: ${card.sentence}`;

        return (
          <li key={card.id}>
            <button
              type="button"
              className={`history-card${isPlaying ? " history-card--playing" : ""}`}
              onClick={() => void onPlay(itemId, card.sentence)}
              disabled={!canSpeak}
              aria-pressed={isPlaying}
              aria-label={actionLabel}
              title={actionLabel}
            >
              <span className="history-card__heading">
                <span className="history-card__sentence">{card.sentence}</span>
                <span className="history-card__audio" aria-hidden="true">
                  {isPlaying ? <StopIcon /> : <SpeakerIcon />}
                </span>
              </span>
              <span className="history-card__translation">{card.translation}</span>
              <span className="history-card__meta">
                <span className="history-card__badge">{card.level}</span>
                <span className="history-card__theme">{card.theme}</span>
              </span>
              <span className="history-card__footer">
                {card.reviewed_at ? (
                  <>
                    <span className="history-card__date">
                      {new Date(card.reviewed_at).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </span>
                    <span className="history-card__meta-sep" aria-hidden="true">·</span>
                  </>
                ) : null}
                <span className="history-card__reps">
                  {card.repetitions} {card.repetitions === 1 ? "revisão" : "revisões"}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M4 9.5h3.2L12 5.5v13l-4.8-4H4v-5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M15.5 9c1.2 1 1.2 5 0 6M18 6.5c2.2 2 2.2 9 0 11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor" />
    </svg>
  );
}

interface WordListProps {
  words: SeenWord[];
  canSpeak: boolean;
  playingItemId: string | null;
  onPlay: (itemId: string, text: string) => Promise<void>;
}

function WordList({ words, canSpeak, playingItemId, onPlay }: WordListProps) {
  return (
    <ul className="history-word-list" aria-label="Palavras praticadas">
      {words.map((word) => {
        const itemId = `word:${word.term}`;
        const isPlaying = playingItemId === itemId;
        const actionLabel = isPlaying
          ? `Parar reprodução: ${word.term}`
          : `Ouvir a palavra: ${word.term}`;

        return (
          <li key={word.term}>
            <button
              type="button"
              className={`history-word-card${isPlaying ? " history-word-card--playing" : ""}`}
              onClick={() => void onPlay(itemId, word.term)}
              disabled={!canSpeak}
              aria-pressed={isPlaying}
              aria-label={actionLabel}
              title={actionLabel}
            >
              <span className="history-word-card__heading">
                <span className="history-word-card__term">{word.term}</span>
                <span className="history-card__audio" aria-hidden="true">
                  {isPlaying ? <StopIcon /> : <SpeakerIcon />}
                </span>
              </span>
              <span className="history-word-card__translation">{word.translation}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
