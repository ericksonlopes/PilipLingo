/**
 * Native Web Speech API wrapper for speech synthesis and recognition.
 *
 * Speech synthesis renders exercise audio via SpeechSynthesis, while speaking
 * practice uses SpeechRecognition API. Neither calls the backend (zero TTS costs).
 */

interface RecognitionAlternative {
  readonly transcript: string;
}

interface RecognitionResult {
  readonly length: number;
  readonly [index: number]: RecognitionAlternative;
}

interface RecognitionResultList {
  readonly length: number;
  readonly [index: number]: RecognitionResult;
}

export interface RecognitionEvent {
  readonly results: RecognitionResultList;
}

export interface RecognitionErrorEvent {
  readonly error: string;
}

export interface SpeechRecognizer {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

type RecognizerConstructor = new () => SpeechRecognizer;

const SPEECH_LANG = "en-US";
export const ENGLISH_VOICE_STORAGE_KEY = "piliplingo.englishVoiceUri";
const ENGLISH_LANGUAGE_PATTERN = /^en(?:[-_]|$)/i;

/** Returns English voices installed in browser in stable order. */
export function getEnglishVoices(): SpeechSynthesisVoice[] {
  if (!isSpeechSupported()) return [];

  return window.speechSynthesis
    .getVoices()
    .filter((voice) => ENGLISH_LANGUAGE_PATTERN.test(voice.lang))
    .sort((first, second) =>
      first.lang.localeCompare(second.lang) || first.name.localeCompare(second.name),
    );
}

/** Preferred English voice URI stored in browser localStorage. */
export function getPreferredEnglishVoiceUri(): string | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage.getItem(ENGLISH_VOICE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setPreferredEnglishVoiceUri(voiceUri: string | null): void {
  if (typeof window === "undefined") return;

  try {
    if (voiceUri === null) {
      window.localStorage.removeItem(ENGLISH_VOICE_STORAGE_KEY);
    } else {
      window.localStorage.setItem(ENGLISH_VOICE_STORAGE_KEY, voiceUri);
    }
  } catch {
    // Synthesis falls back to default voice if storage is blocked.
  }
}

function applyPreferredEnglishVoice(utterance: SpeechSynthesisUtterance, lang: string): void {
  if (!ENGLISH_LANGUAGE_PATTERN.test(lang)) return;

  const preferredVoiceUri = getPreferredEnglishVoiceUri();
  if (preferredVoiceUri === null) return;

  const preferredVoice = getEnglishVoices().find(
    (voice) => voice.voiceURI === preferredVoiceUri,
  );
  if (preferredVoice !== undefined) {
    utterance.voice = preferredVoice;
  }
}

function recognizerConstructor(): RecognizerConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }
  const candidate = window as unknown as {
    SpeechRecognition?: RecognizerConstructor;
    webkitSpeechRecognition?: RecognizerConstructor;
  };
  return candidate.SpeechRecognition ?? candidate.webkitSpeechRecognition ?? null;
}

export function isRecognitionSupported(): boolean {
  return recognizerConstructor() !== null;
}

/**
 * Microphone requires a secure context (HTTPS or localhost).
 */
export function isMicAllowedHere(): boolean {
  return typeof window !== "undefined" && window.isSecureContext;
}

/** Creates English speech recognizer, or null if unsupported. */
export function createRecognizer(): SpeechRecognizer | null {
  const Recognizer = recognizerConstructor();
  if (Recognizer === null) {
    return null;
  }
  const recognizer = new Recognizer();
  recognizer.lang = SPEECH_LANG;
  recognizer.continuous = false;
  recognizer.interimResults = false;
  recognizer.maxAlternatives = 3;
  return recognizer;
}

/** Transcripts from recognition event in descending confidence order. */
export function transcriptsOf(event: RecognitionEvent): string[] {
  const result = event.results[0];
  if (result === undefined) {
    return [];
  }
  const transcripts: string[] = [];
  for (let index = 0; index < result.length; index += 1) {
    const alternative = result[index];
    if (alternative !== undefined) {
      transcripts.push(alternative.transcript);
    }
  }
  return transcripts;
}

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export type SpeechResult = "ended" | "cancelled" | "error" | "unsupported";

interface ActiveSpeech {
  utterance: SpeechSynthesisUtterance;
  resolve: (result: SpeechResult) => void;
  watchdog: number;
}

interface IdleWaiter {
  resolve: () => void;
  idleForMs: number;
  timer: number | null;
  signal: AbortSignal | undefined;
  onAbort: () => void;
}

