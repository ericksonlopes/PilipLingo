/**
 * Persists study setup menu preferences in localStorage.
 *
 * Allows student to return to app with their selected modes, theme, and limit intact.
 */

import { useEffect, useRef, useState } from "react";

import type { ExerciseMode } from "../lib/types";

const STORAGE_KEY = "piliplingo.studySetup";

interface StudySetup {
  selectedModes: ExerciseMode[];
  selectedTheme: string | null;
  sessionLimit: number;
}

function readSetup(): StudySetup | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as Record<string, unknown>;
    if (
      !Array.isArray(obj.selectedModes) ||
      !("selectedTheme" in obj) ||
      typeof obj.sessionLimit !== "number"
    ) {
      return null;
    }
    return {
      selectedModes: obj.selectedModes as ExerciseMode[],
      selectedTheme:
        typeof obj.selectedTheme === "string" && obj.selectedTheme.trim() !== ""
          ? obj.selectedTheme
          : null,
      sessionLimit: obj.sessionLimit,
    };
  } catch {
    return null;
  }
}

function writeSetup(setup: StudySetup): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(setup));
  } catch {
    // Storage blocked (private mode) — ignore silently.
  }
}

const DEFAULT_LIMIT = 8;
const VALID_LIMITS = new Set([4, 8, 12, 16, 20]);

export function usePersistedStudySetup(allModes: ExerciseMode[]) {
  const [selectedModes, setSelectedModes] = useState<ExerciseMode[]>(
    () => readSetup()?.selectedModes ?? allModes,
  );
  const [selectedTheme, setSelectedTheme] = useState<string | null>(
    () => readSetup()?.selectedTheme ?? null,
  );
  const [sessionLimit, setSessionLimit] = useState<number>(() => {
    const saved = readSetup()?.sessionLimit ?? DEFAULT_LIMIT;
    return VALID_LIMITS.has(saved) ? saved : DEFAULT_LIMIT;
  });

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    writeSetup({ selectedModes, selectedTheme, sessionLimit });
  }, [selectedModes, selectedTheme, sessionLimit]);

  useEffect(() => {
    if (allModes.length === 0) return;
    setSelectedModes((current) => {
      const valid = current.filter((m) => allModes.includes(m));
      return valid.length > 0 ? valid : allModes;
    });
  }, [allModes.join(",")]);

  return {
    selectedModes,
    setSelectedModes,
    selectedTheme,
    setSelectedTheme,
    sessionLimit,
    setSessionLimit,
  };
}
