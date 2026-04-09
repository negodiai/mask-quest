const express = require('express');
const router = express.Router();
const db = require('../database');
const { v4: uuidv4 } = require('uuid');

const ADMIN_ID = '359839365';

function isAdmin(userId) {
    return userId === ADMIN_ID;
}

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Настройка хранения файлов
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../public/images');
        // Создаём папку, если её нет
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
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB лимит
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Только изображения'), false);
        }
    }
});

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
    
    // Проверяем обязательные поля
    if (!name || !latitude || !longitude) {
        return res.status(400).json({ 
            error: 'Обязательные поля: название, широта, долгота' 
        });
    }
    
    const id = uuidv4();
    
    // Генерируем уникальный QR-код, если не передан или уже существует
    let finalQrCode = qrCode;
    if (!finalQrCode) {
        finalQrCode = `MASK_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    }
    
    try {
        // Проверяем, не существует ли уже такой QR-код
        const existingQr = await db.query('SELECT id FROM masks WHERE "qrCode" = $1', [finalQrCode]);
        if (existingQr.rows.length > 0) {
            // Если QR-код уже существует, генерируем новый уникальный
            finalQrCode = `MASK_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
        }
        
        await db.query(`
            INSERT INTO masks (
                id, name, description, "fullDescription", latitude, longitude, 
                address, "qrCode", "priceAmount", "isAvailable", "yandexMapLink"
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
            id, 
            name || 'Без названия', 
            description || '', 
            fullDescription || '', 
            parseFloat(latitude), 
            parseFloat(longitude), 
            address || '', 
            finalQrCode, 
            priceAmount || 0, 
            isAvailable ? 1 : 0, 
            yandexMapLink || ''
        ]);
        
        res.json({ success: true, id, message: 'Маска добавлена' });
    } catch (err) {
        console.error('Add mask error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.put('/masks/:id', checkAdmin, async (req, res) => {
    const { name, description, fullDescription, latitude, longitude, address, qrCode, priceAmount, isAvailable, yandexMapLink } = req.body;
    
    try {
        // Получаем текущую маску, чтобы сохранить photoHash, если он не передан
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
        `, [
            name, description, fullDescription, 
            latitude ? parseFloat(latitude) : null, 
            longitude ? parseFloat(longitude) : null, 
            address, qrCode, priceAmount, 
            isAvailable ? 1 : 0, yandexMapLink, 
            currentPhotoHash, req.params.id
        ]);
        
        res.json({ success: true, message: 'Маска обновлена' });
    } catch (err) {
        console.error('Update mask error:', err);
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

router.post('/masks/:id/publish', checkAdmin, async (req, res) => {
    try {
        const maskId = req.params.id;
        const adminId = req.headers['x-user-id'] || 'admin';
        
        // Проверяем, существует ли маска
        const maskResult = await db.query('SELECT * FROM masks WHERE id = $1', [maskId]);
        if (maskResult.rows.length === 0) {
            return res.status(404).json({ error: 'Маска не найдена' });
        }
        
        // Проверяем, что координаты заполнены
        const mask = maskResult.rows[0];
        if (!mask.latitude || !mask.longitude) {
            return res.status(400).json({ error: 'У маски не указаны координаты. Сначала отредактируйте маску и добавьте широту/долготу.' });
        }
        
        // Публикуем маску
        await db.query(`
            UPDATE masks SET "isAvailable" = 1 WHERE id = $1
        `, [maskId]);
        
        // Добавляем запись в лог
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
        const maskId = req.params.id;
        const adminId = req.headers['x-user-id'] || 'admin';
        
        // Проверяем, существует ли маска
        const maskResult = await db.query('SELECT * FROM masks WHERE id = $1', [maskId]);
        if (maskResult.rows.length === 0) {
            return res.status(404).json({ error: 'Маска не найдена' });
        }
        
        // Публикуем маску
        await db.query(`
            UPDATE masks SET "isAvailable" = 1 WHERE id = $1
        `, [maskId]);
        
        // Добавляем запись в лог (с adminId)
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

// ========== ЗАГРУЗКА ФОТО ==========

// Эндпоинт для загрузки главного фото маски
router.post('/masks', checkAdmin, async (req, res) => {
    const { name, description, fullDescription, latitude, longitude, address, qrCode, priceAmount, isAvailable, yandexMapLink } = req.body;
    const id = uuidv4();
    const uniqueQrCode = qrCode || `MASK_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    try {
        // Проверяем, не существует ли уже такой QR-код
        const existingQr = await db.query('SELECT id FROM masks WHERE "qrCode" = $1', [uniqueQrCode]);
        if (existingQr.rows.length > 0) {
            // Если QR-код уже существует, генерируем уникальный
            const newQrCode = `MASK_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
            await db.query(`
                INSERT INTO masks (id, name, description, "fullDescription", latitude, longitude, address, "qrCode", "priceAmount", "isAvailable", "yandexMapLink")
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            `, [id, name, description, fullDescription, latitude, longitude, address, newQrCode, priceAmount, isAvailable ? 1 : 0, yandexMapLink]);
        } else {
            await db.query(`
                INSERT INTO masks (id, name, description, "fullDescription", latitude, longitude, address, "qrCode", "priceAmount", "isAvailable", "yandexMapLink")
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            `, [id, name, description, fullDescription, latitude, longitude, address, uniqueQrCode, priceAmount, isAvailable ? 1 : 0, yandexMapLink]);
        }
        
        res.json({ success: true, id, message: 'Маска добавлена' });
    } catch (err) {
        console.error('Add mask error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Эндпоинт для загрузки нескольких фото в галерею
router.post('/masks/:id/upload-gallery', checkAdmin, upload.array('photos', 10), async (req, res) => {
    try {
        const maskId = req.params.id;
        
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'Файлы не загружены' });
        }
        
        const photoUrls = req.files.map(file => `/images/${file.filename}`);
        
        // Сохраняем список фото в БД (как JSON массив)
        await db.query(`
            UPDATE masks SET "galleryPhotos" = $1 WHERE id = $2
        `, [JSON.stringify(photoUrls), maskId]);
        
        res.json({ success: true, photoUrls, message: `${req.files.length} фото загружено` });
    } catch (err) {
        console.error('Upload gallery error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;