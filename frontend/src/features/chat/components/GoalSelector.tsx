/**
 * Tela de seleção de meta para modalidade GOAL.
 * Exibe lista de metas pré-definidas + campo de texto para meta customizada.
 */
import { useState } from "react";

import type { ChatGoal, ProficiencyLevel } from "../../../lib/types";

const MAX_CUSTOM_GOAL = 200;

const DEFAULT_TARGETS_MAP: Record<string, string[]> = {
  "Apresentar-se e dar informacoes pessoais": [
    "Saber o nome da pessoa",
    "Saber onde a pessoa mora",
    "Saber qual a idade da pessoa",
  ],
  "Descrever rotina diaria com Simple Present": [
    "Descobrir que horas a pessoa acorda",
    "Descobrir o que ela faz no trabalho ou estudo",
    "Descobrir o que ela faz no tempo livre",
  ],
  "Fazer perguntas sobre o passado": [
    "Saber onde a pessoa passou o ultimo fim de semana",
    "Saber com quem ela estava",
    "Saber o que ela fez de mais legal",
  ],
  "Falar sobre planos futuros": [
    "Saber para onde a pessoa quer viajar",
    "Saber quando essa viagem deve acontecer",
    "Saber o que ela mais quer fazer la",
  ],
  "Pedir e dar direcoes": [
    "Saber a localizacao do destino",
    "Saber qual o melhor caminho ou transporte",
    "Saber quanto tempo leva para chegar",
  ],
  "Fazer e aceitar convites": [
    "Descobrir que atividade a pessoa gostaria de fazer",
    "Combinar o dia e horario ideal",
    "Definir onde voces vao se encontrar",
  ],
  "Discutir vantagens e desvantagens": [
    "Descobrir a opiniao geral da pessoa",
    "Extrair pelo menos uma vantagem mencionada",
    "Extrair pelo menos uma desvantagem mencionada",
  ],
  "Narrar uma historia no passado": [
    "Descobrir quando a historia aconteceu",
    "Descobrir o momento mais emocionante ou inesperado",
    "Descobrir como terminou a historia",
  ],
  "Expressar opiniao e concordar/discordar": [
    "Descobrir a opiniao da pessoa sobre o assunto",
    "Descobrir o argumento principal dela",
    "Descobrir como ela reage ao seu ponto de vista",
  ],
  "Conduzir uma entrevista de emprego": [
    "Descobrir a profissao ou area de atuacao",
    "Descobrir a maior experiencia anterior",
    "Descobrir o principal objetivo de carreira",
  ],
  "Discutir questoes hipoteticas": [
    "Descobrir o que a pessoa faria se ganhasse na loteria",
    "Descobrir para onde ela viajaria se pudesse ir a qualquer lugar",
    "Descobrir que profissao diferente ela escolheria",
  ],
  "Comunicar-se em situacoes de saude": [
    "Descobrir o que a pessoa esta sentindo",
    "Descobrir ha quanto tempo os sintomas comecaram",
    "Descobrir que recomendacao ou remedio ela precisa",
  ],
};

function getGoalTargets(goal: ChatGoal): string[] {
  if (goal.targets && goal.targets.length >= 3) {
    return goal.targets;
  }
  return (
    DEFAULT_TARGETS_MAP[goal.label] || [
      "Saber o nome da pessoa",
      "Saber onde a pessoa mora",
      "Saber qual a idade da pessoa",
    ]
  );
}

interface GoalSelectorProps {
  goals: ChatGoal[];
  userLevel: ProficiencyLevel;
  onSelect: (goal: string, targets?: string[]) => void;
  onBack: () => void;
}

