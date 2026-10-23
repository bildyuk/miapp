const tg = window.Telegram?.WebApp;
const STORAGE_KEY = 'miniapp_tasks_v1';

// ---- Инициализация Telegram SDK ----
if (tg) {
  tg.ready();
  tg.expand();
  try {
    tg.setHeaderColor('secondary_bg_color');
    tg.setBackgroundColor(tg.themeParams.bg_color || '#ffffff');
  } catch { /* старые клиенты */ }
}

// ---- DOM ----
const taskList   = document.getElementById('task-list');
const taskInput  = document.getElementById('task-input');
const addBtn     = document.getElementById('add-btn');
const emptyState = document.getElementById('empty-state');
const greeting   = document.getElementById('greeting');
const subtitle   = document.getElementById('subtitle');
const avatar     = document.getElementById('avatar');
const shareBtn   = document.getElementById('share-btn');

let tasks = [];

// ---- Данные пользователя ----
function initUser() {
  const u = tg?.initDataUnsafe?.user;
  if (u) {
    greeting.textContent = `Привет, ${u.first_name || 'друг'}!`;
    const initials = ((u.first_name?.[0] || '') + (u.last_name?.[0] || '')).toUpperCase();
    avatar.textContent = initials || '👤';
    if (u.username) subtitle.textContent = `@${u.username}`;
  }
}

// ---- Хранилище (CloudStorage + localStorage) ----
async function loadTasks() {
  try {
    if (tg?.CloudStorage) {
      const fromCloud = await new Promise((resolve) => {
        tg.CloudStorage.getItem(STORAGE_KEY, (err, value) => {
          resolve(!err && value ? JSON.parse(value) : null);
        });
      });
      if (fromCloud) return fromCloud;
    }
  } catch { /* fallback */ }
  try {
    const local = localStorage.getItem(STORAGE_KEY);
    return local ? JSON.parse(local) : [];
  } catch { return []; }
}

function saveTasks() {
  const data = JSON.stringify(tasks);
  localStorage.setItem(STORAGE_KEY, data);
  if (tg?.CloudStorage) {
    tg.CloudStorage.setItem(STORAGE_KEY, data, () => {});
  }
}

// ---- Рендер ----
function render() {
  taskList.innerHTML = '';
  const active = tasks.filter(t => !t.done).length;

  if (tasks.length === 0) {
    emptyState.classList.add('visible');
  } else {
    emptyState.classList.remove('visible');
    tasks.forEach((task) => {
      const li = document.createElement('li');
      li.className = 'task-item' + (task.done ? ' done' : '');
      li.dataset.id = task.id;

      const cb = document.createElement('div');
      cb.className = 'task-checkbox';
      cb.addEventListener('click', () => toggleTask(task.id));

      const txt = document.createElement('div');
      txt.className = 'task-text';
      txt.textContent = task.text;

      const del = document.createElement('button');
      del.className = 'task-delete';
      del.textContent = '✕';
      del.addEventListener('click', () => deleteTask(task.id));

      li.append(cb, txt, del);
      taskList.appendChild(li);
    });
  }

  // Счётчик в подзаголовке
  if (tasks.length > 0) {
    subtitle.textContent = `${active} из ${tasks.length} активных`;
  }
}

// ---- Действия ----
function addTask() {
  const text = taskInput.value.trim();
  if (!text) return;
  tasks.unshift({ id: Date.now().toString(), text, done: false });
  taskInput.value = '';
  if (tg?.MainButton) tg.MainButton.hide();
  render();
  saveTasks();
  tg?.HapticFeedback?.impactOccurred('light');
}

function toggleTask(id) {
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  t.done = !t.done;
  render();
  saveTasks();
  tg?.HapticFeedback?.impactOccurred('light');
}

function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  render();
  saveTasks();
  tg?.HapticFeedback?.notificationOccurred('warning');
}

// ---- События ----
addBtn.addEventListener('click', addTask);
taskInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addTask();
});

// MainButton показывается при вводе текста (нативный UX)
taskInput.addEventListener('input', () => {
  if (!tg?.MainButton) return;
  if (taskInput.value.trim()) {
    tg.MainButton.setText('Добавить задачу');
    tg.MainButton.show();
  } else {
    tg.MainButton.hide();
  }
});

// Основной CTA через MainButton
if (tg?.MainButton) {
  tg.MainButton.setText('Добавить задачу');
  tg.MainButton.onClick(addTask);
}

// Шаринг в любой чат Telegram
shareBtn.addEventListener('click', () => {
  const active = tasks.filter(t => !t.done).length;
  const text = `Мои задачи: ${active} активных из ${tasks.length} 📋`;
  if (tg?.openTelegramLink) {
    const url = `https://t.me/share/url?url=${encodeURIComponent('https://t.me')}&text=${encodeURIComponent(text)}`;
    tg.openTelegramLink(url);
  } else if (navigator.share) {
    navigator.share({ text });
  } else {
    navigator.clipboard?.writeText(text);
  }
  tg?.HapticFeedback?.selectionChanged();
});

// Реакция на смену темы
if (tg?.onEvent) {
  tg.onEvent('themeChanged', () => {
    try { tg.setHeaderColor('secondary_bg_color'); } catch {}
  });
}

// ---- Запуск ----
initUser();
loadTasks().then((saved) => {
  tasks = saved || [];
  render();
});