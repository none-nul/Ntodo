const { app, BrowserWindow, ipcMain, screen, desktopCapturer, dialog, Tray, Menu } = require('electron');
const path = require('path');
const fs = require('fs/promises');

const WINDOW_WIDTH = 330;
const WINDOW_HEIGHT = 500;

let mainWindow;
let tray;
let isQuitting = false;

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
    resizable: true,
    skipTaskbar: false,
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

ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:close', () => mainWindow?.hide());
ipcMain.handle('window:pin', (_event, pinned) => {
  mainWindow?.setAlwaysOnTop(Boolean(pinned), 'screen-saver');
  return Boolean(pinned);
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