let activeSpeech: ActiveSpeech | null = null;
const idleWaiters = new Set<IdleWaiter>();

function finishIdleWaiter(waiter: IdleWaiter): void {
  if (!idleWaiters.delete(waiter)) return;
  if (waiter.timer !== null) window.clearTimeout(waiter.timer);
  waiter.signal?.removeEventListener("abort", waiter.onAbort);
  waiter.resolve();
}

function pauseIdleWaiters(): void {
  idleWaiters.forEach((waiter) => {
    if (waiter.timer !== null) {
      window.clearTimeout(waiter.timer);
      waiter.timer = null;
    }
  });
}

function scheduleIdleWaiters(): void {
  if (activeSpeech !== null) return;
  idleWaiters.forEach((waiter) => {
    if (waiter.timer !== null) return;
    waiter.timer = window.setTimeout(() => {
      waiter.timer = null;
      if (activeSpeech === null) finishIdleWaiter(waiter);
    }, waiter.idleForMs);
  });
}

function settleSpeech(speech: ActiveSpeech, result: SpeechResult, notifyIdle = true): void {
  if (activeSpeech !== speech) return;
  window.clearTimeout(speech.watchdog);
  speech.utterance.onend = null;
  speech.utterance.onerror = null;
  activeSpeech = null;
  speech.resolve(result);
  if (notifyIdle) scheduleIdleWaiters();
}

/**
 * Speaks text in requested language and returns result status.
 * Replaces active utterance instead of queuing.
 */
export function speakLang(text: string, lang: string, rate = 1): Promise<SpeechResult> {
  if (!isSpeechSupported() || !text.trim()) {
    return Promise.resolve("unsupported");
  }

  pauseIdleWaiters();
  if (activeSpeech !== null) {
    const replaced = activeSpeech;
    settleSpeech(replaced, "cancelled", false);
    window.speechSynthesis.cancel();
  } else {
    window.speechSynthesis.cancel();
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = rate;
  applyPreferredEnglishVoice(utterance, lang);

  return new Promise<SpeechResult>((resolve) => {
    const speech: ActiveSpeech = { utterance, resolve, watchdog: 0 };
    speech.watchdog = window.setTimeout(() => {
      window.speechSynthesis.cancel();
      settleSpeech(speech, "error");
    }, Math.max(5_000, Math.min(30_000, text.length * 250)));
    activeSpeech = speech;
    utterance.onend = () => settleSpeech(speech, "ended");
    utterance.onerror = () => settleSpeech(speech, "error");
    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      settleSpeech(speech, "error");
    }
  });
}

/**
 * Speaks English text and returns completion status.
 */
export function speak(text: string, rate = 1): Promise<SpeechResult> {
  if (!isSpeechSupported() || !text.trim()) {
    return Promise.resolve("unsupported");
  }

  pauseIdleWaiters();
  if (activeSpeech !== null) {
    const replaced = activeSpeech;
    settleSpeech(replaced, "cancelled", false);
    window.speechSynthesis.cancel();
  } else {
    window.speechSynthesis.cancel();
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = SPEECH_LANG;
  utterance.rate = rate;
  applyPreferredEnglishVoice(utterance, SPEECH_LANG);

  return new Promise<SpeechResult>((resolve) => {
    const speech: ActiveSpeech = {
      utterance,
      resolve,
      watchdog: 0,
    };
    speech.watchdog = window.setTimeout(() => {
      window.speechSynthesis.cancel();
      settleSpeech(speech, "error");
    }, Math.max(5_000, Math.min(30_000, text.length * 250)));
    activeSpeech = speech;
    utterance.onend = () => settleSpeech(speech, "ended");
    utterance.onerror = () => settleSpeech(speech, "error");

    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      settleSpeech(speech, "error");
    }
  });
}

/**
 * Waits for speech synthesis to remain idle for given duration.
 */
export function waitForSpeechIdle(idleForMs = 0, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.resolve();

  return new Promise<void>((resolve) => {
    const waiter: IdleWaiter = {
      resolve,
      idleForMs,
      timer: null,
      signal,
      onAbort: () => undefined,
    };
    waiter.onAbort = () => finishIdleWaiter(waiter);
    idleWaiters.add(waiter);
    signal?.addEventListener("abort", waiter.onAbort, { once: true });
    scheduleIdleWaiters();
  });
}

export function stopSpeaking(): void {
  if (isSpeechSupported()) {
    window.speechSynthesis.cancel();
  }
  if (activeSpeech !== null) {
    settleSpeech(activeSpeech, "cancelled", false);
  }
  [...idleWaiters].forEach(finishIdleWaiter);
}
