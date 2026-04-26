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
app.use('/uploads', express.static('uploads'));

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

// QR-шлюз: обрабатывает ссылки вида /m/17
app.get('/m/:maskId', (req, res) => {
    const maskId = req.params.maskId;
    const userAgent = req.headers['user-agent'] || '';
    
    const isTelegram = userAgent.includes('Telegram') || userAgent.includes('TelegramBot');
    const isVK = userAgent.includes('VK') || userAgent.includes('VKAndroidApp');
    
    if (isTelegram) {
        // Перенаправляем в мини-приложение с параметром маски
        const botUsername = 'negodiai_quest_bot';
        return res.redirect(`https://t.me/${botUsername}/app?startapp=mask_${maskId}`);
    }
    
    if (isVK) {
        return res.redirect(`https://vk.com/negodiai?w=appXXXX#mask_${maskId}`);
    }
    
    // Показываем страницу выбора платформы
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Выберите платформу | НЕГОДЯЙ</title>
            <style>
                body {
                    font-family: system-ui, -apple-system, sans-serif;
                    background: linear-gradient(180deg, #0f0f1e 0%, #1a1a2e 100%);
                    color: #fff;
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0;
                    padding: 20px;
                }
                .container {
                    max-width: 400px;
                    width: 100%;
                    text-align: center;
                }
                .logo {
                    width: 100px;
                    height: 100px;
                    background: linear-gradient(135deg, #3B82F6, #2563EB);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 24px;
                }
                .logo i {
                    font-size: 48px;
                    color: white;
                }
                h1 {
                    margin-bottom: 8px;
                }
                .subtitle {
                    color: #64748b;
                    margin-bottom: 32px;
                }
                .buttons {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    padding: 14px 20px;
                    border-radius: 16px;
                    text-decoration: none;
                    font-weight: 600;
                    transition: all 0.2s ease;
                    background: #252542;
                    color: white;
                }
                .btn-telegram {
                    background: #26A5E4;
                }
                .btn-vk {
                    background: #0077FF;
                }
                .btn-telegram:hover, .btn-vk:hover {
                    transform: translateY(-2px);
                    opacity: 0.9;
                }
                .fa-telegram, .fa-vk {
                    font-size: 20px;
                }
            </style>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css">
        </head>
        <body>
            <div class="container">
                <div class="logo">
                    <i class="fas fa-mask"></i>
                </div>
                <h1>НЕГОДЯЙ</h1>
                <p class="subtitle">Туристический квест по Калининграду</p>
                <div class="buttons">
                    <a href="https://t.me/negodiai_quest_bot/app?startapp=mask_${maskId}" class="btn btn-telegram">
    <i class="fab fa-telegram"></i> Открыть в Telegram
</a>
                    <a href="https://vk.com/negodiai?w=appXXXX#mask_${maskId}" class="btn btn-vk">
                        <i class="fab fa-vk"></i> Открыть в VK
                    </a>
                </div>
            </div>
        </body>
        </html>
    `);
});

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