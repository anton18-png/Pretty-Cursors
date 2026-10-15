const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile, spawnSync } = require('child_process');
const https = require('https');
const http = require('http');

const GITHUB_REPO = 'anton18-png/Pretty-Cursors';
const RAW_BASE = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/`;
// Папка, откуда качаются .7z архивы курсоров
const CURSORS_REMOTE_DIR = 'cursors/';
const CURSORS_DIR = 'C:\\Windows\\Cursors';
const UTILS_DIR = 'Utils';
const ASSETS_DIR = 'assets';
const LOCAL_CURSORS_JSON = 'assets/cursors.json';

// Проверка интернета: стучимся в список курсоров (он лежит в assets, а не в cursors/)
const PING_URL = `${RAW_BASE}${LOCAL_CURSORS_JSON}`;

// ============================================================
//  Белый список курсоров
// ============================================================
const KNOWN_CURSORS = [
  'Acheron Honkai',
  'Ado',
  'Aemeath',
  'Anya Forger',
  'Aqua Deltarune',
  'Arlecchino',
  'Ayanami Rei',
  'Bbarto',
  'Camellya Red',
  'Camellya White',
  'Cinnamoroll',
  'Cyrene',
  'Ellen Joe Alt',
  'Ellen Joe Alt2',
  'Ellen Joe',
  'Elysia Honkai',
  'Frieren',
  'Furina',
  'Hello Kitty',
  'Herta Alt',
  'Herta Honkai',
  'Honkai Firefly',
  'Hornet Hollow Knight',
  'HypnOS',
  'KUDA 5',
  'Kurumi Tokisaki',
  'Makima',
  'Miku Alt',
  'Miku Hatsune',
  'Miku',
  'Rainbow Big',
  'Rainbow Mini',
  'Seven Senses of the ReUnion',
  'Silver Wolf',
  'SouSou No Frieren',
  'Sunday Honkai',
  'Zani Wuwa',
  'Сarlotta'
];

let mainWindow = null;
let rootDir = null;
let assetsDir = null;
let utilsDir = null;
let tempDir = null;
let cacheDir = null;
let isErrorPage = false;

// ============================================================
//  Портативный режим
// ============================================================
function resolvePortableDataDir() {
  if (app.isPackaged) return path.join(path.dirname(process.execPath), 'extreme_data');
  return path.join(app.getAppPath(), 'extreme_data');
}

function setupPortableMode() {
  const dataDir = resolvePortableDataDir();
  fs.mkdirSync(dataDir, { recursive: true });
  const userData = path.join(dataDir, 'electron_userdata');
  fs.mkdirSync(userData, { recursive: true });
  app.setPath('userData', userData);

  const sub = {
    sessionData: path.join(userData, 'session'),
    cache:       path.join(userData, 'cache'),
    logs:        path.join(userData, 'chromium_logs'),
    crashDumps:  path.join(userData, 'crashDumps'),
    temp:        path.join(dataDir, 'temp'),
    userCache:   path.join(dataDir, 'userCache')
  };
  for (const [key, dir] of Object.entries(sub)) {
    try { fs.mkdirSync(dir, { recursive: true }); app.setPath(key, dir); } catch {}
  }
  return dataDir;
}

const PORTABLE_DATA_DIR = setupPortableMode();

// ============================================================
//  Admin
// ============================================================
function isRunningAsAdmin() {
  return new Promise((resolve) => {
    execFile('fltmc', { windowsHide: true }, (err) => resolve(!err));
  });
}

function relaunchAsAdmin() {
  const exePath = process.execPath;
  const args = process.argv.slice(1).filter((a) => !a.startsWith('--relaunch'));
  const argsString = args.map((a) => `'${a.replace(/'/g, "''")}'`).join(',');
  const psArgs = args.length
    ? `-FilePath '${exePath.replace(/'/g, "''")}' -ArgumentList @(${argsString}) -Verb RunAs`
    : `-FilePath '${exePath.replace(/'/g, "''")}' -Verb RunAs`;
  spawnSync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', `Start-Process ${psArgs}`],
    { windowsHide: true, stdio: 'ignore' }
  );
}

