import { useId, useRef, useState } from "react";
import type { RefObject } from "react";

import type { ExerciseMode, StudyModeOption, StudyOptions } from "../../lib/types";

/* ------------------------------------------------------------------ */
/*  Ícones inline — SVG simples, sem dependência externa               */
/* ------------------------------------------------------------------ */

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

function IconX() {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
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
  );
}

function IconSparkle() {
  return (
    <svg
      aria-hidden="true"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
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

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Subcomponente: ModeCard — um toggle-card por modo de exercício     */
/* ------------------------------------------------------------------ */

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
      {/* Indicador de seleção (substitui o checkbox nativo) */}
      <span className="mode-card__check" aria-hidden="true">
        {isSelected && <IconCheck />}
      </span>
      {/* Ícone do modo */}
      <span className="mode-card__icon">{modeIcon(option.mode)}</span>
      {/* Texto */}
      <span className="mode-card__body">
        <span className="mode-card__label">{option.label}</span>
        <span className="mode-card__desc">{modeDescription(option.mode)}</span>
      </span>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/*  Subcomponente: ThemeCombobox — combobox acessível com tema livre   */
/* ------------------------------------------------------------------ */

interface ThemeComboboxProps {
  themes: StudyOptions["themes"];
  value: string | null;           // tema interno (EN) ou string livre
  onChange: (theme: string | null) => void;
}

/** Retorna o label PT de um tema da lista, ou o valor bruto se for tema livre. */
function themeToDisplay(value: string | null, themes: StudyOptions["themes"]): string {
  if (!value) return "";
  return themes.find((t) => t.theme === value)?.label ?? value;
}

function ThemeCombobox({ themes, value, onChange }: ThemeComboboxProps) {
  const inputId = useId();
  const listId = useId();

  // Texto visível no input — pode divergir de `value` enquanto o user digita
  const [inputText, setInputText] = useState(() => themeToDisplay(value, themes));
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Sincroniza quando o valor muda externamente (ex.: limpar)
  const displayFromValue = themeToDisplay(value, themes);
  if (!open && inputText !== displayFromValue) {
    setInputText(displayFromValue);
  }

  // Filtra pela busca atual (case-insensitive, label PT ou tema EN)
  const suggestions = inputText.trim()
    ? themes.filter(
        (t) =>
          t.theme !== null &&
          (t.label.toLowerCase().includes(inputText.toLowerCase()) ||
            t.theme.toLowerCase().includes(inputText.toLowerCase())),
      )
    : themes.filter((t) => t.theme !== null);

  function commit(theme: string | null, label: string) {
    onChange(theme);
    setInputText(label);
    setOpen(false);
    setActiveIdx(-1);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const text = e.target.value;
    setInputText(text);
    setOpen(true);
    setActiveIdx(-1);
    // Atualiza o valor externo: vazio → null, senão o texto bruto como tema livre
    onChange(text.trim() === "" ? null : text.trim());
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIdx >= 0 && suggestions[activeIdx]) {
      e.preventDefault();
      const s = suggestions[activeIdx];
      commit(s.theme, s.label);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIdx(-1);
    }
  }

  function handleBlur(e: React.FocusEvent) {
    // Fecha só se o foco saiu para fora do combobox inteiro
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setOpen(false);
      setActiveIdx(-1);
    }
  }

  const isCustom = value !== null && value !== "" && !themes.some((t) => t.theme === value);

  return (
    <div
      className="theme-combobox"
      onBlur={handleBlur}
    >
      {/* ---- Input ---- */}
      <div className="theme-input-wrap">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={listId}
          aria-activedescendant={
            activeIdx >= 0 ? `${listId}-opt-${activeIdx}` : undefined
          }
          aria-describedby="theme-hint"
          className="field__input theme-input"
          value={inputText}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Tema surpresa — ou escreva qualquer assunto"
          autoComplete="off"
          maxLength={120}
        />
        {value !== null && value !== "" && (
          <button
            type="button"
            className="theme-clear-btn"
            aria-label="Limpar tema"
            tabIndex={-1}
            onClick={() => {
              commit(null, "");
              inputRef.current?.focus();
            }}
          >
            <IconX />
          </button>
        )}
      </div>

      {/* ---- Badge tema livre ---- */}
      {isCustom && (
        <span className="theme-custom-badge">
          <IconSparkle />
          tema livre
        </span>
      )}

      {/* ---- Dropdown de sugestões ---- */}
      {open && suggestions.length > 0 && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Temas disponíveis"
          className="theme-listbox"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.theme}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={s.theme === value}
              className={[
                "theme-listbox__item",
                s.theme === value ? "theme-listbox__item--selected" : "",
                i === activeIdx ? "theme-listbox__item--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onMouseDown={(e) => {
                // mousedown antes do blur para não fechar antes de registrar o clique
                e.preventDefault();
                commit(s.theme, s.label);
              }}
            >
              {s.label}
            </li>
          ))}
        </ul>
      )}
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

