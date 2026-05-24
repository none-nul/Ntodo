const state = {
  tasks: [],
  completed: [],
  view: 'active',
  addMode: 'manual',
  pinned: true,
  priority: 3,
  interactionMode: 'far',
  isEngaged: false,
  settings: {
    farOpacity: 0.38,
    nearOpacity: 0.72,
    activeOpacity: 0.96,
    openAtLogin: false,
    autoCompleteParentOnSubtasksDone: true,
    openaiApiKey: '',
    openaiBaseUrl: 'https://api.openai.com/v1',
    openaiModel: 'gpt-4o-mini',
    clipboardAiShortcut: 'Ctrl+Alt+T'
  }
};

const addEncouragements = [
  '已记下，下一步更清楚了。',
  '先放进列表，等会儿就能处理。',
  '任务已安排，心里少占一点。',
  '记录好了，按节奏来就行。',
  '这件事已经归位。'
];

const completeEncouragements = [
  '完成得很稳，继续推进下一件。',
  '这一项已经收尾。',
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

function clampOpacity(value, fallback) {
  return Math.min(0.98, Math.max(0.22, Number(value) || fallback));
}

function setOpacityVariable(name, value) {
  const opacity = clampOpacity(value, 0.72);
  document.documentElement.style.setProperty(`--shell-${name}-opacity`, opacity.toString());
  document.documentElement.style.setProperty(`--shell-${name}-bottom-opacity`, Math.max(0.22, opacity - 0.06).toString());
}

function applySettings() {
  state.settings.farOpacity = clampOpacity(state.settings.farOpacity ?? state.settings.idleOpacity, 0.38);
  state.settings.nearOpacity = clampOpacity(state.settings.nearOpacity ?? state.settings.idleOpacity, 0.72);
  state.settings.activeOpacity = clampOpacity(state.settings.activeOpacity, 0.96);
  setOpacityVariable('far', state.settings.farOpacity);
  setOpacityVariable('near', state.settings.nearOpacity);
  setOpacityVariable('active', state.settings.activeOpacity);
  $('#farOpacityRange').value = Math.round(state.settings.farOpacity * 100).toString();
  $('#nearOpacityRange').value = Math.round(state.settings.nearOpacity * 100).toString();
  $('#activeOpacityRange').value = Math.round(state.settings.activeOpacity * 100).toString();
  $('#farOpacityValue').textContent = `${Math.round(state.settings.farOpacity * 100)}%`;
  $('#nearOpacityValue').textContent = `${Math.round(state.settings.nearOpacity * 100)}%`;
  $('#activeOpacityValue').textContent = `${Math.round(state.settings.activeOpacity * 100)}%`;
  $('#openAtLoginToggle').checked = Boolean(state.settings.openAtLogin);
  $('#openaiApiKeyInput').value = state.settings.openaiApiKey || '';
  $('#openaiBaseUrlInput').value = state.settings.openaiBaseUrl || 'https://api.openai.com/v1';
  $('#openaiModelInput').value = state.settings.openaiModel || 'gpt-4o-mini';
  $('#clipboardShortcutInput').value = state.settings.clipboardAiShortcut || 'Ctrl+Alt+T';
  $('#autoCompleteParentToggle').checked = Boolean(state.settings.autoCompleteParentOnSubtasksDone);
}

function setInteractionMode(mode) {
  if (state.interactionMode === mode) return;
  state.interactionMode = mode;
  document.body.classList.toggle('interaction-far', mode === 'far');
  document.body.classList.toggle('interaction-near', mode === 'near');
  document.body.classList.toggle('interaction-active', mode === 'active');
}

function isInteractiveTarget(target) {
  return Boolean(target.closest('button, input, select, textarea, a, label, .settings-card, .guide-card'));
}

async function setMousePassthrough(passthrough) {
  if (state.mousePassthrough === passthrough) return;
  state.mousePassthrough = passthrough;
  await window.ntodo.setMousePassthrough(passthrough);
}

function resetEngageTimer() {
  window.clearTimeout(resetEngageTimer.timer);
  resetEngageTimer.timer = window.setTimeout(() => {
    state.isEngaged = false;
    setInteractionMode('far');
    setMousePassthrough(true);
  }, 18000);
}

function engageWindow() {
  state.isEngaged = true;
  setInteractionMode('active');
  setMousePassthrough(false);
  resetEngageTimer();
}

function bindInteractionLayer() {
  document.body.classList.add('interaction-far');
  setMousePassthrough(true);

  document.addEventListener('pointermove', (event) => {
    if (state.isEngaged) {
      resetEngageTimer();
      return;
    }
    setInteractionMode('near');
    setMousePassthrough(!isInteractiveTarget(event.target));
  });

  document.addEventListener('pointerdown', (event) => {
    if (isInteractiveTarget(event.target)) engageWindow();
  }, true);

  document.addEventListener('click', (event) => {
    if (!state.isEngaged && !isInteractiveTarget(event.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  document.addEventListener('mouseleave', () => {
    if (state.isEngaged) return;
    setInteractionMode('far');
    setMousePassthrough(true);
  });

  window.addEventListener('blur', () => {
    state.isEngaged = false;
    setInteractionMode('far');
    setMousePassthrough(true);
  });
}

function applyAddMode() {
  const isAiMode = state.addMode === 'ai';
  $('.manual-controls').hidden = isAiMode;
  $('.ai-controls').hidden = !isAiMode;
  $('#quickAddForm').classList.toggle('ai-mode', isAiMode);
  $('#taskInput').placeholder = isAiMode
    ? '例如：明天一定要交英语作文，分成查资料、写初稿、修改'
    : '添加现在要做的事';
  document.querySelectorAll('.add-mode-option').forEach((button) => {
    button.classList.toggle('active', button.dataset.mode === state.addMode);
  });
  focusTaskInput(false);
}

function showEncouragement(eventType = 'complete', message = '') {
  const box = $('#encourage');
  const fallback = eventType === 'add' ? addEncouragements : completeEncouragements;
  box.textContent = message || fallback[Math.floor(Math.random() * fallback.length)];
  box.hidden = false;
  window.clearTimeout(showEncouragement.timer);
  showEncouragement.timer = window.setTimeout(() => {
    box.hidden = true;
  }, 2600);
}

function showTaskFeedback(eventType) {
  showEncouragement(eventType);
}

function focusTaskInput(selectText = true) {
  window.setTimeout(() => {
    const input = $('#taskInput');
    window.focus();
    input.focus();
    if (selectText) input.select();
  }, 40);
}

function showAiError(message) {
  const box = $('#aiError');
  box.textContent = message;
  box.hidden = false;
  window.clearTimeout(showAiError.timer);
  showAiError.timer = window.setTimeout(() => {
    box.hidden = true;
  }, 5200);
}

function createTrashIcon() {
  const namespace = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(namespace, 'svg');
  svg.setAttribute('class', 'action-icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');

  const lid = document.createElementNS(namespace, 'path');
  lid.setAttribute('d', 'M7 8h10M10 8V6h4v2M9 10v7M15 10v7');

  const bin = document.createElementNS(namespace, 'path');
  bin.setAttribute('d', 'M8 8l1 11h6l1-11');

  svg.append(lid, bin);
  return svg;
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
      const shouldCompleteParent =
        !readOnly &&
        state.settings.autoCompleteParentOnSubtasksDone &&
        task.subtasks.length > 0 &&
        task.subtasks.every((item) => item.done);
      if (shouldCompleteParent) {
        await completeTask(task.id);
        return;
      }
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
      deleteButton.setAttribute('aria-label', '删除子项目');
      deleteButton.title = '删除子项目';
      deleteButton.append(createTrashIcon());
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
  const dueButton = item.querySelector('.due-toggle');
  const dueForm = item.querySelector('.due-date-form');
  const dueInput = dueForm.querySelector('input');
  const clearDueButton = dueForm.querySelector('.clear-due');
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
  dueInput.value = task.dueDate || '';
  dueButton.classList.toggle('has-due', Boolean(task.dueDate));

  checkbox.addEventListener('change', () => completeTask(task.id, item));
  deleteButton.addEventListener('click', () => deleteActiveTask(task.id));
  dueButton.addEventListener('click', () => {
    dueForm.hidden = !dueForm.hidden;
    if (!dueForm.hidden) {
      dueInput.value = task.dueDate || '';
      dueInput.focus();
    }
  });
  subtaskButton.addEventListener('click', () => {
    subtaskForm.hidden = !subtaskForm.hidden;
    if (!subtaskForm.hidden) subtaskInput.focus();
  });

  dueForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    task.dueDate = dueInput.value || '';
    dueForm.hidden = true;
    await persist();
    render();
  });

  clearDueButton.addEventListener('click', async () => {
    task.dueDate = '';
    dueInput.value = '';
    dueForm.hidden = true;
    await persist();
    render();
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
  item.querySelector('.due-toggle').remove();
  item.querySelector('.due-date-form').remove();
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

async function addTask(title, priority = state.priority, source = 'manual', dueDate = '', subtasks = []) {
  const cleanTitle = title.trim();
  if (!cleanTitle) return;
  const task = {
    id: uid(),
    title: cleanTitle,
    priority,
    source,
    dueDate: dueDate || '',
    createdAt: nowIso(),
    subtasks: subtasks.map((subtask) => ({
      id: uid(),
      title: String(subtask || '').trim(),
      done: false,
      createdAt: nowIso()
    })).filter((subtask) => subtask.title)
  };
  state.tasks.push(task);
  await persist();
  render();
  showTaskFeedback('add', task);
}

async function completeTask(id, element = null) {
  const index = state.tasks.findIndex((task) => task.id === id);
  if (index === -1) return;
  const [task] = state.tasks.splice(index, 1);
  task.completedAt = nowIso();
  task.subtasks = task.subtasks.map((subtask) => ({ ...subtask, done: true }));
  state.completed.push(task);
  if (element) {
    element.classList.add('done');
    element.classList.add('vanishing');
  }
  await persist();
  showTaskFeedback('complete', task);
  if (element) {
    window.setTimeout(render, 430);
  } else {
    render();
  }
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

async function parseTasksFromText(text, source = 'ai') {
  const parsed = await window.ntodo.parseNaturalTask({
    text,
    settings: state.settings,
    today: new Date().toISOString().slice(0, 10),
    existingTasks: state.tasks.map((task) => ({
      title: task.title,
      priority: task.priority,
      dueDate: task.dueDate,
      subtaskCount: task.subtasks.length
    }))
  });

  const tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
  if (!tasks.length) throw new Error('AI 没有识别到可添加的任务');

  for (const task of tasks) {
    await addTask(task.title, task.priority, source, task.dueDate, task.subtasks);
  }
}

async function addAiTasks() {
  const input = $('#taskInput');
  const button = $('#aiAddButton');
  const text = input.value.trim();
  if (!text) {
    input.focus();
    return;
  }

  button.disabled = true;
  const previousText = button.textContent;
  button.textContent = '...';

  try {
    await parseTasksFromText(text, 'ai');
    input.value = '';
    $('#dueDateInput').value = '';
    $('#aiError').hidden = true;
    focusTaskInput();
  } catch (error) {
    showAiError(error.message || 'AI 添加失败');
    focusTaskInput();
  } finally {
    button.disabled = false;
    button.textContent = previousText;
  }
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
    if (state.addMode === 'ai') {
      await addAiTasks();
      return;
    }
    const input = $('#taskInput');
    const dueDateInput = $('#dueDateInput');
    await addTask(input.value, state.priority, 'manual', dueDateInput.value);
    input.value = '';
    dueDateInput.value = '';
    input.focus();
  });

  $('#taskInput').addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    $('#quickAddForm').requestSubmit();
  });

  document.querySelectorAll('.add-mode-option').forEach((button) => {
    button.addEventListener('click', () => {
      state.addMode = button.dataset.mode;
      applyAddMode();
    });
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

  document.querySelectorAll('.settings-menu-item').forEach((button) => {
    button.addEventListener('click', () => {
      const section = button.dataset.settingsSection;
      document.querySelectorAll('.settings-menu-item').forEach((item) => {
        item.classList.toggle('active', item === button);
      });
      document.querySelectorAll('.settings-section').forEach((panel) => {
        panel.classList.toggle('active', panel.dataset.settingsSection === section);
      });
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

  [
    ['farOpacityRange', 'farOpacity'],
    ['nearOpacityRange', 'nearOpacity'],
    ['activeOpacityRange', 'activeOpacity']
  ].forEach(([rangeId, settingKey]) => {
    $(`#${rangeId}`).addEventListener('input', async (event) => {
      state.settings[settingKey] = Number(event.currentTarget.value) / 100;
      applySettings();
      await persist();
    });
  });

  $('#openAtLoginToggle').addEventListener('change', async (event) => {
    const enabled = event.currentTarget.checked;
    state.settings.openAtLogin = enabled;
    const loginSettings = await window.ntodo.setOpenAtLogin(enabled);
    state.settings.openAtLogin = Boolean(loginSettings.openAtLogin);
    applySettings();
    await persist();
  });

  $('#autoCompleteParentToggle').addEventListener('change', async (event) => {
    state.settings.autoCompleteParentOnSubtasksDone = event.currentTarget.checked;
    applySettings();
    await persist();
  });

  $('#openaiApiKeyInput').addEventListener('change', async (event) => {
    state.settings.openaiApiKey = event.currentTarget.value.trim();
    await persist();
  });

  $('#openaiBaseUrlInput').addEventListener('change', async (event) => {
    state.settings.openaiBaseUrl = event.currentTarget.value.trim() || 'https://api.openai.com/v1';
    applySettings();
    await persist();
  });

  $('#openaiModelInput').addEventListener('change', async (event) => {
    state.settings.openaiModel = event.currentTarget.value.trim() || 'gpt-4o-mini';
    applySettings();
    await persist();
  });

  $('#clipboardShortcutInput').addEventListener('change', async (event) => {
    const shortcut = event.currentTarget.value.trim() || 'Ctrl+Alt+T';
    state.settings.clipboardAiShortcut = shortcut;
    const result = await window.ntodo.setClipboardShortcut(shortcut);
    $('#clipboardShortcutStatus').textContent = result.ok
      ? `已注册：${shortcut}`
      : `注册失败：${shortcut} 可能已被占用`;
    applySettings();
    await persist();
  });

  $('#guideDoneButton').addEventListener('click', () => {
    localStorage.setItem('ntodo:onboarding-seen', '1');
    $('#onboarding').hidden = true;
  });

  $('#aiAddButton').addEventListener('click', addAiTasks);
  $('#minButton').addEventListener('click', () => window.ntodo.minimize());
  $('#closeButton').addEventListener('click', () => {
    engageWindow();
    $('#closeChoicePanel').hidden = false;
  });
  $('#closeChoicePanel').addEventListener('click', (event) => {
    if (event.target === event.currentTarget) {
      $('#closeChoicePanel').hidden = true;
    }
  });
  $('#closeChoiceCancel').addEventListener('click', () => {
    $('#closeChoicePanel').hidden = true;
  });
  $('#closeToTrayButton').addEventListener('click', () => {
    $('#closeChoicePanel').hidden = true;
    window.ntodo.close();
  });
  $('#quitAppButton').addEventListener('click', () => window.ntodo.quit());
  $('#pinButton').addEventListener('click', async () => {
    state.pinned = !state.pinned;
    await window.ntodo.setPinned(state.pinned);
    $('#pinButton').classList.toggle('active', state.pinned);
  });

  window.ntodo.onStoreChanged((store) => {
    state.tasks = Array.isArray(store.tasks) ? store.tasks : [];
    state.completed = Array.isArray(store.completed) ? store.completed : [];
    state.settings = {
      ...state.settings,
      ...(store && typeof store.settings === 'object' ? store.settings : {})
    };
    applySettings();
    render();
    showTaskFeedback('add');
  });
}

async function boot() {
  bindEvents();
  bindInteractionLayer();
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
  window.ntodo.setClipboardShortcut(state.settings.clipboardAiShortcut || 'Ctrl+Alt+T').then((result) => {
    $('#clipboardShortcutStatus').textContent = result.ok
      ? `已注册：${state.settings.clipboardAiShortcut || 'Ctrl+Alt+T'}`
      : '快捷键注册失败，可能已被其他应用占用';
  }).catch(() => {
    $('#clipboardShortcutStatus').textContent = '快捷键注册失败';
  });
  applyAddMode();
  render();
  showOnboardingIfNeeded();
}

boot();
