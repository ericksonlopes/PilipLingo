import { useEffect } from "react";

import { useSpeechVoices } from "../hooks/useSpeechVoices";
import { speak } from "../lib/speech";
import type { ProficiencyLevel } from "../lib/types";

const VOICE_PREVIEW_TEXT = "The quick brown fox jumps over the lazy dog.";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  username?: string;
  level: ProficiencyLevel;
  onChangeLevel: () => void;
  onLogout?: () => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  username,
  level,
  onChangeLevel,
  onLogout,
}: SettingsModalProps) {
  const { isSupported: isSpeechSupported, voices, selectedVoiceUri, selectVoice } = useSpeechVoices();

  useEffect(() => {
    if (!isOpen) return undefined;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const initial = username ? username.trim().charAt(0).toUpperCase() : "U";

  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <div
        className="sheet settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet__handle" aria-hidden="true" />

        <div className="settings-modal__header">
          <div className="settings-modal__title-wrap">
            <svg
              aria-hidden="true"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="settings-modal__title-icon"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <h2 id="settings-title" className="sheet__title settings-modal__title">
              Configurações
            </h2>
          </div>
          <button
            type="button"
            className="settings-modal__close-btn"
            onClick={onClose}
            aria-label="Fechar configurações"
          >
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Card do perfil do usuário */}
        <div className="settings-profile-card">
          <div className="settings-profile-avatar" aria-hidden="true">
            {initial}
          </div>
          <div className="settings-profile-info">
            <span className="settings-profile-username">{username || "Usuário"}</span>
            <div className="settings-profile-meta">
              <span className="settings-profile-level-badge">Nível {level}</span>
              <span className="settings-profile-sub">CEFR</span>
            </div>
          </div>
        </div>

        {/* Opções de configuração */}
        <div className="settings-options-list">
          <button
            type="button"
            className="settings-option-item"
            onClick={() => {
              onClose();
              onChangeLevel();
            }}
          >
            <div className="settings-option-icon settings-option-icon--primary">
              <svg
                aria-hidden="true"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
            <div className="settings-option-content">
              <span className="settings-option-title">Alterar nível de proficiência</span>
              <span className="settings-option-desc">
                Atualmente no nível <strong>{level}</strong> • Toque para trocar
              </span>
            </div>
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="settings-option-chevron"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

          <section className="settings-voice" aria-labelledby="settings-voice-title">
            <div className="settings-voice__header">
              <div className="settings-option-icon settings-option-icon--primary" aria-hidden="true">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4v-5Z" />
                  <path d="M15.5 9c1.2 1 1.2 5 0 6M18 6.5c2.2 2 2.2 9 0 11" />
                </svg>
              </div>
              <div className="settings-option-content">
                <label id="settings-voice-title" className="settings-option-title" htmlFor="english-voice">
                  Voz em inglês
                </label>
                <span id="settings-voice-description" className="settings-option-desc">
                  Escolha a pronúncia usada nas frases, palavras e exercícios.
                </span>
              </div>
            </div>

            {!isSpeechSupported ? (
              <p className="settings-voice__status" role="status">
                Este navegador não oferece síntese de voz.
              </p>
            ) : voices.length === 0 ? (
              <p className="settings-voice__status" role="status">
                Nenhuma voz em inglês está disponível neste dispositivo.
              </p>
            ) : (
              <div className="settings-voice__controls">
                <select
                  id="english-voice"
                  className="settings-voice__select"
                  value={selectedVoiceUri}
                  onChange={(event) => selectVoice(event.target.value)}
                  aria-describedby="settings-voice-description"
                >
                  <option value="">Padrão do dispositivo</option>
                  {voices.map((voice) => (
                    <option key={voice.voiceURI} value={voice.voiceURI}>
                      {voice.name} ({voice.lang})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn--ghost settings-voice__preview"
                  onClick={() => void speak(VOICE_PREVIEW_TEXT)}
                >
                  Testar
                </button>
              </div>
            )}
          </section>

          {onLogout ? (
            <div className="settings-logout-section">
              <button
                type="button"
                className="btn btn--danger-outline btn--block settings-logout-btn"
                onClick={() => {
                  onClose();
                  onLogout();
                }}
              >
                <svg
                  aria-hidden="true"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Sair da conta
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
