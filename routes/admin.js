const express = require('express');
const router = express.Router();
const db = require('../database');
const { v4: uuidv4 } = require('uuid');

// Проверка прав администратора (только ваш Telegram ID)
const ADMIN_ID = '359839365';

function isAdmin(userId) {
    return userId === ADMIN_ID;
}

// Middleware для проверки прав
function checkAdmin(req, res, next) {
    const userId = req.headers['x-user-id'] || req.query.userId;
    if (!isAdmin(userId)) {
        return res.status(403).json({ error: 'Доступ запрещён' });
    }
    next();
}

// ========== МАСКИ (CRUD) ==========

// Получить все маски
router.get('/masks', checkAdmin, (req, res) => {
    db.all('SELECT * FROM masks ORDER BY name', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Получить одну маску
router.get('/masks/:id', checkAdmin, (req, res) => {
    db.get('SELECT * FROM masks WHERE id = ?', [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Маска не найдена' });
        res.json(row);
    });
});

// Добавить маску
router.post('/masks', checkAdmin, (req, res) => {
    const { name, description, fullDescription, latitude, longitude, address, qrCode, priceAmount, isAvailable, yandexMapLink } = req.body;
    const id = uuidv4();
    
    db.run(`
        INSERT INTO masks (id, name, description, fullDescription, latitude, longitude, address, qrCode, priceAmount, isAvailable, yandexMapLink)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, name, description, fullDescription, latitude, longitude, address, qrCode, priceAmount, isAvailable ? 1 : 0, yandexMapLink], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id, message: 'Маска добавлена' });
    });
});

// Обновить маску
router.put('/masks/:id', checkAdmin, (req, res) => {
    const { name, description, fullDescription, latitude, longitude, address, qrCode, priceAmount, isAvailable, yandexMapLink } = req.body;
    
    db.run(`
        UPDATE masks SET 
            name = ?, description = ?, fullDescription = ?, latitude = ?, longitude = ?, 
            address = ?, qrCode = ?, priceAmount = ?, isAvailable = ?, yandexMapLink = ?
        WHERE id = ?
    `, [name, description, fullDescription, latitude, longitude, address, qrCode, priceAmount, isAvailable ? 1 : 0, yandexMapLink, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: 'Маска обновлена' });
    });
});

// Удалить маску
router.delete('/masks/:id', checkAdmin, (req, res) => {
    db.run('DELETE FROM masks WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: 'Маска удалена' });
    });
});

// ========== МАРШРУТЫ (CRUD) ==========

// Получить все маршруты
router.get('/routes', checkAdmin, (req, res) => {
    db.all('SELECT * FROM routes ORDER BY name', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Добавить маршрут
router.post('/routes', checkAdmin, (req, res) => {
    const { name, description, difficulty, durationMinutes, distanceKm, color, centerLat, centerLng, zoom } = req.body;
    const id = uuidv4();
    
    db.run(`
        INSERT INTO routes (id, name, description, difficulty, durationMinutes, distanceKm, color, centerLat, centerLng, zoom, isActive)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [id, name, description, difficulty, durationMinutes, distanceKm, color, centerLat, centerLng, zoom], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id, message: 'Маршрут добавлен' });
    });
});

// Обновить маршрут
router.put('/routes/:id', checkAdmin, (req, res) => {
    const { name, description, difficulty, durationMinutes, distanceKm, color, centerLat, centerLng, zoom, isActive } = req.body;
    
    db.run(`
        UPDATE routes SET 
            name = ?, description = ?, difficulty = ?, durationMinutes = ?, distanceKm = ?, 
            color = ?, centerLat = ?, centerLng = ?, zoom = ?, isActive = ?
        WHERE id = ?
    `, [name, description, difficulty, durationMinutes, distanceKm, color, centerLat, centerLng, zoom, isActive ? 1 : 0, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: 'Маршрут обновлён' });
    });
});

// Удалить маршрут
router.delete('/routes/:id', checkAdmin, (req, res) => {
    db.run('DELETE FROM routes WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: 'Маршрут удалён' });
    });
});

// Добавить маску в маршрут
router.post('/routes/:routeId/masks/:maskId', checkAdmin, (req, res) => {
    const { order } = req.body;
    db.run(`
        INSERT OR REPLACE INTO route_masks (routeId, maskId, "order")
        VALUES (?, ?, ?)
    `, [req.params.routeId, req.params.maskId, order || 0], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: 'Маска добавлена в маршрут' });
    });
});

// Удалить маску из маршрута
router.delete('/routes/:routeId/masks/:maskId', checkAdmin, (req, res) => {
    db.run('DELETE FROM route_masks WHERE routeId = ? AND maskId = ?', [req.params.routeId, req.params.maskId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: 'Маска удалена из маршрута' });
    });
});

// ========== СТАТИСТИКА ==========

router.get('/stats', checkAdmin, (req, res) => {
    const stats = {};
    
    // Общее количество пользователей
    db.get('SELECT COUNT(DISTINCT userId) as total FROM user_activations', (err, row) => {
        stats.totalUsers = row?.total || 0;
        
        // Общее количество активаций
        db.get('SELECT COUNT(*) as total FROM user_activations', (err, row2) => {
            stats.totalActivations = row2?.total || 0;
            
            // Популярные маски
            db.all(`
                SELECT m.name, COUNT(*) as count 
                FROM user_activations ua 
                JOIN masks m ON ua.maskId = m.id 
                GROUP BY ua.maskId 
                ORDER BY count DESC 
                LIMIT 10
            `, (err, rows3) => {
                stats.popularMasks = rows3 || [];
                
                // Популярные маршруты
                db.all(`
                    SELECT r.name, COUNT(*) as count 
                    FROM user_route_progress urp 
                    JOIN routes r ON urp.routeId = r.id 
                    WHERE urp.completedAt IS NOT NULL
                    GROUP BY urp.routeId 
                    ORDER BY count DESC 
                    LIMIT 10
                `, (err, rows4) => {
                    stats.popularRoutes = rows4 || [];
                    
                    // Активации по дням (последние 7 дней)
                    db.all(`
                        SELECT DATE(activatedAt) as date, COUNT(*) as count 
                        FROM user_activations 
                        WHERE activatedAt >= DATE('now', '-7 days')
                        GROUP BY DATE(activatedAt)
                        ORDER BY date
                    `, (err, rows5) => {
                        stats.dailyActivations = rows5 || [];
                        
                        // Прогресс по маршрутам
                        db.all(`
                            SELECT 
                                COUNT(CASE WHEN completedAt IS NOT NULL THEN 1 END) as completed,
                                COUNT(*) as total
                            FROM user_route_progress
                        `, (err, rows6) => {
                            stats.routeProgress = rows6[0] || { completed: 0, total: 0 };
                            res.json(stats);
                        });
                    });
                });
            });
        });
    });
});

module.exports = router;