const { app, BrowserWindow, ipcMain, screen, desktopCapturer, dialog, Tray, Menu } = require('electron');
const path = require('path');
const fs = require('fs/promises');

const WINDOW_WIDTH = 330;
const WINDOW_HEIGHT = 500;

let mainWindow;
let tray;
let isQuitting = false;

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
  return data;
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
      { label: '显示 Ntodo', click: showMainWindow },
      { type: 'separator' },
      {
        label: '退出',
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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    showMainWindow();
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  // Keep the tray process alive; users can exit from the tray menu.
});

ipcMain.handle('store:read', readStore);
ipcMain.handle('store:write', (_event, data) => writeStore(data));
ipcMain.handle('ai:parse-task', parseNaturalTask);

ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:close', () => mainWindow?.hide());
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

ipcMain.handle('screenshot:pick', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择一张截图',
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return result.filePaths[0];
});

ipcMain.handle('screenshot:sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 480, height: 300 }
  });
  return sources.slice(0, 12).map((source) => ({
    id: source.id,
    name: source.name,
    thumbnail: source.thumbnail.toDataURL()
  }));
});
