const express = require('express');
const router = express.Router();
const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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

// Настройка хранения файлов
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../public/images');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const maskId = req.params.id || req.body.id || 'temp';
        const uniqueName = `${maskId}_${Date.now()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Только изображения'), false);
        }
    }
});

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

// СОЗДАНИЕ МАСКИ (POST /masks)
router.post('/masks', checkAdmin, async (req, res) => {
    const { name, description, fullDescription, latitude, longitude, address, qrCode, priceAmount, isAvailable, yandexMapLink } = req.body;
    
    if (!name || !latitude || !longitude) {
        return res.status(400).json({ error: 'Обязательные поля: название, широта, долгота' });
    }
    
    const id = uuidv4();
    let finalQrCode = qrCode;
    if (!finalQrCode) {
        finalQrCode = `MASK_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    }
    
    try {
        const existingQr = await db.query('SELECT id FROM masks WHERE "qrCode" = $1', [finalQrCode]);
        if (existingQr.rows.length > 0) {
            finalQrCode = `MASK_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
        }
        
        await db.query(`
            INSERT INTO masks (id, name, description, "fullDescription", latitude, longitude, address, "qrCode", "priceAmount", "isAvailable", "yandexMapLink")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [id, name, description || '', fullDescription || '', parseFloat(latitude), parseFloat(longitude), address || '', finalQrCode, priceAmount || 0, isAvailable ? 1 : 0, yandexMapLink || '']);
        
        res.json({ success: true, id, message: 'Маска добавлена' });
    } catch (err) {
        console.error('Add mask error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ОБНОВЛЕНИЕ МАСКИ
router.put('/masks/:id', checkAdmin, async (req, res) => {
    const { name, description, fullDescription, latitude, longitude, address, qrCode, priceAmount, isAvailable, yandexMapLink } = req.body;
    
    try {
        const currentMask = await db.query('SELECT "photoHash" FROM masks WHERE id = $1', [req.params.id]);
        const currentPhotoHash = currentMask.rows[0]?.photoHash;
        
        await db.query(`
            UPDATE masks SET 
                name = COALESCE($1, name),
                description = COALESCE($2, description),
                "fullDescription" = COALESCE($3, "fullDescription"),
                latitude = COALESCE($4, latitude),
                longitude = COALESCE($5, longitude),
                address = COALESCE($6, address),
                "qrCode" = COALESCE($7, "qrCode"),
                "priceAmount" = COALESCE($8, "priceAmount"),
                "isAvailable" = COALESCE($9, "isAvailable"),
                "yandexMapLink" = COALESCE($10, "yandexMapLink"),
                "photoHash" = COALESCE($11, "photoHash")
            WHERE id = $12
        `, [name, description, fullDescription, latitude ? parseFloat(latitude) : null, longitude ? parseFloat(longitude) : null, address, qrCode, priceAmount, isAvailable ? 1 : 0, yandexMapLink, currentPhotoHash, req.params.id]);
        
        res.json({ success: true, message: 'Маска обновлена' });
    } catch (err) {
        console.error('Update mask error:', err);
        res.status(500).json({ error: err.message });
    }
});

// УДАЛЕНИЕ МАСКИ
router.delete('/masks/:id', checkAdmin, async (req, res) => {
    try {
        await db.query('DELETE FROM masks WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'Маска удалена' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ПУБЛИКАЦИЯ МАСКИ
router.post('/masks/:id/publish', checkAdmin, async (req, res) => {
    try {
        const maskId = req.params.id;
        const adminId = req.headers['x-user-id'] || 'admin';
        
        const maskResult = await db.query('SELECT * FROM masks WHERE id = $1', [maskId]);
        if (maskResult.rows.length === 0) {
            return res.status(404).json({ error: 'Маска не найдена' });
        }
        
        const mask = maskResult.rows[0];
        if (!mask.latitude || !mask.longitude) {
            return res.status(400).json({ error: 'У маски не указаны координаты. Сначала отредактируйте маску и добавьте широту/долготу.' });
        }
        
        await db.query('UPDATE masks SET "isAvailable" = 1 WHERE id = $1', [maskId]);
        
        await db.query(`
            INSERT INTO admin_logs ("adminId", action, "targetId", details, "createdAt")
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        `, [adminId, 'PUBLISH_MASK', maskId, JSON.stringify({ maskId: maskId })]);
        
        res.json({ success: true, message: 'Маска опубликована и доступна в каталоге' });
    } catch (err) {
        console.error('Publish error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ЗАГРУЗКА ФОТО
router.post('/masks/:id/upload', checkAdmin, upload.single('photo'), async (req, res) => {
    try {
        const maskId = req.params.id;
        
        if (!req.file) {
            return res.status(400).json({ error: 'Файл не загружен' });
        }
        
        const photoUrl = `/images/${req.file.filename}`;
        
        const result = await db.query('UPDATE masks SET "photoHash" = $1 WHERE id = $2 RETURNING id', [photoUrl, maskId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Маска не найдена' });
        }
        
        res.json({ success: true, photoUrl, message: 'Фото загружено' });
    } catch (err) {
        console.error('Upload error:', err);
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

// ========== СТАТИСТИКА ==========

router.get('/stats', checkAdmin, async (req, res) => {
    try {
        const stats = {};
        
        const totalUsersRes = await db.query('SELECT COUNT(DISTINCT "userId") as total FROM user_activations');
        stats.totalUsers = parseInt(totalUsersRes.rows[0]?.total) || 0;
        
        const totalActivationsRes = await db.query('SELECT COUNT(*) as total FROM user_activations');
        stats.totalActivations = parseInt(totalActivationsRes.rows[0]?.total) || 0;
        
        const popularMasksRes = await db.query(`
            SELECT m.name, COUNT(*) as count 
            FROM user_activations ua 
            JOIN masks m ON ua."maskId" = m.id 
            GROUP BY ua."maskId", m.name 
            ORDER BY count DESC 
            LIMIT 10
        `);
        stats.popularMasks = popularMasksRes.rows || [];
        
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
        
        const dailyActivationsRes = await db.query(`
            SELECT DATE("activatedAt") as date, COUNT(*) as count 
            FROM user_activations 
            WHERE "activatedAt" >= NOW() - INTERVAL '7 days'
            GROUP BY DATE("activatedAt")
            ORDER BY date
        `);
        stats.dailyActivations = dailyActivationsRes.rows || [];
        
        const routeProgressRes = await db.query(`
            SELECT COUNT(CASE WHEN "completedAt" IS NOT NULL THEN 1 END) as completed, COUNT(*) as total
            FROM user_route_progress
        `);
        stats.routeProgress = {
            completed: parseInt(routeProgressRes.rows[0]?.completed) || 0,
            total: parseInt(routeProgressRes.rows[0]?.total) || 0
        };
        
        const activeUsersRes = await db.query(`
            SELECT COUNT(DISTINCT "userId") as count 
            FROM user_activations 
            WHERE "activatedAt" >= NOW() - INTERVAL '7 days'
        `);
        stats.activeUsers = parseInt(activeUsersRes.rows[0]?.count) || 0;
        
        const totalRoutesRes = await db.query('SELECT COUNT(*) as total FROM routes WHERE "isActive" = 1');
        stats.totalRoutes = parseInt(totalRoutesRes.rows[0]?.total) || 0;
        
        const totalMasksRes = await db.query('SELECT COUNT(*) as total FROM masks WHERE "isAvailable" = 1');
        stats.totalMasks = parseInt(totalMasksRes.rows[0]?.total) || 0;
        
        res.json(stats);
    } catch (err) {
        console.error('Stats error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;