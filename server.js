const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Подключаем базу данных PostgreSQL
const db = require('./database');

// Импортируем наши маршруты (API)
const masksRoutes = require('./routes/masks');
const activateByQrRoutes = require('./routes/activate-by-qr');
const routesRoutes = require('./routes/routes');
const userRoutes = require('./routes/user');
const seedRoutes = require('./routes/seed');
const redirectRoutes = require('./routes/redirect');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Настройки сервера
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Подключаем наши API
app.use('/api/masks', masksRoutes);
app.use('/api/masks', activateByQrRoutes);
app.use('/api/routes', routesRoutes);
app.use('/api/user', userRoutes);
app.use('/api/seed', seedRoutes);
app.use('/scan', redirectRoutes);
app.use('/api/admin', adminRoutes);

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Маршрут для QR-кодов (шлюз)
app.get('/m/:id', async (req, res) => {
    const maskId = req.params.id;
    const userAgent = req.headers['user-agent'] || '';
    
    const isTelegram = userAgent.includes('Telegram') || userAgent.includes('TelegramBot');
    const isVK = userAgent.includes('VK') || userAgent.includes('VKAndroidApp');
    const isMax = userAgent.includes('Max'); // уточни UA у MAX
    
    // Если пользователь уже внутри Telegram → редирект в мини-приложение с параметром
    if (isTelegram) {
        const botUsername = 'negodiai_bot'; // имя твоего бота
        return res.redirect(`https://t.me/${botUsername}/app?startapp=mask_${maskId}`);
    }
    
    // Если пользователь в VK
    if (isVK) {
        // Ссылка на VK Mini App (замени на реальную)
        return res.redirect(`https://vk.com/appXXXXXXXX#mask_${maskId}`);
    }
    
    // Иначе показываем страницу выбора платформы
    res.send(getPlatformPage(maskId));
});

// HTML страница выбора платформы
function getPlatformPage(maskId) {
    return `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Выберите платформу | НЕГОДЯЙ</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(180deg, #0f0f1e 0%, #1a1a2e 100%);
            color: #fff;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container { max-width: 400px; width: 100%; text-align: center; }
        .logo {
            width: 120px; height: 120px;
            background: linear-gradient(135deg, #3B82F6, #2563EB);
            border-radius: 60px;
            display: flex;
            align-items: center; justify-content: center;
            margin: 0 auto 24px;
        }
        .logo i { font-size: 60px; color: white; }
        h1 { font-size: 28px; margin-bottom: 8px; }
        .subtitle { color: #64748b; margin-bottom: 32px; }
        .platform-buttons { display: flex; flex-direction: column; gap: 16px; }
        .platform-btn {
            display: flex; align-items: center; gap: 16px;
            padding: 16px 20px; background: #252542;
            border: none; border-radius: 16px;
            color: white; font-size: 18px; font-weight: 600;
            cursor: pointer; transition: all 0.2s ease;
            width: 100%; text-decoration: none;
        }
        .platform-btn:hover { background: #2d2d54; transform: translateY(-2px); }
        .platform-icon {
            width: 48px; height: 48px;
            background: #1a1a2e; border-radius: 12px;
            display: flex; align-items: center; justify-content: center;
        }
        .platform-icon i { font-size: 24px; }
        .telegram-icon { color: #26A5E4; }
        .vk-icon { color: #0077FF; }
        .web-icon { color: #3B82F6; }
        .platform-info { flex: 1; text-align: left; }
        .platform-name { font-size: 16px; font-weight: 600; }
        .platform-desc { font-size: 12px; color: #64748b; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo"><i class="fas fa-mask"></i></div>
        <h1>НЕГОДЯЙ</h1>
        <p class="subtitle">Туристический квест по Калининграду</p>
        <div class="platform-buttons">
            <a href="https://t.me/negodiai_bot/app?startapp=mask_${maskId}" class="platform-btn">
                <div class="platform-icon"><i class="fab fa-telegram telegram-icon"></i></div>
                <div class="platform-info">
                    <div class="platform-name">Telegram</div>
                    <div class="platform-desc">Открыть в мини-приложении</div>
                </div>
                <i class="fas fa-chevron-right" style="color: #64748b;"></i>
            </a>
            <a href="https://vk.com/appXXXXXXXX#mask_${maskId}" class="platform-btn">
                <div class="platform-icon"><i class="fab fa-vk vk-icon"></i></div>
                <div class="platform-info">
                    <div class="platform-name">ВКонтакте</div>
                    <div class="platform-desc">Открыть в VK Mini App</div>
                </div>
                <i class="fas fa-chevron-right" style="color: #64748b;"></i>
            </a>
        </div>
        <p style="font-size: 12px; color: #3d3d5c; margin-top: 32px;">Маска #${maskId}</p>
    </div>
</body>
</html>
    `;
}

// Запускаем сервер
app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});

// Обработка ошибок базы данных
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
});