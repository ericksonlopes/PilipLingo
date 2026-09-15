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
    // Private mode / storage blocked: proceed without persisting.
    return null;
  }
}

/**
 * English proficiency level selected by user, stored in localStorage.
 */
export function useLevel() {
  const [level, setLevelState] = useState<ProficiencyLevel | null>(readStoredLevel);

  useEffect(() => {
    if (!level) return;
    try {
      localStorage.setItem(STORAGE_KEY, level);
    } catch {
      // ignore persistence error
    }
  }, [level]);

  const setLevel = useCallback((next: ProficiencyLevel) => setLevelState(next), []);

  return { level, setLevel, hasLevel: level !== null };
}
