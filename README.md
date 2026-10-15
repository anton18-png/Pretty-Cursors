<div align="center">

<img src="assets/logo.png" alt="Pretty Cursors" width="160" />

**Красивые курсоры для Windows в один клик.**

[![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-0078D4?logo=windows)](https://www.microsoft.com/windows)
[![Electron](https://img.shields.io/badge/Electron-44-47848F?logo=electron)](https://www.electronjs.org/)
[![License](https://img.shields.io/badge/license-CC%20BY--NC%204.0-lightgrey)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-cba6f7)]()

</div>

---

## ✨ Что это

**Pretty Cursors** — менеджер курсоров для Windows. Позволяет устанавливать,
применять и удалять кастомные курсоры (например, из аниме, игр и т.д.) без ручного
копания в реестре и папке `C:\Windows\Cursors`.

Всё, что нужно — нажать одну кнопку.

---

## 🚀 Возможности

- 📥 **Скачивание** — курсоры качаются с GitHub-репозитория, кэшируются локально.
- ✅ **Установка** — распаковка `.7z` и копирование `.cur/.ani` в `C:\Windows\Cursors`.
- ▶️ **Применение** — мгновенная смена курсора без перезагрузки.
- 🗑️ **Удаление** — по одному или все сразу, с возвратом стандартного курсора Windows.
- 🖼️ **Смена обоев** интерфейса — `Night XP` и `Magical Sky`.
- ℹ️ **Встроенная справка** — как работает приложение, прямо в меню.
- 🌐 **Проверка интернета** — если сети нет, показывается отдельный экран с подсказкой.


<img width="1186" height="793" alt="изображение" src="https://github.com/user-attachments/assets/b107daa6-f58f-482e-8ae7-cd0568295084" />

---

## ⚙️ Как это работает

Кратко — под капотом:

| Действие | Что происходит |
|---|---|
| **Скачать** | `.7z`-архив качается с `raw.githubusercontent.com/...` в `extreme_data/cursors_cache/` |
| **Установить** | Архив распаковывается через `Utils/7z.exe` во временную папку, файлы `.cur/.ani` копируются в `C:\Windows\Cursors\<имя>\` |
| **Применить** | Пути прописываются в `HKCU\Control Panel\Cursors`, изменения применяются через `SystemParametersInfo(SPI_SETCURSORS)` — без перезагрузки |
| **Удалить** | Папка курсора удаляется, кэш-архив стирается |
| **Удалить все** | Сначала возвращается стандартный курсор Windows, затем удаляются только папки известных курсоров (белый список) |
| **Обновить** | Перечитывается `assets/cursors.json` |

> ⚠️ Приложение требует **прав администратора**, потому что пишет в `C:\Windows\Cursors`.
> При запуске без прав будет предложен перезапуск с UAC.

---

## 📦 Установка

1. Скачайте `Pretty-Cursors-Setup-1.0.0.exe` из раздела [Releases](../../releases).
2. Запустите — установщик попросит права администратора.
3. Установите в любую папку (по умолчанию — `%LocalAppData%\Programs\Pretty Cursors`).
4. Запустите **Pretty Cursors** из меню «Пуск» или с рабочего стола.

---

## 🛠️ Сборка из исходников

### Требования

- **Windows 10/11**
- **Node.js** ≥ 22.12
- **npm** ≥ 10

### Шаги

```bash
# 1. Клонировать репозиторий
git clone https://github.com/anton18-png/Pretty-Cursors.git
cd Pretty-Cursors

# 2. Установить зависимости
npm install

# 3. Запустить в режиме разработки
npm start

# 4. Собрать установщик
npm run build
```

## 📄 Лицензия

Проект распространяется под лицензией
**[Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)](LICENSE)**.

Вы **можете**:

- ✅ Свободно использовать, форкать, изменять и распространять.
- ✅ Использовать в личных и образовательных целях.
- ✅ Указывать авторство (ссылку на этот репозиторий).

Вы **не можете**:

- ❌ Продавать приложение или его модификации.
- ❌ Использовать в коммерческих продуктах и сервисах.
- ❌ Убирать уведомление об авторстве.

Полный текст — в файле [LICENSE](LICENSE).

---

## 👤 Автор

**Anton18-PNG**

- GitHub: [@anton18-png](https://github.com/anton18-png)
- Репозиторий: [Pretty-Cursors](https://github.com/anton18-png/Pretty-Cursors)
