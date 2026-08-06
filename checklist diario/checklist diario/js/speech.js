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
    this.accumulatedFinal = ''; // guarda textos de sessões anteriores (iOS gap)
    this.sessionFinal = ''; // guarda o texto consolidado da sessão atual
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

  _mergeTranscripts(current, next) {
    const a = current.trim();
    const b = next.trim();
    if (!a) return b;
    if (!b) return a;
    
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();
    
    if (bLower.includes(aLower)) return b;
    
    for (let i = Math.min(aLower.length, bLower.length); i > 0; i--) {
      if (aLower.endsWith(bLower.slice(0, i))) {
        return a + b.slice(i);
      }
    }
    return a + ' ' + b;
  }

  _handleResult(event) {
    let text = '';

    for (let i = 0; i < event.results.length; i++) {
      const result = event.results[i];
      const chunk = result[0].transcript.trim();
      if (!chunk) continue;
      text = this._mergeTranscripts(text, chunk);
    }

    this.sessionFinal = text;
    this.lastInterim = '';

    const full = this.getTranscript();
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
    const finalTranscript = this.getTranscript();
    
    this.accumulatedFinal = '';
    this.sessionFinal = '';
    this.lastInterim = '';

    if (this.onEnd) this.onEnd(finalTranscript);
  }

  _safeStart() {
    if (this.isActive) return;
    try {
      if (this.sessionFinal) {
        this.accumulatedFinal = this.accumulatedFinal 
          ? `${this.accumulatedFinal} ${this.sessionFinal}`.trim() 
          : this.sessionFinal;
        this.sessionFinal = '';
      }
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
    this.sessionFinal = '';
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
      const finalTranscript = this.getTranscript();
      if (finalTranscript) {
        this.accumulatedFinal = '';
        this.sessionFinal = '';
        this.lastInterim = '';
        if (this.onEnd) this.onEnd(finalTranscript);
      }
    }
  }

  getTranscript() {
    const text = `${this.accumulatedFinal} ${this.sessionFinal} ${this.lastInterim}`.trim();
    // Limpa espaços duplos que possam ter sobrado na concatenação
    return text.replace(/\s{2,}/g, ' ');
  }
}