async function bootstrap() {
  if (process.argv.includes('--relaunch')) return true;
  const isAdmin = await isRunningAsAdmin();
  if (isAdmin) return true;

  const choice = dialog.showMessageBoxSync({
    type: 'warning',
    title: 'Требуются права администратора',
    message: 'Pretty Cursors работает только с правами администратора.\n\nСейчас будет выполнен перезапуск с запросом UAC.',
    buttons: ['Перезапустить', 'Выход'],
    defaultId: 0,
    cancelId: 1,
  });

  if (choice === 0) relaunchAsAdmin();
  app.quit();
  return false;
}

// ============================================================
//  Проверка интернета
// ============================================================
function pingInternet(timeout = 5000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      resolve(ok);
    };

    const req = https.get(PING_URL, {
      method: 'HEAD',
      headers: { 'User-Agent': 'PrettyCursors/1.0' },
      timeout
    }, (res) => {
      res.resume();
      finish(res.statusCode >= 200 && res.statusCode < 500);
    });

    req.on('timeout', () => { req.destroy(); finish(false); });
    req.on('error', () => finish(false));

    setTimeout(() => { req.destroy(); finish(false); }, timeout + 500);
  });
}

// ============================================================
//  Paths
// ============================================================
function resolvePaths() {
  if (app.isPackaged) {
    rootDir = app.getAppPath();

    const resAssets = path.join(process.resourcesPath, 'assets');
    const asarAssets = path.join(rootDir, 'assets');
    assetsDir = fs.existsSync(resAssets) ? resAssets : asarAssets;

    utilsDir = path.join(process.resourcesPath, UTILS_DIR);
  } else {
    rootDir = app.getAppPath();
    assetsDir = path.join(rootDir, ASSETS_DIR);
    utilsDir = path.join(rootDir, UTILS_DIR);
  }
}

function getUtilsPath(file) {
  return path.join(utilsDir, file);
}

function getCursorIconPath(cursorName) {
  const base = cursorName.replace(/\.7z$/i, '');
  const iconsDir = path.join(assetsDir, 'cursor_icons');
  const candidates = [
    path.join(iconsDir, `${base}.png`),
    path.join(iconsDir, `${base}.PNG`),
  ];
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p; } catch {}
  }
  return null;
}

function getAppIconPath() {
  const candidates = [];
  if (app.isPackaged) {
    candidates.push(
      path.join(process.resourcesPath, 'assets', 'icon.ico'),
      path.join(app.getAppPath(), 'assets', 'icon.ico')
    );
  } else {
    candidates.push(
      path.join(__dirname, 'assets', 'icon.ico'),
      path.join(app.getAppPath(), 'assets', 'icon.ico')
    );
  }
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p; } catch {}
  }
  return null;
}

function isInstalled(cursorName) {
  const destDir = path.join(CURSORS_DIR, cursorName);
  if (!fs.existsSync(destDir)) return false;
  try {
    return fs.readdirSync(destDir).some(f => /\.(cur|ani)$/i.test(f));
  } catch { return false; }
}

function isDownloaded(cursorName) {
  return fs.existsSync(path.join(cacheDir, `${cursorName}.7z`));
}

// ============================================================
//  Download
// ============================================================
function downloadFile(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('Too many redirects'));
    const file = fs.createWriteStream(dest);
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      headers: {
        'User-Agent': 'PrettyCursors/1.0',
        'Accept': 'application/octet-stream'
      },
      timeout: 30000
    }, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode)) {
        file.close();
        try { fs.unlinkSync(dest); } catch {}
        return downloadFile(res.headers.location, dest, redirects + 1).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(dest); } catch {}
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(dest)));
    });
    req.on('timeout', () => req.destroy(new Error('Timeout')));
    req.on('error', (err) => { file.close(); try { fs.unlinkSync(dest); } catch {} reject(err); });
  });
}

