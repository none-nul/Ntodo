const state = {
  tasks: [],
  completed: [],
  sync: null,
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
    openaiProfiles: [],
    activeOpenaiProfileId: '',
    settingsUpdatedAt: '',
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
const ACCOUNT_REGISTER_URL = 'https://account.nonenull.top/#register';
const activeView = $('#activeView');
const completedView = $('#completedView');
const taskTemplate = $('#taskTemplate');

function uid() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (char) =>
    (Number(char) ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> Number(char) / 4).toString(16)
  );
}

function nowIso() {
  return new Date().toISOString();
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function createOpenaiProfile(profile = {}) {
  const model = String(profile.model || profile.openaiModel || 'gpt-4o-mini').trim() || 'gpt-4o-mini';
  return {
    id: profile.id || uid(),
    name: String(profile.name || model || 'API').trim(),
    apiKey: String(profile.apiKey || profile.openaiApiKey || '').trim(),
    baseUrl: String(profile.baseUrl || profile.openaiBaseUrl || 'https://api.openai.com/v1').trim() || 'https://api.openai.com/v1',
    model
  };
}

function syncActiveOpenaiSettings() {
  const profile = state.settings.openaiProfiles.find((item) => item.id === state.settings.activeOpenaiProfileId);
  if (!profile) return;
  state.settings.openaiApiKey = profile.apiKey;
  state.settings.openaiBaseUrl = profile.baseUrl;
  state.settings.openaiModel = profile.model;
}

function ensureOpenaiProfiles() {
  const settings = state.settings;
  settings.openaiProfiles = Array.isArray(settings.openaiProfiles)
    ? settings.openaiProfiles.map(createOpenaiProfile).filter((profile) => profile.apiKey)
    : [];
  if (!settings.openaiProfiles.length && settings.openaiApiKey) {
    settings.openaiProfiles.push(createOpenaiProfile({
      name: settings.openaiModel || 'OpenAI',
      apiKey: settings.openaiApiKey,
      baseUrl: settings.openaiBaseUrl,
      model: settings.openaiModel
    }));
  }
  if (!settings.openaiProfiles.some((profile) => profile.id === settings.activeOpenaiProfileId)) {
    settings.activeOpenaiProfileId = settings.openaiProfiles[0]?.id || '';
  }
  syncActiveOpenaiSettings();
  return settings.openaiProfiles;
}

function maskApiKey(apiKey) {
  const key = String(apiKey || '');
  if (key.length <= 8) return key ? '••••' : '未填写';
  return `${key.slice(0, 3)}••••${key.slice(-4)}`;
}

function markSettingsChanged() {
  state.settings.settingsUpdatedAt = nowIso();
}

function createDefaultSyncState(sync = {}) {
  return {
    userId: sync.userId || 'local-user',
    deviceId: isUuid(sync.deviceId) ? sync.deviceId : uid(),
    accessToken: sync.accessToken || '',
    email: sync.email || '',
    name: sync.name || '',
    lastServerVersion: Number(sync.lastServerVersion) || 0,
    lastSyncAt: sync.lastSyncAt || '',
    status: sync.status || 'offline',
    lastError: sync.lastError || '',
    outbox: Array.isArray(sync.outbox) ? sync.outbox : [],
    appliedChanges: Array.isArray(sync.appliedChanges) ? sync.appliedChanges : [],
    deletedTodos: Array.isArray(sync.deletedTodos) ? sync.deletedTodos : []
  };
}

function ensureSyncState() {
  if (!state.sync) state.sync = createDefaultSyncState();
  return state.sync;
}

function hydrateTask(task, completed = false, index = 0) {
  const sync = ensureSyncState();
  const createdAt = task.createdAt || task.created_at || nowIso();
  const updatedAt = task.updated_at || task.updatedAt || task.completedAt || createdAt;
  const id = isUuid(task.id) ? task.id : uid();
  return {
    ...task,
    id,
    title: String(task.title || '').trim(),
    note: task.note || '',
    completed: Boolean(task.completed ?? completed),
    dueDate: task.dueDate || (typeof task.due_at === 'string' ? task.due_at.slice(0, 10) : ''),
    priority: [1, 2, 3].includes(Number(task.priority)) ? Number(task.priority) : 2,
    list_id: task.list_id || null,
    sort_order: Number.isFinite(Number(task.sort_order)) ? Number(task.sort_order) : index,
    createdAt,
    created_at: task.created_at || createdAt,
    updated_at: updatedAt,
    deleted_at: task.deleted_at || null,
    version: Math.max(1, Number(task.version) || 1),
    device_id: isUuid(task.device_id) ? task.device_id : sync.deviceId,
    server_version: Number(task.server_version) || 0,
    sync_status: task.sync_status || 'synced',
    subtasks: Array.isArray(task.subtasks) ? task.subtasks : []
  };
}

function todoPayload(task) {
  const sync = ensureSyncState();
  return {
    id: task.id,
    user_id: sync.userId,
    title: task.title,
    note: task.note || '',
    completed: Boolean(task.completed),
    due_at: task.dueDate || null,
    priority: Number(task.priority) || 2,
    list_id: task.list_id || null,
    sort_order: Number(task.sort_order) || 0,
    created_at: task.created_at || task.createdAt,
    updated_at: task.updated_at || nowIso(),
    deleted_at: task.deleted_at || null,
    version: Number(task.version) || 1,
    device_id: task.device_id || sync.deviceId,
    subtasks: task.subtasks || []
  };
}

function touchTodo(task, completed = Boolean(task.completed)) {
  const sync = ensureSyncState();
  task.completed = completed;
  task.updated_at = nowIso();
  task.version = Math.max(1, Number(task.version) || 1) + 1;
  task.device_id = sync.deviceId;
  task.sync_status = 'pending';
  if (!task.created_at) task.created_at = task.createdAt || task.updated_at;
  if (!task.sort_order && task.sort_order !== 0) task.sort_order = Date.now();
}

function enqueueTodoChange(task, operation = 'update') {
  const sync = ensureSyncState();
  sync.outbox.push({
    id: uid(),
    user_id: sync.userId,
    device_id: sync.deviceId,
    entity_type: 'todo',
    entity_id: task.id,
    operation,
    payload: todoPayload(task),
    client_change_id: uid(),
    base_server_version: Number(task.server_version) || 0,
    created_at: nowIso(),
    retry_count: 0,
    next_retry_at: '',
    status: 'pending'
  });
  if (sync.accessToken) scheduleSync();
}


function timeValue(value) {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

function hasPendingTodoChange(todoId) {
  const sync = ensureSyncState();
  return sync.outbox.some((change) => change.entity_id === todoId && change.status === 'pending');
}

function removePendingTodoChanges(todoId) {
  const sync = ensureSyncState();
  sync.outbox = sync.outbox.filter((change) => change.entity_id !== todoId || change.status === 'synced');
}

function queueTodoIfMissing(task, operation = 'update') {
  if (!task?.id || hasPendingTodoChange(task.id)) return false;
  task.sync_status = 'pending';
  enqueueTodoChange(task, operation);
  return true;
}

function findDeletedTodo(id) {
  const sync = ensureSyncState();
  return sync.deletedTodos.find((todo) => todo.id === id) || null;
}

function flushLocalOrphans() {
  const sync = ensureSyncState();
  sync.deletedTodos = sync.deletedTodos.filter((todo) => isUuid(todo.id));

  sync.deletedTodos.forEach((todo) => {
    if (Number(todo.server_version) <= 0) {
      removePendingTodoChanges(todo.id);
      return;
    }
    if (todo.sync_status === 'synced') return;
    if (!todo.deleted_at) todo.deleted_at = todo.updated_at || nowIso();
    if (!todo.updated_at) todo.updated_at = todo.deleted_at;
    if (!hasPendingTodoChange(todo.id)) {
      enqueueTodoChange(todo, 'delete');
    }
  });

  [...state.tasks, ...state.completed].forEach((task) => {
    if (!task.title || task.deleted_at || hasPendingTodoChange(task.id)) return;
    if (Number(task.server_version) <= 0) {
      queueTodoIfMissing(task, 'create');
      return;
    }
    if (task.sync_status === 'pending') {
      queueTodoIfMissing(task, 'update');
    }
  });
}
function normalizePendingChangesForAccount() {
  const sync = ensureSyncState();
  sync.outbox.forEach((change) => {
    change.user_id = sync.userId;
    change.device_id = sync.deviceId;
    if (!isUuid(change.client_change_id)) change.client_change_id = uid();
    if (!isUuid(change.entity_id) && change.payload?.id && isUuid(change.payload.id)) {
      change.entity_id = change.payload.id;
    }
    if (change.payload && typeof change.payload === 'object') {
      change.payload.user_id = sync.userId;
      change.payload.device_id = sync.deviceId;
    }
  });
  [...state.tasks, ...state.completed].forEach((task) => {
    task.device_id = sync.deviceId;
  });
}

function markTodoChanged(task, operation = 'update', completed = Boolean(task.completed)) {
  touchTodo(task, completed);
  enqueueTodoChange(task, operation);
}

function rememberDeletedTodo(task) {
  const sync = ensureSyncState();
  const payload = todoPayload(task);
  payload.server_version = Number(task.server_version) || Number(payload.server_version) || 0;
  payload.sync_status = task.sync_status || 'pending';
  sync.deletedTodos = sync.deletedTodos.filter((item) => item.id !== task.id);
  sync.deletedTodos.push(payload);
}

function loadStore(store = {}) {
  const shouldQueueExistingTodos = !store.sync;
  state.sync = createDefaultSyncState(store.sync || {});
  state.tasks = (Array.isArray(store.tasks) ? store.tasks : [])
    .map((task, index) => hydrateTask(task, false, index))
    .filter((task) => task.title && !task.deleted_at);
  state.completed = (Array.isArray(store.completed) ? store.completed : [])
    .map((task, index) => hydrateTask(task, true, index))
    .filter((task) => task.title && !task.deleted_at);
  state.settings = {
    ...state.settings,
    ...(store && typeof store.settings === 'object' ? store.settings : {})
  };
  const localTodoIds = new Set([...state.tasks, ...state.completed].map((task) => task.id));
  state.sync.outbox = state.sync.outbox.filter((change) =>
    isUuid(change.client_change_id) &&
    isUuid(change.entity_id) &&
    (localTodoIds.has(change.entity_id) || change.operation === 'delete')
  );
  state.sync.deletedTodos = state.sync.deletedTodos.filter((todo) => isUuid(todo.id));

  const queuedTodoIds = new Set(state.sync.outbox.map((change) => change.entity_id));
  [...state.tasks, ...state.completed].forEach((task) => {
    if (!shouldQueueExistingTodos && (task.server_version > 0 || queuedTodoIds.has(task.id))) return;
    task.sync_status = 'pending';
    enqueueTodoChange(task, 'create');
    queuedTodoIds.add(task.id);
  });
}

function syncSummary() {
  const sync = ensureSyncState();
  const pending = sync.outbox.filter((change) => change.status === 'pending').length;
  const account = sync.email ? sync.email : '未登录';
  const statusMap = {
    idle: '已同步',
    offline: '离线',
    syncing: '同步中',
    error: '同步失败'
  };
  const status = statusMap[sync.status] || sync.status;
  return `${account} · ${status} · 待同步 ${pending}`;
}

function updateSyncStatus() {
  const sync = ensureSyncState();
  const isLoggedIn = Boolean(sync.accessToken);
  const errorBox = $('#syncErrorBox');
  if (errorBox) {
    errorBox.textContent = sync.lastError || '';
    errorBox.hidden = !sync.lastError;
  }
  $('#syncGuestFields').hidden = isLoggedIn;
  const loginPanel = $('#syncLoginPanel');
  if (loginPanel) loginPanel.hidden = isLoggedIn;
  $('#syncAccountPanel').hidden = !isLoggedIn;
  const syncIntervalRow = $('#syncIntervalRow');
  if (syncIntervalRow) syncIntervalRow.hidden = true;
  $('#syncLoginButton').hidden = isLoggedIn;
  $('#syncLogoutButton').hidden = !isLoggedIn;
  if (isLoggedIn) {
    $('#syncAccountEmail').textContent = sync.email || '已登录';
    $('#syncAccountMeta').textContent = sync.lastSyncAt ? `上次同步 ${formatTime(sync.lastSyncAt)}` : '尚未完成同步';
  }
  const statusText = $('#syncStatusText');
  if (statusText) statusText.textContent = syncSummary();
  const syncButton = $('#syncNowButton');
  if (syncButton) syncButton.disabled = sync.status === 'syncing' || !sync.accessToken;
}

async function apiCall(pathName, options = {}) {
  const sync = ensureSyncState();
  const response = await window.ntodo.apiRequest({
    path: pathName,
    method: options.method || 'GET',
    body: options.body,
    token: options.token ?? sync.accessToken,
    timeoutMs: options.timeoutMs || 15000
  });
  if (!response.ok) {
    const message = response.data?.error?.message || `请求失败：${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.data = response.data;
    throw error;
  }
  return response.data;
}

function currentDeviceInfo() {
  return {
    device_id: ensureSyncState().deviceId,
    device_name: navigator.userAgent.includes('Windows') ? 'Ntodo Windows' : 'Ntodo Desktop',
    platform: 'desktop'
  };
}

async function authenticateSync(mode) {
  const sync = ensureSyncState();
  const emailInput = $('#syncLoginEmailInput');
  const passwordInput = $('#syncLoginPasswordInput');
  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;
  sync.email = email;
  sync.lastError = '';
  updateSyncStatus();

  if (!email || password.length < 8) {
    setSyncError('请输入邮箱和至少 8 位密码');
    await persist();
    return;
  }
  try {
    sync.status = 'syncing';
    updateSyncStatus();
    const body = {
      email,
      password,
      device: currentDeviceInfo()
    };
    const data = await apiCall('/auth/login', {
      method: 'POST',
      token: '',
      body
    });
    sync.userId = data.user.id;
    sync.email = data.user.email;
    sync.name = data.user.name || '';
    sync.deviceId = data.device_id || sync.deviceId;
    sync.accessToken = data.access_token;
    sync.lastServerVersion = Number(sync.lastServerVersion) || 0;
    sync.status = 'idle';
    normalizePendingChangesForAccount();
    passwordInput.value = '';
    await persist();
    await syncUserSettingsOnce();
    sync.lastError = '';
    updateSyncStatus();
    showEncouragement('add', '登录成功');
    await syncNow();
  } catch (error) {
    sync.status = 'error';
    if (error.status === 401) {
      sync.lastError = '账号或密码错误';
    } else {
      sync.lastError = error.message || '登录失败';
    }
    await persist();
    updateSyncStatus();
  }
}

function findLocalTodo(id) {
  const active = state.tasks.find((task) => task.id === id);
  if (active) return { task: active, list: state.tasks, completed: false };
  const completed = state.completed.find((task) => task.id === id);
  if (completed) return { task: completed, list: state.completed, completed: true };
  return null;
}

function taskFromPayload(payload) {
  return hydrateTask({
    id: payload.id,
    title: payload.title,
    note: payload.note || '',
    completed: Boolean(payload.completed),
    dueDate: payload.due_at ? String(payload.due_at).slice(0, 10) : '',
    priority: payload.priority,
    list_id: payload.list_id || null,
    sort_order: payload.sort_order,
    createdAt: payload.created_at,
    created_at: payload.created_at,
    updated_at: payload.updated_at,
    deleted_at: payload.deleted_at || null,
    version: payload.version,
    device_id: payload.device_id,
    server_version: payload.server_version || 0,
    sync_status: 'synced',
    completedAt: payload.completed ? payload.updated_at : undefined,
    subtasks: Array.isArray(payload.subtasks) ? payload.subtasks : []
  }, Boolean(payload.completed));
}

function applyRemoteChange(change) {
  const sync = ensureSyncState();
  if (sync.appliedChanges.includes(change.change_id)) return;
  if (change.entity_type !== 'todo') return;
  const payload = {
    ...(change.payload || {}),
    id: change.entity_id,
    server_version: Number(change.server_version) || 0
  };
  const existing = findLocalTodo(change.entity_id);
  const deleted = findDeletedTodo(change.entity_id);
  const remoteUpdatedAt = timeValue(payload.updated_at || change.created_at);

  if (payload.deleted_at) {
    if (existing) {
      const localUpdatedAt = timeValue(existing.task.updated_at || existing.task.updatedAt);
      if (remoteUpdatedAt >= localUpdatedAt) {
        existing.task.deleted_at = payload.deleted_at;
        existing.task.updated_at = payload.updated_at || payload.deleted_at;
        existing.task.server_version = Number(change.server_version) || existing.task.server_version;
        rememberDeletedTodo(existing.task);
        existing.list.splice(existing.list.indexOf(existing.task), 1);
      } else {
        queueTodoIfMissing(existing.task, 'update');
      }
    }
    return;
  }

  if (deleted) {
    const localDeletedAt = timeValue(deleted.deleted_at || deleted.updated_at);
    if (localDeletedAt >= remoteUpdatedAt) {
      const currentServerVersion = Number(deleted.server_version) || 0;
      const remoteServerVersion = Number(change.server_version) || 0;
      deleted.server_version = Math.max(currentServerVersion, remoteServerVersion);
      if (deleted.sync_status !== 'synced' && Number(deleted.server_version) > 0 && !hasPendingTodoChange(deleted.id)) {
        deleted.sync_status = 'pending';
        enqueueTodoChange(deleted, 'delete');
      }
      return;
    }
    sync.deletedTodos = sync.deletedTodos.filter((todo) => todo.id !== deleted.id);
  }

  const nextTask = taskFromPayload(payload);
  nextTask.server_version = Number(change.server_version) || nextTask.server_version;
  if (!existing) {
    (nextTask.completed ? state.completed : state.tasks).push(nextTask);
    return;
  }

  const localUpdatedAt = timeValue(existing.task.updated_at || existing.task.updatedAt);
  if (remoteUpdatedAt < localUpdatedAt) {
    queueTodoIfMissing(existing.task, 'update');
    return;
  }

  Object.assign(existing.task, nextTask);
  if (nextTask.completed !== existing.completed) {
    existing.list.splice(existing.list.indexOf(existing.task), 1);
    (nextTask.completed ? state.completed : state.tasks).push(existing.task);
  }
}
async function pushPendingChanges() {
  const sync = ensureSyncState();
  const changes = sync.outbox
    .filter((change) => change.status === 'pending')
    .slice(0, 100)
    .map((change) => ({
      client_change_id: change.client_change_id,
      entity_type: change.entity_type,
      entity_id: change.entity_id,
      operation: change.operation,
      base_server_version: Number(change.base_server_version) || 0,
      payload: {
        ...change.payload,
        user_id: sync.userId,
        device_id: sync.deviceId
      }
    }));
  if (!changes.length) return;

  const data = await apiCall('/sync/push', {
    method: 'POST',
    body: {
      device_id: sync.deviceId,
      changes
    },
    timeoutMs: 20000
  });

  (data.accepted || []).forEach((accepted) => {
    const outboxItem = sync.outbox.find((change) => change.client_change_id === accepted.client_change_id);
    if (outboxItem) {
      outboxItem.status = 'synced';
      if (outboxItem.operation === 'delete' && accepted.status !== 'stale') {
        const deleted = findDeletedTodo(accepted.entity_id);
        if (deleted) deleted.sync_status = 'synced';
      }
    }
    const local = findLocalTodo(accepted.entity_id);
    if (local) {
      local.task.server_version = Number(accepted.server_version) || local.task.server_version;
      local.task.sync_status = 'synced';
    } else {
      const deleted = findDeletedTodo(accepted.entity_id);
      if (deleted) deleted.server_version = Number(accepted.server_version) || deleted.server_version;
    }
  });
}

async function pullRemoteChanges() {
  const sync = ensureSyncState();
  let since = Number(sync.lastServerVersion) || 0;
  while (true) {
    const data = await apiCall(`/sync/pull?since_version=${since}&limit=200`);
    const changes = Array.isArray(data.changes) ? data.changes : [];
    changes.forEach((change) => {
      if (change.device_id !== sync.deviceId) applyRemoteChange(change);
      if (!sync.appliedChanges.includes(change.change_id)) sync.appliedChanges.push(change.change_id);
      since = Math.max(since, Number(change.server_version) || since);
    });
    sync.lastServerVersion = Math.max(since, Number(data.next_since_version) || since);
    if (!data.has_more) break;
  }
}

async function ackSyncVersion() {
  const sync = ensureSyncState();
  if (!sync.accessToken) return;
  await apiCall('/sync/ack', {
    method: 'POST',
    body: {
      device_id: sync.deviceId,
      last_acked_server_version: sync.lastServerVersion
    }
  });
}

async function syncNow() {
  const sync = ensureSyncState();
  if (!sync.accessToken || sync.status === 'syncing') {
    updateSyncStatus();
    return;
  }
  try {
    sync.status = 'syncing';
    sync.lastError = '';
    updateSyncStatus();
    normalizePendingChangesForAccount();
    flushLocalOrphans();
    await pushPendingChanges();
    await pullRemoteChanges();
    if (sync.outbox.some((change) => change.status === 'pending')) {
      await pushPendingChanges();
    }
    await ackSyncVersion();
    sync.outbox = sync.outbox.filter((change) => change.status !== 'synced').slice(-500);
    sync.appliedChanges = sync.appliedChanges.slice(-1000);
    sync.status = 'idle';
    sync.lastSyncAt = nowIso();
    await persist();
    render();
  } catch (error) {
    sync.status = 'error';
    sync.lastError = error.message || '同步失败';
    await persist();
  } finally {
    updateSyncStatus();
  }
}

function scheduleSync(delay = 1800) {
  window.clearTimeout(scheduleSync.timer);
  scheduleSync.timer = window.setTimeout(syncNow, delay);
}

function syncOnForeground() {
  const sync = ensureSyncState();
  if (!sync.accessToken || sync.status === 'syncing') return;
  syncNow();
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
  ensureSyncState();
  await window.ntodo.writeStore({
    tasks: state.tasks,
    completed: state.completed,
    sync: state.sync,
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
  const sync = ensureSyncState();
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
  ensureOpenaiProfiles();
  renderOpenaiProfiles();
  $('#clipboardShortcutInput').value = state.settings.clipboardAiShortcut || 'Ctrl+Alt+T';
  $('#autoCompleteParentToggle').checked = Boolean(state.settings.autoCompleteParentOnSubtasksDone);
  $('#syncLoginEmailInput').value = sync.email || '';
  updateSyncStatus();
}

async function logoutSync() {
  const sync = ensureSyncState();
  sync.userId = 'local-user';
  sync.accessToken = '';
  sync.email = '';
  sync.name = '';
  sync.status = 'offline';
  sync.lastError = '';
  sync.lastServerVersion = 0;
  $('#syncLoginPasswordInput').value = '';
  await persist();
  updateSyncStatus();
}

function setSyncError(message) {
  ensureSyncState().lastError = message;
  updateSyncStatus();
}

function settingsSnapshot() {
  ensureOpenaiProfiles();
  return {
    ...state.settings,
    settingsUpdatedAt: state.settings.settingsUpdatedAt || nowIso()
  };
}

function mergeOpenaiProfiles(primary = [], secondary = []) {
  const merged = [];
  const seen = new Set();
  [...primary, ...secondary].forEach((profile) => {
    const item = createOpenaiProfile(profile);
    if (!item.apiKey || seen.has(item.id)) return;
    seen.add(item.id);
    merged.push(item);
  });
  return merged;
}

async function syncUserSettingsOnce() {
  const sync = ensureSyncState();
  if (!sync.accessToken) return;
  ensureOpenaiProfiles();
  const hadLocalSettingsStamp = Boolean(state.settings.settingsUpdatedAt);

  const remote = await apiCall('/user/settings', { timeoutMs: 15000 });
  const remoteSettings = remote?.settings && typeof remote.settings === 'object' ? remote.settings : {};
  const remoteUpdatedAt = remote.updated_at || remoteSettings.settingsUpdatedAt || '';
  const hasRemoteSettings = Object.keys(remoteSettings).length > 0;
  const remoteTime = timeValue(remoteUpdatedAt);
  const localTime = hadLocalSettingsStamp ? timeValue(state.settings.settingsUpdatedAt) : 0;
  const localProfiles = Array.isArray(state.settings.openaiProfiles) ? state.settings.openaiProfiles : [];
  const remoteProfiles = Array.isArray(remoteSettings.openaiProfiles) ? remoteSettings.openaiProfiles : [];

  if (hasRemoteSettings && (!hadLocalSettingsStamp || remoteTime > localTime)) {
    state.settings = {
      ...state.settings,
      ...remoteSettings,
      openaiProfiles: mergeOpenaiProfiles(remoteProfiles, localProfiles),
      settingsUpdatedAt: remoteTime ? new Date(remoteTime).toISOString() : (remoteSettings.settingsUpdatedAt || nowIso())
    };
    ensureOpenaiProfiles();
    applySettings();
    await persist();
    return;
  }

  if (hasRemoteSettings && remoteProfiles.length) {
    state.settings.openaiProfiles = mergeOpenaiProfiles(localProfiles, remoteProfiles);
    if (!state.settings.openaiProfiles.some((profile) => profile.id === state.settings.activeOpenaiProfileId)) {
      state.settings.activeOpenaiProfileId = state.settings.openaiProfiles[0]?.id || '';
    }
    syncActiveOpenaiSettings();
  }

  if (!state.settings.settingsUpdatedAt) state.settings.settingsUpdatedAt = nowIso();
  const snapshot = settingsSnapshot();
  await apiCall('/user/settings', {
    method: 'PUT',
    body: {
      settings: snapshot,
      updated_at: snapshot.settingsUpdatedAt
    },
    timeoutMs: 15000
  });
  await persist();
}

function openOpenaiEditor(profileId = '') {
  const profiles = ensureOpenaiProfiles();
  const profile = profiles.find((item) => item.id === profileId);
  $('#openaiEditor').hidden = false;
  $('#openaiEditor').dataset.editingId = profile?.id || '';
  $('#openaiApiKeyInput').value = profile?.apiKey || '';
  $('#openaiBaseUrlInput').value = profile?.baseUrl || 'https://api.openai.com/v1';
  $('#openaiModelInput').value = profile?.model || 'gpt-4o-mini';
  $('#openaiTestStatus').textContent = profile ? '正在编辑已有 API' : '正在添加新 API';
}

function closeOpenaiEditor() {
  $('#openaiEditor').hidden = true;
  $('#openaiEditor').dataset.editingId = '';
  $('#openaiApiKeyInput').value = '';
  $('#openaiBaseUrlInput').value = 'https://api.openai.com/v1';
  $('#openaiModelInput').value = 'gpt-4o-mini';
  $('#openaiTestStatus').textContent = '';
}

function renderOpenaiProfiles() {
  const profiles = ensureOpenaiProfiles();
  const list = $('#openaiProfilesList');
  if (!list) return;
  list.innerHTML = '';

  profiles.forEach((profile) => {
    const item = document.createElement('div');
    item.className = 'api-profile-item';
    if (profile.id === state.settings.activeOpenaiProfileId) item.classList.add('active');

    const info = document.createElement('button');
    info.type = 'button';
    info.className = 'api-profile-main';
    info.innerHTML = `<strong>${profile.name}</strong><small>${profile.model} · ${maskApiKey(profile.apiKey)}</small>`;
    info.addEventListener('click', async () => {
      state.settings.activeOpenaiProfileId = profile.id;
      syncActiveOpenaiSettings();
      markSettingsChanged();
      closeOpenaiEditor();
      renderOpenaiProfiles();
      await persist();
    });

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'api-profile-action';
    edit.textContent = '编辑';
    edit.addEventListener('click', () => openOpenaiEditor(profile.id));

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'api-profile-action danger';
    remove.textContent = '删除';
    remove.addEventListener('click', async () => {
      state.settings.openaiProfiles = state.settings.openaiProfiles.filter((item) => item.id !== profile.id);
      if (state.settings.activeOpenaiProfileId === profile.id) {
        state.settings.activeOpenaiProfileId = state.settings.openaiProfiles[0]?.id || '';
      }
      syncActiveOpenaiSettings();
      markSettingsChanged();
      closeOpenaiEditor();
      renderOpenaiProfiles();
      await persist();
    });

    item.append(info, edit, remove);
    list.append(item);
  });

  if (!profiles.length) {
    const empty = document.createElement('div');
    empty.className = 'api-profile-empty';
    empty.textContent = '还没有保存 API，点击 + 添加。';
    list.append(empty);
    openOpenaiEditor();
  } else if (!$('#openaiEditor').dataset.editingId) {
    closeOpenaiEditor();
  }
}

async function saveOpenaiProfile() {
  const apiKey = $('#openaiApiKeyInput').value.trim();
  const baseUrl = $('#openaiBaseUrlInput').value.trim() || 'https://api.openai.com/v1';
  const model = $('#openaiModelInput').value.trim() || 'gpt-4o-mini';
  if (!apiKey) {
    $('#openaiTestStatus').textContent = '请先填写 API Key';
    return;
  }
  const editingId = $('#openaiEditor').dataset.editingId;
  const profile = createOpenaiProfile({
    id: editingId || uid(),
    name: model,
    apiKey,
    baseUrl,
    model
  });
  const index = state.settings.openaiProfiles.findIndex((item) => item.id === profile.id);
  if (index >= 0) state.settings.openaiProfiles.splice(index, 1, profile);
  else state.settings.openaiProfiles.push(profile);
  state.settings.activeOpenaiProfileId = profile.id;
  syncActiveOpenaiSettings();
  markSettingsChanged();
  closeOpenaiEditor();
  renderOpenaiProfiles();
  await persist();
}

async function testOpenaiProfile() {
  const button = $('#openaiTestButton');
  const status = $('#openaiTestStatus');
  button.disabled = true;
  status.textContent = '正在测试...';
  try {
    await window.ntodo.testOpenAiConfig({
      apiKey: $('#openaiApiKeyInput').value.trim(),
      baseUrl: $('#openaiBaseUrlInput').value.trim() || 'https://api.openai.com/v1',
      model: $('#openaiModelInput').value.trim() || 'gpt-4o-mini'
    });
    status.textContent = '连接正常';
  } catch (error) {
    status.textContent = error.message || '连接失败';
  } finally {
    button.disabled = false;
  }
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
      markTodoChanged(task);
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
        markTodoChanged(task);
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
    markTodoChanged(task);
    await persist();
    render();
  });

  clearDueButton.addEventListener('click', async () => {
    task.dueDate = '';
    dueInput.value = '';
    dueForm.hidden = true;
    markTodoChanged(task);
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
    markTodoChanged(task);
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
    note: '',
    completed: false,
    priority,
    source,
    dueDate: dueDate || '',
    createdAt: nowIso(),
    created_at: nowIso(),
    updated_at: nowIso(),
    deleted_at: null,
    version: 1,
    device_id: ensureSyncState().deviceId,
    server_version: 0,
    sync_status: 'pending',
    list_id: null,
    sort_order: Date.now(),
    subtasks: subtasks.map((subtask) => ({
      id: uid(),
      title: String(subtask || '').trim(),
      done: false,
      createdAt: nowIso()
    })).filter((subtask) => subtask.title)
  };
  enqueueTodoChange(task, 'create');
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
  markTodoChanged(task, 'update', true);
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
  const task = state.tasks.find((item) => item.id === id);
  if (task) {
    const deletedAt = nowIso();
    task.deleted_at = deletedAt;
    task.updated_at = deletedAt;
    if (Number(task.server_version) > 0) {
      markTodoChanged(task, 'delete', false);
      rememberDeletedTodo(task);
    } else {
      removePendingTodoChanges(task.id);
    }
  }
  state.tasks = state.tasks.filter((task) => task.id !== id);
  await persist();
  render();
}

async function deleteCompletedTask(id) {
  const task = state.completed.find((item) => item.id === id);
  if (task) {
    const deletedAt = nowIso();
    task.deleted_at = deletedAt;
    task.updated_at = deletedAt;
    if (Number(task.server_version) > 0) {
      markTodoChanged(task, 'delete', true);
      rememberDeletedTodo(task);
    } else {
      removePendingTodoChanges(task.id);
    }
  }
  state.completed = state.completed.filter((task) => task.id !== id);
  await persist();
  render();
}

async function parseTasksFromText(text, source = 'ai') {
  ensureOpenaiProfiles();
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
      markSettingsChanged();
      applySettings();
      await persist();
    });
  });

  $('#openAtLoginToggle').addEventListener('change', async (event) => {
    const enabled = event.currentTarget.checked;
    state.settings.openAtLogin = enabled;
    const loginSettings = await window.ntodo.setOpenAtLogin(enabled);
    state.settings.openAtLogin = Boolean(loginSettings.openAtLogin);
    markSettingsChanged();
    applySettings();
    await persist();
  });

  $('#autoCompleteParentToggle').addEventListener('change', async (event) => {
    state.settings.autoCompleteParentOnSubtasksDone = event.currentTarget.checked;
    markSettingsChanged();
    applySettings();
    await persist();
  });

  $('#syncLoginEmailInput').addEventListener('change', async (event) => {
    ensureSyncState().email = event.currentTarget.value.trim().toLowerCase();
    await persist();
    updateSyncStatus();
  });

  $('#syncLoginButton').addEventListener('click', () => authenticateSync('login'));
  $('#syncOpenRegisterLink').addEventListener('click', () => window.ntodo.openExternal(ACCOUNT_REGISTER_URL));
  $('#syncNowButton').addEventListener('click', syncNow);
  $('#syncLogoutButton').addEventListener('click', logoutSync);

  $('#openaiAddConfigButton').addEventListener('click', () => openOpenaiEditor());
  $('#openaiSaveConfigButton').addEventListener('click', saveOpenaiProfile);
  $('#openaiTestButton').addEventListener('click', testOpenaiProfile);
  $('#openaiCancelEditButton').addEventListener('click', () => {
    closeOpenaiEditor();
    renderOpenaiProfiles();
  });

  $('#clipboardShortcutInput').addEventListener('change', async (event) => {
    const shortcut = event.currentTarget.value.trim() || 'Ctrl+Alt+T';
    state.settings.clipboardAiShortcut = shortcut;
    markSettingsChanged();
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
    loadStore(store);
    applySettings();
    render();
    showTaskFeedback('add');
  });
}

async function boot() {
  bindEvents();
  bindInteractionLayer();
  const stored = await window.ntodo.readStore();
  loadStore(stored);
  await persist();
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
  updateSyncStatus();
  syncOnForeground();
  window.addEventListener('focus', syncOnForeground);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) syncOnForeground();
  });
  window.addEventListener('online', syncOnForeground);
  showOnboardingIfNeeded();
}

boot();
