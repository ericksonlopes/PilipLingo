import type { ProficiencyLevel } from "./types";

interface LevelInfo {
  label: string;
  description: string;
}

/**
 * Mantido no frontend (e nao buscado da API) para o onboarding renderizar na
 * primeira pintura e funcionar offline. O backend expoe os mesmos niveis em
 * GET /sentences/levels.
 */
export const LEVEL_INFO: Record<ProficiencyLevel, LevelInfo> = {
  A1: { label: "Iniciante", description: "Sei poucas palavras e frases muito simples." },
  A2: { label: "Basico", description: "Falo do dia a dia com frases curtas." },
  B1: { label: "Intermediario", description: "Me viro em conversas do trabalho e viagens." },
  B2: { label: "Intermediario avancado", description: "Acompanho conversas longas sem travar." },
  C1: { label: "Avancado", description: "Discuto temas abstratos com fluencia." },
  C2: { label: "Proficiente", description: "Uso o ingles como um falante nativo." },
};
