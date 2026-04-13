const express = require('express');
const router = express.Router();

// Страница для выбора платформы (если сканируют камерой телефона)
const getPlatformPage = (maskId) => `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
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
            align-items: center;
            justify-content: center;
            margin: 0 auto 24px;
        }
        .logo i { font-size: 60px; color: white; }
        h1 { font-size: 28px; margin-bottom: 8px; }
        .subtitle { color: #64748b; margin-bottom: 32px; }
        .platform-buttons { display: flex; flex-direction: column; gap: 16px; }
        .platform-btn {
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 16px 20px;
            background: #252542;
            border: none;
            border-radius: 16px;
            color: white;
            font-size: 18px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            width: 100%;
            text-decoration: none;
        }
        .platform-btn:hover { background: #2d2d54; transform: translateY(-2px); }
        .platform-icon {
            width: 48px; height: 48px;
            background: #1a1a2e;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .platform-icon i { font-size: 24px; }
        .telegram-icon { color: #26A5E4; }
        .vk-icon { color: #0077FF; }
        .max-icon { color: #FF5E00; }
        .platform-info { flex: 1; text-align: left; }
        .platform-name { font-size: 16px; font-weight: 600; }
        .platform-desc { font-size: 12px; color: #64748b; }
        .footer { font-size: 12px; color: #3d3d5c; margin-top: 32px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo"><i class="fas fa-mask"></i></div>
        <h1>НЕГОДЯЙ</h1>
        <p class="subtitle">Туристический квест по Калининграду</p>
        
        <div class="platform-buttons">
            <a href="https://t.me/negodiai_quest_bot/${maskId}" class="platform-btn">
                <div class="platform-icon"><i class="fab fa-telegram telegram-icon"></i></div>
                <div class="platform-info">
                    <div class="platform-name">Telegram</div>
                    <div class="platform-desc">Открыть в Telegram Mini App</div>
                </div>
                <i class="fas fa-chevron-right" style="color: #64748b;"></i>
            </a>
            
            <a href="https://vk.com/negodiai" class="platform-btn">
                <div class="platform-icon"><i class="fab fa-vk vk-icon"></i></div>
                <div class="platform-info">
                    <div class="platform-name">ВКонтакте</div>
                    <div class="platform-desc">Открыть в VK Mini App</div>
                </div>
                <i class="fas fa-chevron-right" style="color: #64748b;"></i>
            </a>
            
            <a href="https://max.ru" class="platform-btn">
                <div class="platform-icon"><i class="fas fa-star max-icon"></i></div>
                <div class="platform-info">
                    <div class="platform-name">MAX</div>
                    <div class="platform-desc">Открыть в MAX</div>
                </div>
                <i class="fas fa-chevron-right" style="color: #64748b;"></i>
            </a>
        </div>
        
        <div class="footer">
            <p>Маска: ${maskId}</p>
            <p style="margin-top: 8px;">Сканируйте QR-код камерой телефона</p>
        </div>
    </div>
    
    <script>
        (function() {
            const userAgent = navigator.userAgent || '';
            // Если открыто в Telegram WebView — сразу открываем мини-приложение
            if (userAgent.includes('Telegram') && window.TelegramWebApp) {
                window.location.href = 'https://t.me/negodiai_quest_bot/${maskId}';
            }
            // Если открыто в VK
            else if (userAgent.includes('VK')) {
                window.location.href = 'https://vk.com/negodiai';
            }
        })();
    </script>
</body>
</html>
`;

// Маршрут для умного редиректа
router.get('/:maskId', (req, res) => {
    const maskId = req.params.maskId;
    const userAgent = req.headers['user-agent'] || '';
    
    console.log(`=== УМНЫЙ QR ===`);
    console.log(`Маска: ${maskId}`);
    console.log(`User-Agent: ${userAgent}`);
    
    // Проверяем, идёт ли запрос из Telegram
    const isTelegram = userAgent.includes('Telegram') || 
                       userAgent.includes('TelegramBot') ||
                       userAgent.includes('Telegram-Web');
    
    // Проверяем, идёт ли запрос из VK
    const isVK = userAgent.includes('VK') || 
                 userAgent.includes('VKAndroidApp') ||
                 userAgent.includes('VKWebApp');
    
    if (isTelegram) {
        // Открываем мини-приложение напрямую с параметром маски
        const appUrl = `https://t.me/negodiai_quest_bot/${maskId}`;
        console.log(`→ Открываем мини-приложение: ${appUrl}`);
        res.redirect(appUrl);
    } 
    else if (isVK) {
        console.log(`→ Перенаправление в VK`);
        res.redirect('https://vk.com/negodiai');
    }
    else {
        // Показываем страницу выбора платформы
        console.log(`→ Показываем страницу выбора платформы`);
        res.send(getPlatformPage(maskId));
    }
});

module.exports = router;