const express = require('express');
const router = express.Router();
const db = require('../database');

// Функция обновления прогресса маршрутов для пользователя
async function updateUserRouteProgress(userId) {
    try {
        // Получаем все маршруты
        const routesResult = await db.query('SELECT id FROM routes WHERE "isActive" = 1');
        const routes = routesResult.rows;
        
        // Получаем все активированные маски пользователя
        const activationsResult = await db.query(
            'SELECT "maskId" FROM user_activations WHERE "userId" = $1',
            [userId]
        );
        const activatedMaskIds = new Set(activationsResult.rows.map(r => r.maskId));
        
        // Получаем все связи маршрутов и масок
        const routeMasksResult = await db.query('SELECT * FROM route_masks');
        const routeMasks = routeMasksResult.rows;
        
        for (const route of routes) {
            // Маски в этом маршруте
            const masksInRoute = routeMasks.filter(rm => rm.routeId === route.id);
            const totalMasks = masksInRoute.length;
            
            // Активированные маски в этом маршруте
            const activatedCount = masksInRoute.filter(rm => activatedMaskIds.has(rm.maskId)).length;
            
            const progressPercent = totalMasks > 0 ? Math.round((activatedCount / totalMasks) * 100) : 0;
            const isCompleted = activatedCount === totalMasks && totalMasks > 0;
            
            // Проверяем, есть ли уже запись прогресса
            const existingResult = await db.query(
                'SELECT * FROM user_route_progress WHERE "userId" = $1 AND "routeId" = $2',
                [userId, route.id]
            );
            
            if (existingResult.rows.length > 0) {
                // Обновляем существующую запись
                await db.query(`
                    UPDATE user_route_progress 
                    SET "progressPercent" = $1, "masksActivated" = $2, 
                        "completedAt" = $3
                    WHERE "userId" = $4 AND "routeId" = $5
                `, [progressPercent, activatedCount, isCompleted ? new Date().toISOString() : null, userId, route.id]);
            } else if (activatedCount > 0) {
                // Создаём новую запись
                const { v4: uuidv4 } = require('uuid');
                await db.query(`
                    INSERT INTO user_route_progress (id, "userId", "routeId", "progressPercent", "masksActivated", "completedAt")
                    VALUES ($1, $2, $3, $4, $5, $6)
                `, [uuidv4(), userId, route.id, progressPercent, activatedCount, isCompleted ? new Date().toISOString() : null]);
            }
        }
        
        console.log(`Прогресс маршрутов обновлён для пользователя ${userId}`);
    } catch (err) {
        console.error('Ошибка обновления прогресса маршрутов:', err);
                console.log(`Начинаем обновление прогресса для пользователя ${userId}`);
        console.log(`Найдено маршрутов: ${routes.length}`);
        console.log(`Найдено активированных масок: ${activatedMaskIds.size}`);
    }
}

// Функция расчета расстояния между двумя точками
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

const ACTIVATION_RADIUS_METERS = 50;