export default function GoalSelector({
  goals,
  userLevel,
  onSelect,
  onBack,
}: GoalSelectorProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [custom1, setCustom1] = useState("");
  const [custom2, setCustom2] = useState("");
  const [custom3, setCustom3] = useState("");

  const customTargets = [custom1.trim(), custom2.trim(), custom3.trim()].filter(Boolean);
  const isCustomMode = customTargets.length > 0;

  function handleSubmit() {
    if (selected) {
      const found = goals.find((g) => g.label === selected);
      if (found) {
        onSelect(found.label, getGoalTargets(found));
        return;
      }
      onSelect(selected, [
        "Saber o nome da pessoa",
        "Saber onde a pessoa mora",
        "Saber qual a idade da pessoa",
      ]);
      return;
    }

    if (customTargets.length > 0) {
      const title = customTargets.join(" • ");
      onSelect(title, customTargets);
    }
  }

  const canSubmit = Boolean(selected) || customTargets.length > 0;

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
      <h2 className="chat-selector__title">Escolha uma meta</h2>
      <p className="chat-selector__subtitle">
        Selecione uma missão pré-definida (cada uma tem 3 metas) ou defina as suas próprias.
      </p>

      {goals.length === 0 ? (
        <p className="chat-selector__empty">
          Nenhuma meta pré-definida disponível. Use os campos abaixo.
        </p>
      ) : (
        <ul className="chat-item-list" role="list">
          {goals.map((g) => {
            const isSelected = selected === g.label;
            const targets = getGoalTargets(g);
            return (
              <li key={g.id}>
                <button
                  type="button"
                  className={`chat-item-card${isSelected ? " chat-item-card--selected" : ""}`}
                  onClick={() => {
                    setSelected(isSelected ? null : g.label);
                    setCustom1("");
                    setCustom2("");
                    setCustom3("");
                  }}
                  aria-pressed={isSelected}
                >
                  <span className="chat-item-card__body">
                    <span className="chat-item-card__label">
                      {g.label}
                      {g.level_hint !== userLevel && (
                        <span className={`level level--${g.level_hint.toLowerCase()}`}>
                          {g.level_hint}
                        </span>
                      )}
                    </span>
                    <span className="chat-item-card__desc">{g.description}</span>

                    <div className="chat-item-card__targets">
                      <span className="chat-item-card__targets-title">🎯 3 metas para extrair:</span>
                      <div className="chat-item-card__targets-pills">
                        {targets.map((tgt, i) => (
                          <span key={i} className="chat-item-card__target-pill">
                            {i + 1}. {tgt}
                          </span>
                        ))}
                      </div>
                    </div>
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

      <div className="chat-selector__custom">
        <label className="field__label">
          Ou escreva suas 3 metas personalizadas:
        </label>
        <p className="chat-selector__custom-hint">
          Defina o que você precisa descobrir/extrair durante o bate-papo em inglês:
        </p>

        <div className="chat-custom-goals-grid">
          <div className="chat-custom-goal-field">
            <span className="chat-custom-goal-field__prefix">1</span>
            <input
              type="text"
              className="field__input chat-custom-goal-field__input"
              placeholder="Ex: Saber o nome da pessoa"
              maxLength={MAX_CUSTOM_GOAL}
              value={custom1}
              onChange={(e) => {
                setCustom1(e.target.value);
                setSelected(null);
              }}
              aria-label="Meta 1"
            />
          </div>

          <div className="chat-custom-goal-field">
            <span className="chat-custom-goal-field__prefix">2</span>
            <input
              type="text"
              className="field__input chat-custom-goal-field__input"
              placeholder="Ex: Saber onde ela mora"
              maxLength={MAX_CUSTOM_GOAL}
              value={custom2}
              onChange={(e) => {
                setCustom2(e.target.value);
                setSelected(null);
              }}
              aria-label="Meta 2"
            />
          </div>

          <div className="chat-custom-goal-field">
            <span className="chat-custom-goal-field__prefix">3</span>
            <input
              type="text"
              className="field__input chat-custom-goal-field__input"
              placeholder="Ex: Saber qual a idade dela"
              maxLength={MAX_CUSTOM_GOAL}
              value={custom3}
              onChange={(e) => {
                setCustom3(e.target.value);
                setSelected(null);
              }}
              aria-label="Meta 3"
            />
          </div>
        </div>
      </div>

      <div className="chat-selector__footer">
        <button
          type="button"
          className="btn btn--primary btn--block"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          {isCustomMode
            ? `Iniciar conversa com ${customTargets.length} ${customTargets.length === 1 ? "meta" : "metas"}`
            : "Iniciar conversa"}
        </button>
      </div>
    </div>
  );
}
