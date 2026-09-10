import { app, BrowserWindow, desktopCapturer, ipcMain, powerMonitor, screen, session } from 'electron';
import { createRequire } from 'node:module';
import { createPublicKey, verify } from 'node:crypto';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
let mainWindow;
let controlBridge;
let selectedCaptureSourceId;
let initialLink = extractLink(process.argv);

function extractLink(values) {
  return values.find((value) => typeof value === 'string' && value.startsWith('huddle-control://')) ?? null;
}

function addonPath() {
  if (app.isPackaged) return join(process.resourcesPath, 'native', 'huddle_control_bridge.node');
  return join(app.getAppPath(), 'native', 'prebuild', process.arch, 'huddle_control_bridge.node');
}

function loadControlBridge() {
  try {
    return require(addonPath());
  } catch (error) {
    throw new Error(`Huddle Control Agent could not load its native Windows bridge: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function publishLink(link) {
  if (!link) return;
  initialLink = link;
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('agent:link', link);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 760,
    height: 760,
    minWidth: 620,
    minHeight: 620,
    title: 'Huddle Control Agent',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: join(app.getAppPath(), 'src', 'preload.cjs'),
    },
  });
  mainWindow.removeMenu();
  mainWindow.loadFile(join(app.getAppPath(), 'dist-renderer', 'index.html'));
  mainWindow.on('closed', () => {
    mainWindow = undefined;
  });
}

function setNativeSessionState(next) {
  try {
    controlBridge.setSessionState(next);
  } catch {
    // A quitting process must not throw after the native bridge has unloaded.
  }
}

async function resolveSelectedCaptureSource() {
  if (!selectedCaptureSourceId) return null;
  const sources = await desktopCapturer.getSources({ types: ['screen'], fetchWindowIcons: false });
  return sources.find((source) => source.id === selectedCaptureSourceId) ?? null;
}

function registerIpc() {
  ipcMain.handle('agent:initial-link', () => initialLink);
  ipcMain.handle('native:configure-dpi', () => controlBridge.configureDpiAwareness());
  ipcMain.handle('native:is-elevated', () => controlBridge.isElevated());
  ipcMain.handle('native:architecture', () => controlBridge.nativeArchitecture());
  ipcMain.handle('native:windows-version', () => controlBridge.windowsVersion());
  ipcMain.handle('native:apply-input', (_event, input) => controlBridge.applyInput(input));
  ipcMain.handle('native:release-all', () => controlBridge.releaseAll());
  ipcMain.handle('native:clipboard-count', () => controlBridge.clipboardChangeCount());
  ipcMain.handle('native:clipboard-read', () => controlBridge.readClipboardText());
  ipcMain.handle('native:clipboard-write', (_event, text) => controlBridge.writeClipboardText(text));
  ipcMain.handle('native:clipboard-shortcut', (_event, action) => controlBridge.sendClipboardShortcut(action));
  ipcMain.handle('native:session-state', () => controlBridge.sessionState());
  ipcMain.handle('native:acknowledge-display-change', () => controlBridge.acknowledgeDisplayChange());
  ipcMain.handle('native:restart-elevated', (_event, link) => controlBridge.relaunchElevated(link));
  ipcMain.handle('capture:list', async () => {
    const sources = await desktopCapturer.getSources({ types: ['screen'], fetchWindowIcons: false });
    return sources.map(({ id, name, display_id: displayId }) => ({ id, name, displayId }));
  });
  ipcMain.handle('capture:select', async (_event, sourceId) => {
    if (typeof sourceId !== 'string') throw new TypeError('Invalid display source.');
    const source = (await desktopCapturer.getSources({ types: ['screen'], fetchWindowIcons: false })).find((item) => item.id === sourceId);
    if (!source) throw new TypeError('Windows could not map the selected display. Select it again.');
    controlBridge.setCaptureSource(source.id);
    selectedCaptureSourceId = source.id;
  });
  ipcMain.handle('release:verify', (_event, bytes, signature, publicKeyBase64) => {
    if (!(bytes instanceof Uint8Array) || !(signature instanceof Uint8Array) || typeof publicKeyBase64 !== 'string') return false;
    try {
      const rawKey = Buffer.from(publicKeyBase64, 'base64');
      if (rawKey.length !== 32) return false;
      const spki = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), rawKey]);
      return verify(null, Buffer.from(bytes), createPublicKey({ key: spki, format: 'der', type: 'spki' }), Buffer.from(signature));
    } catch {
      return false;
    }
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => publishLink(extractLink(commandLine)));
  app.on('open-url', (event, url) => {
    event.preventDefault();
    publishLink(url);
  });
  app.whenReady().then(() => {
    controlBridge = loadControlBridge();
    controlBridge.configureDpiAwareness();
    if (app.isPackaged) app.setAsDefaultProtocolClient('huddle-control');
    else app.setAsDefaultProtocolClient('huddle-control', process.execPath, [process.argv[1]]);
    registerIpc();
    session.defaultSession.setDisplayMediaRequestHandler(
      async (_request, callback) => {
        try {
          const source = await resolveSelectedCaptureSource();
          callback(source ? { video: source } : {});
        } catch {
          callback({});
        }
      },
      { useSystemPicker: false },
    );
    powerMonitor.on('lock-screen', () => setNativeSessionState('inactive'));
    powerMonitor.on('suspend', () => setNativeSessionState('inactive'));
    powerMonitor.on('shutdown', () => setNativeSessionState('inactive'));
    screen.on('display-added', () => setNativeSessionState('display-changed'));
    screen.on('display-removed', () => setNativeSessionState('display-changed'));
    screen.on('display-metrics-changed', () => setNativeSessionState('display-changed'));
    createWindow();
  });
  app.on('before-quit', () => {
    setNativeSessionState('inactive');
    try {
      controlBridge?.releaseAll();
    } catch {
      // Best effort during teardown.
    }
  });
  app.on('window-all-closed', () => app.quit());
}
