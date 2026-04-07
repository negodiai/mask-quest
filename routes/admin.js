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

router.post('/masks', checkAdmin, async (req, res) => {
    const { name, description, fullDescription, latitude, longitude, address, qrCode, priceAmount, isAvailable, yandexMapLink } = req.body;
    const id = uuidv4();
    
    try {
        await db.query(`
            INSERT INTO masks (id, name, description, "fullDescription", latitude, longitude, address, "qrCode", "priceAmount", "isAvailable", "yandexMapLink")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [id, name, description, fullDescription, latitude, longitude, address, qrCode, priceAmount, isAvailable ? 1 : 0, yandexMapLink]);
        res.json({ success: true, id, message: 'Маска добавлена' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/masks/:id', checkAdmin, async (req, res) => {
    const { name, description, fullDescription, latitude, longitude, address, qrCode, priceAmount, isAvailable, yandexMapLink } = req.body;
    
    try {
        await db.query(`
            UPDATE masks SET 
                name = $1, description = $2, "fullDescription" = $3, latitude = $4, longitude = $5, 
                address = $6, "qrCode" = $7, "priceAmount" = $8, "isAvailable" = $9, "yandexMapLink" = $10
            WHERE id = $11
        `, [name, description, fullDescription, latitude, longitude, address, qrCode, priceAmount, isAvailable ? 1 : 0, yandexMapLink, req.params.id]);
        res.json({ success: true, message: 'Маска обновлена' });
    } catch (err) {
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
        
        const totalUsersRes = await db.query('SELECT COUNT(DISTINCT "userId") as total FROM user_activations');
        stats.totalUsers = totalUsersRes.rows[0]?.total || 0;
        
        const totalActivationsRes = await db.query('SELECT COUNT(*) as total FROM user_activations');
        stats.totalActivations = totalActivationsRes.rows[0]?.total || 0;
        
        const popularMasksRes = await db.query(`
            SELECT m.name, COUNT(*) as count 
            FROM user_activations ua 
            JOIN masks m ON ua."maskId" = m.id 
            GROUP BY ua."maskId", m.name 
            ORDER BY count DESC 
            LIMIT 10
        `);
        stats.popularMasks = popularMasksRes.rows;
        
        const popularRoutesRes = await db.query(`
            SELECT r.name, COUNT(*) as count 
            FROM user_route_progress urp 
            JOIN routes r ON urp."routeId" = r.id 
            WHERE urp."completedAt" IS NOT NULL
            GROUP BY urp."routeId", r.name 
            ORDER BY count DESC 
            LIMIT 10
        `);
        stats.popularRoutes = popularRoutesRes.rows;
        
        const dailyActivationsRes = await db.query(`
            SELECT DATE("activatedAt") as date, COUNT(*) as count 
            FROM user_activations 
            WHERE "activatedAt" >= DATE('now', '-7 days')
            GROUP BY DATE("activatedAt")
            ORDER BY date
        `);
        stats.dailyActivations = dailyActivationsRes.rows;
        
        res.json(stats);
    } catch (err) {
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

// Опубликовать маршрут (сделать isActive = 1)
router.post('/routes/:id/publish', checkAdmin, async (req, res) => {
    try {
        // 1. Проверяем, существует ли маршрут
        const routeResult = await db.query('SELECT * FROM routes WHERE id = $1', [req.params.id]);
        if (routeResult.rows.length === 0) {
            return res.status(404).json({ error: 'Маршрут не найден' });
        }
        
        // 2. Обновляем статус isActive = 1 (опубликован)
        await db.query(`
            UPDATE routes 
            SET "isActive" = 1, 
                "updatedAt" = CURRENT_TIMESTAMP
            WHERE id = $1
        `, [req.params.id]);
        
        // 3. Логируем действие администратора
        await db.query(`
            INSERT INTO admin_logs ("adminId", action, "targetId", details, "createdAt")
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        `, [req.headers['x-user-id'], 'PUBLISH_ROUTE', req.params.id, JSON.stringify({ routeId: req.params.id })]);
        
        // 4. Отправляем успешный ответ
        res.json({ 
            success: true, 
            message: 'Маршрут опубликован и доступен пользователям' 
        });
    } catch (err) {
        console.error('Publish route error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Снять с публикации маршрут (сделать isActive = 0)
router.post('/routes/:id/unpublish', checkAdmin, async (req, res) => {
    try {
        // 1. Проверяем, существует ли маршрут
        const routeResult = await db.query('SELECT * FROM routes WHERE id = $1', [req.params.id]);
        if (routeResult.rows.length === 0) {
            return res.status(404).json({ error: 'Маршрут не найден' });
        }
        
        // 2. Обновляем статус isActive = 0 (черновик)
        await db.query(`
            UPDATE routes 
            SET "isActive" = 0, 
                "updatedAt" = CURRENT_TIMESTAMP
            WHERE id = $1
        `, [req.params.id]);
        
        // 3. Логируем действие администратора
        await db.query(`
            INSERT INTO admin_logs ("adminId", action, "targetId", details, "createdAt")
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        `, [req.headers['x-user-id'], 'UNPUBLISH_ROUTE', req.params.id, JSON.stringify({ routeId: req.params.id })]);
        
        // 4. Отправляем успешный ответ
        res.json({ 
            success: true, 
            message: 'Маршрут снят с публикации' 
        });
    } catch (err) {
        console.error('Unpublish route error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;