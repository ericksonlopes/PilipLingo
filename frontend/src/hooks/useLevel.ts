import { useCallback, useEffect, useState } from "react";

import { PROFICIENCY_LEVELS } from "../lib/types";
import type { ProficiencyLevel } from "../lib/types";

const STORAGE_KEY = "piliplingo.level";

function readStoredLevel(): ProficiencyLevel | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return PROFICIENCY_LEVELS.includes(stored as ProficiencyLevel)
      ? (stored as ProficiencyLevel)
      : null;
  } catch {
    // Modo privado/storage bloqueado: segue sem persistir.
    return null;
  }
}

/**
 * Nivel de ingles informado pelo usuario. Guardado no proprio aparelho porque o
 * app ainda nao tem contas; quando entrar autenticacao, isso migra para o perfil
 * no backend sem mudar a API de geracao (que recebe o nivel por parametro).
 */
export function useLevel() {
  const [level, setLevelState] = useState<ProficiencyLevel | null>(readStoredLevel);

  useEffect(() => {
    if (!level) return;
    try {
      localStorage.setItem(STORAGE_KEY, level);
    } catch {
      // ignora falha de persistencia
    }
  }, [level]);

  const setLevel = useCallback((next: ProficiencyLevel) => setLevelState(next), []);

  return { level, setLevel, hasLevel: level !== null };
}
