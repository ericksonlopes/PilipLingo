/**
 * Guarda a preferencia do aluno entre montar a frase por blocos ou digita-la
 * com o teclado, nos modos AUDIO_DICTATION e BLOCK_TRANSLATION.
 *
 * A escolha vale para toda a sessao (e persiste entre sessoes no localStorage),
 * para que quem prefere teclado nao precise alternar em cada exercicio.
 */

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "piliplingo.answerInputMode";

export type AnswerInputMode = "blocks" | "typing";

function readMode(): AnswerInputMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === "typing" ? "typing" : "blocks";
  } catch {
    return "blocks";
  }
}

export function useTypingPreference() {
  const [inputMode, setInputMode] = useState<AnswerInputMode>(readMode);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, inputMode);
    } catch {
      // Storage bloqueado (modo privado) — ignora silenciosamente.
    }
  }, [inputMode]);

  const toggle = useCallback(() => {
    setInputMode((current) => (current === "blocks" ? "typing" : "blocks"));
  }, []);

  return { inputMode, setInputMode, toggle };
}
