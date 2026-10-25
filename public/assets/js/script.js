// Клиентская логика генератора и регистрация Service Worker.

const passwordForm = document.getElementById('passwordForm');
const lengthInput = document.getElementById('length');
const lengthRange = document.getElementById('lengthRange');
const includeSymbolsInput = document.getElementById('includeSymbols');
const passwordOutput = document.getElementById('passwordOutput');
const copyButton = document.getElementById('copyButton');
const regenerateButton = document.getElementById('regenerateButton');
const statusMessage = document.getElementById('statusMessage');
const resultBadge = document.getElementById('resultBadge');
const themeToggle = document.getElementById('themeToggle');

let lastPassword = '';

// Синхронизирует числовое поле и ползунок длины.
if (lengthInput && lengthRange) {
    lengthInput.addEventListener('input', () => {
        const length = Number(lengthInput.value);

        if (Number.isInteger(length) && length >= 1 && length <= 64) {
            lengthRange.value = String(length);
        }
    });

    lengthRange.addEventListener('input', () => {
        lengthInput.value = lengthRange.value;
    });
}

function showMessage(message, isError = false) {
    if (!statusMessage) {
        return;
    }

    statusMessage.textContent = message;
    statusMessage.classList.toggle('error', isError);
}

function showPassword(password, length, includeSymbols, offline = false) {
    lastPassword = password;
    passwordOutput.textContent = password;
    copyButton.disabled = false;
    regenerateButton.disabled = false;

    resultBadge.textContent = offline ? 'Офлайн' : 'Готово';
    resultBadge.classList.add('ready');

    const symbolsText = includeSymbols ? 'специальные символы разрешены' : 'без специальных символов';
    const connectionText = offline ? ' Создано локально без обращения к серверу.' : '';
    showMessage(`Длина: ${length} · ${symbolsText}.${connectionText}`);
}

// Локальный генератор нужен на случай, когда сервер недоступен без интернета.
// В браузере используется Web Crypto API.
function generatePasswordOffline(length, includeSymbols) {
    const lowercaseLetters = 'abcdefghijklmnopqrstuvwxyz';
    const uppercaseLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const digits = '0123456789';
    const symbols = '!@#$%^&*()-_=+[]{};:,.?';
    let characters = lowercaseLetters + uppercaseLetters + digits;

    if (includeSymbols) {
        characters += symbols;
    }

    const randomValues = new Uint32Array(length);
    window.crypto.getRandomValues(randomValues);

    let password = '';

    for (let i = 0; i < length; i++) {
        password += characters[randomValues[i] % characters.length];
    }

    return password;
}

async function createPassword() {
    const length = Number(lengthInput.value);
    const includeSymbols = includeSymbolsInput.checked;

    if (!Number.isInteger(length) || length < 1 || length > 64) {
        showMessage('Введите целую длину от 1 до 64.', true);
        lengthInput.focus();
        return;
    }

    resultBadge.textContent = 'Создание…';
    resultBadge.classList.remove('ready');
    showMessage('Генерируем пароль…');

    const query = new URLSearchParams({
        length: String(length),
        includeSymbols: String(includeSymbols)
    });

    try {
        // При наличии соединения запрашиваем пароль у Express API.
        const response = await fetch(`/api/password?${query.toString()}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Не удалось создать пароль.');
        }

        showPassword(data.password, data.length, data.includeSymbols, false);
    } catch (error) {
        // Сетевые ошибки переключают приложение в локальный режим.
        if (error instanceof TypeError) {
            try {
                const password = generatePasswordOffline(length, includeSymbols);
                showPassword(password, length, includeSymbols, true);
            } catch (offlineError) {
                resultBadge.textContent = 'Ошибка';
                showMessage('Не удалось создать пароль в офлайн-режиме.', true);
            }
        } else {
            resultBadge.textContent = 'Ошибка';
            showMessage(error.message, true);
        }
    }
}

if (passwordForm) {
    passwordForm.addEventListener('submit', (event) => {
        event.preventDefault();
        createPassword();
    });
}

if (regenerateButton) {
    regenerateButton.addEventListener('click', createPassword);
}

if (copyButton) {
    copyButton.addEventListener('click', async () => {
        if (!lastPassword) {
            return;
        }

        try {
            await navigator.clipboard.writeText(lastPassword);
            showMessage('Пароль скопирован в буфер обмена.');
        } catch (error) {
            showMessage('Не удалось скопировать пароль. Выдели его и скопируй вручную.', true);
        }
    });
}

// Переключение цветовой темы с сохранением выбранного значения.
function setTheme(isDark) {
    document.body.classList.toggle('dark-theme', isDark);

    if (themeToggle) {
        themeToggle.textContent = isDark ? 'Светлая тема' : 'Тёмная тема';
    }
}

if (themeToggle) {
    let savedTheme = 'light';

    try {
        savedTheme = localStorage.getItem('password_generator_theme') || 'light';
    } catch (error) {
        // Продолжаем работу, даже если localStorage недоступен.
    }

    setTheme(savedTheme === 'dark');

    themeToggle.addEventListener('click', () => {
        const isDark = !document.body.classList.contains('dark-theme');
        setTheme(isDark);

        try {
            localStorage.setItem('password_generator_theme', isDark ? 'dark' : 'light');
        } catch (error) {
            // Выбранная тема останется активной до перезагрузки страницы.
        }
    });
}

// Регистрируем Service Worker. На localhost и HTTPS браузеры разрешают PWA API.
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker зарегистрирован.');
        } catch (error) {
            console.error('Не удалось зарегистрировать Service Worker:', error);
        }
    });
}
