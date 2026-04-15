const express = require('express');
const router = express.Router();
const db = require('../database');
const { v4: uuidv4 } = require('uuid');

const ADMIN_ID = '359839365';

function isAdmin(userId) {
    return userId === ADMIN_ID;
}

async function checkAdmin(req, res, next) {
    const userId = req.headers['x-user-id'] || req.query.userId;
    if (!isAdmin(userId)) {
        return res.status(403).json({ error: 'Доступ запрещён' });
    }
    next();
}

// ========== МАСКИ (CRUD) ==========

router.get('/masks', checkAdmin, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM masks ORDER BY name');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/masks/:id', checkAdmin, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM masks WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Маска не найдена' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/admin/masks - добавить маску (черновик)
router.post('/masks', checkAdmin, async (req, res) => {
    const { 
        name, description, fullDescription, latitude, longitude, address, 
        qrCode, priceAmount, yandexMapLink, googleMapLink, twoGisLink 
    } = req.body;
    const id = uuidv4();
    
    try {
        await db.query(`
            INSERT INTO masks (id, name, description, "fullDescription", latitude, longitude, 
                               address, "qrCode", "priceAmount", "isAvailable", 
                               "yandexMapLink", "googleMapLink", "twoGisLink")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `, [id, name, description, fullDescription, latitude, longitude, address, 
            qrCode, priceAmount, 0, yandexMapLink, googleMapLink, twoGisLink]);
        
        res.json({ success: true, id, message: 'Маска добавлена как черновик' });
    } catch (err) {
        console.error('Add mask error:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/admin/masks/:id - обновить маску
router.put('/masks/:id', checkAdmin, async (req, res) => {
    const { 
        name, description, fullDescription, latitude, longitude, address, 
        qrCode, priceAmount, isAvailable, yandexMapLink, googleMapLink, twoGisLink 
    } = req.body;
    
    try {
        await db.query(`
            UPDATE masks SET 
                name = $1, description = $2, "fullDescription" = $3, 
                latitude = $4, longitude = $5, address = $6, "qrCode" = $7, 
                "priceAmount" = $8, "isAvailable" = $9, 
                "yandexMapLink" = $10, "googleMapLink" = $11, "twoGisLink" = $12
            WHERE id = $13
        `, [name, description, fullDescription, latitude, longitude, address, 
            qrCode, priceAmount, isAvailable ? 1 : 0, 
            yandexMapLink, googleMapLink, twoGisLink, req.params.id]);
        
        res.json({ success: true, message: 'Маска обновлена' });
    } catch (err) {
        console.error('Update mask error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/admin/masks/:id/publish - опубликовать маску
router.post('/masks/:id/publish', checkAdmin, async (req, res) => {
    try {
        const maskResult = await db.query('SELECT * FROM masks WHERE id = $1', [req.params.id]);
        if (maskResult.rows.length === 0) {
            return res.status(404).json({ error: 'Маска не найдена' });
        }
        
        await db.query(`
            UPDATE masks SET "isAvailable" = 1 WHERE id = $1
        `, [req.params.id]);
        
        await db.query(`
            INSERT INTO admin_logs ("adminId", action, "targetId", details)
            VALUES ($1, $2, $3, $4)
        `, [req.headers['x-user-id'], 'PUBLISH_MASK', req.params.id, JSON.stringify({ maskId: req.params.id })]);
        
        res.json({ success: true, message: 'Маска опубликована' });
    } catch (err) {
        console.error('Publish error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.delete('/masks/:id', checkAdmin, async (req, res) => {
    try {
        await db.query('DELETE FROM masks WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'Маска удалена' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========== МАРШРУТЫ (CRUD) ==========

router.get('/routes', checkAdmin, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM routes ORDER BY name');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/routes', checkAdmin, async (req, res) => {
    const { name, description, difficulty, durationMinutes, distanceKm, color, centerLat, centerLng, zoom } = req.body;
    const id = uuidv4();
    
    try {
        await db.query(`
            INSERT INTO routes (id, name, description, difficulty, "durationMinutes", "distanceKm", color, "centerLat", "centerLng", zoom, "isActive")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1)
        `, [id, name, description, difficulty, durationMinutes, distanceKm, color, centerLat, centerLng, zoom]);
        res.json({ success: true, id, message: 'Маршрут добавлен' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/routes/:id', checkAdmin, async (req, res) => {
    const { name, description, difficulty, durationMinutes, distanceKm, color, centerLat, centerLng, zoom, isActive } = req.body;
    
    try {
        await db.query(`
            UPDATE routes SET 
                name = $1, description = $2, difficulty = $3, "durationMinutes" = $4, "distanceKm" = $5, 
                color = $6, "centerLat" = $7, "centerLng" = $8, zoom = $9, "isActive" = $10
            WHERE id = $11
        `, [name, description, difficulty, durationMinutes, distanceKm, color, centerLat, centerLng, zoom, isActive ? 1 : 0, req.params.id]);
        res.json({ success: true, message: 'Маршрут обновлён' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/routes/:id', checkAdmin, async (req, res) => {
    try {
        await db.query('DELETE FROM routes WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'Маршрут удалён' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Добавить маску в маршрут
router.post('/routes/:routeId/masks/:maskId', checkAdmin, async (req, res) => {
    const { order } = req.body;
    try {
        await db.query(`
            INSERT INTO route_masks ("routeId", "maskId", "order")
            VALUES ($1, $2, $3)
            ON CONFLICT ("routeId", "maskId") DO UPDATE SET "order" = EXCLUDED."order"
        `, [req.params.routeId, req.params.maskId, order || 0]);
        res.json({ success: true, message: 'Маска добавлена в маршрут' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Удалить маску из маршрута
router.delete('/routes/:routeId/masks/:maskId', checkAdmin, async (req, res) => {
    try {
        await db.query('DELETE FROM route_masks WHERE "routeId" = $1 AND "maskId" = $2', [req.params.routeId, req.params.maskId]);
        res.json({ success: true, message: 'Маска удалена из маршрута' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========== СТАТИСТИКА ==========

router.get('/stats', checkAdmin, async (req, res) => {
    try {
        const stats = {};
        
        // Всего пользователей
        const totalUsersRes = await db.query('SELECT COUNT(DISTINCT "userId") as total FROM user_activations');
        stats.totalUsers = parseInt(totalUsersRes.rows[0]?.total) || 0;
        
        // Всего активаций
        const totalActivationsRes = await db.query('SELECT COUNT(*) as total FROM user_activations');
        stats.totalActivations = parseInt(totalActivationsRes.rows[0]?.total) || 0;
        
        // Популярные маски
        const popularMasksRes = await db.query(`
            SELECT m.name, COUNT(*) as count 
            FROM user_activations ua 
            JOIN masks m ON ua."maskId" = m.id 
            GROUP BY ua."maskId", m.name 
            ORDER BY count DESC 
            LIMIT 10
        `);
        stats.popularMasks = popularMasksRes.rows || [];
        
        // Популярные маршруты
        const popularRoutesRes = await db.query(`
            SELECT r.name, COUNT(*) as count 
            FROM user_route_progress urp 
            JOIN routes r ON urp."routeId" = r.id 
            WHERE urp."completedAt" IS NOT NULL
            GROUP BY urp."routeId", r.name 
            ORDER BY count DESC 
            LIMIT 10
        `);
        stats.popularRoutes = popularRoutesRes.rows || [];
        
                // Активации за 7 дней
        const dailyActivationsRes = await db.query(`
            SELECT DATE(TO_TIMESTAMP("activatedAt", 'YYYY-MM-DD HH24:MI:SS')) as date, COUNT(*) as count 
            FROM user_activations 
            WHERE TO_TIMESTAMP("activatedAt", 'YYYY-MM-DD HH24:MI:SS') >= NOW() - INTERVAL '7 days'
            GROUP BY DATE(TO_TIMESTAMP("activatedAt", 'YYYY-MM-DD HH24:MI:SS'))
            ORDER BY date
        `);
        stats.dailyActivations = dailyActivationsRes.rows || [];
        
        // Пройденные маршруты
        const completedRoutesRes = await db.query(`
            SELECT COUNT(*) as count 
            FROM user_route_progress 
            WHERE "completedAt" IS NOT NULL
        `);
        stats.completedRoutesTotal = parseInt(completedRoutesRes.rows[0]?.count) || 0;
        
                // Активные пользователи за последние 7 дней (конвертируем TEXT в TIMESTAMP)
        const activeUsersRes = await db.query(`
            SELECT COUNT(DISTINCT "userId") as count 
            FROM user_activations 
            WHERE TO_TIMESTAMP("activatedAt", 'YYYY-MM-DD HH24:MI:SS') >= NOW() - INTERVAL '7 days'
        `);
        stats.activeUsers = parseInt(activeUsersRes.rows[0]?.count) || 0;
        
        // Всего маршрутов
        const totalRoutesRes = await db.query('SELECT COUNT(*) as total FROM routes WHERE "isActive" = 1');
        stats.totalRoutes = parseInt(totalRoutesRes.rows[0]?.total) || 0;
        
        // Всего масок
        const totalMasksRes = await db.query('SELECT COUNT(*) as total FROM masks WHERE "isAvailable" = 1');
        stats.totalMasks = parseInt(totalMasksRes.rows[0]?.total) || 0;
        
        // Отладка
        console.log('=== СТАТИСТИКА ===');
        console.log('Всего пользователей:', stats.totalUsers);
        console.log('Активных за 7 дней:', stats.activeUsers);
        console.log('Пройдено маршрутов:', stats.completedRoutesTotal);
        
        res.json(stats);
    } catch (err) {
        console.error('Stats error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Опубликовать маску (сделать isAvailable = true и перенести в каталог)
router.post('/masks/:id/publish', checkAdmin, async (req, res) => {
    try {
        // Проверяем, существует ли маска
        const maskResult = await db.query('SELECT * FROM masks WHERE id = $1', [req.params.id]);
        if (maskResult.rows.length === 0) {
            return res.status(404).json({ error: 'Маска не найдена' });
        }
        
        // Обновляем статус isAvailable = 1 (опубликовано)
        await db.query(`
            UPDATE masks SET "isAvailable" = 1, "updatedAt" = CURRENT_TIMESTAMP
            WHERE id = $1
        `, [req.params.id]);
        
        // Логируем действие
        await db.query(`
            INSERT INTO admin_logs ("adminId", action, "targetId", details)
            VALUES ($1, $2, $3, $4)
        `, [req.headers['x-user-id'], 'PUBLISH_MASK', req.params.id, JSON.stringify({ maskId: req.params.id })]);
        
        res.json({ success: true, message: 'Маска опубликована и доступна в каталоге' });
    } catch (err) {
        console.error('Publish error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ========== ДОБАВЛЕНИЕ МАСКИ В МАРШРУТЫ ==========

// Получить все маршруты для селекта
router.get('/routes/list', checkAdmin, async (req, res) => {
    try {
        const result = await db.query('SELECT id, name FROM routes WHERE "isActive" = 1 ORDER BY name');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Получить маршруты, в которые уже добавлена маска
router.get('/masks/:maskId/routes', checkAdmin, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT r.id, r.name 
            FROM route_masks rm
            JOIN routes r ON rm."routeId" = r.id
            WHERE rm."maskId" = $1
        `, [req.params.maskId]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Добавить маску в маршрут
router.post('/masks/:maskId/routes/:routeId', checkAdmin, async (req, res) => {
    const { order } = req.body;
    try {
        await db.query(`
            INSERT INTO route_masks ("routeId", "maskId", "order")
            VALUES ($1, $2, $3)
            ON CONFLICT ("routeId", "maskId") DO UPDATE SET "order" = EXCLUDED."order"
        `, [req.params.routeId, req.params.maskId, order || 0]);
        res.json({ success: true, message: 'Маска добавлена в маршрут' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Удалить маску из маршрута
router.delete('/masks/:maskId/routes/:routeId', checkAdmin, async (req, res) => {
    try {
        await db.query('DELETE FROM route_masks WHERE "routeId" = $1 AND "maskId" = $2', 
            [req.params.routeId, req.params.maskId]);
        res.json({ success: true, message: 'Маска удалена из маршрута' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;