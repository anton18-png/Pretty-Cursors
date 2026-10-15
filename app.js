const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const state = {
  cursors: [],
  loading: false,
  busy: new Set()
};

const els = {
  grid: $('#cursor-grid'),
  statusText: $('.status-text'),
  btnRefresh: $('#btn-refresh'),
  btnOpenFolder: $('#btn-open-folder'),
  btnDeleteAll: $('#btn-delete-all'),
  toastContainer: $('#toast-container'),
  btnSettings: $('#btn-settings'),
  settingsMenu: $('#settings-menu'),
  settingsTabs: $$('.settings-tab'),
  settingsPanels: $$('.settings-panel'),
  wallpaperInputs: $$('input[name="wallpaper"]')
};

// ============================================================
//  Хелперы
// ============================================================
function pathToFileUrl(p) {
  if (!p) return '';
  const norm = String(p).replace(/\\/g, '/');
  const parts = norm.split('/');
  const encoded = parts.map((seg, i) => {
    if (i === 0 && /^[a-zA-Z]:$/.test(seg)) return seg;
    return encodeURIComponent(seg);
  }).join('/');
  return `file:///${encoded}?t=${Date.now()}`;
}

function showToast(message, type = 'info', duration = 3000) {
  if (!els.toastContainer) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  els.toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

function setStatus(text) {
  if (els.statusText) els.statusText.textContent = text;
}

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

// ============================================================
//  Настройки: шестерёнка + меню
// ============================================================
const DEFAULT_WALLPAPER = 'night_xp';
const VALID_WALLPAPERS = ['night_xp', 'magical_sky'];

function closeSettings() {
  if (!els.settingsMenu) return;
  els.settingsMenu.hidden = true;
}

function toggleSettings() {
  if (!els.settingsMenu) return;
  els.settingsMenu.hidden = !els.settingsMenu.hidden;
}

function initSettings() {
  if (els.btnSettings) {
    els.btnSettings.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSettings();
    });
  }

  // Клик вне меню — закрыть
  document.addEventListener('click', (e) => {
    if (!els.settingsMenu || els.settingsMenu.hidden) return;
    if (els.settingsMenu.contains(e.target)) return;
    if (els.btnSettings && els.btnSettings.contains(e.target)) return;
    closeSettings();
  });

  // Esc — закрыть
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSettings();
  });

  // Табы
  els.settingsTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      els.settingsTabs.forEach((t) => t.classList.toggle('active', t === tab));
      els.settingsPanels.forEach((p) => {
        p.hidden = p.dataset.panel !== target;
      });
    });
  });

  // Обои
  els.wallpaperInputs.forEach((input) => {
    input.addEventListener('change', () => {
      if (input.checked) applyWallpaper(input.value);
    });
  });

  // Применяем сохранённые обои (по умолчанию — night_xp)
  let saved = DEFAULT_WALLPAPER;
  try {
    const stored = localStorage.getItem('wallpaper');
    if (stored && VALID_WALLPAPERS.includes(stored)) saved = stored;
  } catch {}
  applyWallpaper(saved, false);
  const savedInput = document.querySelector(`input[name="wallpaper"][value="${saved}"]`);
  if (savedInput) savedInput.checked = true;
}

function applyWallpaper(name, notify = true) {
  if (!VALID_WALLPAPERS.includes(name)) name = DEFAULT_WALLPAPER;

  document.body.classList.remove(
    'wallpaper-night_xp',
    'wallpaper-magical_sky'
  );
  document.body.classList.add(`wallpaper-${name}`);

  try { localStorage.setItem('wallpaper', name); } catch {}

  if (notify) {
    const titles = {
      night_xp: 'Night XP',
      magical_sky: 'Magical Sky'
    };
    showToast(`🖼️ Обои: ${titles[name] || name}`, 'success', 2000);
  }
}

