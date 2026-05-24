const { app, BrowserWindow, ipcMain, screen, Tray, Menu } = require('electron');
const { clipboard, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs/promises');

const WINDOW_WIDTH = 330;
const WINDOW_HEIGHT = 500;

let mainWindow;
let clipboardPreviewWindow;
let tray;
let isQuitting = false;
let registeredClipboardShortcut = '';

const DEFAULT_CLIPBOARD_SHORTCUT = 'CommandOrControl+Alt+T';

app.setName('Ntodo');
app.setAppUserModelId('com.ntodo.desktop');

function getStorePath() {
  return path.join(app.getPath('userData'), 'tasks.json');
}

function getIconPath() {
  return path.join(__dirname, '..', 'assets', 'ntodo.ico');
}

async function readStore() {
  try {
    const raw = await fs.readFile(getStorePath(), 'utf8');
    return JSON.parse(raw);
  } catch {
    return { tasks: [], completed: [] };
  }
}

async function writeStore(data) {
  await fs.mkdir(path.dirname(getStorePath()), { recursive: true });
  await fs.writeFile(getStorePath(), JSON.stringify(data, null, 2), 'utf8');
  registerClipboardShortcut(data?.settings?.clipboardAiShortcut);
  return data;
}

function normalizeAccelerator(shortcut) {
  const clean = String(shortcut || '').trim();
  if (!clean) return '';
  return clean
    .split('+')
    .map((part) => {
      const token = part.trim();
      if (/^(ctrl|control)$/i.test(token)) return 'CommandOrControl';
      if (/^cmdorctrl$/i.test(token)) return 'CommandOrControl';
      if (/^cmd$/i.test(token)) return 'Command';
      if (/^option$/i.test(token)) return 'Alt';
      if (/^esc$/i.test(token)) return 'Escape';
      if (/^del$/i.test(token)) return 'Delete';
      if (/^[a-z]$/i.test(token)) return token.toUpperCase();
      return token;
    })
    .filter(Boolean)
    .join('+');
}

function buildOpenAiUrl(baseUrl) {
  const cleanBaseUrl = String(baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
  if (cleanBaseUrl.endsWith('/chat/completions')) return cleanBaseUrl;
  return `${cleanBaseUrl}/chat/completions`;
}

function getResponseContent(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
      .trim();
  }
  return '';
}

function normalizeParsedTasks(parsed) {
  const tasks = Array.isArray(parsed?.tasks) ? parsed.tasks : [];
  return {
    tasks: tasks
      .map((task) => ({
        title: String(task?.title || '').trim(),
        priority: [1, 2, 3].includes(Number(task?.priority)) ? Number(task.priority) : 2,
        dueDate: /^\d{4}-\d{2}-\d{2}$/.test(String(task?.dueDate || '')) ? String(task.dueDate) : '',
        subtasks: Array.isArray(task?.subtasks)
          ? task.subtasks.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 12)
          : []
      }))
      .filter((task) => task.title)
      .slice(0, 8)
  };
}

function normalizeTasksForStore(tasks) {
  return (Array.isArray(tasks) ? tasks : [])
    .map((task) => ({
      title: String(task?.title || '').trim(),
      priority: [1, 2, 3].includes(Number(task?.priority)) ? Number(task.priority) : 2,
      dueDate: /^\d{4}-\d{2}-\d{2}$/.test(String(task?.dueDate || '')) ? String(task.dueDate) : '',
      subtasks: Array.isArray(task?.subtasks)
        ? task.subtasks.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 12)
        : []
    }))
    .filter((task) => task.title)
    .slice(0, 8);
}

function extractJsonObject(text) {
  const cleanText = String(text || '').trim();
  if (!cleanText) throw new Error('模型没有返回可解析内容');

  try {
    return JSON.parse(cleanText);
  } catch {
    const fenced = cleanText.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) return JSON.parse(fenced[1].trim());

    const first = cleanText.indexOf('{');
    const last = cleanText.lastIndexOf('}');
    if (first !== -1 && last > first) {
      return JSON.parse(cleanText.slice(first, last + 1));
    }
    throw new Error('模型返回的内容不是合法 JSON');
  }
}

