const express = require('express');
const router = express.Router();
const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Настройка хранения файлов
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Только изображения!'));
        }
    }
});

// Эндпоинт для загрузки фото маски
router.post('/masks/:id/upload-photo', checkAdmin, upload.single('photo'), async (req, res) => {
    try {
        const maskId = req.params.id;
        
        if (!req.file) {
            return res.status(400).json({ error: 'Файл не загружен' });
        }
        
        // Проверяем, существует ли маска
        const maskResult = await db.query('SELECT * FROM masks WHERE id = $1', [maskId]);
        if (maskResult.rows.length === 0) {
            return res.status(404).json({ error: 'Маска не найдена' });
        }
        
        // Создаём папку public/images если её нет
        const imagesDir = path.join(__dirname, '../public/images');
        if (!fs.existsSync(imagesDir)) {
            fs.mkdirSync(imagesDir, { recursive: true });
        }
        
        // Копируем файл в public/images с именем maskId.jpg
        const targetPath = path.join(imagesDir, `${maskId}.jpg`);
        fs.copyFileSync(req.file.path, targetPath);
        
        // Удаляем временный файл
        fs.unlinkSync(req.file.path);
        
        // Обновляем запись в БД (сохраняем хеш фото)
        await db.query(`
            UPDATE masks SET "photoHash" = $1, "activationPhotoHash" = $1
            WHERE id = $2
        `, [`${maskId}.jpg`, maskId]);
        
        res.json({ 
            success: true, 
            message: 'Фото загружено', 
            url: `/images/${maskId}.jpg` 
        });
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Эндпоинт для удаления фото маски
router.delete('/masks/:id/photo', checkAdmin, async (req, res) => {
    try {
        const maskId = req.params.id;
        const imagePath = path.join(__dirname, '../public/images', `${maskId}.jpg`);
        
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
        }
        
        await db.query(`UPDATE masks SET "photoHash" = NULL, "activationPhotoHash" = NULL WHERE id = $1`, [maskId]);
        
        res.json({ success: true, message: 'Фото удалено' });
    } catch (err) {
        console.error('Delete photo error:', err);
        res.status(500).json({ error: err.message });
    }
});

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
        
        // Общее количество уникальных пользователей
        const totalUsersRes = await db.query('SELECT COUNT(DISTINCT "userId") as total FROM user_activations');
        stats.totalUsers = parseInt(totalUsersRes.rows[0]?.total) || 0;
        
        // Общее количество активаций
        const totalActivationsRes = await db.query('SELECT COUNT(*) as total FROM user_activations');
        stats.totalActivations = parseInt(totalActivationsRes.rows[0]?.total) || 0;
        
        // Популярные маски (топ 10)
        const popularMasksRes = await db.query(`
            SELECT m.name, COUNT(*) as count 
            FROM user_activations ua 
            JOIN masks m ON ua."maskId" = m.id 
            GROUP BY ua."maskId", m.name 
            ORDER BY count DESC 
            LIMIT 10
        `);
        stats.popularMasks = popularMasksRes.rows || [];
        
        // Популярные маршруты (топ 10)
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
        
        // Активации за последние 7 дней (теперь TIMESTAMP, можно использовать напрямую)
        const dailyActivationsRes = await db.query(`
            SELECT DATE("activatedAt") as date, COUNT(*) as count 
            FROM user_activations 
            WHERE "activatedAt" >= NOW() - INTERVAL '7 days'
            GROUP BY DATE("activatedAt")
            ORDER BY date
        `);
        stats.dailyActivations = dailyActivationsRes.rows || [];
        
        // Прогресс по маршрутам
        const routeProgressRes = await db.query(`
            SELECT 
                COUNT(CASE WHEN "completedAt" IS NOT NULL THEN 1 END) as completed,
                COUNT(*) as total
            FROM user_route_progress
        `);
        stats.routeProgress = {
            completed: parseInt(routeProgressRes.rows[0]?.completed) || 0,
            total: parseInt(routeProgressRes.rows[0]?.total) || 0
        };
        
        // Активные пользователи за последние 7 дней
        const activeUsersRes = await db.query(`
            SELECT COUNT(DISTINCT "userId") as count 
            FROM user_activations 
            WHERE "activatedAt" >= NOW() - INTERVAL '7 days'
        `);
        stats.activeUsers = parseInt(activeUsersRes.rows[0]?.count) || 0;
        
        // Всего маршрутов
        const totalRoutesRes = await db.query('SELECT COUNT(*) as total FROM routes WHERE "isActive" = 1');
        stats.totalRoutes = parseInt(totalRoutesRes.rows[0]?.total) || 0;
        
        // Всего масок (опубликованных)
        const totalMasksRes = await db.query('SELECT COUNT(*) as total FROM masks WHERE "isAvailable" = 1');
        stats.totalMasks = parseInt(totalMasksRes.rows[0]?.total) || 0;
        
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

module.exports = router;