// ============================================================
//  Список курсоров
// ============================================================
function loadLocalList() {
  const localPath = path.join(rootDir, LOCAL_CURSORS_JSON);
  if (!fs.existsSync(localPath)) {
    console.warn('[loadLocalList] файл не найден:', localPath);
    return [];
  }
  try {
    const json = JSON.parse(fs.readFileSync(localPath, 'utf8'));
    if (!Array.isArray(json)) return [];
    return json.map(item => {
      const name = item.name.replace(/\.7z$/i, '');
      return {
        name,
        fileName: `${name}.7z`,
        size: item.size || 0,
        // Все ссылки ведут в папку cursors/
        downloadUrl: item.downloadUrl || `${RAW_BASE}${CURSORS_REMOTE_DIR}${encodeURIComponent(name)}.7z`
      };
    });
  } catch (e) {
    console.warn('[loadLocalList] parse failed:', e.message);
    return [];
  }
}

async function fetchCursorList() {
  const list = loadLocalList();
  return list.map(c => ({
    ...c,
    icon: getCursorIconPath(c.name),
    downloaded: isDownloaded(c.name),
    installed: isInstalled(c.name)
  }));
}

// ============================================================
//  Extract / Install / Activate / Uninstall
// ============================================================
async function extractArchive(archivePath, destDir) {
  const sevenZip = getUtilsPath('7z.exe');
  if (!fs.existsSync(sevenZip)) throw new Error('7z.exe не найден в папке Utils');
  return new Promise((resolve, reject) => {
    execFile(sevenZip, ['x', archivePath, `-o${destDir}`, '-y'],
      { windowsHide: true, maxBuffer: 32 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr || err.message));
        resolve();
      });
  });
}

function copyRecursiveSync(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copyRecursiveSync(path.join(src, name), path.join(dest, name));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

async function downloadCursor(cursorName) {
  const archivePath = path.join(cacheDir, `${cursorName}.7z`);
  try {
    if (fs.existsSync(archivePath)) {
      return { ok: true, alreadyDownloaded: true, size: fs.statSync(archivePath).size };
    }
    // Скачиваем из папки cursors/
    const url = `${RAW_BASE}${CURSORS_REMOTE_DIR}${encodeURIComponent(cursorName)}.7z`;
    await downloadFile(url, archivePath);
    return { ok: true, size: fs.statSync(archivePath).size };
  } catch (e) {
    try { if (fs.existsSync(archivePath)) fs.unlinkSync(archivePath); } catch {}
    return { ok: false, error: e.message };
  }
}

async function installCursor(cursorName) {
  const archivePath = path.join(cacheDir, `${cursorName}.7z`);
  const tempExtract = path.join(tempDir, cursorName);
  const destDir = path.join(CURSORS_DIR, cursorName);

  try {
    if (!fs.existsSync(archivePath)) {
      const dl = await downloadCursor(cursorName);
      if (!dl.ok) throw new Error(dl.error || 'Не удалось скачать архив');
    }

    if (fs.existsSync(tempExtract)) fs.rmSync(tempExtract, { recursive: true, force: true });
    fs.mkdirSync(tempExtract, { recursive: true });
    await extractArchive(archivePath, tempExtract);

    let sourceRoot = tempExtract;
    const entries = fs.readdirSync(tempExtract, { withFileTypes: true });
    if (entries.length === 1 && entries[0].isDirectory()) {
      sourceRoot = path.join(tempExtract, entries[0].name);
    }

    if (fs.existsSync(destDir)) fs.rmSync(destDir, { recursive: true, force: true });
    fs.mkdirSync(destDir, { recursive: true });

    for (const file of fs.readdirSync(sourceRoot)) {
      const src = path.join(sourceRoot, file);
      const dst = path.join(destDir, file);
      if (fs.statSync(src).isDirectory()) copyRecursiveSync(src, dst);
      else fs.copyFileSync(src, dst);
    }

    const checkFiles = [];
    const walkCheck = (dir, prefix = '') => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const rel = prefix ? `${prefix}/${e.name}` : e.name;
        if (e.isDirectory()) walkCheck(path.join(dir, e.name), rel);
        else if (/\.(cur|ani)$/i.test(e.name)) checkFiles.push(rel);
      }
    };
    walkCheck(destDir);

    if (checkFiles.length === 0) {
      throw new Error('В архиве нет .cur/.ani файлов');
    }

    const infFile = fs.readdirSync(destDir).find(f => f.toLowerCase().endsWith('.inf'));
    if (infFile) {
      const infPath = path.join(destDir, infFile);
      await new Promise((resolve) => {
        execFile('rundll32.exe',
          ['setupapi.dll,InstallHinfSection', 'DefaultInstall', '132', infPath],
          { windowsHide: true },
          () => resolve());
      });
    }

    let activationWarning = null;
    try {
      await activateCursor(cursorName);
    } catch (e) {
      activationWarning = e.message;
    }

    try { fs.rmSync(tempExtract, { recursive: true, force: true }); } catch {}

    return { ok: true, filesCount: checkFiles.length, activationWarning };
  } catch (e) {
    try { if (fs.existsSync(tempExtract)) fs.rmSync(tempExtract, { recursive: true, force: true }); } catch {}
    return { ok: false, error: `установка не удалась: ${e.message}` };
  }
}

