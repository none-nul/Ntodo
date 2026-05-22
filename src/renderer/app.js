const state = {
  tasks: [],
  completed: [],
  view: 'active',
  pinned: true,
  priority: 3,
  settings: {
    idleOpacity: 0.72,
    openAtLogin: false
  }
};

const encouragements = [
  '完成得很稳，继续推进下一件。',
  '这一项已经收尾，节奏不错。',
  '任务清掉了，给自己一点正反馈。',
  '做完就是进展，下一步更轻了。',
  '很好，这件事不用再占脑子了。'
];

const priorityConfig = {
  3: { label: '高优先级', className: 'priority-high' },
  2: { label: '中优先级', className: 'priority-medium' },
  1: { label: '低优先级', className: 'priority-low' }
};

const $ = (selector) => document.querySelector(selector);
const activeView = $('#activeView');
const completedView = $('#completedView');
const taskTemplate = $('#taskTemplate');

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function formatTime(iso) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(iso));
}

function formatDuration(startIso, endIso) {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return '不到 1 分钟';

  const totalMinutes = Math.max(1, Math.round((end - start) / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];

  if (days) parts.push(`${days} 天`);
  if (hours) parts.push(`${hours} 小时`);
  if (minutes || parts.length === 0) parts.push(`${minutes} 分钟`);
  return parts.join(' ');
}

function getDueCountdown(dueDate) {
  if (!dueDate) return null;
  const due = new Date(`${dueDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return { value: '今天', caption: dueDate, overdue: false };
  if (diffDays > 0) return { value: `${diffDays}天`, caption: '剩余', overdue: false };
  return { value: `${Math.abs(diffDays)}天`, caption: '已超', overdue: true };
}

function getDueSortValue(task) {
  if (!task.dueDate) return Number.POSITIVE_INFINITY;
  const due = new Date(`${task.dueDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) return Number.POSITIVE_INFINITY;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / 86400000);
}

function getPriority(priority) {
  return priorityConfig[Number(priority)] || priorityConfig[2];
}

function sortedTasks() {
  return [...state.tasks].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const dueDelta = getDueSortValue(a) - getDueSortValue(b);
    if (dueDelta !== 0) return dueDelta;
    return new Date(a.createdAt) - new Date(b.createdAt);
  });
}

async function persist() {
  await window.ntodo.writeStore({
    tasks: state.tasks,
    completed: state.completed,
    settings: state.settings
  });
}

function applySettings() {
  const opacity = Math.min(0.95, Math.max(0.35, Number(state.settings.idleOpacity) || 0.72));
  document.documentElement.style.setProperty('--shell-idle-opacity', opacity.toString());
  document.documentElement.style.setProperty('--shell-idle-bottom-opacity', Math.max(0.35, opacity - 0.06).toString());
  $('#idleOpacityRange').value = Math.round(opacity * 100).toString();
  $('#idleOpacityValue').textContent = `${Math.round(opacity * 100)}%`;
  $('#openAtLoginToggle').checked = Boolean(state.settings.openAtLogin);
}

function showEncouragement() {
  const box = $('#encourage');
  box.textContent = encouragements[Math.floor(Math.random() * encouragements.length)];
  box.hidden = false;
  window.clearTimeout(showEncouragement.timer);
  showEncouragement.timer = window.setTimeout(() => {
    box.hidden = true;
  }, 2600);
}

function renderSubtasks(container, task, readOnly = false) {
  container.textContent = '';
  task.subtasks.forEach((subtask) => {
    const row = document.createElement('div');
    row.className = `subtask${subtask.done ? ' done' : ''}`;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = subtask.done;
    checkbox.disabled = readOnly;
    checkbox.addEventListener('change', async () => {
      subtask.done = checkbox.checked;
      await persist();
      render();
    });

    const label = document.createElement('span');
    label.textContent = subtask.title;

    row.append(checkbox, label);

    if (!readOnly) {
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'subtask-delete';
      deleteButton.title = '删除子项目';
      deleteButton.textContent = '⌫';
      deleteButton.addEventListener('click', async () => {
        task.subtasks = task.subtasks.filter((item) => item.id !== subtask.id);
        await persist();
        render();
      });
      row.append(deleteButton);
    }

    container.append(row);
  });
}

