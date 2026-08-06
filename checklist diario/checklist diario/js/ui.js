// ui.js — renderização e eventos de tela. Não conhece localStorage nem a
// Web Speech API: só recebe estado para desenhar e chama callbacks (em
// `handlers`) quando o usuário faz alguma coisa. Toda inserção de texto do
// usuário usa textContent/DOM (nunca innerHTML com dado do usuário), então
// não há risco de XSS mesmo sem escapar manualmente.

import { getLocalDateKey } from './store.js';
import { CATEGORIES } from './categories.js';

const WEEKDAY_FALLBACK = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

const PERIOD_LABELS = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' };
// Horário representativo de cada período, só para ordenar junto com
// tarefas de horário exato — nunca é mostrado, só comparado.
const PERIOD_SORT_KEY = { manha: '06:00', tarde: '13:00', noite: '19:00' };

function capitalize(text) {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatNumericDate(dateKey) {
  const [y, m, d] = dateKey.split('-');
  return `${d}/${m}/${y}`;
}

function dateFromKey(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const SVG_NS = 'http://www.w3.org/2000/svg';

// Ícones desenhados via DOM (createElementNS), não innerHTML: não há nenhum
// dado do usuário envolvido, mas assim fica consistente com o resto do
// arquivo, que nunca usa innerHTML.
function svgEl(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const key in attrs) node.setAttribute(key, attrs[key]);
  return node;
}

function buildXIcon() {
  const svg = svgEl('svg', { class: 'icon', viewBox: '0 0 24 24', 'aria-hidden': 'true' });
  svg.append(
    svgEl('line', { x1: '18', y1: '6', x2: '6', y2: '18' }),
    svgEl('line', { x1: '6', y1: '6', x2: '18', y2: '18' })
  );
  return svg;
}

function buildTrashIcon() {
  const svg = svgEl('svg', { class: 'icon', viewBox: '0 0 24 24', 'aria-hidden': 'true' });
  svg.append(
    svgEl('polyline', { points: '3 6 5 6 21 6' }),
    svgEl('path', { d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' }),
    svgEl('line', { x1: '10', y1: '11', x2: '10', y2: '17' }),
    svgEl('line', { x1: '14', y1: '11', x2: '14', y2: '17' })
  );
  return svg;
}

function buildMicIcon() {
  const svg = svgEl('svg', { class: 'icon', viewBox: '0 0 24 24', 'aria-hidden': 'true' });
  svg.append(
    svgEl('path', { d: 'M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z' }),
    svgEl('path', { d: 'M19 10v2a7 7 0 0 1-14 0v-2' }),
    svgEl('line', { x1: '12', y1: '19', x2: '12', y2: '23' }),
    svgEl('line', { x1: '8', y1: '23', x2: '16', y2: '23' })
  );
  return svg;
}

// Constrói um ícone a partir dos dados declarativos em categories.js (lista
// de { tag, attrs }) — mantém o desenho de cada categoria num só lugar.
function buildIconFromShape(shape) {
  const svg = svgEl('svg', { class: 'icon', viewBox: '0 0 24 24', 'aria-hidden': 'true' });
  for (const { tag, attrs } of shape) svg.appendChild(svgEl(tag, attrs));
  return svg;
}


function formatDayLabel(dateKey, todayKey, yesterdayKey) {
  if (dateKey === todayKey) return 'Hoje';
  if (dateKey === yesterdayKey) return 'Ontem';
  const dt = dateFromKey(dateKey);
  let weekday;
  try {
    weekday = dt.toLocaleDateString('pt-BR', { weekday: 'long' });
  } catch (err) {
    weekday = WEEKDAY_FALLBACK[dt.getDay()];
  }
  let month;
  try {
    month = dt.toLocaleDateString('pt-BR', { month: 'long' });
  } catch (err) {
    month = '';
  }
  return `${capitalize(weekday)}, ${dt.getDate()} de ${month}`;
}

export function mountUI(handlers) {
  const el = {
    counter: document.getElementById('pendingCounter'),
    bannerInsecure: document.getElementById('banner-insecure'),
    bannerStorage: document.getElementById('banner-storage'),
    taskList: document.getElementById('taskList'),
    toast: document.getElementById('toast'),
    textForm: document.getElementById('textForm'),
    textInput: document.getElementById('textInput'),
    sendBtn: document.getElementById('sendBtn'),
    voiceBtn: document.getElementById('voiceBtn'),
    voiceLabel: document.querySelector('.voice-btn-label'),
    voiceStatus: document.getElementById('voiceStatus'),
    exportBtn: document.getElementById('exportBtn'),
    importBtn: document.getElementById('importBtn'),
    importFile: document.getElementById('importFile'),
  };

  let isPressed = false;
  let pressStartedAt = 0;
  let toastTimer = null;
  let voiceStatusTimer = null;

  // ---------- composer de texto ----------

  function updateSendState() {
    el.sendBtn.disabled = el.textInput.value.trim().length === 0;
  }

  el.textForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (el.textInput.readOnly) return;
    const value = el.textInput.value.trim();
    if (!value) return;
    handlers.onSubmitText(value);
    el.textInput.value = '';
    updateSendState();
  });
  el.textInput.addEventListener('input', updateSendState);
  updateSendState();

  // ---------- botão de voz: segurar para gravar ----------

  function startPress(e) {
    if (el.voiceBtn.disabled) return;
    if (e.cancelable) e.preventDefault();
    if (isPressed) return; // protege contra disparo duplo touch+mouse
    isPressed = true;
    pressStartedAt = Date.now();
    if (navigator.vibrate) navigator.vibrate(30);
    handlers.onVoiceDown();
  }

  function endPress(e) {
    if (!isPressed) return;
    if (e && e.cancelable) e.preventDefault();
    isPressed = false;
    const duration = Date.now() - pressStartedAt;
    const accidental = duration < 400;
    if (navigator.vibrate) navigator.vibrate(15);
    handlers.onVoiceUp(accidental);
  }

  el.voiceBtn.addEventListener('touchstart', startPress, { passive: false });
  el.voiceBtn.addEventListener('touchend', endPress, { passive: false });
  el.voiceBtn.addEventListener('touchcancel', endPress, { passive: false });
  el.voiceBtn.addEventListener('mousedown', startPress);
  el.voiceBtn.addEventListener('mouseup', endPress);
  el.voiceBtn.addEventListener('mouseleave', (e) => { if (isPressed) endPress(e); });
  el.voiceBtn.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---------- exportar / importar ----------

  el.exportBtn.addEventListener('click', () => handlers.onExport());
  el.importBtn.addEventListener('click', () => el.importFile.click());
  el.importFile.addEventListener('change', () => {
    const file = el.importFile.files && el.importFile.files[0];
    el.importFile.value = '';
    if (file) handlers.onImportFile(file);
  });

  // ---------- edição inline (toque longo / duplo toque) ----------

  function startEdit(textEl) {
    if (textEl.querySelector('input')) return;
    const item = textEl.closest('.task-item');
    if (!item) return;
    const id = item.dataset.id;
    const original = textEl.textContent;
    let settled = false;

    textEl.textContent = '';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'task-edit-input';
    input.setAttribute('aria-label', 'Editar tarefa');
    input.value = original;
    textEl.appendChild(input);
    input.focus();
    input.select();

    const finish = (commit) => {
      if (settled) return;
      settled = true;
      if (commit) {
        const value = input.value.trim();
        if (value && value !== original) {
          handlers.onEditSave(id, value);
          return; // a nova renderização substitui este nó
        }
      }
      textEl.textContent = original;
    };

    input.addEventListener('blur', () => finish(true));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    });
  }

  let longPressTimer = null;
  el.taskList.addEventListener('touchstart', (e) => {
    const textEl = e.target.closest('.task-text');
    if (!textEl) return;
    longPressTimer = setTimeout(() => startEdit(textEl), 500);
  }, { passive: true });
  el.taskList.addEventListener('touchend', () => clearTimeout(longPressTimer));
  el.taskList.addEventListener('touchmove', () => clearTimeout(longPressTimer));
  el.taskList.addEventListener('dblclick', (e) => {
    const textEl = e.target.closest('.task-text');
    if (textEl) startEdit(textEl);
  });

  // ---------- toque / clique em check e excluir ----------

  el.taskList.addEventListener('click', (e) => {
    const checkBtn = e.target.closest('.task-check');
    if (checkBtn) {
      const item = checkBtn.closest('.task-item');
      handlers.onToggle(item.dataset.id);
      return;
    }
    const failBtn = e.target.closest('.task-fail');
    if (failBtn) {
      const item = failBtn.closest('.task-item');
      handlers.onFail(item.dataset.id);
      return;
    }
    const delBtn = e.target.closest('.task-delete');
    if (delBtn) {
      const item = delBtn.closest('.task-item');
      handlers.onDelete(item.dataset.id);
    }
  });

  // ---------- construção da lista ----------

  function buildTaskItem(task) {
    const li = document.createElement('li');
    const statusClass = task.status ? `is-${task.status}` : (task.done ? 'is-done' : 'is-pending');
    li.className = `task-item ${statusClass}`;
    li.dataset.id = task.id;

    const check = document.createElement('button');
    check.type = 'button';
    check.className = 'task-check';
    check.setAttribute('aria-label', task.done ? 'Desmarcar tarefa' : 'Marcar tarefa como concluída');
    check.setAttribute('aria-pressed', String(task.done));

    const text = document.createElement('div');
    text.className = 'task-text';
    text.tabIndex = 0;
    text.textContent = task.text;

    li.append(check, text);

    // Mostra a etiqueta de horário exato ("15:00") quando houver; senão, o
    // período do dia ("Manhã") — mas só se ele não for redundante com o
    // cabeçalho da própria sessão (ex.: dentro da sessão "Manhã" já fica
    // óbvio, não precisa repetir no card).
    const chipText = task.time || (task.period && task.category !== task.period ? PERIOD_LABELS[task.period] : null);
    if (chipText) {
      const chip = document.createElement('span');
      chip.className = 'task-time';
      chip.textContent = chipText;
      li.appendChild(chip);
    }

    const fail = document.createElement('button');
    fail.type = 'button';
    fail.className = 'task-fail';
    fail.setAttribute('aria-label', 'Marcar tarefa como falha');
    fail.appendChild(buildXIcon());
    li.appendChild(fail);

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'task-delete';
    del.setAttribute('aria-label', 'Excluir tarefa');
    del.appendChild(buildTrashIcon());
    li.appendChild(del);

    return li;
  }

  // Tarefas com horário (exato ou período do dia) aparecem primeiro,
  // ordenadas por ele; as sem nenhum indicador mantêm a ordem em que foram
  // ditas/criadas (sort é estável).
  function sortKey(task) {
    return task.time || (task.period ? PERIOD_SORT_KEY[task.period] : null);
  }

  function sortByTime(tasks) {
    return [...tasks].sort((a, b) => {
      const ka = sortKey(a);
      const kb = sortKey(b);
      if (ka && kb) return ka < kb ? -1 : ka > kb ? 1 : 0;
      if (ka) return -1;
      if (kb) return 1;
      return 0;
    });
  }

  function buildSubsection(title, kind, tasks) {
    if (tasks.length === 0) return null;
    const section = document.createElement('div');
    section.className = `subsection subsection-${kind}`;

    const heading = document.createElement('h3');
    heading.className = 'subsection-title';
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.setAttribute('aria-hidden', 'true');
    heading.append(dot, document.createTextNode(title));

    const ul = document.createElement('ul');
    ul.className = 'task-sublist';
    for (const task of tasks) ul.appendChild(buildTaskItem(task));

    section.append(heading, ul);
    return section;
  }

  function buildCategoryHeader(category) {
    const wrap = document.createElement('div');
    wrap.className = 'category-header';

    const badge = document.createElement('span');
    badge.className = 'category-icon';
    badge.setAttribute('aria-hidden', 'true');
    badge.appendChild(buildIconFromShape(category.icon));

    const label = document.createElement('span');
    label.className = 'category-label';
    label.textContent = category.label;

    wrap.append(badge, label);
    return wrap;
  }

  // Agrupa as tarefas do dia por sessão (categoria) e monta, dentro de cada
  // sessão, os blocos de Pendentes/Concluídas — a ordem das sessões segue a
  // ordem fixa de CATEGORIES, então a lista não "pula de lugar" a cada render.
  function buildDateGroup(dateKey, dayTasks, todayKey, yesterdayKey) {
    const section = document.createElement('section');
    section.className = 'date-group';

    const header = document.createElement('div');
    header.className = 'date-header';

    const top = document.createElement('div');
    top.className = 'date-header-top';

    const label = document.createElement('span');
    label.className = 'date-label';
    label.textContent = formatDayLabel(dateKey, todayKey, yesterdayKey);

    const numeric = document.createElement('span');
    numeric.className = 'date-numeric';
    const done = dayTasks.filter((t) => t.status === 'done' || t.done).length;
    const failed = dayTasks.filter((t) => t.status === 'failed').length;
    numeric.textContent = `${formatNumericDate(dateKey)} · ${done} feito${failed > 0 ? ` · ${failed} falhou` : ''}`;

    top.append(label, numeric);

    const progress = document.createElement('div');
    progress.className = 'date-progress';
    progress.setAttribute('role', 'progressbar');
    progress.setAttribute('aria-valuemin', '0');
    progress.setAttribute('aria-valuemax', String(dayTasks.length));
    progress.setAttribute('aria-valuenow', String(done));
    const fill = document.createElement('div');
    fill.className = 'date-progress-fill';
    const pct = dayTasks.length ? Math.round((done / dayTasks.length) * 100) : 0;
    fill.style.width = `${pct}%`;
    progress.appendChild(fill);

    header.append(top, progress);
    section.appendChild(header);

    const byCategory = new Map();
    for (const task of dayTasks) {
      const catId = task.category || 'outros';
      if (!byCategory.has(catId)) byCategory.set(catId, []);
      byCategory.get(catId).push(task);
    }

    for (const category of CATEGORIES) {
      const catTasks = byCategory.get(category.id);
      if (!catTasks || catTasks.length === 0) continue;

      const block = document.createElement('div');
      block.className = 'category-block';
      block.appendChild(buildCategoryHeader(category));

      const pending = sortByTime(catTasks.filter((t) => t.status === 'pending' || (!t.status && !t.done)));
      const finished = sortByTime(catTasks.filter((t) => t.status === 'done' || t.done));
      const failed = sortByTime(catTasks.filter((t) => t.status === 'failed'));

      const pendingSection = buildSubsection('Pendentes', 'pending', pending);
      if (pendingSection) block.appendChild(pendingSection);

      const doneSection = buildSubsection('Concluídas', 'done', finished);
      if (doneSection) block.appendChild(doneSection);
      
      const failedSection = buildSubsection('Falharam', 'failed', failed);
      if (failedSection) block.appendChild(failedSection);

      section.appendChild(block);
    }

    return section;
  }

  function buildEmptyState() {
    const wrap = document.createElement('div');
    wrap.className = 'empty-state';
    const icon = document.createElement('div');
    icon.className = 'empty-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.appendChild(buildMicIcon());
    const title = document.createElement('p');
    title.className = 'empty-title';
    title.textContent = 'Nada por aqui ainda';
    const sub = document.createElement('p');
    sub.className = 'empty-sub';
    sub.textContent = 'Segure o botão do microfone e diga o que você precisa fazer hoje.';
    wrap.append(icon, title, sub);
    return wrap;
  }

  function updateCounter(tasks) {
    const todayKey = getLocalDateKey();
    const pendingCount = tasks.filter((t) => t.date === todayKey && (!t.status || t.status === 'pending')).length;
    el.counter.textContent = pendingCount === 0
      ? 'Tudo feito hoje'
      : `${pendingCount} pendente${pendingCount > 1 ? 's' : ''} hoje`;
  }

  function render(state) {
    const tasks = state.tasks;
    el.taskList.replaceChildren();
    updateCounter(tasks);

    if (tasks.length === 0) {
      el.taskList.appendChild(buildEmptyState());
      return;
    }

    const todayKey = getLocalDateKey();
    const yesterdayKey = getLocalDateKey(new Date(Date.now() - 86400000));

    const groups = new Map();
    for (const task of tasks) {
      if (!groups.has(task.date)) groups.set(task.date, []);
      groups.get(task.date).push(task);
    }

    // Formato AAAA-MM-DD ordena igual cronologicamente como string.
    const dateKeys = Array.from(groups.keys()).sort().reverse();

    const frag = document.createDocumentFragment();
    for (const dateKey of dateKeys) {
      frag.appendChild(buildDateGroup(dateKey, groups.get(dateKey), todayKey, yesterdayKey));
    }
    el.taskList.appendChild(frag);
  }

  // ---------- gravação de voz: estado visual ----------

  function setRecordingState(recording) {
    if (recording) {
      el.voiceBtn.classList.add('recording');
      if (el.voiceLabel) el.voiceLabel.textContent = 'Ouvindo... solte para enviar';
      el.textInput.readOnly = true;
      el.textInput.value = '';
      el.textInput.placeholder = 'Ouvindo...';
    } else {
      el.voiceBtn.classList.remove('recording');
      if (el.voiceLabel) el.voiceLabel.textContent = 'Segure para falar';
      el.textInput.readOnly = false;
      el.textInput.value = '';
      el.textInput.placeholder = 'Digite uma tarefa...';
      updateSendState();
    }
  }

  function setLiveText(text) {
    if (el.textInput.readOnly) el.textInput.value = text;
  }

  function showVoiceMessage(message) {
    el.voiceStatus.textContent = message;
    clearTimeout(voiceStatusTimer);
    voiceStatusTimer = setTimeout(() => { el.voiceStatus.textContent = ''; }, 4000);
  }

  function disableVoice(message) {
    el.voiceBtn.disabled = true;
    el.voiceBtn.classList.add('unavailable');
    if (el.voiceLabel) el.voiceLabel.textContent = message;
  }

  function showInsecureBanner(message) {
    el.bannerInsecure.textContent = message;
    el.bannerInsecure.hidden = false;
  }

  function showStorageBanner(message) {
    el.bannerStorage.textContent = message;
    el.bannerStorage.hidden = false;
  }

  // ---------- toast ----------

  function hideToast() {
    el.toast.hidden = true;
    el.toast.replaceChildren();
  }

  function showToast(message, actionLabel, actionFn) {
    el.toast.replaceChildren();
    const span = document.createElement('span');
    span.textContent = message;
    el.toast.appendChild(span);

    if (actionLabel && actionFn) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'toast-action';
      btn.textContent = actionLabel;
      btn.addEventListener('click', () => {
        actionFn();
        hideToast();
      });
      el.toast.appendChild(btn);
    }

    el.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 5000);
  }

  return {
    render,
    setRecordingState,
    setLiveText,
    showVoiceMessage,
    disableVoice,
    showInsecureBanner,
    showStorageBanner,
    showToast,
  };
}
