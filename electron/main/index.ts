import { app, BrowserWindow, ipcMain, dialog, Menu, shell, session, nativeTheme } from 'electron';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { CertStore } from './proxy/certs';
import { DebugProxy } from './proxy/engine';
import { normalizeRules } from './proxy/rules';
import { startSample } from './proxy/sample';
import { SystemProxyManager } from './system-proxy';
import type { FlowmanRules, ComposePayload, BreakpointDecision } from '../../src/types/flow';

let mainWindow: BrowserWindow | null = null;
let proxy: DebugProxy;
let certs: CertStore;
let rules: FlowmanRules;
let samplePort = 0;
let rulesPath = '';
const sysProxy = new SystemProxyManager();

function send(channel: string, payload?: any) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function loadRules(): FlowmanRules {
  try {
    return normalizeRules(JSON.parse(fs.readFileSync(rulesPath, 'utf8')));
  } catch {
    return normalizeRules({});
  }
}

function saveRules(next: any): FlowmanRules {
  rules = normalizeRules(next);
  fs.mkdirSync(path.dirname(rulesPath), { recursive: true });
  fs.writeFileSync(rulesPath, JSON.stringify(rules, null, 2));
  return rules;
}

function statePayload() {
  return {
    ...proxy.status(),
    samplePort,
    systemProxy: sysProxy.systemProxyOwned,
    systemProxyServices: sysProxy.systemProxyServices,
    systemProxyError: sysProxy.systemProxyError,
    caFingerprint: certs.fingerprint(),
    caPath: path.join(certs.directory, 'ca-cert.pem'),
    caDerPath: path.join(certs.directory, 'ca-cert.der'),
  };
}

async function setSystemProxy(enabled: boolean) {
  const result = await sysProxy.setSystemProxy(enabled, proxy.port, proxy.status().running, proxy.lastError);
  send('status', statePayload());
  return result;
}

function seedSampleFlow(): Promise<void> {
  if (!samplePort || !proxy || !proxy.status().running) return Promise.resolve();
  return new Promise((resolve) => {
    const req = http.request({
      host: '127.0.0.1',
      port: proxy.port,
      method: 'GET',
      path: `http://127.0.0.1:${samplePort}/hello`,
      headers: { host: `127.0.0.1:${samplePort}`, 'user-agent': 'Flowman' },
    }, (res) => {
      res.resume();
      res.on('end', resolve);
    });
    req.on('error', () => resolve());
    req.setTimeout(4000, () => {
      req.destroy();
      resolve();
    });
    req.end();
  });
}

async function openBrowser(url?: string) {
  const partition = 'persist:flowman-debug';
  const browserSession = session.fromPartition(partition);
  await browserSession.setProxy({
    proxyRules: `http://127.0.0.1:${proxy.port}`,
    proxyBypassRules: '<-loopback>',
  });
  browserSession.setCertificateVerifyProc((_request, callback) => callback(0));

  const window = new BrowserWindow({
    width: 1040,
    height: 760,
    title: 'Flowman 调试浏览器',
    backgroundColor: '#f4f7fb',
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  });

  const targetUrl = url || (samplePort ? `http://127.0.0.1:${samplePort}/` : `http://127.0.0.1:${proxy.port}/`);
  
  if (process.env.VITE_DEV_SERVER_URL) {
    await window.loadURL(`${process.env.VITE_DEV_SERVER_URL}browser.html?url=${encodeURIComponent(targetUrl)}`);
  } else {
    await window.loadFile(path.join(__dirname, '../../dist/browser.html'), {
      query: { url: targetUrl },
    });
  }
}

function buildMenu() {
  const template: any[] = [
    {
      label: 'Flowman',
      submenu: [
        {
          label: '关于 Flowman',
          click: () => {
            if (mainWindow) {
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: '关于 Flowman',
                message: 'Flowman (Vue 3 + TS + Vite)',
                detail: '现代化的本地 HTTP/HTTPS 调试代理。采用 Vue 3、TypeScript 与 Vite 现代架构重构实现。',
              });
            }
          },
        },
        { type: 'separator' },
        {
          label: '偏好设置...',
          accelerator: 'CmdOrCtrl+,',
          click: () => send('menu', 'settings'),
        },
        { type: 'separator' },
        { role: 'quit', label: '退出' },
      ],
    },
    {
      label: '文件',
      submenu: [
        { label: '清除会话', accelerator: 'Shift+Cmd+Backspace', click: () => proxy.clear() },
        { label: '导出 HAR', click: () => exportHar() },
        { label: '导出 CA 证书', click: () => exportCa() },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { role: 'togglefullscreen', label: '进入全屏' },
      ],
    },
    {
      label: '工具',
      submenu: [
        { label: 'Compose', accelerator: 'Cmd+N', click: () => send('menu', 'compose') },
        { label: '工具页', accelerator: 'Cmd+T', click: () => send('menu', 'tools') },
        { label: '偏好设置', accelerator: 'CmdOrCtrl+,', click: () => send('menu', 'settings') },
        { label: '调试浏览器', click: () => openBrowser() },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function exportHar() {
  if (!mainWindow) return { ok: false };
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: 'flowman-session.har',
    filters: [{ name: 'HAR', extensions: ['har'] }],
  });
  if (result.canceled || !result.filePath) return { ok: false };
  fs.writeFileSync(result.filePath, JSON.stringify(proxy.toHar(), null, 2));
  return { ok: true, filePath: result.filePath };
}

