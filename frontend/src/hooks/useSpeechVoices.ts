import { useEffect, useState } from "react";

import {
  getEnglishVoices,
  getPreferredEnglishVoiceUri,
  isSpeechSupported,
  setPreferredEnglishVoiceUri,
} from "../lib/speech";

interface UseSpeechVoicesResult {
  isSupported: boolean;
  voices: SpeechSynthesisVoice[];
  selectedVoiceUri: string;
  selectVoice: (voiceUri: string) => void;
}

/** Mantém a lista de vozes inglesas e a preferência local do usuário sincronizadas. */
export function useSpeechVoices(): UseSpeechVoicesResult {
  const isSupported = isSpeechSupported();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => getEnglishVoices());
  const [selectedVoiceUri, setSelectedVoiceUri] = useState(
    () => getPreferredEnglishVoiceUri() ?? "",
  );

  useEffect(() => {
    if (!isSupported) return undefined;

    function syncVoices() {
      setVoices(getEnglishVoices());
    }

    syncVoices();
    window.speechSynthesis.addEventListener("voiceschanged", syncVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", syncVoices);
  }, [isSupported]);

  useEffect(() => {
    if (
      selectedVoiceUri !== "" &&
      voices.length > 0 &&
      !voices.some((voice) => voice.voiceURI === selectedVoiceUri)
    ) {
      setSelectedVoiceUri("");
      setPreferredEnglishVoiceUri(null);
    }
  }, [selectedVoiceUri, voices]);

  function selectVoice(voiceUri: string) {
    setSelectedVoiceUri(voiceUri);
    setPreferredEnglishVoiceUri(voiceUri || null);
  }

  return { isSupported, voices, selectedVoiceUri, selectVoice };
}