function renderMeta(meta, task, completed = false) {
  meta.textContent = '';

  const priority = getPriority(task.priority);
  const chip = document.createElement('span');
  chip.className = 'priority-chip';
  chip.textContent = priority.label;
  meta.append(chip);

  const subtaskStatus = document.createElement('span');
  subtaskStatus.textContent = `子项目 ${task.subtasks.filter((s) => s.done).length}/${task.subtasks.length}`;
  meta.append(subtaskStatus);

  if (completed) {
    const started = document.createElement('span');
    started.textContent = `开始 ${formatTime(task.createdAt)}`;
    meta.append(started);

    const time = document.createElement('span');
    time.className = 'completed-time';
    time.textContent = `完成于 ${formatTime(task.completedAt)}`;
    meta.append(time);

    const duration = document.createElement('span');
    duration.textContent = `耗时 ${formatDuration(task.createdAt, task.completedAt)}`;
    meta.append(duration);
  }
}

function renderTask(task) {
  const item = taskTemplate.content.firstElementChild.cloneNode(true);
  item.dataset.id = task.id;
  item.classList.add(getPriority(task.priority).className);

  const checkbox = item.querySelector('.task-check');
  const title = item.querySelector('.task-title');
  const meta = item.querySelector('.task-meta');
  const deleteButton = item.querySelector('.delete-task');
  const subtaskButton = item.querySelector('.subtask-toggle');
  const subtaskForm = item.querySelector('.subtask-form');
  const subtaskInput = subtaskForm.querySelector('input');
  const subtasks = item.querySelector('.subtasks');

  title.textContent = '';
  const titleText = document.createElement('span');
  titleText.className = 'task-title-text';
  titleText.textContent = task.title;
  title.append(titleText);

  const dueCountdown = getDueCountdown(task.dueDate);
  if (dueCountdown) {
    const watermark = document.createElement('div');
    watermark.className = `due-watermark${dueCountdown.overdue ? ' overdue' : ''}`;

    const value = document.createElement('strong');
    value.textContent = dueCountdown.value;

    const caption = document.createElement('span');
    caption.textContent = dueCountdown.caption;

    watermark.append(value, caption);
    item.append(watermark);
  }

  renderMeta(meta, task);
  renderSubtasks(subtasks, task);

  checkbox.addEventListener('change', () => completeTask(task.id, item));
  deleteButton.addEventListener('click', () => deleteActiveTask(task.id));
  subtaskButton.addEventListener('click', () => {
    subtaskForm.hidden = !subtaskForm.hidden;
    if (!subtaskForm.hidden) subtaskInput.focus();
  });

  subtaskForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const value = subtaskInput.value.trim();
    if (!value) return;
    task.subtasks.push({ id: uid(), title: value, done: false, createdAt: nowIso() });
    subtaskInput.value = '';
    subtaskForm.hidden = true;
    await persist();
    render();
  });

  return item;
}

function renderCompletedTask(task) {
  const item = taskTemplate.content.firstElementChild.cloneNode(true);
  item.classList.add('done', getPriority(task.priority).className);
  item.querySelector('.task-check').checked = true;
  item.querySelector('.task-check').disabled = true;
  item.querySelector('.task-title').textContent = task.title;
  renderMeta(item.querySelector('.task-meta'), task, true);
  item.querySelector('.delete-task').addEventListener('click', () => deleteCompletedTask(task.id));
  item.querySelector('.subtask-toggle').remove();
  item.querySelector('.subtask-form').remove();
  renderSubtasks(item.querySelector('.subtasks'), task, true);
  return item;
}

function render() {
  activeView.textContent = '';
  completedView.textContent = '';

  sortedTasks().forEach((task) => activeView.append(renderTask(task)));
  [...state.completed]
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
    .forEach((task) => completedView.append(renderCompletedTask(task)));

  activeView.hidden = state.view !== 'active';
  completedView.hidden = state.view !== 'completed';
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.view === state.view);
  });
}

async function addTask(title, priority = state.priority, source = 'manual', dueDate = '') {
  const cleanTitle = title.trim();
  if (!cleanTitle) return;
  state.tasks.push({
    id: uid(),
    title: cleanTitle,
    priority,
    source,
    dueDate: dueDate || '',
    createdAt: nowIso(),
    subtasks: []
  });
  await persist();
  render();
}

