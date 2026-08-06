// time.js — encontra uma expressão de horário falado dentro de um texto
// (ex.: "às três da tarde", "15h30", "meio-dia") e devolve o horário em
// HH:MM junto com o texto sem essa expressão. Função pura, sem estado.

const HOUR_WORDS = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12,
};

const MINUTE_WORDS = {
  'quarenta e cinco': 45, 'vinte e cinco': 25, quarenta: 40, cinquenta: 50,
  trinta: 30, vinte: 20, quinze: 15, dez: 10, meia: 30,
};

// Alternativas com e sem acento: o reconhecimento de voz costuma acentuar
// certo, mas texto digitado pelo usuário nem sempre.
const HOUR_WORD_PATTERN = 'uma|um|duas|dois|tr[êe]s|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|zero';
const MINUTE_WORD_PATTERN = 'quarenta e cinco|vinte e cinco|quarenta|cinquenta|trinta|vinte|quinze|dez|meia';
const PERIOD_PATTERN = 'da manh[ãa]|de manh[ãa]|da tarde|de tarde|da noite|[àa]\\s+noite';

// Sem "\b" de propósito: no JavaScript, \b só reconhece [A-Za-z0-9_] como
// caractere de palavra, então falha silenciosamente colado a letras
// acentuadas (ex.: nunca reconhece o limite antes de "às"). Quem impede
// casamento em lugar errado é a checagem de "hasMarker" mais abaixo — um
// número ou palavra de hora solta, sem h/minutos/período/"às", é descartado.
const GENERAL_RE = new RegExp(
  '(?:(?<asPrefix>[àa]s)\\s+)?' +
  '(?<hour>\\d{1,2}|' + HOUR_WORD_PATTERN + ')' +
  '(?:\\s*(?<hmark>:|h(?!ora))\\s*(?<minuteDigital>\\d{2})?)?' + // "15h30" ou só "15h" (= 15:00); "h(?!ora)" pra não comer o "h" de "horas"
  '(?:\\s*horas?)?' +
  '(?:\\s+e\\s+(?<minuteWord>' + MINUTE_WORD_PATTERN + '|\\d{1,2}\\s*min(?:utos?)?))?' +
  '(?:\\s*(?<period>' + PERIOD_PATTERN + '))?',
  'gi'
);

const FIXED_PHRASES = [
  { re: /\bmeio[-\s]?dia\b/i, time: '12:00' },
  { re: /\bmeia[-\s]?noite\b/i, time: '00:00' },
];

// Período do dia dito sozinho, sem hora ("de manhã", "depois do almoço"):
// não dá um horário exato, mas ainda assim não pode virar uma tarefa vazia
// nem ficar colado ao texto da tarefa. "(?:^|\s)...(?:$|\s)" no lugar de
// "\b" pelo mesmo motivo do resto do arquivo (\b não vê o limite antes de
// letra acentuada).
const STANDALONE_PERIOD_RE = new RegExp(
  '(?:^|\\s)(' +
    '(?:de|da|pela)\\s+manh[ãa]' + '|' +
    '(?:de|a|[àá]|pela)\\s+tarde' + '|' +
    '(?:de|a|[àá]|pela)\\s+noite' + '|' +
    '(?:depois|antes)\\s+d[oa]\\s+caf[ée](?:\\s+da\\s+manh[ãa])?' + '|' +
    '(?:depois|antes)\\s+d[oa]\\s+almo[çc]o' + '|' +
    '(?:depois|antes)\\s+d[oa]\\s+(?:jantar|janta)' +
  ')(?:$|\\s)',
  'gi'
);

function periodFromPhrase(phrase) {
  const p = normalizeKey(phrase);
  if (p.includes('almoco')) return p.includes('antes') ? 'manha' : 'tarde';
  if (p.includes('cafe')) return 'manha';
  if (p.includes('jantar') || p.includes('janta')) return 'noite';
  if (p.includes('manha')) return 'manha';
  if (p.includes('tarde')) return 'tarde';
  if (p.includes('noite')) return 'noite';
  return null;
}