/* ------------------------------------------------------------------ */
/*  Skeleton de loading                                                 */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Componente principal: StudySetup                                    */
/* ------------------------------------------------------------------ */

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
  onThemeChange,
  onSessionLimitChange,
  onRetryLoad,
  onStart,
}: StudySetupProps) {
  const canStart = selectedModes.length > 0 && !isLoading;

  return (
    <section className="page study-setup" aria-busy={isLoading}>
      {/* ---- Cabeçalho ---- */}
      <div className="setup-header">
        <p className="page__eyebrow">Preparar sessão</p>
        <h1 ref={headingRef} className="page__title" tabIndex={-1}>
          Como você quer estudar?
        </h1>
        <p className="page__meta">
          Marque os formatos que você quer alternar durante a sessão.
        </p>
      </div>

      {/* ---- Estados: loading / erro ---- */}
      {isLoading && <SetupSkeleton />}

      {error !== null && (
        <div className="alert alert--error" role="alert">
          <span>{error}</span>
          <button type="button" className="btn btn--sm" onClick={onRetryLoad}>
            Tentar de novo
          </button>
        </div>
      )}

      {/* ---- Conteúdo principal (só após carregar sem erro) ---- */}
      {!isLoading && error === null && options !== null && (
        <>
          {options.modes.length === 0 || options.themes.length === 0 ? (
            <div className="empty">
              <p className="empty__title">Nenhuma opção disponível</p>
              <p className="empty__text">Tente recarregar o menu de preparação.</p>
            </div>
          ) : (
            <>
              {/* ---- Modos de exercício ---- */}
              <fieldset className="field" aria-describedby="study-mode-hint">
                <legend className="field__label">Formatos de exercício</legend>
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
                      Marque pelo menos um formato para começar.
                    </span>
                  ) : (
                    <>
                      <span className="setup-note__count">{selectedModes.length}</span>
                      {selectedModes.length === 1
                        ? " formato selecionado."
                        : " formatos selecionados."}
                    </>
                  )}
                </p>
              </fieldset>

              {/* ---- Tema ---- */}
              <div className="field setup-theme-field">
                <label className="field__label" htmlFor="theme-input">
                  <IconTheme />
                  Tema das frases novas
                </label>
                <ThemeCombobox
                  themes={options.themes}
                  value={selectedTheme}
                  onChange={onThemeChange}
                />
                <p id="theme-hint" className="setup-note">
                  Digite qualquer assunto ou escolha da lista. Revisões pendentes
                  aparecem independentemente do tema.
                </p>
              </div>

              {/* ---- Quantidade ---- */}
              <div className="field">
                <span className="field__label">Exercícios por sessão</span>
                <SessionLimitPicker value={sessionLimit} onChange={onSessionLimitChange} />
                <p className="setup-note">
                  Quantidade de exercícios que serão montados para esta sessão.
                </p>
              </div>

              {/* ---- Aviso IA desligada ---- */}
              {!isAiEnabled && (
                <p className="alert alert--warn" role="status">
                  Frases novas estão desligadas porque a IA não está configurada. Você
                  ainda pode revisar os cards existentes.
                </p>
              )}

              {/* ---- CTA ---- */}
              <button
                type="button"
                className="btn btn--primary btn--block setup-cta"
                disabled={!canStart}
                onClick={onStart}
              >
                Começar
              </button>
            </>
          )}
        </>
      )}
    </section>
  );
}
