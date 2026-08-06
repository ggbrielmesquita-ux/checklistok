// store.js — estado da aplicação + persistência em localStorage.
// Único responsável por ler/escrever tarefas. Os outros módulos só
// conversam com o app através das funções exportadas aqui.

import { categorizeTask } from './categories.js';
import { syncTasksToSupabase, deleteTasksFromSupabase, fetchTasksFromSupabase } from './supabase.js';

const STORAGE_KEY = 'dizai:tasks:v1';

let state = { tasks: [] };
let persistenceAvailable = true;
const listeners = new Set();

/**
 * Gera a chave de data (AAAA-MM-DD) a partir do horário LOCAL do aparelho.
 * Importante: nunca usar toISOString() aqui, porque ela converte para UTC
 * e a virada do dia sairia errada no fuso do Brasil (ex.: 21h em SP já
 * seria "amanhã" em UTC).
 */
export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function genId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function notify() {
  for (const fn of listeners) fn(state);
}

function persist() {
  if (!persistenceAvailable) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks: state.tasks }));
    // Sincroniza em background, sem travar a UI
    syncTasksToSupabase(state.tasks);
  } catch (err) {
    // Ex.: modo privado do Safari, ou quota estourada. O app segue
    // funcionando em memória, só avisando a UI de que não vai salvar.
    persistenceAvailable = false;
    notify();
  }
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.tasks)) {
        state = { tasks: parsed.tasks };
      }
    }
    persistenceAvailable = true;
  } catch (err) {
    persistenceAvailable = false;
  }
}

async function init() {
  load();
  notify();

  // Tenta puxar dados remotos para mesclar/atualizar
  const remoteTasks = await fetchTasksFromSupabase();
  if (remoteTasks && remoteTasks.length > 0) {
    // Uma estratégia simples de mesclagem (remoto tem prioridade por ser nuvem)
    const localTasks = [...state.tasks];
    const remoteMap = new Map(remoteTasks.map(t => [t.id, t]));
    
    // Atualiza ou insere remotos
    for (const rt of remoteTasks) {
      const idx = localTasks.findIndex(lt => lt.id === rt.id);
      if (idx >= 0) {
        localTasks[idx] = rt;
      } else {
        localTasks.push(rt);
      }
    }
    
    state = { tasks: localTasks };
    persist(); // salva o mix no localStorage
    notify();
  }
}

function getState() {
  return state;
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function isPersistenceAvailable() {
  return persistenceAvailable;
}

// Escolhe a sessão de uma tarefa: o tema (Carro, Casa...) manda sempre que
// bate por palavra-chave; só cai no período do dia (Manhã/Tarde/Noite) como
// reserva, no lugar de "Outros", quando o texto não tem tema nenhum mas veio
// com período falado — ex. "de manhã andar de bike" (sem tema) vira sessão
// "Manhã"; "de manhã trocar o óleo do carro" continua em "Carro", só com a
// etiqueta "Manhã" no card.
function resolveCategory(text, period) {
  const topic = categorizeTask(text);
  if (topic === 'outros' && period) return period;
  return topic;
}

/**
 * @param {{ text: string, time?: string|null, period?: string|null }[]} taskInputs
 *   — normalmente a saída de parser.parseTasks().
 */
function addTasks(taskInputs) {
  if (!Array.isArray(taskInputs) || taskInputs.length === 0) return [];
  const dateKey = getLocalDateKey();
  const now = Date.now();
  const added = taskInputs.map((input, i) => ({
    id: genId(),
    text: input.text,
    time: input.time || null,
    period: input.period || null,
    category: resolveCategory(input.text, input.period),
    date: dateKey,
    done: false, // mantido pra compatibilidade com import/export se quiser
    status: 'pending', // novo
    createdAt: now + i, // preserva a ordem de fala dentro do mesmo envio
  }));
  state = { tasks: state.tasks.concat(added) };
  persist();
  notify();
  return added;
}

function toggleTask(id) {
  state = {
    tasks: state.tasks.map((t) => {
      if (t.id === id) {
        const isDone = t.status === 'done' || t.done;
        return { ...t, done: !isDone, status: !isDone ? 'done' : 'pending' };
      }
      return t;
    }),
  };
  persist();
  notify();
}

function setTaskStatus(id, newStatus) {
  state = {
    tasks: state.tasks.map((t) => {
      if (t.id === id) {
        return { ...t, status: newStatus, done: newStatus === 'done' };
      }
      return t;
    }),
  };
  persist();
  notify();
}

function updateTaskText(id, newText) {
  const clean = String(newText || '').trim();
  if (!clean) return;
  state = {
    tasks: state.tasks.map((t) => (t.id === id ? { ...t, text: clean, category: resolveCategory(clean, t.period) } : t)),
  };
  persist();
  notify();
}

function deleteTask(id) {
  const index = state.tasks.findIndex((t) => t.id === id);
  if (index === -1) return null;
  const item = state.tasks[index];
  const tasks = state.tasks.slice();
  tasks.splice(index, 1);
  state = { tasks };
  
  deleteTasksFromSupabase([id]); // remove da nuvem
  persist();
  notify();
  return { item, index };
}

function restoreTask(item, index) {
  const tasks = state.tasks.slice();
  const at = Math.min(Math.max(index, 0), tasks.length);
  tasks.splice(at, 0, item);
  state = { tasks };
  persist();
  notify();
}

function exportJSON() {
  return JSON.stringify(
    { version: 1, exportedAt: new Date().toISOString(), tasks: state.tasks },
    null,
    2
  );
}

function importJSON(data) {
  let parsed;
  try {
    parsed = typeof data === 'string' ? JSON.parse(data) : data;
  } catch (err) {
    throw new Error('O arquivo não é um JSON válido.');
  }
  if (!parsed || !Array.isArray(parsed.tasks)) {
    throw new Error('Formato inesperado: faltou a lista de tarefas.');
  }
  const normalized = parsed.tasks
    .filter((t) => t && typeof t.text === 'string' && typeof t.date === 'string')
    .map((t) => {
      const text = String(t.text);
      const period = typeof t.period === 'string' ? t.period : null;
      return {
        id: typeof t.id === 'string' ? t.id : genId(),
        text,
        time: typeof t.time === 'string' ? t.time : null,
        period,
        // Backups antigos (de antes das sessões) não têm categoria salva —
        // reclassifica pelo texto na hora de importar.
        category: typeof t.category === 'string' ? t.category : resolveCategory(text, period),
        date: t.date,
        done: !!t.done,
        status: t.status || (t.done ? 'done' : 'pending'),
        createdAt: typeof t.createdAt === 'number' ? t.createdAt : Date.now(),
      };
    });
  state = { tasks: normalized };
  persist();
  notify();
}

export const store = {
  init,
  getState,
  subscribe,
  isPersistenceAvailable,
  addTasks,
  toggleTask,
  setTaskStatus, // expõe a nova função
  updateTaskText,
  deleteTask,
  restoreTask,
  exportJSON,
  importJSON,
};
