/**
 * Fala e escuta nativas do navegador.
 *
 * A reproducao dos exercicios sai do SpeechSynthesis e a validacao da pratica de
 * fala usa a Speech Recognition API. Nenhum dos dois vai para o backend: nao ha
 * custo de TTS nem upload de audio do usuario.
 *
 * A Speech Recognition nao faz parte da lib DOM do TypeScript e o projeto nao usa
 * pacote de tipos extra, entao o contrato minimo que precisamos esta declarado
 * aqui como interface local (nao global, para nao colidir se a lib DOM passar a
 * declarar isso numa versao futura).
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

function recognizerConstructor(): RecognizerConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }
  // Chrome/Edge/Safari expoem com prefixo; o nome sem prefixo e o padrao.
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
 * O microfone exige contexto seguro: HTTPS ou localhost.
 *
 * Isso pega justamente o caminho recomendado para testar no celular
 * (`http://SEU_IP:5173`): a API existe no navegador, o botao aparece, mas o
 * browser bloqueia a captura sem avisar em tela. Detectar aqui permite explicar
 * o motivo em vez de deixar o aluno achando que a propria voz nao serve.
 */
export function isMicAllowedHere(): boolean {
  return typeof window !== "undefined" && window.isSecureContext;
}

/** Cria um reconhecedor de fala em ingles, ou null quando o navegador nao suporta. */
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

/** Todas as alternativas do primeiro resultado, da mais provavel para a menos. */
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
 * Fala a frase em ingles e informa como a reproducao terminou. Uma nova chamada
 * substitui a anterior, em vez de enfileirar as duas.
 */
export function speak(text: string, rate = 1): Promise<SpeechResult> {
  if (!isSpeechSupported() || !text.trim()) {
    return Promise.resolve("unsupported");
  }

  pauseIdleWaiters();
  if (activeSpeech !== null) {
    const replaced = activeSpeech;
    // Desliga os handlers antes de cancelar: alguns motores disparam onerror de
    // forma sincrona no cancel(), o que nao pode sinalizar um falso periodo ocioso.
    settleSpeech(replaced, "cancelled", false);
    window.speechSynthesis.cancel();
  } else {
    window.speechSynthesis.cancel();
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = SPEECH_LANG;
  utterance.rate = rate;

  return new Promise<SpeechResult>((resolve) => {
    const speech: ActiveSpeech = {
      utterance,
      resolve,
      watchdog: 0,
    };
    // Alguns navegadores nao disparam onend depois de falhas do motor. O teto
    // impede que uma sessao fique esperando para sempre.
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
 * Espera a sintese ficar ociosa pelo periodo pedido. Se outra fala comecar nesse
 * intervalo, a contagem reinicia; abortar o signal ou chamar stopSpeaking libera
 * a espera sem rejeicao nem deadlock.
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
