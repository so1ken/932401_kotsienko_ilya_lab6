// Лабораторная работа №6. Генератор паролей.
// Сервер на Node.js и Express отдаёт страницы сайта и предоставляет API.

const express = require('express');
const path = require('node:path');
const { randomInt } = require('node:crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const publicPath = path.join(__dirname, 'public');

// Наборы символов, из которых создаются пароли.
const lowercaseLetters = 'abcdefghijklmnopqrstuvwxyz';
const uppercaseLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const digits = '0123456789';
const symbols = '!@#$%^&*()-_=+[]{};:,.?';

// Создаёт пароль указанной длины.
// randomInt из node:crypto использует криптографически стойкую случайность.
function generatePassword(length, includeSymbols) {
    let characters = lowercaseLetters + uppercaseLetters + digits;

    if (includeSymbols) {
        characters += symbols;
    }

    let password = '';

    for (let i = 0; i < length; i++) {
        const randomIndex = randomInt(0, characters.length);
        password += characters[randomIndex];
    }

    return password;
}

// Общий обработчик для маршрутов с query-параметром и параметром пути.
function passwordRoute(req, res) {
    // Для /api/password/16 берём длину из req.params.
    // Для /api/password?length=16 берём длину из req.query.
    const lengthValue = req.params.length !== undefined
        ? req.params.length
        : req.query.length;

    let length = 12;

    if (lengthValue !== undefined) {
        // Длина должна быть целым числом, записанным цифрами.
        if (!/^\d+$/.test(String(lengthValue))) {
            return res.status(400).json({
                error: 'Параметр length должен быть целым числом от 1 до 64.'
            });
        }

        length = Number(lengthValue);

        if (!Number.isInteger(length) || length < 1 || length > 64) {
            return res.status(400).json({
                error: 'Длина пароля должна быть в диапазоне от 1 до 64.'
            });
        }
    }

    // По умолчанию специальные символы разрешены.
    let includeSymbols = true;

    if (req.query.includeSymbols !== undefined) {
        const symbolsValue = String(req.query.includeSymbols).toLowerCase();

        if (symbolsValue !== 'true' && symbolsValue !== 'false') {
            return res.status(400).json({
                error: 'Параметр includeSymbols должен быть true или false.'
            });
        }

        includeSymbols = symbolsValue === 'true';
    }

    const password = generatePassword(length, includeSymbols);

    // Формат ответа соответствует условию лабораторной работы.
    return res.json({
        password: password,
        length: length,
        includeSymbols: includeSymbols
    });
}

// Главная страница.
app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

// Страница «О себе».
app.get('/about', (req, res) => {
    res.sendFile(path.join(publicPath, 'about.html'));
});

// Дополнительный маршрут из общей части задания.
app.get('/api/status', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Сервер генератора паролей работает.'
    });
});

// Основной маршрут: длина передаётся через query-параметр.
// Пример: /api/password?length=16&includeSymbols=true
app.get('/api/password', passwordRoute);

// Дополнительный пример req.params — длина указана в адресе.
// Пример: /api/password/16?includeSymbols=false
app.get('/api/password/:length', passwordRoute);

// Статические файлы: CSS, клиентский JavaScript, манифест, иконки и SW.
app.use(express.static(publicPath));

// Обработка неизвестных адресов.
app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'Маршрут API не найден.' });
    }

    return res.status(404).sendFile(path.join(publicPath, '404.html'));
});

app.listen(PORT, () => {
    console.log(`Сервер запущен: http://localhost:${PORT}`);
    console.log('Для остановки сервера нажмите Ctrl+C.');
});