// ============================================================
//  Список курсоров
// ============================================================
async function loadCursors() {
  if (state.loading) return;
  state.loading = true;
  setStatus('Загрузка списка…');
  if (els.grid) els.grid.innerHTML = '<div class="loader"></div>';

  try {
    const cursors = await window.api.cursors.list();
    state.cursors = cursors;
    renderCursors();

    if (!cursors.length) {
      setStatus('Список пуст');
      if (els.grid) els.grid.innerHTML = `
        <div class="empty">
          <b>Курсоры не найдены.</b><br>
          <span class="muted">Проверьте assets/cursors.json</span>
        </div>`;
    } else {
      setStatus(`Загружено ${cursors.length} курсоров`);
    }
  } catch (e) {
    console.error(e);
    setStatus('Ошибка загрузки');
    showToast('Не удалось загрузить список: ' + e.message, 'error', 5000);
    if (els.grid) els.grid.innerHTML = `<div class="empty">Ошибка: ${e.message}</div>`;
  } finally {
    state.loading = false;
  }
}

function renderCursors() {
  if (!els.grid) return;
  els.grid.innerHTML = '';
  for (const cursor of state.cursors) els.grid.appendChild(makeCard(cursor));
}

function makeCard(cursor) {
  const card = document.createElement('div');
  card.className = 'cursor-card';
  card.dataset.name = cursor.name;
  if (cursor.installed) card.classList.add('installed');
  if (cursor.downloaded) card.classList.add('downloaded');

  // Превью
  const preview = document.createElement('div');
  preview.className = 'cursor-preview';

  if (cursor.icon) {
    const img = document.createElement('img');
    img.className = 'cursor-icon';
    img.src = pathToFileUrl(cursor.icon);
    img.alt = cursor.name;
    img.draggable = false;
    img.onerror = () => {
      img.remove();
      preview.innerHTML = '<div class="cursor-icon-fallback">🖱️</div>';
    };
    preview.appendChild(img);
  } else {
    preview.innerHTML = '<div class="cursor-icon-fallback">🖱️</div>';
  }
  card.appendChild(preview);

  // Инфо
  const info = document.createElement('div');
  info.className = 'cursor-info';
  info.innerHTML = `
    <span class="cursor-name" title="${cursor.name}">${cursor.name}</span>
    <span class="cursor-size">${formatSize(cursor.size)}</span>
  `;
  card.appendChild(info);

  // Бейджи
  const badges = document.createElement('div');
  badges.className = 'cursor-badges';
  if (cursor.installed) badges.innerHTML += '<span class="badge installed">✓ Установлен</span>';
  else if (cursor.downloaded) badges.innerHTML += '<span class="badge downloaded">📦 Скачан</span>';
  card.appendChild(badges);

  // Кнопки
  const actions = document.createElement('div');
  actions.className = 'cursor-actions';

  const btnDownload = makeBtn('📥', 'Скачать', 'btn-download', async () => {
    if (state.busy.has(cursor.name)) return;
    await runAction(cursor, btnDownload, 'Скачивание…', async () => {
      const r = await window.api.cursors.download(cursor.name);
      if (!r.ok) throw new Error(r.error || 'Ошибка скачивания');
      cursor.downloaded = true;
      showToast(`📥 Скачано: ${cursor.name}`, 'success');
    });
  });
  if (cursor.downloaded) btnDownload.classList.add('done');

  const btnInstall = makeBtn('✅', 'Установить', 'btn-install', async () => {
    if (state.busy.has(cursor.name)) return;
    await runAction(cursor, btnInstall, 'Установка…', async () => {
      const r = await window.api.cursors.install(cursor.name);
      if (!r.ok) {
        console.error('Детали ошибки установки:', r.error);
        throw new Error('установка не удалась');
      }
      cursor.installed = true;
      cursor.downloaded = true;
      if (r.activationWarning) {
        showToast(`✅ Установлено: ${cursor.name} (файлов: ${r.filesCount})`, 'warning', 5000);
      } else {
        showToast(`✅ Установлено: ${cursor.name}`, 'success');
      }
    });
  });
  if (cursor.installed) btnInstall.classList.add('done');

  const btnApply = makeBtn('▶️', 'Применить', 'btn-apply', async () => {
    if (state.busy.has(cursor.name)) return;
    if (!cursor.installed) {
      showToast('Сначала установите курсор', 'warning', 2500);
      return;
    }
    await runAction(cursor, btnApply, 'Применение…', async () => {
      const r = await window.api.cursors.activate(cursor.name);
      if (!r.ok) throw new Error(r.error || 'Ошибка применения');
      showToast(`▶️ Применён: ${cursor.name}`, 'success');
    });
  });

  const btnDelete = makeBtn('🗑️', 'Удалить', 'btn-delete', async () => {
    if (state.busy.has(cursor.name)) return;
    if (!confirm(`Удалить курсор «${cursor.name}» из системы?`)) return;
    await runAction(cursor, btnDelete, 'Удаление…', async () => {
      const r = await window.api.cursors.uninstall(cursor.name);
      if (!r.ok) throw new Error(r.error || 'Ошибка удаления');
      cursor.installed = false;
      cursor.downloaded = false;
      showToast(`🗑️ Удалено: ${cursor.name}`, 'success');
    });
  });
  if (!cursor.installed && !cursor.downloaded) {
    btnDelete.disabled = true;
    btnDelete.classList.add('disabled');
  }

  actions.append(btnDownload, btnInstall, btnApply, btnDelete);
  card.appendChild(actions);

  return card;
}

