/**
 * Stores student preference between block selection and keyboard typing
 * in AUDIO_DICTATION and BLOCK_TRANSLATION modes.
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
      // Private mode / storage blocked: ignore silently.
    }
  }, [inputMode]);

  const toggle = useCallback(() => {
    setInputMode((current) => (current === "blocks" ? "typing" : "blocks"));
  }, []);

  return { inputMode, setInputMode, toggle };
}
