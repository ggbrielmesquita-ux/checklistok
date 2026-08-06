// app.js — inicialização: cria o store, a UI e o controlador de voz, e
// conecta os três. Nenhuma regra de negócio mora aqui; este arquivo só
// orquestra chamadas entre os módulos especializados.

import { store, getLocalDateKey } from './store.js';
import { parseTasks } from './parser.js';
import { SpeechController, isSpeechRecognitionSupported } from './speech.js';
import { mountUI } from './ui.js';

function init() {
  store.init();

  let speech = null;
  let discardNext = false;

  const ui = mountUI({
    onSubmitText(text) {
      const tasks = parseTasks(text);
      if (tasks.length) store.addTasks(tasks);
    },
    onVoiceDown() {
      if (speech) speech.start();
    },
    onVoiceUp(accidental) {
      if (!speech) return;
      discardNext = accidental;
      speech.stop();
    },
    onToggle(id) {
      store.toggleTask(id);
    },
    onFail(id) {
      const task = store.getState().tasks.find((t) => t.id === id);
      if (task) {
        store.setTaskStatus(id, task.status === 'failed' ? 'pending' : 'failed');
      }
    },
    onDelete(id) {
      const result = store.deleteTask(id);
      if (result) {
        ui.showToast('Tarefa excluída.', 'Desfazer', () => {
          store.restoreTask(result.item, result.index);
        });
      }
    },
    onEditSave(id, text) {
      store.updateTaskText(id, text);
    },
    onExport() {
      exportTasks();
    },
    onImportFile(file) {
      importTasks(file);
    },
  });

  const storageWarning =
    'Não foi possível acessar o armazenamento do navegador. Suas tarefas vão funcionar só nesta sessão e serão perdidas ao fechar o app.';

  // A persistência pode falhar já no início (ex.: modo privado do Safari) ou
  // só numa escrita posterior (ex.: quota estourada) — por isso o estado é
  // conferido a cada mudança, não só na inicialização.
  const checkStorageWarning = () => {
    if (!store.isPersistenceAvailable()) ui.showStorageBanner(storageWarning);
  };

  store.subscribe((state) => {
    ui.render(state);
    checkStorageWarning();
  });
  ui.render(store.getState());
  checkStorageWarning();

  if (!window.isSecureContext) {
    ui.showInsecureBanner(
      'O reconhecimento de voz só funciona em conexão segura (https). Publique o app (ex.: Vercel ou Netlify) e acesse pelo link https para usar o microfone.'
    );
    ui.disableVoice('Voz indisponível (abra por https)');
  } else if (!isSpeechRecognitionSupported()) {
    ui.disableVoice('Voz não suportada neste navegador');
  } else {
    speech = new SpeechController({
      onStart() {
        ui.setRecordingState(true);
      },
      onInterim(text) {
        ui.setLiveText(text);
      },
      onEnd(transcript) {
        ui.setRecordingState(false);
        if (discardNext) {
          discardNext = false;
          ui.showVoiceMessage('Segure o botão enquanto fala e solte só no final.');
          return;
        }
        const tasks = parseTasks(transcript);
        if (tasks.length) {
          store.addTasks(tasks);
        } else if (transcript) {
          ui.showVoiceMessage('Não entendi. Tente novamente.');
        }
      },
      onError(kind) {
        ui.setRecordingState(false);
        if (kind === 'permission') {
          ui.showVoiceMessage('Permissão de microfone negada. Libere o microfone nas configurações do navegador.');
        } else {
          ui.showVoiceMessage('Não foi possível usar o microfone agora. Tente de novo.');
        }
      },
    });
  }

  setupDayChangeWatcher(ui);
  registerServiceWorker();
}

// Se o app ficar aberto durante a virada da meia-noite, o bloco de "Hoje"
// precisa nascer sozinho. Verifica periodicamente e também quando a aba
// volta a ficar visível/em foco (que é quando isso costuma ser notado).
function setupDayChangeWatcher(ui) {
  let lastDateKey = getLocalDateKey();
  const checkDateChange = () => {
    const current = getLocalDateKey();
    if (current !== lastDateKey) {
      lastDateKey = current;
      ui.render(store.getState());
    }
  };
  setInterval(checkDateChange, 30000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkDateChange();
  });
  window.addEventListener('focus', checkDateChange);
}

function exportTasks() {
  try {
    const json = store.exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dizai-backup-${getLocalDateKey()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Falha ao exportar tarefas', err);
  }
}

function importTasks(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      store.importJSON(reader.result);
    } catch (err) {
      window.alert(`Não foi possível importar o arquivo: ${err.message}`);
    }
  };
  reader.onerror = () => window.alert('Não foi possível ler o arquivo selecionado.');
  reader.readAsText(file);
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      // Publicação sem SW ainda funciona; só perde o cache offline.
    });
  });
}

init();
