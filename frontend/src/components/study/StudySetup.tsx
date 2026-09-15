import { useState } from "react";
import type { RefObject } from "react";

import type { ExerciseMode, StudyModeOption, StudyOptions } from "../../lib/types";

/* Inline SVG icons */

function IconTyping() {
  return (
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
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" />
    </svg>
  );
}

function IconDictation() {
  return (
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
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}

function IconBlocks() {
  return (
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
      <rect x="2" y="7" width="8" height="6" rx="1.5" />
      <rect x="14" y="7" width="8" height="6" rx="1.5" />
      <path d="M10 10h4" />
      <path d="M5 17h14" />
    </svg>
  );
}

function IconSpeaking() {
  return (
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
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconVocab() {
  return (
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
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconTheme() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function IconSentenceBuilder() {
  return (
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
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function modeIcon(mode: ExerciseMode) {
  switch (mode) {
    case "TYPING_CLOZE":
      return <IconTyping />;
    case "AUDIO_DICTATION":
      return <IconDictation />;
    case "BLOCK_TRANSLATION":
      return <IconBlocks />;
    case "SPEAKING_PRACTICE":
      return <IconSpeaking />;
    case "VOCAB_MATCHING":
      return <IconVocab />;
    case "SENTENCE_BUILDER":
      return <IconSentenceBuilder />;
  }
}

function modeDescription(mode: ExerciseMode): string {
  switch (mode) {
    case "TYPING_CLOZE":
      return "Digite a palavra que falta em cada frase.";
    case "AUDIO_DICTATION":
      return "Ouça e monte a frase com os blocos.";
    case "BLOCK_TRANSLATION":
      return "Traduza ordenando os blocos em inglês.";
    case "SPEAKING_PRACTICE":
      return "Ouça, repita e confira sua pronúncia.";
    case "VOCAB_MATCHING":
      return "Exercício em grupo reservado à compatibilidade com sessões antigas.";
    case "SENTENCE_BUILDER":
      return "Escreva uma frase usando a palavra indicada.";
  }
}

interface ModeCardProps {
  option: StudyModeOption;
  isSelected: boolean;
  onToggle: () => void;
}

function ModeCard({ option, isSelected, onToggle }: ModeCardProps) {
  return (
    <label
      className={`mode-card${isSelected ? " mode-card--active" : ""}`}
      data-mode={option.mode}
    >
      <input
        type="checkbox"
        className="mode-card__input"
        checked={isSelected}
        onChange={onToggle}
      />
      <span className="mode-card__check" aria-hidden="true">
        {isSelected && <IconCheck />}
      </span>
      <span className="mode-card__icon">{modeIcon(option.mode)}</span>
      <span className="mode-card__body">
        <span className="mode-card__label">{option.label}</span>
        <span className="mode-card__desc">{modeDescription(option.mode)}</span>
      </span>
    </label>
  );
}

type ThemeTabMode = "SURPRISE" | "SUGGESTED" | "CUSTOM";

interface ThemeSelectorProps {
  themes: StudyOptions["themes"];
  value: string | null;
  onChange: (theme: string | null) => void;
}

function ThemeSelector({ themes, value, onChange }: ThemeSelectorProps) {
  const suggestedThemes = themes.filter((t) => t.theme !== null);

  const initialMode: ThemeTabMode = (() => {
    if (value === null || value === "") return "SURPRISE";
    if (suggestedThemes.some((t) => t.theme === value)) return "SUGGESTED";
    return "CUSTOM";
  })();

  const [activeTab, setActiveTab] = useState<ThemeTabMode>(initialMode);
  const [customText, setCustomText] = useState(() => (initialMode === "CUSTOM" ? value ?? "" : ""));
  const [selectedSuggested, setSelectedSuggested] = useState(() =>
    initialMode === "SUGGESTED" && value
      ? value
      : suggestedThemes[0]?.theme ?? "",
  );

  function handleTabChange(tab: ThemeTabMode) {
    setActiveTab(tab);
    if (tab === "SURPRISE") {
      onChange(null);
    } else if (tab === "SUGGESTED") {
      const themeToUse = selectedSuggested || suggestedThemes[0]?.theme || null;
      onChange(themeToUse);
    } else if (tab === "CUSTOM") {
      onChange(customText.trim() === "" ? null : customText.trim());
    }
  }

  function handleSuggestedChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setSelectedSuggested(val);
    onChange(val);
  }

  function handleCustomChange(e: React.ChangeEvent<HTMLInputElement>) {
    const txt = e.target.value;
    setCustomText(txt);
    onChange(txt.trim() === "" ? null : txt.trim());
  }

  function handleClearCustom() {
    setCustomText("");
    onChange(null);
  }

  const activeLabel = (() => {
    if (activeTab === "SURPRISE" || value === null || value === "") {
      return "🎲 Tema surpresa (variado)";
    }
    if (activeTab === "SUGGESTED") {
      const found = suggestedThemes.find((t) => t.theme === value);
      return found ? `📋 ${found.label}` : `📋 ${value}`;
    }
    return `✍️ "${customText.trim() || value}"`;
  })();

  return (
    <div className="theme-selector-card">
      <div className="theme-segment-tabs" role="tablist" aria-label="Modo de escolha do tema">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "SURPRISE"}
          className={`theme-segment-tab${activeTab === "SURPRISE" ? " theme-segment-tab--active" : ""}`}
          onClick={() => handleTabChange("SURPRISE")}
        >
          🎲 Surpresa
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "SUGGESTED"}
          className={`theme-segment-tab${activeTab === "SUGGESTED" ? " theme-segment-tab--active" : ""}`}
          onClick={() => handleTabChange("SUGGESTED")}
        >
          📋 Sugeridos ({suggestedThemes.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "CUSTOM"}
          className={`theme-segment-tab${activeTab === "CUSTOM" ? " theme-segment-tab--active" : ""}`}
          onClick={() => handleTabChange("CUSTOM")}
        >
          ✍️ Tema livre
        </button>
      </div>

      <div className="theme-segment-content">
        {activeTab === "SURPRISE" && (
          <div className="theme-panel theme-panel--surprise">
            <span className="theme-panel__badge">🎲 Aleatório</span>
            <p className="theme-panel__desc">
              A IA sorteará assuntos dinâmicos do dia a dia a cada nova frase para enriquecer seu vocabulário.
            </p>
          </div>
        )}

        {activeTab === "SUGGESTED" && (
          <div className="theme-panel theme-panel--suggested">
            <label htmlFor="suggested-theme-select" className="theme-panel__label">
              Escolha um dos {suggestedThemes.length} temas disponíveis:
            </label>
            <div className="theme-select-wrap">
              <select
                id="suggested-theme-select"
                className="field__input theme-select"
                value={selectedSuggested}
                onChange={handleSuggestedChange}
              >
                {suggestedThemes.map((t) => (
                  <option key={t.theme!} value={t.theme!}>
                    {t.label}
                  </option>
                ))}
              </select>
              <span className="theme-select-arrow" aria-hidden="true">▾</span>
            </div>
            <p className="theme-panel__desc">
              Frases focadas em vocabulário e expressões comuns para esta situação.
            </p>
          </div>
        )}

        {activeTab === "CUSTOM" && (
          <div className="theme-panel theme-panel--custom">
            <label htmlFor="custom-study-theme" className="theme-panel__label">
              Escreva qualquer assunto que quer praticar:
            </label>
            <div className="theme-custom-wrap">
              <input
                id="custom-study-theme"
                type="text"
                className="field__input theme-custom-input"
                placeholder="Ex: Inteligência artificial, Culinária italiana, Viagens..."
                maxLength={120}
                value={customText}
                onChange={handleCustomChange}
                autoComplete="off"
              />
              {customText && (
                <button
                  type="button"
                  className="theme-clear-btn"
                  onClick={handleClearCustom}
                  aria-label="Limpar tema digitado"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="theme-panel__custom-footer">
              <span className="theme-panel__desc">
                Você pode escrever em português ou inglês.
              </span>
              <span className="theme-panel__counter">{customText.length}/120</span>
            </div>
          </div>
        )}
      </div>

      <div className="theme-active-footer">
        <span className="theme-active-footer__label">Tema selecionado:</span>
        <span className="theme-active-footer__value">{activeLabel}</span>
      </div>
    </div>
  );
}

const SESSION_LIMIT_OPTIONS = [4, 8, 12, 16, 20] as const;

interface SessionLimitPickerProps {
  value: number;
  onChange: (next: number) => void;
}

function SessionLimitPicker({ value, onChange }: SessionLimitPickerProps) {
  return (
    <div className="limit-picker" role="group" aria-label="Exercícios por sessão">
      {SESSION_LIMIT_OPTIONS.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            className={`limit-btn${active ? " limit-btn--active" : ""}`}
            onClick={() => onChange(opt)}
            aria-pressed={active}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function SetupSkeleton() {
  return (
    <div className="setup-skeleton" aria-hidden="true">
      <div className="skeleton-row skeleton-row--wide" />
      <div className="skeleton-row skeleton-row--wide" />
      <div className="skeleton-row skeleton-row--wide" />
      <div className="skeleton-row skeleton-row--medium" />
      <div className="skeleton-row skeleton-row--narrow" />
    </div>
  );
}

export const STUDY_SETUP_SESSION_LIMIT_OPTIONS = SESSION_LIMIT_OPTIONS;

export interface StudySetupProps {
  headingRef?: RefObject<HTMLHeadingElement | null>;
  isLoading: boolean;
  error: string | null;
  options: StudyOptions | null;
  isAiEnabled: boolean;
  selectedModes: ExerciseMode[];
  selectedTheme: string | null;
  sessionLimit: number;
  onToggleMode: (mode: ExerciseMode) => void;
  onSelectAllModes?: () => void;
  onClearModes?: () => void;
  onThemeChange: (theme: string | null) => void;
  onSessionLimitChange: (limit: number) => void;
  onRetryLoad: () => void;
  onStart: () => void;
}

export default function StudySetup({
  headingRef,
  isLoading,
  error,
  options,
  isAiEnabled,
  selectedModes,
  selectedTheme,
  sessionLimit,
  onToggleMode,
  onSelectAllModes,
  onClearModes,
  onThemeChange,
  onSessionLimitChange,
  onRetryLoad,
  onStart,
}: StudySetupProps) {
  const canStart = selectedModes.length > 0 && !isLoading;

  function handleSelectAll() {
    if (onSelectAllModes) {
      onSelectAllModes();
    } else if (options) {
      options.modes.forEach((m) => {
        if (!selectedModes.includes(m.mode)) onToggleMode(m.mode);
      });
    }
  }

  function handleClearAll() {
    if (onClearModes) {
      onClearModes();
    } else {
      selectedModes.forEach((m) => onToggleMode(m));
    }
  }

  const [isConfigExpanded, setIsConfigExpanded] = useState(false);

  return (
    <section className="page study-setup" aria-busy={isLoading}>
      <div className="setup-header">
        <p className="page__eyebrow">Preparar sessão</p>
        <h1 ref={headingRef} className="page__title" tabIndex={-1}>
          O que você quer praticar hoje?
        </h1>
        <p className="page__meta">
          Escolha o tema das novas frases geradas por IA para a sua prática diária.
        </p>
      </div>

      {isLoading && <SetupSkeleton />}

      {error !== null && (
        <div className="alert alert--error" role="alert">
          <span>{error}</span>
          <button type="button" className="btn btn--sm" onClick={onRetryLoad}>
            Tentar de novo
          </button>
        </div>
      )}

      {!isLoading && error === null && options !== null && (
        <>
          {options.modes.length === 0 || options.themes.length === 0 ? (
            <div className="empty">
              <p className="empty__title">Nenhuma opção disponível</p>
              <p className="empty__text">Tente recarregar o menu de preparação.</p>
            </div>
          ) : (
            <>
              <div className="field setup-theme-field setup-theme-field--hero">
                <span className="field__label setup-theme-field__label">
                  <IconTheme />
                  Tema das frases novas
                </span>

                <ThemeSelector
                  themes={options.themes}
                  value={selectedTheme}
                  onChange={onThemeChange}
                />
                <p className="setup-note">
                  Cards em repetição espaçada aparecem independentemente do tema selecionado.
                </p>
              </div>

              <div
                className={`study-config-accordion${
                  isConfigExpanded ? " study-config-accordion--open" : ""
                }`}
              >
                <button
                  type="button"
                  className="study-config-accordion__trigger"
                  onClick={() => setIsConfigExpanded((prev) => !prev)}
                  aria-expanded={isConfigExpanded}
                >
                  <div className="study-config-accordion__header-left">
                    <span className="study-config-accordion__icon" aria-hidden="true">
                      ⚙️
                    </span>
                    <div className="study-config-accordion__titles">
                      <span className="study-config-accordion__title">
                        Configurações da sessão
                      </span>
                      <span className="study-config-accordion__summary">
                        {selectedModes.length === options.modes.length
                          ? "Todos os formatos"
                          : `${selectedModes.length} de ${options.modes.length} formatos`}{" "}
                        • {sessionLimit} exercícios (~{Math.round(sessionLimit * 0.8)} min)
                      </span>
                    </div>
                  </div>
                  <span
                    className={`study-config-accordion__chevron${
                      isConfigExpanded ? " study-config-accordion__chevron--open" : ""
                    }`}
                    aria-hidden="true"
                  >
                    ▾
                  </span>
                </button>

                {isConfigExpanded && (
                  <div className="study-config-accordion__body">
                    <fieldset className="field mode-fieldset" aria-describedby="study-mode-hint">
                      <div className="mode-card-header">
                        <legend className="field__label">Formatos de exercício</legend>
                        <div className="mode-card-header__actions">
                          <button
                            type="button"
                            className="btn btn--ghost btn--xs"
                            onClick={handleSelectAll}
                            disabled={selectedModes.length === options.modes.length}
                          >
                            Selecionar todos
                          </button>
                          <button
                            type="button"
                            className="btn btn--ghost btn--xs"
                            onClick={handleClearAll}
                            disabled={selectedModes.length === 0}
                          >
                            Limpar
                          </button>
                        </div>
                      </div>

                      <div className="mode-card-list">
                        {options.modes.map((option) => (
                          <ModeCard
                            key={option.mode}
                            option={option}
                            isSelected={selectedModes.includes(option.mode)}
                            onToggle={() => onToggleMode(option.mode)}
                          />
                        ))}
                      </div>

                      <p
                        id="study-mode-hint"
                        className="setup-note"
                        aria-live="polite"
                        aria-atomic="true"
                      >
                        {selectedModes.length === 0 ? (
                          <span className="setup-note--warn">
                            ⚠️ Marque pelo menos um formato para começar o estudo.
                          </span>
                        ) : (
                          <>
                            <span className="setup-note__count">{selectedModes.length}</span>
                            {selectedModes.length === 1
                              ? " formato selecionado."
                              : ` de ${options.modes.length} formatos selecionados.`}
                          </>
                        )}
                      </p>
                    </fieldset>

                    <div className="field">
                      <div className="limit-picker-header">
                        <span className="field__label">Exercícios por sessão</span>
                        <span className="limit-picker-estimate">
                          ~{Math.round(sessionLimit * 0.8)} min estimados
                        </span>
                      </div>
                      <SessionLimitPicker
                        value={sessionLimit}
                        onChange={onSessionLimitChange}
                      />
                      <p className="setup-note">
                        Quantidade de exercícios que serão montados para esta prática.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {!isAiEnabled && (
                <p className="alert alert--warn" role="status">
                  Frases novas estão desligadas porque a IA não está configurada. Você
                  ainda pode revisar os cards existentes.
                </p>
              )}

              <div className="study-setup__footer">
                <button
                  type="button"
                  className="btn btn--primary btn--block study-setup__submit-btn"
                  disabled={!canStart}
                  onClick={onStart}
                >
                  {selectedModes.length === 0
                    ? "Selecione pelo menos um formato"
                    : `Começar sessão (${sessionLimit} exercícios)`}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
