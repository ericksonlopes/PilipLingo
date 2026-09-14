/**
 * Persiste as configuracoes do menu de preparacao da sessao no localStorage.
 *
 * Isso permite que o usuario reabra o app ou a aba e encontre os modos, tema e
 * limite ja selecionados, sem precisar configurar tudo de novo.
 *
 * Nao persiste a sessao em andamento (fila de exercicios) para nao servir
 * exercicios velhos ou correcoes desatualizadas. Ao reabrir, uma nova sessao
 * e montada com as mesmas configuracoes salvas.
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
      // Garante que string vazia salva em versões antigas vira null.
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
    // Storage bloqueado (modo privado) — ignora silenciosamente.
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
    // Rejeita valor salvo que nao e uma opcao valida.
    return VALID_LIMITS.has(saved) ? saved : DEFAULT_LIMIT;
  });

  // Persiste sempre que qualquer opcao mudar, mas nao no mount inicial
  // (evita gravar valores parciais antes das opcoes chegarem do backend).
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    writeSetup({ selectedModes, selectedTheme, sessionLimit });
  }, [selectedModes, selectedTheme, sessionLimit]);

  // Quando as opcoes disponiveis chegam do backend, garante que nao ha modo
  // salvo que nao existe mais.
  useEffect(() => {
    if (allModes.length === 0) return;
    setSelectedModes((current) => {
      const valid = current.filter((m) => allModes.includes(m));
      return valid.length > 0 ? valid : allModes;
    });
  }, [allModes.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    selectedModes,
    setSelectedModes,
    selectedTheme,
    setSelectedTheme,
    sessionLimit,
    setSessionLimit,
  };
}