async function postChatCompletion(url, apiKey, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    return await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('API 请求超时，请检查网络、Base URL 或模型名称');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function parseNaturalTask(_event, payload = {}) {
  const text = String(payload.text || '').trim();
  if (!text) throw new Error('请输入要解析的任务内容');

  const settings = payload.settings || {};
  const apiKey = String(settings.openaiApiKey || process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) throw new Error('请先在设置里填写 OpenAI API Key');

  const model = String(settings.openaiModel || 'gpt-4o-mini').trim();
  const today = String(payload.today || new Date().toISOString().slice(0, 10));
  const existingTasks = Array.isArray(payload.existingTasks)
    ? payload.existingTasks
        .slice(0, 12)
        .map((task) => ({
          title: String(task?.title || '').slice(0, 80),
          priority: [1, 2, 3].includes(Number(task?.priority)) ? Number(task.priority) : 2,
          dueDate: /^\d{4}-\d{2}-\d{2}$/.test(String(task?.dueDate || '')) ? String(task.dueDate) : '',
          subtaskCount: Number.isFinite(Number(task?.subtaskCount)) ? Number(task.subtaskCount) : 0
        }))
    : [];

  const requestBody = {
    model,
    temperature: 0.1,
    stream: false,
    messages: [
      {
        role: 'system',
        content: [
          '你是 Ntodo 的任务解析器，只返回 JSON，不要返回 Markdown，不要解释。',
          'JSON 格式必须是：{"tasks":[{"title":"任务名","priority":2,"dueDate":"YYYY-MM-DD 或空字符串","subtasks":["子任务"]}]}',
          `今天是 ${today}。把“明天、下周五、月底”等相对日期解析成 YYYY-MM-DD。`,
          'priority 需要结合用户语气、截止时间紧迫性、DDL 暗示、任务重要性和现有任务压力判断。',
          'priority=3：用户说“一定、必须、ddl、马上、今天、明天、紧急、考试、提交、截止、不能拖”，或截止时间在 2 天内，或明显比现有任务更急。',
          'priority=2：普通需要完成、近期但不紧急、没有强烈语气。',
          'priority=1：用户表达“有空、以后、顺便、不急、可以的话”，或没有截止且明显是低压力任务。',
          '如果用户明确说高/中/低优先级，以用户明确表达为准。',
          '如果没有明确截止日期，dueDate 返回空字符串。',
          '只有用户明确提到步骤、清单、分成几步时才生成 subtasks。',
          '不要编造用户没有说的任务。',
          `现有未完成任务摘要：${JSON.stringify(existingTasks)}`
        ].join('\n')
      },
      { role: 'user', content: text }
    ],
    response_format: { type: 'json_object' }
  };

  const url = buildOpenAiUrl(settings.openaiBaseUrl);
  let response = await postChatCompletion(url, apiKey, requestBody);

  if (!response.ok && response.status === 400) {
    const fallbackBody = { ...requestBody };
    delete fallbackBody.response_format;
    response = await postChatCompletion(url, apiKey, fallbackBody);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`OpenAI API 请求失败：${response.status} ${detail.slice(0, 240)}`);
  }

  const data = await response.json();
  const content = getResponseContent(data);
  return normalizeParsedTasks(extractJsonObject(content));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildClipboardPreviewHtml(tasks, error = '') {
  const rows = normalizeTasksForStore(tasks);
  const rowsHtml = rows
    .map((task, index) => {
      const subtasks = task.subtasks.join('\n');
      return `
        <article class="task-card" data-index="${index}">
          <label>
            <span>任务</span>
            <textarea class="title" rows="2" maxlength="180">${escapeHtml(task.title)}</textarea>
          </label>
          <div class="grid">
            <label>
              <span>优先级</span>
              <select class="priority">
                <option value="3"${task.priority === 3 ? ' selected' : ''}>高</option>
                <option value="2"${task.priority === 2 ? ' selected' : ''}>中</option>
                <option value="1"${task.priority === 1 ? ' selected' : ''}>低</option>
              </select>
            </label>
            <label>
              <span>截止日期</span>
              <input class="dueDate" type="date" value="${escapeHtml(task.dueDate)}" />
            </label>
          </div>
          <label>
            <span>子任务</span>
            <textarea class="subtasks" rows="2" placeholder="每行一个子任务">${escapeHtml(subtasks)}</textarea>
          </label>
        </article>`;
    })
    .join('');

  const content = rowsHtml || `<div class="empty">${escapeHtml(error || '没有识别到可添加的任务')}</div>`;
  const disableConfirm = rowsHtml ? '' : ' disabled';
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <style>
    :root { color-scheme: light; font-family: "Microsoft YaHei", "Segoe UI", Arial, sans-serif; color: #26221b; }
    * { box-sizing: border-box; }
    body { margin: 0; overflow: hidden; background: transparent; }
    main { width: 360px; max-height: 430px; overflow: auto; padding: 12px; border: 1px solid rgba(52,45,34,.16); border-radius: 12px; background: #fffdf8; box-shadow: 0 18px 46px rgba(35,29,19,.24); }
    header { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
    h1 { margin: 0; font-size: 14px; line-height: 1.2; }
    p { margin: 3px 0 0; color: #776d5c; font-size: 11px; }
    .status { margin: 0 0 10px; padding: 8px 9px; border-radius: 8px; background: rgba(28,124,104,.1); color: #0f624e; font-size: 12px; }
    .status.error { background: rgba(185,67,50,.1); color: #8b3d32; }
    .task-card { display: grid; gap: 8px; padding: 10px; margin-bottom: 8px; border: 1px solid rgba(52,45,34,.12); border-radius: 9px; background: #fff; }
    label { display: grid; gap: 4px; min-width: 0; }
    label span { color: #6b604f; font-size: 11px; font-weight: 800; }
    textarea, input, select { width: 100%; min-width: 0; border: 1px solid rgba(52,45,34,.16); border-radius: 8px; background: #fffdf8; color: #2c271f; font: inherit; font-size: 12px; outline: none; }
    textarea { resize: vertical; padding: 7px 8px; line-height: 1.35; }
    input, select { height: 32px; padding: 0 8px; }
    textarea:focus, input:focus, select:focus { border-color: rgba(28,124,104,.52); box-shadow: 0 0 0 3px rgba(28,124,104,.12); }
    .grid { display: grid; grid-template-columns: 86px 1fr; gap: 8px; }
    .actions { position: sticky; bottom: -12px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding-top: 10px; background: linear-gradient(180deg, rgba(255,253,248,0), #fffdf8 26%); }
    button { height: 34px; border: 1px solid rgba(52,45,34,.14); border-radius: 9px; background: #fff; color: #343027; font-weight: 800; cursor: pointer; }
    button.primary { border: 0; background: #1c7c68; color: #fff; }
    button:disabled { cursor: default; opacity: .55; }
    .empty { padding: 16px 10px; color: #776d5c; text-align: center; font-size: 12px; }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>确认添加到 Ntodo</h1>
        <p>AI 已根据剪贴板生成任务，可先修改再添加。</p>
      </div>
    </header>
    ${error ? `<div class="status error">${escapeHtml(error)}</div>` : '<div class="status">检查无误后确认添加。</div>'}
    <section id="tasks">${content}</section>
    <div class="actions">
      <button id="cancelButton" type="button">取消</button>
      <button id="confirmButton" class="primary" type="button"${disableConfirm}>添加</button>
    </div>
  </main>
  <script>
    const collect = () => Array.from(document.querySelectorAll('.task-card')).map((card) => ({
      title: card.querySelector('.title').value.trim(),
      priority: Number(card.querySelector('.priority').value),
      dueDate: card.querySelector('.dueDate').value,
      subtasks: card.querySelector('.subtasks').value.split(/\\n+/).map((item) => item.trim()).filter(Boolean)
    })).filter((task) => task.title);
    document.getElementById('cancelButton').addEventListener('click', () => window.ntodo.cancelClipboardPreview());
    document.getElementById('confirmButton').addEventListener('click', async (event) => {
      event.currentTarget.disabled = true;
      await window.ntodo.confirmClipboardTasks(collect());
    });
  </script>
</body>
</html>`;
}

function showClipboardPreview(tasks, error = '') {
  if (clipboardPreviewWindow && !clipboardPreviewWindow.isDestroyed()) {
    clipboardPreviewWindow.close();
  }

  const point = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(point);
  const width = 360;
  const height = 430;
  const x = Math.min(Math.max(point.x + 12, display.workArea.x), display.workArea.x + display.workArea.width - width);
  const y = Math.min(Math.max(point.y + 12, display.workArea.y), display.workArea.y + display.workArea.height - height);

  const previewWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    title: 'Ntodo Clipboard Preview',
    icon: getIconPath(),
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  clipboardPreviewWindow = previewWindow;
  previewWindow.setAlwaysOnTop(true, 'screen-saver');
  previewWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildClipboardPreviewHtml(tasks, error))}`);
  previewWindow.on('closed', () => {
    if (clipboardPreviewWindow === previewWindow) clipboardPreviewWindow = null;
  });
}

async function addConfirmedClipboardTasks(tasks) {
  const cleanTasks = normalizeTasksForStore(tasks);
  if (!cleanTasks.length) return false;

  const store = await readStore();
  const createdAt = new Date().toISOString();
  const existingTasks = Array.isArray(store.tasks) ? store.tasks : [];
  store.tasks = existingTasks.concat(
    cleanTasks.map((task) => ({
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      title: task.title,
      priority: task.priority,
      source: 'clipboard-ai',
      dueDate: task.dueDate,
      createdAt,
      subtasks: task.subtasks.map((subtask) => ({
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        title: subtask,
        done: false,
        createdAt
      }))
    }))
  );
  await writeStore(store);
  mainWindow?.webContents.send('store:changed', store);
  clipboardPreviewWindow?.close();
  showMainWindow();
  return true;
}

async function runClipboardAiShortcut() {
  const text = clipboard.readText().trim();
  if (!text) {
    showClipboardPreview([], '剪贴板没有可识别的文字。');
    return;
  }

  showClipboardPreview([], '正在识别剪贴板内容...');

  try {
    const store = await readStore();
    const parsed = await parseNaturalTask(null, {
      text,
      settings: store.settings || {},
      existingTasks: Array.isArray(store.tasks) ? store.tasks : []
    });
    showClipboardPreview(parsed.tasks);
  } catch (error) {
    showClipboardPreview([], error.message || 'AI 识别失败');
  }
}

function registerClipboardShortcut(shortcut) {
  if (!app.isReady()) return { ok: false, shortcut: '' };
  const accelerator = normalizeAccelerator(shortcut || DEFAULT_CLIPBOARD_SHORTCUT);
  if (registeredClipboardShortcut === accelerator) return { ok: true, shortcut: accelerator };

  if (registeredClipboardShortcut) {
    globalShortcut.unregister(registeredClipboardShortcut);
    registeredClipboardShortcut = '';
  }

  if (!accelerator) return { ok: true, shortcut: '' };
  const ok = globalShortcut.register(accelerator, runClipboardAiShortcut);
  if (ok) registeredClipboardShortcut = accelerator;
  return { ok, shortcut: accelerator };
}

function placeTopRight(win) {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const { x, y, width } = display.workArea;
  win.setBounds({
    x: x + width - WINDOW_WIDTH - 18,
    y: y + 18,
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT
  });
}

function showMainWindow() {
  if (!mainWindow) return;
  placeTopRight(mainWindow);
  mainWindow.setSkipTaskbar(true);
  mainWindow.show();
  mainWindow.focus();
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
}

function createTray() {
  if (tray) return;
  tray = new Tray(getIconPath());
  tray.setToolTip('Ntodo');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Show Ntodo', click: showMainWindow },
      { type: 'separator' },
      {
        label: 'Exit',
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ])
  );
  tray.on('click', showMainWindow);
  tray.on('double-click', showMainWindow);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: 300,
    minHeight: 380,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    title: 'Ntodo',
    icon: getIconPath(),
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow.hide();
  });

  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  placeTopRight(mainWindow);
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  createTray();
  createWindow();
  readStore().then((store) => registerClipboardShortcut(store?.settings?.clipboardAiShortcut)).catch(() => {
    registerClipboardShortcut(DEFAULT_CLIPBOARD_SHORTCUT);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    showMainWindow();
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  // Keep the tray process alive; users can exit from the tray menu.
});

ipcMain.handle('store:read', readStore);
ipcMain.handle('store:write', (_event, data) => writeStore(data));
ipcMain.handle('ai:parse-task', parseNaturalTask);
ipcMain.handle('clipboard-ai:set-shortcut', (_event, shortcut) => registerClipboardShortcut(shortcut));
ipcMain.handle('clipboard-ai:confirm', (_event, tasks) => addConfirmedClipboardTasks(tasks));
ipcMain.handle('clipboard-ai:cancel-preview', () => {
  clipboardPreviewWindow?.close();
  return true;
});

ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:close', () => mainWindow?.hide());
ipcMain.handle('window:quit', () => {
  isQuitting = true;
  app.quit();
});
ipcMain.handle('window:mouse-passthrough', (_event, passthrough) => {
  if (!mainWindow) return Boolean(passthrough);
  mainWindow.setIgnoreMouseEvents(Boolean(passthrough), { forward: true });
  return Boolean(passthrough);
});
ipcMain.handle('window:pin', (_event, pinned) => {
  mainWindow?.setAlwaysOnTop(Boolean(pinned), 'screen-saver');
  return Boolean(pinned);
});

ipcMain.handle('settings:get-login-item', () => app.getLoginItemSettings());
ipcMain.handle('settings:set-open-at-login', (_event, openAtLogin) => {
  app.setLoginItemSettings({
    openAtLogin: Boolean(openAtLogin),
    path: process.execPath
  });
  return app.getLoginItemSettings();
});

