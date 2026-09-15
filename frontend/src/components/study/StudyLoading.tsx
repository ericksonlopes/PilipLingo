import { useEffect, useMemo, useState } from "react";

import type { ExerciseMode, ProficiencyLevel, StudyOptions } from "../../lib/types";

interface StudyLoadingProps {
  level: ProficiencyLevel;
  theme: string | null;
  options: StudyOptions | null;
  selectedModes: ExerciseMode[];
  sessionLimit: number;
  isAiEnabled: boolean;
  onCancel: () => void;
}

const CULTURAL_TIPS = [
  {
    title: "Mabuhay!",
    tagalog: "Mabuhay!",
    meaning:
      'Saudação filipina que significa literalmente "vida longa" ou "viva!". É usada para dar boas-vindas calorosas por todo o arquipélago.',
    emoji: "🇵🇭",
  },
  {
    title: "Respeito com 'Po' e 'Opo'",
    tagalog: "Salamat po / Opo",
    meaning:
      'Nas Filipinas, adicionar a partícula "po" às frases (ou "opo" para "sim") é a forma tradicional de demonstrar respeito e cortesia.',
    emoji: "🙏",
  },
  {
    title: "Você consegue!",
    tagalog: "Kaya mo 'yan!",
    meaning:
      'Expressão de encorajamento muito popular entre os falantes de Tagalo. Mentalize essa energia para os exercícios de hoje!',
    emoji: "💪",
  },
  {
    title: "Com calma e constância",
    tagalog: "Dahan-dahan lang",
    meaning:
      'Significa "devagar / aos poucos". Na repetição espaçada, a consistência diária é o segredo para fixar o vocabulário.',
    emoji: "🌱",
  },
  {
    title: "O icônico Jeepney",
    tagalog: "Sasakay ako ng jeepney",
    meaning:
      'Os Jeepneys são os transportes públicos mais marcantes das Filipinas, adaptados de jipes e decorados com artes vibrantes e exclusivas.',
    emoji: "🚙",
  },
  {
    title: "Hospitalidade filipina",
    tagalog: "Kumain ka na ba?",
    meaning:
      '"Você já comeu?" é uma saudação de carinho tão comum nas Filipinas quanto "Tudo bem?", refletindo a cultura acolhedora.',
    emoji: "🍚",
  },
];

const MODE_LABELS: Record<ExerciseMode, { name: string; emoji: string }> = {
  TYPING_CLOZE: { name: "Digitação", emoji: "⌨️" },
  AUDIO_DICTATION: { name: "Compreensão de áudio", emoji: "🎧" },
  BLOCK_TRANSLATION: { name: "Blocos de tradução", emoji: "🧱" },
  SPEAKING_PRACTICE: { name: "Prática de fala", emoji: "🗣️" },
  SENTENCE_BUILDER: { name: "Construtor de frases", emoji: "✍️" },
  VOCAB_MATCHING: { name: "Combinação", emoji: "🔗" },
};

