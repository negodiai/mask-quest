const express = require('express');
const router = express.Router();

// Этот маршрут обрабатывает запросы от бота
router.get('/webapp/:maskId', (req, res) => {
    const maskId = req.params.maskId;
    const webappUrl = `${process.env.APP_URL || 'https://ваш-проект.up.railway.app'}?start=${maskId}`;
    
    // Отдаём HTML, который открывает WebApp
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
            <script src="https://telegram.org/js/telegram-web-app.js"></script>
        </head>
        <body>
            <script>
                const tg = window.Telegram.WebApp;
                tg.ready();
                tg.expand();
                tg.openLink('${webappUrl}');
                tg.close();
            </script>
        </body>
        </html>
    `);
});

module.exports = router;