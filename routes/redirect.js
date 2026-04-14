const express = require('express');
const router = express.Router();

// Страница выбора платформы (для обычного сканирования камерой)
function getPlatformPage(maskId, maskName) {
    return `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <title>НЕГОДЯЙ | Выберите платформу</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
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
        
        .container {
            max-width: 400px;
            width: 100%;
            text-align: center;
        }
        
        .logo {
            width: 120px;
            height: 120px;
            background: linear-gradient(135deg, #3B82F6, #2563EB);
            border-radius: 60px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 24px;
        }
        
        .logo i {
            font-size: 60px;
            color: white;
        }
        
        h1 {
            font-size: 28px;
            margin-bottom: 8px;
        }
        
        .subtitle {
            color: #64748b;
            margin-bottom: 32px;
        }
        
        .mask-name {
            background: #252542;
            border-radius: 20px;
            padding: 8px 16px;
            display: inline-block;
            margin-bottom: 24px;
            font-size: 14px;
            color: #94a3b8;
        }
        
        .platform-buttons {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        
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
        
        .platform-btn:hover {
            background: #2d2d54;
            transform: translateY(-2px);
        }
        
        .platform-icon {
            width: 48px;
            height: 48px;
            background: #1a1a2e;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .platform-icon i {
            font-size: 24px;
        }
        
        .telegram-icon { color: #26A5E4; }
        .vk-icon { color: #0077FF; }
        .max-icon { color: #FF5A5F; }
        
        .platform-info {
            flex: 1;
            text-align: left;
        }
        
        .platform-name {
            font-size: 16px;
            font-weight: 600;
        }
        
        .platform-desc {
            font-size: 12px;
            color: #64748b;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">
            <i class="fas fa-mask"></i>
        </div>
        <h1>НЕГОДЯЙ</h1>
        <p class="subtitle">Туристический квест по Калининграду</p>
        
        <div class="mask-name">
            <i class="fas fa-map-marker-alt"></i> ${escapeHtml(maskName || 'Маска')}
        </div>
        
        <div class="platform-buttons">
            <a href="https://t.me/negodiai_quest_bot?start=${maskId}" class="platform-btn" id="telegram-btn">
                <div class="platform-icon">
                    <i class="fab fa-telegram telegram-icon"></i>
                </div>
                <div class="platform-info">
                    <div class="platform-name">Telegram</div>
                    <div class="platform-desc">Открыть в Telegram Mini App</div>
                </div>
                <i class="fas fa-chevron-right" style="color: #64748b;"></i>
            </a>
            
            <a href="https://vk.com/negodiai" class="platform-btn" id="vk-btn">
                <div class="platform-icon">
                    <i class="fab fa-vk vk-icon"></i>
                </div>
                <div class="platform-info">
                    <div class="platform-name">ВКонтакте</div>
                    <div class="platform-desc">Открыть в VK Mini App</div>
                </div>
                <i class="fas fa-chevron-right" style="color: #64748b;"></i>
            </a>
            
            <a href="https://max.ru" class="platform-btn" id="max-btn">
                <div class="platform-icon">
                    <i class="fas fa-star max-icon"></i>
                </div>
                <div class="platform-info">
                    <div class="platform-name">MAX</div>
                    <div class="platform-desc">Открыть в MAX</div>
                </div>
                <i class="fas fa-chevron-right" style="color: #64748b;"></i>
            </a>
        </div>
        
        <p style="font-size: 12px; color: #3d3d5c; margin-top: 32px;">
            ID маски: ${maskId}
        </p>
    </div>
    
    <script>
        function escapeHtml(str) {
            if (!str) return '';
            return str.replace(/[&<>]/g, function(m) {
                if (m === '&') return '&amp;';
                if (m === '<') return '&lt;';
                if (m === '>') return '&gt;';
                return m;
            });
        }
        
        // Автоматическое перенаправление для Telegram
        (function() {
            const userAgent = navigator.userAgent || '';
            
            if (userAgent.includes('Telegram') && window.TelegramWebApp) {
                window.location.href = 'https://t.me/negodiai_quest_bot?start=${maskId}';
            }
            else if (userAgent.includes('VK')) {
                window.location.href = 'https://vk.com/negodiai';
            }
            else if (userAgent.includes('MAX')) {
                window.location.href = 'https://max.ru';
            }
        })();
    </script>
</body>
</html>
    `;
}

// Функция для получения названия маски из базы данных
async function getMaskName(maskId, db) {
    try {
        const result = await db.query('SELECT name FROM masks WHERE id = $1', [maskId]);
        if (result.rows.length > 0) {
            return result.rows[0].name;
        }
        return null;
    } catch (err) {
        console.error('Error getting mask name:', err);
        return null;
    }
}

// Маршрут для умного редиректа
router.get('/:maskId', async (req, res) => {
    const maskId = req.params.maskId;
    const userAgent = req.headers['user-agent'] || '';
    const db = require('../database');
    
    console.log(`=== УМНЫЙ QR ===`);
    console.log(`Маска: ${maskId}`);
    console.log(`User-Agent: ${userAgent}`);
    
    // Получаем название маски для отображения
    const maskName = await getMaskName(maskId, db);
    
    // Проверяем, идёт ли запрос из Telegram
    const isTelegram = userAgent.includes('Telegram') || 
                       userAgent.includes('TelegramBot') ||
                       userAgent.includes('Telegram-Web');
    
    // Проверяем, идёт ли запрос из VK
    const isVK = userAgent.includes('VK') || 
                 userAgent.includes('VKAndroidApp') ||
                 userAgent.includes('VKWebApp');
    
    // Проверяем, идёт ли запрос из MAX
    const isMAX = userAgent.includes('MAX') || 
                  userAgent.includes('MaxApp');
    
    if (isTelegram) {
        // Перенаправляем в Telegram бота с параметром маски
        const botUsername = 'negodiai_quest_bot';
        const redirectUrl = `https://t.me/${botUsername}?start=${maskId}`;
        console.log(`→ Перенаправление в Telegram: ${redirectUrl}`);
        res.redirect(redirectUrl);
    } 
    else if (isVK) {
        console.log(`→ Перенаправление в VK`);
        res.redirect('https://vk.com/negodiai');
    }
    else if (isMAX) {
        console.log(`→ Перенаправление в MAX`);
        res.redirect('https://max.ru');
    }
    else {
        // Показываем страницу выбора платформы
        console.log(`→ Показываем страницу выбора платформы`);
        res.send(getPlatformPage(maskId, maskName));
    }
});

module.exports = router;