export default function StudyLoading({
  level,
  theme,
  options,
  selectedModes,
  sessionLimit,
  isAiEnabled,
  onCancel,
}: StudyLoadingProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [tipIndex, setTipIndex] = useState(() =>
    Math.floor(Math.random() * CULTURAL_TIPS.length),
  );
  const [iconIndex, setIconIndex] = useState(0);

  const heroIcons = useMemo(() => ["🇵🇭", "🧠", "✨", "🎧", "✍️", "🎯"], []);

  // Rotação suave do ícone central
  useEffect(() => {
    const interval = setInterval(() => {
      setIconIndex((prev) => (prev + 1) % heroIcons.length);
    }, 1600);
    return () => clearInterval(interval);
  }, [heroIcons.length]);

  // Avanço das micro-etapas de montagem
  useEffect(() => {
    const interval = setInterval(() => {
      setStepIndex((prev) => (prev < 3 ? prev + 1 : prev));
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  const steps = useMemo(
    () => [
      {
        title: "Analisando seu progresso",
        detail: `Buscando cartões de repetição espaçada no nível ${level}...`,
      },
      {
        title: isAiEnabled ? "Gerando contexto com IA" : "Organizando frases selecionadas",
        detail: isAiEnabled
          ? "Criando frases naturais e vocabulário contextualizado..."
          : "Filtrando as melhores frases para sua sessão...",
      },
      {
        title: "Calibrando exercícios",
        detail: `Formatando desafios para ${selectedModes.length} formato(s) ativo(s)...`,
      },
      {
        title: "Quase pronto!",
        detail: "Sintetizando áudios em tagalo e preparando os primeiros cartões...",
      },
    ],
    [isAiEnabled, level, selectedModes.length],
  );

  const currentThemeLabel = useMemo(() => {
    if (!theme) return "🎲 Tema surpresa / variado";
    const found = options?.themes.find((t) => t.theme === theme);
    if (found) return found.label;
    return `✍️ "${theme}"`;
  }, [options?.themes, theme]);

  const currentTip = CULTURAL_TIPS[tipIndex];

  function nextTip() {
    setTipIndex((prev) => (prev + 1) % CULTURAL_TIPS.length);
  }

  return (
    <section className="page study-loading" aria-busy="true">
      {/* Topo com botão de voltar/cancelar */}
      <div className="study-loading__topbar">
        <div className="study-loading__live-status" role="status" aria-live="polite">
          <span className="study-loading__pulse-dot" aria-hidden="true" />
          <span>Montando sua sessão...</span>
        </div>
        <button
          type="button"
          className="btn btn--sm btn--ghost"
          onClick={onCancel}
          aria-label="Voltar para a configuração de estudo"
        >
          Voltar
        </button>
      </div>

      {/* Hero com Radar e Ícone Animado */}
      <div className="study-loading__hero">
        <div className="study-loading__radar" aria-hidden="true">
          <div className="study-loading__radar-ring" />
          <div className="study-loading__radar-ring study-loading__radar-ring--delayed" />
          <div className="study-loading__icon-circle">
            <span className="study-loading__hero-icon">{heroIcons[iconIndex]}</span>
          </div>
        </div>

        <h2 className="study-loading__title">Preparando seu estudo</h2>
        <p className="study-loading__current-step">
          {steps[stepIndex].detail}
        </p>

        {/* Barra de progresso contínua */}
        <div className="study-loading__bar-container" aria-hidden="true">
          <div className="study-loading__bar" />
        </div>
      </div>

      {/* Timeline de Etapas */}
      <div className="study-loading__stepper" aria-hidden="true">
        {steps.map((step, idx) => {
          const isDone = idx < stepIndex;
          const isActive = idx === stepIndex;
          return (
            <div
              key={step.title}
              className={`study-loading__step ${
                isDone
                  ? "study-loading__step--done"
                  : isActive
                  ? "study-loading__step--active"
                  : ""
              }`}
            >
              <div className="study-loading__step-indicator">
                {isDone ? "✓" : idx + 1}
              </div>
              <span className="study-loading__step-title">{step.title}</span>
            </div>
          );
        })}
      </div>

      {/* Card: O que estamos montando */}
      <div className="study-loading__summary-card">
        <div className="study-loading__summary-header">
          <span className="study-loading__summary-badge">Resumo da sessão</span>
          <span className="study-loading__summary-level">Nível {level}</span>
        </div>

        <div className="study-loading__summary-row">
          <span className="study-loading__summary-label">Tema:</span>
          <span className="study-loading__summary-value">{currentThemeLabel}</span>
        </div>

        <div className="study-loading__summary-row">
          <span className="study-loading__summary-label">Meta:</span>
          <span className="study-loading__summary-value">
            {sessionLimit} exercícios (~{sessionLimit} min)
          </span>
        </div>

        <div className="study-loading__modes-group">
          <span className="study-loading__summary-label">Formatos selecionados:</span>
          <div className="study-loading__modes-list">
            {selectedModes.map((mode) => {
              const info = MODE_LABELS[mode] ?? { name: mode, emoji: "📝" };
              return (
                <span key={mode} className="study-loading__mode-chip">
                  <span aria-hidden="true">{info.emoji}</span>
                  {info.name}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Curiosidade Cultural Interativa */}
      <div
        className="study-loading__tip-card"
        onClick={nextTip}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && nextTip()}
      >
        <div className="study-loading__tip-top">
          <span className="study-loading__tip-badge">
            <span aria-hidden="true">{currentTip.emoji}</span> Sabia que?
          </span>
          <span className="study-loading__tip-action">Toque para outra dica ↻</span>
        </div>
        <div className="study-loading__tip-tagalog">{currentTip.tagalog}</div>
        <p className="study-loading__tip-text">{currentTip.meaning}</p>
      </div>

      {/* Botão de Cancelamento no Rodapé */}
      <div className="study-loading__footer">
        <button
          type="button"
          className="btn btn--secondary btn--block"
          onClick={onCancel}
        >
          Cancelar e alterar configurações
        </button>
      </div>
    </section>
  );
}
