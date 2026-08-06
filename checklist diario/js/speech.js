// speech.js — encapsula a Web Speech API (SpeechRecognition). Isolado do
// resto do app: só fala a "língua" de callbacks (onStart/onInterim/onEnd/
// onError), sem tocar em DOM ou em localStorage. Isso facilita testar e
// trocar de implementação no futuro sem mexer em mais nada.

export function isIOS() {
  const ua = navigator.userAgent || '';
  // iPadOS moderno se identifica como "Macintosh", mas tem touch — por isso
  // o teste extra de maxTouchPoints para não perder os iPads.
  const isAppleTouch = /iPad|iPhone|iPod/.test(ua) ||
    (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  return isAppleTouch;
}

export function getSpeechRecognitionCtor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function isSpeechRecognitionSupported() {
  return Boolean(window.isSecureContext) && getSpeechRecognitionCtor() !== null;
}

export class SpeechController {
  /**
   * @param {{
   *   onStart?: () => void,
   *   onInterim?: (text: string) => void,
   *   onEnd?: (finalText: string) => void,
   *   onError?: (kind: 'permission'|'other', detail?: string) => void,
   * }} callbacks
   */
  constructor(callbacks = {}) {
    this.onStart = callbacks.onStart;
    this.onInterim = callbacks.onInterim;
    this.onEnd = callbacks.onEnd;
    this.onError = callbacks.onError;

    this.ios = isIOS();
    this.recognition = null;
    this.isActive = false; // guarda contra chamada dupla de start() -> InvalidStateError
    this.holding = false; // true enquanto o usuário mantém o botão pressionado
    this.manualStop = false;
    this.accumulatedFinal = '';
    this.lastInterim = '';

    this._buildRecognition();
  }

  _buildRecognition() {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = 'pt-BR';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.onresult = (event) => this._handleResult(event);
    recognition.onerror = (event) => this._handleError(event);
    recognition.onend = () => this._handleEnd();
    this.recognition = recognition;
  }

  _handleResult(event) {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        const chunk = result[0].transcript.trim();
        if (chunk) {
          this.accumulatedFinal = this.accumulatedFinal
            ? `${this.accumulatedFinal} ${chunk}`
            : chunk;
        }
      } else {
        interim += result[0].transcript;
      }
    }
    this.lastInterim = interim;
    const full = `${this.accumulatedFinal} ${interim}`.trim();
    if (this.onInterim) this.onInterim(full);
  }

  _handleError(event) {
    // no-speech e aborted acontecem o tempo todo em uso normal (pausas,
    // solturas do botão) — não são erro de verdade, ignorar em silêncio.
    if (event.error === 'no-speech' || event.error === 'aborted') return;

    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      this.holding = false;
      if (this.onError) this.onError('permission');
      return;
    }

    if (this.onError) this.onError('other', event.error);
  }

  _handleEnd() {
    this.isActive = false;

    // No iOS/Safari o reconhecimento para sozinho em qualquer pausa de fala.
    // Enquanto o botão continuar pressionado, reinicia automaticamente sem
    // perder o texto já acumulado.
    if (this.holding && !this.manualStop && this.ios) {
      setTimeout(() => {
        if (this.holding) this._safeStart();
      }, 50);
      return;
    }

    this.holding = false;
    if (this.onEnd) this.onEnd(this.getTranscript());
  }

  _safeStart() {
    if (this.isActive) return;
    try {
      this.recognition.start();
      this.isActive = true;
    } catch (err) {
      // InvalidStateError ao tentar iniciar algo que já está iniciando —
      // ignora, o próximo ciclo de onend tenta de novo se preciso.
    }
  }

  start() {
    if (!this.recognition || this.isActive) return;
    this.accumulatedFinal = '';
    this.lastInterim = '';
    this.manualStop = false;
    this.holding = true;
    try {
      this.recognition.start();
      this.isActive = true;
      if (this.onStart) this.onStart();
    } catch (err) {
      this.holding = false;
    }
  }

  stop() {
    this.holding = false;
    this.manualStop = true;
    if (this.isActive) {
      try {
        this.recognition.stop();
      } catch (err) {
        // já parado, nada a fazer
      }
    } else {
      // já tinha terminado sozinho (ex.: gap no iOS) — reporta na hora
      if (this.onEnd) this.onEnd(this.getTranscript());
    }
  }

  getTranscript() {
    const text = this.accumulatedFinal.trim();
    return text || this.lastInterim.trim();
  }
}