function normalizeKey(word) {
  return word.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function clampHour(h) {
  return Math.min(23, Math.max(0, h));
}

function clampMinute(m) {
  return Math.min(59, Math.max(0, m));
}

function applyPeriod(hour, periodRaw) {
  if (!periodRaw) return hour;
  const period = normalizeKey(periodRaw);
  if (period.includes('manha')) return hour === 12 ? 0 : hour;
  if (period.includes('tarde') || period.includes('noite')) {
    return hour >= 1 && hour <= 11 ? hour + 12 : hour;
  }
  return hour;
}

function formatTime(hour, minute) {
  return `${String(clampHour(hour)).padStart(2, '0')}:${String(clampMinute(minute)).padStart(2, '0')}`;
}

// Mesmo motivo do comentário acima: usa "(^|\s)" em vez de "\b" para achar a
// preposição solta no fim de "before", porque \b não enxerga o limite antes
// de "à" acentuado (e também porque \b sozinho cortaria coisas como o final
// de "seguida", que termina em "da" sem ser a preposição).
function stripDanglingPreposition(before) {
  const trimmed = before.replace(/\s+$/, '');
  const match = /(^|\s)(às|as|de|da|pela|à|depois|antes)$/i.exec(trimmed);
  if (!match) return trimmed;
  return stripDanglingPreposition(trimmed.slice(0, trimmed.length - match[0].length));
}

// Remove o trecho casado do texto original e limpa preposições/pontuação
// que sobram coladas (ex.: "ligar pro dentista, às 15h" -> "ligar pro dentista").
function cleanupText(text, matchStart, matchEnd) {
  let before = stripDanglingPreposition(text.slice(0, matchStart));
  const after = text.slice(matchEnd);
  let combined = `${before} ${after}`;
  combined = combined.replace(/\s*,\s*,\s*/g, ', ');
  combined = combined.replace(/^[\s,;.]+|[\s,;.]+$/g, '');
  combined = combined.replace(/\s{2,}/g, ' ');
  return combined.trim();
}

// parser.js separa fragmentos por " e " isolado (a conjunção "e" da fala,
// "faz isso e aquilo"). Mas "às três e meia" também usa "e" — pra dizer os
// minutos, não pra separar tarefas. Sem proteção, "e meia" viraria uma
// tarefa fantasma. protectTimeConjunctions troca só esse "e" específico por
// um marcador (sem espaços nas bordas, os espaços originais são preservados
// à parte) antes da quebra por " e "; restoreTimeConjunctions devolve o "e"
// normal depois, já dentro de cada fragmento.
const TIME_CONJ_PLACEHOLDER = '@@TIMEE@@';
const HOUR_TOKEN_PATTERN = '\\d{1,2}|' + HOUR_WORD_PATTERN;
const PROTECT_RE = new RegExp(
  '(' + HOUR_TOKEN_PATTERN + ')(\\s+)e(\\s+)(' + MINUTE_WORD_PATTERN + '|\\d{1,2}\\s*min(?:utos?)?)',
  'gi'
);

export function protectTimeConjunctions(text) {
  if (typeof text !== 'string' || !text) return text || '';
  return text.replace(PROTECT_RE, (_full, hour, sp1, sp2, minute) => hour + sp1 + TIME_CONJ_PLACEHOLDER + sp2 + minute);
}

export function restoreTimeConjunctions(text) {
  if (typeof text !== 'string' || !text) return text || '';
  return text.split(TIME_CONJ_PLACEHOLDER).join('e');
}

/**
 * @param {string} text
 * @returns {{ time: string|null, period: 'manha'|'tarde'|'noite'|null, cleanText: string }}
 */
export function extractTime(text) {
  if (typeof text !== 'string' || !text) return { time: null, period: null, cleanText: text || '' };

  for (const { re, time } of FIXED_PHRASES) {
    const fixedMatch = re.exec(text);
    if (fixedMatch) {
      return {
        time,
        period: null,
        cleanText: cleanupText(text, fixedMatch.index, fixedMatch.index + fixedMatch[0].length),
      };
    }
  }

  GENERAL_RE.lastIndex = 0;
  let match;
  while ((match = GENERAL_RE.exec(text))) {
    const full = match[0];
    const { asPrefix, hour: hourRaw, hmark, minuteDigital, minuteWord: minuteWordRaw, period: periodRaw } = match.groups;
    const hasMarker = Boolean(asPrefix) || Boolean(hmark) || Boolean(minuteWordRaw) ||
      Boolean(periodRaw) || /\bhoras?\b/i.test(full);

    if (hasMarker) {
      const hour = /^\d+$/.test(hourRaw) ? parseInt(hourRaw, 10) : HOUR_WORDS[normalizeKey(hourRaw)];
      if (hour !== undefined) {
        let minute = 0;
        if (minuteDigital) {
          minute = parseInt(minuteDigital, 10);
        } else if (minuteWordRaw) {
          const digitMatch = /^(\d{1,2})/.exec(minuteWordRaw.trim());
          minute = digitMatch ? parseInt(digitMatch[1], 10) : (MINUTE_WORDS[normalizeKey(minuteWordRaw)] || 0);
        }
        const time = formatTime(applyPeriod(hour, periodRaw), minute);
        const cleanText = cleanupText(text, match.index, match.index + full.length);
        return { time, period: null, cleanText };
      }
    }

    if (match.index === GENERAL_RE.lastIndex) GENERAL_RE.lastIndex += 1; // evita loop infinito em casada vazia
  }

  // Nenhuma hora explícita — tenta achar um período do dia sozinho ("de
  // manhã", "depois do almoço"). Não dá um horário exato, mas evita que a
  // frase vire uma tarefa fantasma ou fique com o período colado no texto.
  STANDALONE_PERIOD_RE.lastIndex = 0;
  const periodMatch = STANDALONE_PERIOD_RE.exec(text);
  if (periodMatch) {
    const period = periodFromPhrase(periodMatch[1]);
    if (period) {
      const matchStart = periodMatch.index + (periodMatch[0].startsWith(periodMatch[1]) ? 0 : 1);
      const cleanText = cleanupText(text, matchStart, matchStart + periodMatch[1].length);
      return { time: null, period, cleanText };
    }
  }

  return { time: null, period: null, cleanText: text };
}
