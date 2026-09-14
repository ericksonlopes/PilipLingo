/**
 * Tela de seleção de tópico para modalidade TOPIC.
 * Permite selecionar um tópico sugerido ou digitar um tema customizado.
 */
import { useState } from "react";

import type { ChatTopic, ProficiencyLevel } from "../../../lib/types";

const MAX_CUSTOM_TOPIC = 120;

interface TopicSelectorProps {
  topics: ChatTopic[];
  userLevel: ProficiencyLevel;
  onSelect: (topic: string) => void;
  onBack: () => void;
  loading?: boolean;
}

export default function TopicSelector({
  topics,
  userLevel,
  onSelect,
  onBack,
  loading = false,
}: TopicSelectorProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [custom, setCustom] = useState("");

  const canSubmit = Boolean(selected || custom.trim());

  function handleSubmit() {
    const topicToStart = custom.trim() || selected;
    if (topicToStart) {
      onSelect(topicToStart);
    }
  }

  return (
    <div className="chat-selector">
      <button
        type="button"
        className="btn btn--ghost btn--sm chat-selector__back"
        onClick={onBack}
        aria-label="Voltar para seleção de modalidade"
      >
        ← Voltar
      </button>

      <h2 className="chat-selector__title">Escolha um tema</h2>
      <p className="chat-selector__subtitle">
        Digite qualquer assunto que você queira praticar ou selecione um dos tópicos sugeridos.
      </p>

      {/* Caixa de tema personalizado */}
      <div
        className={`chat-selector__custom-box${
          custom.trim() ? " chat-selector__custom-box--active" : ""
        }`}
      >
        <div className="chat-selector__custom-box-header">
          <label htmlFor="custom-topic-input" className="chat-selector__custom-box-title">
            💬 Digite seu próprio tema
          </label>
          {custom && (
            <button
              type="button"
              className="chat-selector__clear-btn"
              onClick={() => setCustom("")}
              aria-label="Limpar tema digitado"
            >
              Limpar
            </button>
          )}
        </div>

        <input
          id="custom-topic-input"
          type="text"
          className="field__input chat-selector__custom-input"
          placeholder="Ex: Entrevista de emprego, Culinária italiana, Ficção científica..."
          maxLength={MAX_CUSTOM_TOPIC}
          value={custom}
          onChange={(e) => {
            setCustom(e.target.value);
            setSelected(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && custom.trim()) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          autoComplete="off"
        />

        <div className="chat-selector__custom-box-footer">
          <span className="chat-selector__custom-hint">
            Escreva o assunto em português ou inglês
          </span>
          <span className="chat-selector__char-count">
            {custom.length}/{MAX_CUSTOM_TOPIC}
          </span>
        </div>
      </div>

      {/* Divisor */}
      <div className="chat-selector__divider">
        <span className="chat-selector__divider-text">
          {topics.length > 0 ? "ou escolha um tópico sugerido" : "tópicos sugeridos"}
        </span>
      </div>

      {/* Lista de tópicos sugeridos */}
      {topics.length === 0 && !loading ? (
        <p className="chat-selector__empty">
          Nenhum tópico sugerido disponível. Use o campo acima para digitar o tema.
        </p>
      ) : (
        <ul className="chat-item-list" role="list">
          {topics.map((t) => {
            const isSelected = selected === t.label;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  className={`chat-item-card${isSelected ? " chat-item-card--selected" : ""}`}
                  onClick={() => {
                    setSelected(isSelected ? null : t.label);
                    setCustom("");
                  }}
                  aria-pressed={isSelected}
                >
                  <span className="chat-item-card__body">
                    <span className="chat-item-card__label">
                      {t.label}
                      {t.level_hint !== userLevel && (
                        <span className={`level level--${t.level_hint.toLowerCase()}`}>
                          {t.level_hint}
                        </span>
                      )}
                    </span>
                    <span className="chat-item-card__desc">{t.description}</span>
                  </span>
                  <span
                    className={`chat-item-card__check${
                      isSelected ? " chat-item-card__check--checked" : ""
                    }`}
                    aria-hidden="true"
                  >
                    {isSelected && "✓"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Rodapé fixo com botão Iniciar conversa */}
      <div className="chat-selector__footer">
        <button
          type="button"
          className="btn btn--primary btn--block chat-selector__submit-btn"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          {custom.trim()
            ? `Iniciar: "${custom.trim().length > 25 ? custom.trim().slice(0, 25) + "…" : custom.trim()}"`
            : selected
            ? `Iniciar: ${selected}`
            : "Iniciar conversa"}
        </button>
      </div>
    </div>
  );
}