// GET /api/masks/list - список всех опубликованных масок
router.get('/list', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT id, number, name, description, "photoHash", "isAvailable", 
                   "priceAmount", "priceCurrency", "yandexMapLink", "googleMapLink", "twoGisLink"
            FROM masks 
            WHERE "isAvailable" = 1
            ORDER BY number ASC
        `);
        
        const safeMasks = result.rows.map(m => ({
            id: m.id,
            number: m.number,
            name: m.name,
            description: m.description,
            photoHash: m.photoHash,
            isAvailable: m.isAvailable === 1,
            price: { amount: m.priceAmount, currency: m.priceCurrency || 'RUB' },
            yandexMapLink: m.yandexMapLink,
            googleMapLink: m.googleMapLink,
            twoGisLink: m.twoGisLink
        }));
        
        res.json(safeMasks);
    } catch (err) {
        console.error('Error in /list:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/masks/detail - детали конкретной маски
router.get('/detail', async (req, res) => {
    const { id } = req.query;
    
    if (!id) {
        return res.status(400).json({ error: 'Mask ID required' });
    }
    
    try {
        const result = await db.query('SELECT * FROM masks WHERE id = $1', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Mask not found' });
        }
        
        const mask = result.rows[0];
        res.json({
            id: mask.id,
            name: mask.name,
            description: mask.description,
            fullDescription: mask.fullDescription,
            latitude: mask.latitude,
            longitude: mask.longitude,
            address: mask.address,
            photoHash: mask.photoHash,
            activationPhotoHash: mask.activationPhotoHash,
            audioGuideHash: mask.audioGuideHash,
            isAvailable: mask.isAvailable === 1,
            price: { amount: mask.priceAmount, currency: mask.priceCurrency || 'RUB' },
            yandexMapLink: mask.yandexMapLink,
            googleMapLink: mask.googleMapLink,
            twoGisLink: mask.twoGisLink
        });
    } catch (err) {
        console.error('Error in /detail:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/masks/nearby - маски рядом с точкой
router.get('/nearby', async (req, res) => {
    const { lat, lng, radius = 1000 } = req.query;
    
    if (!lat || !lng) {
        return res.status(400).json({ error: 'Latitude and longitude required' });
    }
    
    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const searchRadius = parseFloat(radius);
    
    try {
        const result = await db.query('SELECT * FROM masks WHERE "isAvailable" = 1');
        const allMasks = result.rows;
        
        const nearbyMasks = allMasks
            .map(mask => ({
                id: mask.id,
                name: mask.name,
                description: mask.description,
                latitude: mask.latitude,
                longitude: mask.longitude,
                distance: calculateDistance(userLat, userLng, mask.latitude, mask.longitude)
            }))
            .filter(mask => mask.distance <= searchRadius)
            .sort((a, b) => a.distance - b.distance);
        
        res.json(nearbyMasks);
    } catch (err) {
        console.error('Error in /nearby:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/masks/activate - активация маски по геолокации
router.post('/activate', async (req, res) => {
    const { userId, maskId, latitude, longitude, telegramData } = req.body;
    const { v4: uuidv4 } = require('uuid');
    
    if (!userId || !latitude || !longitude) {
        return res.status(400).json({ 
            success: false, 
            message: 'Не хватает данных' 
        });
    }
    
    const userLat = parseFloat(latitude);
    const userLng = parseFloat(longitude);
    
    try {
        let targetMask = null;
        
        if (maskId) {
            const result = await db.query('SELECT * FROM masks WHERE id = $1', [maskId]);
            if (result.rows.length === 0) {
                return res.json({ success: false, error: 'mask_not_found', message: 'Маска не найдена' });
            }
            targetMask = result.rows[0];
        } else {
            const allMasks = await db.query('SELECT * FROM masks WHERE "isAvailable" = 1');
            let nearest = null;
            let minDist = Infinity;
            
            for (const mask of allMasks.rows) {
                const dist = calculateDistance(userLat, userLng, mask.latitude, mask.longitude);
                if (dist <= ACTIVATION_RADIUS_METERS && dist < minDist) {
                    minDist = dist;
                    nearest = mask;
                }
            }
            targetMask = nearest;
        }
        
        if (!targetMask) {
            return res.json({
                success: false,
                error: 'no_mask_nearby',
                message: `Рядом нет масок. Подойдите в радиусе ${ACTIVATION_RADIUS_METERS}м`
            });
        }
        
        const distance = calculateDistance(userLat, userLng, targetMask.latitude, targetMask.longitude);
        if (distance > ACTIVATION_RADIUS_METERS) {
            return res.json({
                success: false,
                error: 'too_far',
                message: `Вы слишком далеко (${Math.round(distance)}м). Подойдите ближе (${ACTIVATION_RADIUS_METERS}м)`
            });
        }
        
        const existing = await db.query(
            'SELECT * FROM user_activations WHERE "userId" = $1 AND "maskId" = $2',
            [userId, targetMask.id]
        );
        
        if (existing.rows.length > 0) {
            return res.json({
                success: false,
                error: 'already_activated',
                message: 'Вы уже активировали эту маску! Ищите следующую.'
            });
        }
        
                        const activationId = uuidv4();
        const now = new Date().toISOString();
        await db.query(`
            INSERT INTO user_activations (id, "userId", "maskId", latitude, longitude, "telegramData", "activatedAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [activationId, userId, targetMask.id, userLat, userLng, JSON.stringify(telegramData || {}), now]);
        
        // Обновляем прогресс маршрутов
        await updateUserRouteProgress(userId);
        
        res.json({
            success: true,
            message: `Поздравляем! Вы активировали маску "${targetMask.name}"`,
            mask: {
                id: targetMask.id,
                name: targetMask.name,
                fullDescription: targetMask.fullDescription,
                activationPhotoHash: targetMask.activationPhotoHash,
                audioGuideHash: targetMask.audioGuideHash,
                price: { amount: targetMask.priceAmount, currency: targetMask.priceCurrency || 'RUB' },
                isAvailable: targetMask.isAvailable === 1
            }
        });
        
        res.json({
            success: true,
            message: `Поздравляем! Вы активировали маску "${targetMask.name}"`,
            mask: {
                id: targetMask.id,
                name: targetMask.name,
                fullDescription: targetMask.fullDescription,
                activationPhotoHash: targetMask.activationPhotoHash,
                audioGuideHash: targetMask.audioGuideHash,
                price: { amount: targetMask.priceAmount, currency: targetMask.priceCurrency || 'RUB' },
                isAvailable: targetMask.isAvailable === 1
            }
        });
    } catch (err) {
        console.error('Activation error:', err);
        res.status(500).json({ success: false, message: 'Ошибка активации' });
    }
});

module.exports = router;