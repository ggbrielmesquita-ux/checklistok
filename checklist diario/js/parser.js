// parser.js — módulo puro: recebe uma string (falada ou digitada) e devolve
// um array de tarefas separadas, cada uma como { text, time, period }. Não
// depende de DOM nem de estado global, para poder ser testado isoladamente.

import { extractTime, protectTimeConjunctions, restoreTimeConjunctions } from './time.js';

// Conectores comuns da fala espontânea que funcionam como separador de itens.
// A ordem importa: frases compostas ("e depois", "e também") são tratadas
// antes das palavras soltas ("depois", "também") para não deixar um "e"
// sobrando. O "(?!\s+d[ao]\b)" evita comer o "depois" de "depois do almoço"/
// "depois da janta": ali "depois" é parte de uma expressão de período do
// dia (ver time.js), não um separador de tarefa.
const CONNECTOR_PATTERNS = [
  /\be\s+depois\b(?!\s+d[ao]\b)/gi,
  /\be\s+tamb[ée]m\b/gi,
  /\bdepois\b(?!\s+d[ao]\b)/gi,
  /\btamb[ée]m\b/gi,
];

const MIN_LENGTH = 3;

function capitalize(text) {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Quebra uma fala/texto corrido em tarefas separadas, cada uma com um
 * horário e/ou período do dia opcionais (ex.: "trocar o óleo do carro, às
 * três da tarde" vira uma única tarefa com time: "15:00", em vez de duas
 * tarefas; "de manhã andar de bike" vira uma tarefa com period: "manha").
 * @param {string} input
 * @returns {{ text: string, time: string|null, period: string|null }[]}
 */
export function parseTasks(input) {
  if (typeof input !== 'string') return [];

  let text = input.trim();
  if (!text) return [];

  // Passo 1: normaliza conectores de fala em vírgula, para caírem no mesmo
  // separador usado por pontuação.
  for (const pattern of CONNECTOR_PATTERNS) {
    text = text.replace(pattern, ',');
  }

  // Passo 2: protege o "e" interno de horários ("três e meia") antes de
  // usar " e " como separador de itens, senão "e meia" viraria item.
  text = protectTimeConjunctions(text);

  // Passo 3: separa por vírgula, ponto, ponto-e-vírgula e pela conjunção
  // " e " isolada (ex.: "cuidar do passarinho e comprar ração" -> 2 itens).
  const byPunctuation = text.split(/[,;.]+/);
  const rawFragments = byPunctuation.flatMap((fragment) => fragment.split(/\s+e\s+/i));

  // Passo 4: para cada fragmento, restaura o "e" protegido, extrai horário
  // e/ou período do dia se houver, limpa espaços, descarta fragmentos
  // curtos, capitaliza e remove duplicatas (sem diferenciar maiúsculas).
  const seen = new Set();
  const tasks = [];
  let pendingTimeForNext = null;

  for (const rawFragment of rawFragments) {
    const restored = restoreTimeConjunctions(rawFragment).trim().replace(/\s+/g, ' ');
    if (!restored) continue;

    const { time, period, cleanText } = extractTime(restored);
    const clean = cleanText.trim().replace(/\s+/g, ' ');

    if ((time || period) && clean.length < MIN_LENGTH) {
      // Fragmento era só uma expressão de horário/período falada em pausa
      // própria (ex.: "trocar o óleo, às três da tarde" ou "de manhã,
      // andar de bike") — associa ao item anterior em vez de virar uma
      // tarefa vazia. Se não houver item anterior (o período veio antes de
      // qualquer tarefa nesse envio), fica pendente para o próximo item.
      const previous = tasks[tasks.length - 1];
      if (previous) {
        if (time && !previous.time) previous.time = time;
        if (period && !previous.period) previous.period = period;
        continue;
      }
      // Sem item anterior ainda: guarda para anexar ao PRÓXIMO fragmento.
      pendingTimeForNext = {
        time: time || (pendingTimeForNext && pendingTimeForNext.time) || null,
        period: period || (pendingTimeForNext && pendingTimeForNext.period) || null,
      };
      continue;
    }

    if (clean.length < MIN_LENGTH) continue;

    const capitalized = capitalize(clean);
    const key = capitalized.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    const finalTime = time || (pendingTimeForNext && pendingTimeForNext.time) || null;
    const finalPeriod = period || (pendingTimeForNext && pendingTimeForNext.period) || null;
    pendingTimeForNext = null;
    tasks.push({ text: capitalized, time: finalTime, period: finalPeriod });
  }

  return tasks;
}