async function exportCa() {
  if (!mainWindow) return { ok: false };
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: 'flowman-ca.pem',
    filters: [{ name: 'PEM', extensions: ['pem'] }, { name: 'DER', extensions: ['cer', 'der'] }],
  });
  if (result.canceled || !result.filePath) return { ok: false };
  if (result.filePath.endsWith('.cer') || result.filePath.endsWith('.der')) {
    fs.writeFileSync(result.filePath, certs.der());
  } else {
    fs.writeFileSync(result.filePath, certs.caCertPem);
  }
  return { ok: true, filePath: result.filePath };
}

function registerIpc() {
  ipcMain.handle('state', () => statePayload());
  ipcMain.handle('recording', async (_event, value: boolean) => {
    proxy.setRecording(value);
    if (value) await setSystemProxy(true);
    return statePayload();
  });
  ipcMain.handle('clear', () => {
    proxy.clear();
    return statePayload();
  });
  ipcMain.handle('rules:get', () => rules);
  ipcMain.handle('rules:save', async (_event, next: any) => {
    let updateError = '';
    try {
      await proxy.updateRules(next);
      saveRules(next);
    } catch (error: any) {
      updateError = error.message;
      proxy.lastError = error.message;
    }
    return { ok: !updateError, error: updateError, rules, state: statePayload() };
  });
  ipcMain.handle('flows', () => proxy.listSummaries());
  ipcMain.handle('flow', (_event, id: string) => proxy.getFlow(id));
  ipcMain.handle('search', (_event, query: string) => proxy.search(query));
  ipcMain.handle('export-har', () => exportHar());
  ipcMain.handle('export-ca', () => exportCa());
  ipcMain.handle('install-ca', async () => {
    const caPath = path.join(certs.directory, 'ca-cert.pem');
    return sysProxy.installCaToKeychain(caPath);
  });
  ipcMain.handle('reveal-ca', () => {
    shell.showItemInFolder(path.join(certs.directory, 'ca-cert.pem'));
    return true;
  });
  ipcMain.handle('repeat', (_event, id: string) => proxy.repeat(id));
  ipcMain.handle('compose', (_event, payload: ComposePayload) => proxy.compose(payload));
  ipcMain.handle('break:resolve', (_event, payload: { id: string; decision: BreakpointDecision }) => {
    return proxy.resolveBreakpoint(payload.id, payload.decision);
  });
  ipcMain.handle('system-proxy', (_event, enabled: boolean) => setSystemProxy(enabled));
  ipcMain.handle('browser', (_event, url?: string) => openBrowser(url));
  ipcMain.handle('select-file', async () => {
    if (!mainWindow) return '';
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'] });
    return result.canceled ? '' : result.filePaths[0];
  });
  ipcMain.handle('highlight', (_event, payload: { id: string; color: string }) => {
    return proxy.highlight(payload.id, payload.color);
  });
  ipcMain.handle('theme:set', (_event, theme: 'system' | 'light' | 'dark') => {
    nativeTheme.themeSource = theme;
    return nativeTheme.shouldUseDarkColors;
  });
  ipcMain.handle('theme:get', () => {
    return {
      themeSource: nativeTheme.themeSource,
      shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
    };
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 880,
    minWidth: 1040,
    minHeight: 680,
    title: 'Flowman',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    backgroundColor: '#e8edf3',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }
}

app.whenReady().then(async () => {
  const userData = app.getPath('userData');
  rulesPath = path.join(userData, 'rules.json');
  certs = new CertStore(path.join(userData, 'certs'));
  certs.load();
  fs.writeFileSync(path.join(certs.directory, 'ca-cert.der'), certs.der());
  rules = loadRules();
  proxy = new DebugProxy({ certStore: certs, rules });

  proxy.on('flow', (flow) => send('flow', flow));
  proxy.on('flow-update', (flow) => send('flow-update', flow));
  proxy.on('breakpoint', (data) => send('breakpoint', data));
  proxy.on('status', () => send('status', statePayload()));
  proxy.on('cleared', () => send('cleared'));

  try {
    const sample = await startSample(9108);
    samplePort = sample.port;
  } catch (error: any) {
    samplePort = 0;
    proxy.lastError = `示例服务启动失败: ${error.message}`;
  }

  try {
    await proxy.start(rules.port);
  } catch (error: any) {
    const originalPort = rules.port;
    let startedFallback = false;
    if (rules.port !== 9001) {
      try {
        await proxy.start(9001);
        rules.port = 9001;
        saveRules(rules);
        proxy.lastError = `端口 ${originalPort} 已被占用，已自动切换至端口 9001`;
        startedFallback = true;
      } catch {
        // Fallback failed
      }
    }
    if (!startedFallback) {
      proxy.lastError = `代理端口 ${originalPort} 启动失败: ${error.message}`;
    }
  }

  registerIpc();
  buildMenu();
  await seedSampleFlow();
  if (proxy.recording) await setSystemProxy(true);
  createWindow();
});

let quitting = false;
app.on('before-quit', (event) => {
  if (quitting) return;
  event.preventDefault();
  quitting = true;
  const owned = sysProxy.systemProxyOwned;
  sysProxy.systemProxyOwned = false;
  const cleanup = owned ? sysProxy.disableRememberedServices() : Promise.resolve();
  cleanup.finally(async () => {
    if (proxy) await proxy.stop();
    app.exit(0);
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