async function completeTask(id, element) {
  const index = state.tasks.findIndex((task) => task.id === id);
  if (index === -1) return;
  const [task] = state.tasks.splice(index, 1);
  task.completedAt = nowIso();
  task.subtasks = task.subtasks.map((subtask) => ({ ...subtask, done: true }));
  state.completed.push(task);
  element.classList.add('done');
  element.classList.add('vanishing');
  showEncouragement();
  await persist();
  window.setTimeout(render, 430);
}

async function deleteActiveTask(id) {
  state.tasks = state.tasks.filter((task) => task.id !== id);
  await persist();
  render();
}

async function deleteCompletedTask(id) {
  state.completed = state.completed.filter((task) => task.id !== id);
  await persist();
  render();
}

async function addScreenshotTask() {
  const imagePath = await window.ntodo.pickScreenshot();
  if (!imagePath) return;
  const filename = imagePath.split(/[\\/]/).pop();
  await addTask(`整理截图中的事项：${filename}`, 3, 'screenshot');
}

function showOnboardingIfNeeded() {
  if (localStorage.getItem('ntodo:onboarding-seen')) return;
  $('#onboarding').hidden = false;
}

function bindEvents() {
  $('#todayText').textContent = new Intl.DateTimeFormat('zh-CN', {
    weekday: 'short',
    month: 'numeric',
    day: 'numeric'
  }).format(new Date());

  $('#quickAddForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = $('#taskInput');
    const dueDateInput = $('#dueDateInput');
    await addTask(input.value, state.priority, 'manual', dueDateInput.value);
    input.value = '';
    dueDateInput.value = '';
    input.focus();
  });

  document.querySelectorAll('.priority-option').forEach((button) => {
    button.addEventListener('click', () => {
      state.priority = Number(button.dataset.priority);
      document.querySelectorAll('.priority-option').forEach((option) => {
        option.classList.toggle('active', option === button);
      });
    });
  });

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      state.view = tab.dataset.view;
      render();
    });
  });

  $('#settingsButton').addEventListener('click', () => {
    $('#settingsPanel').hidden = false;
  });

  $('#settingsCloseButton').addEventListener('click', () => {
    $('#settingsPanel').hidden = true;
  });

  $('#settingsPanel').addEventListener('click', (event) => {
    if (event.target === event.currentTarget) {
      $('#settingsPanel').hidden = true;
    }
  });

  $('#idleOpacityRange').addEventListener('input', async (event) => {
    state.settings.idleOpacity = Number(event.currentTarget.value) / 100;
    applySettings();
    await persist();
  });

  $('#openAtLoginToggle').addEventListener('change', async (event) => {
    const enabled = event.currentTarget.checked;
    state.settings.openAtLogin = enabled;
    const loginSettings = await window.ntodo.setOpenAtLogin(enabled);
    state.settings.openAtLogin = Boolean(loginSettings.openAtLogin);
    applySettings();
    await persist();
  });

  $('#guideDoneButton').addEventListener('click', () => {
    localStorage.setItem('ntodo:onboarding-seen', '1');
    $('#onboarding').hidden = true;
  });

  $('#screenshotButton').addEventListener('click', addScreenshotTask);
  $('#minButton').addEventListener('click', () => window.ntodo.minimize());
  $('#closeButton').addEventListener('click', () => window.ntodo.close());
  $('#pinButton').addEventListener('click', async () => {
    state.pinned = !state.pinned;
    await window.ntodo.setPinned(state.pinned);
    $('#pinButton').classList.toggle('active', state.pinned);
  });
}

async function boot() {
  bindEvents();
  const stored = await window.ntodo.readStore();
  state.tasks = Array.isArray(stored.tasks) ? stored.tasks : [];
  state.completed = Array.isArray(stored.completed) ? stored.completed : [];
  state.settings = {
    ...state.settings,
    ...(stored && typeof stored.settings === 'object' ? stored.settings : {})
  };
  try {
    const loginSettings = await window.ntodo.getLoginItemSettings();
    state.settings.openAtLogin = Boolean(loginSettings.openAtLogin);
  } catch {
    state.settings.openAtLogin = false;
  }
  applySettings();
  render();
  showOnboardingIfNeeded();
}

boot();
