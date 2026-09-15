import type { ProficiencyLevel } from "./types";

interface LevelInfo {
  label: string;
  description: string;
}

/**
 * Kept on frontend for fast onboarding render and offline support.
 * Backend exposes matching levels in GET /vocabulary/levels.
 */
export const LEVEL_INFO: Record<ProficiencyLevel, LevelInfo> = {
  A1: { label: "Iniciante", description: "Sei poucas palavras e frases muito simples." },
  A2: { label: "Básico", description: "Falo do dia a dia com frases curtas." },
  B1: { label: "Intermediário", description: "Me viro em conversas do trabalho e viagens." },
  B2: { label: "Intermediário avançado", description: "Acompanho conversas longas sem travar." },
  C1: { label: "Avançado", description: "Discuto temas abstratos com fluência." },
  C2: { label: "Proficiente", description: "Uso o inglês como um falante nativo." },
};