function makeBtn(emoji, text, className, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `action-btn ${className}`;
  btn.innerHTML = `<span class="action-emoji">${emoji}</span><span class="action-text">${text}</span>`;
  btn.addEventListener('click', onClick);
  return btn;
}

async function runAction(cursor, btn, busyText, fn) {
  if (state.busy.has(cursor.name)) return;
  state.busy.add(cursor.name);

  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.classList.add('busy');
  btn.innerHTML = `<span class="spinner"></span><span class="action-text">${busyText}</span>`;

  try {
    await fn();
  } catch (e) {
    console.error(e);
    showToast(`Ошибка: ${e.message}`, 'error', 5000);
  } finally {
    state.busy.delete(cursor.name);
    btn.disabled = false;
    btn.classList.remove('busy');
    btn.innerHTML = originalHtml;
    const card = document.querySelector(`.cursor-card[data-name="${CSS.escape(cursor.name)}"]`);
    if (card) card.replaceWith(makeCard(cursor));
  }
}

// ============================================================
//  Тулбар
// ============================================================
if (els.btnRefresh) els.btnRefresh.addEventListener('click', loadCursors);
if (els.btnOpenFolder) els.btnOpenFolder.addEventListener('click', () => {
  window.api.cursors.openFolder();
});

if (els.btnDeleteAll) els.btnDeleteAll.addEventListener('click', async () => {
  if (!confirm('Удалить все установленные курсоры из списка?\n\nСначала будет возвращён стандартный курсор Windows, затем удалены папки только известных курсоров.')) return;

  els.btnDeleteAll.disabled = true;
  const originalHtml = els.btnDeleteAll.innerHTML;
  els.btnDeleteAll.innerHTML = '<span class="spinner"></span> Удаление…';

  try {
    const r = await window.api.cursors.uninstallAll();
    if (!r.ok) throw new Error(r.error || 'Не удалось удалить курсоры');

    const removedCount = r.removed ? r.removed.length : 0;
    const failedCount = r.failed ? r.failed.length : 0;

    if (failedCount > 0) {
      showToast(`🧹 Удалено: ${removedCount}, не удалось удалить: ${failedCount}`, 'warning', 5000);
    } else {
      showToast(`🧹 Удалено курсоров: ${removedCount}`, 'success');
    }

    await loadCursors();
  } catch (e) {
    console.error(e);
    showToast(`Ошибка: ${e.message}`, 'error', 5000);
  } finally {
    els.btnDeleteAll.disabled = false;
    els.btnDeleteAll.innerHTML = originalHtml;
  }
});

// ============================================================
//  Старт
// ============================================================
initSettings();
loadCursors();