async function activateCursor(cursorName) {
  const cursorDir = path.join(CURSORS_DIR, cursorName);
  if (!fs.existsSync(cursorDir)) throw new Error(`Папка не найдена: ${cursorDir}`);

  const cursorFiles = [];
  const walk = (dir, prefix = '') => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) walk(path.join(dir, e.name), rel);
      else if (/\.(cur|ani)$/i.test(e.name)) cursorFiles.push(rel);
    }
  };
  walk(cursorDir);
  if (!cursorFiles.length) throw new Error('В папке нет .cur/.ani файлов');

  const ROLE_HINTS = {
    Arrow:       ['normal', 'default', 'arrow', 'pointer', 'select'],
    Help:        ['help', 'helpsel'],
    AppStarting: ['work', 'loading', 'appstarting', 'background', 'busy'],
    Wait:        ['busy', 'wait', 'load'],
    Crosshair:   ['precision', 'cross', 'crosshair', 'precise'],
    IBeam:       ['text', 'ibeam', 'beam'],
    NWPen:       ['hand', 'pen', 'handwriting', 'nwpen'],
    No:          ['unavailable', 'no', 'unavail'],
    SizeNS:      ['vert', 'ns', 'sizens', 'vertical'],
    SizeWE:      ['horz', 'we', 'sizewe', 'horizontal'],
    SizeNWSE:    ['dgn1', 'diag1', 'nwse', 'diagonal1'],
    SizeNESW:    ['dgn2', 'diag2', 'nesw', 'diagonal2'],
    SizeAll:     ['move', 'sizeall', 'all'],
    UpArrow:     ['up', 'alt', 'alternate', 'uparrow'],
    Hand:        ['link', 'pointer', 'hand', 'location'],
    Person:      ['person', 'pin']
  };

  const commands = [];
  const used = new Set();

  for (const [role, hints] of Object.entries(ROLE_HINTS)) {
    let matched = null;

    for (const f of cursorFiles) {
      if (used.has(f)) continue;
      const base = f.toLowerCase().replace(/\.(cur|ani)$/i, '').replace(/[_\-\s]+/g, ' ').trim();
      for (const h of hints) {
        if (base === h || base.startsWith(h + ' ')) { matched = f; break; }
      }
      if (matched) break;
    }

    if (!matched) {
      for (const h of hints) {
        matched = cursorFiles.find(f => !used.has(f) && f.toLowerCase().includes(h));
        if (matched) break;
      }
    }

    if (matched) {
      used.add(matched);
      const fullPath = path.join(cursorDir, matched).replace(/\//g, '\\');
      commands.push(`reg add "HKCU\\Control Panel\\Cursors" /v "${role}" /t REG_EXPAND_SZ /d "${fullPath}" /f`);
    }
  }

  if (!commands.length) {
    const roles = Object.keys(ROLE_HINTS);
    for (let i = 0; i < Math.min(cursorFiles.length, roles.length); i++) {
      const fullPath = path.join(cursorDir, cursorFiles[i]).replace(/\//g, '\\');
      commands.push(`reg add "HKCU\\Control Panel\\Cursors" /v "${roles[i]}" /t REG_EXPAND_SZ /d "${fullPath}" /f`);
    }
  }

  if (!commands.length) throw new Error('Не удалось сопоставить файлы с ролями');

  commands.push(`reg add "HKCU\\Control Panel\\Cursors" /ve /t REG_SZ /d "${cursorName}" /f`);

  const bat = path.join(tempDir, `activate_${Date.now()}.bat`);
  fs.writeFileSync(bat,
    ['@echo off', 'chcp 65001 >nul', ...commands, 'exit /b 0'].join('\r\n'),
    'utf8'
  );

  await new Promise((resolve, reject) => {
    execFile('cmd.exe', ['/c', bat], { windowsHide: true }, (err) => {
      try { fs.unlinkSync(bat); } catch {}
      if (err) reject(err); else resolve();
    });
  });

  const ps = `
    Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern bool SystemParametersInfo(uint uiAction, uint uiParam, IntPtr pvParam, uint fWinIni);' -Name N -Namespace W -ErrorAction SilentlyContinue;
    [W.N]::SystemParametersInfo(0x0057, 0, [IntPtr]::Zero, 0x03) | Out-Null
  `;
  await new Promise((resolve) => {
    execFile('powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps],
      { windowsHide: true },
      () => resolve()
    );
  });

  return { ok: true, roles: commands.length - 1 };
}

async function uninstallCursor(cursorName) {
  const destDir = path.join(CURSORS_DIR, cursorName);
  const archivePath = path.join(cacheDir, `${cursorName}.7z`);
  try {
    if (fs.existsSync(destDir)) {
      await new Promise((resolve) => {
        const ps = `Remove-Item -LiteralPath '${destDir.replace(/'/g, "''")}' -Recurse -Force -ErrorAction SilentlyContinue`;
        execFile('powershell.exe',
          ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps],
          { windowsHide: true },
          () => resolve());
      });
    }
    if (fs.existsSync(archivePath)) {
      try { fs.unlinkSync(archivePath); } catch {}
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ============================================================
//  Сброс реестра на стандартные курсоры Windows
// ============================================================
async function resetToDefaultCursors() {
  const defaultCursors = {
    Arrow:       '%SystemRoot%\\cursors\\aero_arrow.cur',
    Help:        '%SystemRoot%\\cursors\\aero_helpsel.cur',
    AppStarting: '%SystemRoot%\\cursors\\aero_working.ani',
    Wait:        '%SystemRoot%\\cursors\\aero_busy.ani',
    Crosshair:   '%SystemRoot%\\cursors\\aero_cross.cur',
    IBeam:       '%SystemRoot%\\cursors\\aero_beam.cur',
    NWPen:       '%SystemRoot%\\cursors\\aero_pen.cur',
    No:          '%SystemRoot%\\cursors\\aero_unavail.cur',
    SizeNS:      '%SystemRoot%\\cursors\\aero_ns.cur',
    SizeWE:      '%SystemRoot%\\cursors\\aero_ew.cur',
    SizeNWSE:    '%SystemRoot%\\cursors\\aero_nwse.cur',
    SizeNESW:    '%SystemRoot%\\cursors\\aero_nesw.cur',
    SizeAll:     '%SystemRoot%\\cursors\\aero_move.cur',
    UpArrow:     '%SystemRoot%\\cursors\\aero_up.cur',
    Hand:        '%SystemRoot%\\cursors\\aero_link.cur',
    Person:      '%SystemRoot%\\cursors\\aero_person.cur'
  };

  const resetCommands = Object.entries(defaultCursors).map(
    ([role, p]) => `reg add "HKCU\\Control Panel\\Cursors" /v "${role}" /t REG_EXPAND_SZ /d "${p}" /f`
  );
  resetCommands.push(`reg add "HKCU\\Control Panel\\Cursors" /ve /t REG_SZ /d "" /f`);

  const resetBat = path.join(tempDir, `reset_default_${Date.now()}.bat`);
  fs.writeFileSync(resetBat,
    ['@echo off', 'chcp 65001 >nul', ...resetCommands, 'exit /b 0'].join('\r\n'),
    'utf8'
  );

  await new Promise((resolve, reject) => {
    execFile('cmd.exe', ['/c', resetBat], { windowsHide: true }, (err) => {
      try { fs.unlinkSync(resetBat); } catch {}
      if (err) reject(err); else resolve();
    });
  });

  const ps = `
    Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern bool SystemParametersInfo(uint uiAction, uint uiParam, IntPtr pvParam, uint fWinIni);' -Name N -Namespace W -ErrorAction SilentlyContinue;
    [W.N]::SystemParametersInfo(0x0057, 0, [IntPtr]::Zero, 0x03) | Out-Null
  `;
  await new Promise((resolve) => {
    execFile('powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps],
      { windowsHide: true },
      () => resolve()
    );
  });
}

// ============================================================
//  Удаление ТОЛЬКО известных курсоров
// ============================================================
async function uninstallAllCursors() {
  try {
    const removed = [];
    const failed = [];
    const skipped = [];

    await resetToDefaultCursors();

    for (const name of KNOWN_CURSORS) {
      const dirPath = path.join(CURSORS_DIR, name);

      if (!fs.existsSync(dirPath)) {
        skipped.push(name);
        const archivePath = path.join(cacheDir, `${name}.7z`);
        if (fs.existsSync(archivePath)) {
          try { fs.unlinkSync(archivePath); } catch {}
        }
        continue;
      }

      await new Promise((resolve) => {
        const ps = `Remove-Item -LiteralPath '${dirPath.replace(/'/g, "''")}' -Recurse -Force -ErrorAction SilentlyContinue`;
        execFile('powershell.exe',
          ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps],
          { windowsHide: true },
          () => resolve());
      });

      if (fs.existsSync(dirPath)) failed.push(name);
      else removed.push(name);

      const archivePath = path.join(cacheDir, `${name}.7z`);
      if (fs.existsSync(archivePath)) {
        try { fs.unlinkSync(archivePath); } catch {}
      }
    }

    return { ok: true, removed, failed, skipped };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ============================================================
//  Window
// ============================================================
function createWindow() {
  const iconPath = getAppIconPath();

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#1e1e2e',
    title: 'Pretty Cursors',
    autoHideMenuBar: true,
    show: false,
    icon: iconPath || undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (iconPath) {
    try { mainWindow.setIcon(iconPath); } catch {}
  }

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.on('closed', () => { mainWindow = null; });
}

async function showMainPage() {
  isErrorPage = false;
  if (!mainWindow) return;
  await mainWindow.loadFile('index.html');
}

async function showErrorPage() {
  isErrorPage = true;
  if (!mainWindow) return;
  await mainWindow.loadFile('error.html');
}

// ============================================================
//  IPC
// ============================================================
function registerIpc() {
  ipcMain.handle('cursors:list', async () => {
    try { return await fetchCursorList(); }
    catch (e) { console.error(e); return []; }
  });

  ipcMain.handle('cursors:download', async (_e, name) => downloadCursor(name));
  ipcMain.handle('cursors:install',  async (_e, name) => installCursor(name));
  ipcMain.handle('cursors:activate', async (_e, name) => {
    try { return await activateCursor(name); }
    catch (e) { return { ok: false, error: e.message }; }
  });
  ipcMain.handle('cursors:uninstall',    async (_e, name) => uninstallCursor(name));
  ipcMain.handle('cursors:uninstallAll', async () => uninstallAllCursors());
  ipcMain.handle('cursors:openFolder',   () => shell.openPath(CURSORS_DIR));

  ipcMain.handle('net:check', async () => {
    const ok = await pingInternet();
    return { ok };
  });

  ipcMain.handle('net:retry', async () => {
    const ok = await pingInternet();
    if (ok) {
      await showMainPage();
      return { ok: true };
    }
    return { ok: false };
  });
}

// ============================================================
//  Lifecycle
// ============================================================
app.whenReady().then(async () => {
  const ok = await bootstrap();
  if (!ok) return;

  resolvePaths();
  tempDir = path.join(PORTABLE_DATA_DIR, 'temp');
  cacheDir = path.join(PORTABLE_DATA_DIR, 'cursors_cache');
  fs.mkdirSync(tempDir, { recursive: true });
  fs.mkdirSync(cacheDir, { recursive: true });

  registerIpc();
  createWindow();

  const hasInternet = await pingInternet();
  if (hasInternet) {
    await showMainPage();
  } else {
    await showErrorPage();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});