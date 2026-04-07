const express = require('express');
const router = express.Router();
const db = require('../data/db');
const { calculateDistance, ACTIVATION_RADIUS_METERS } = require('../utils/geo');
const { v4: uuidv4 } = require('uuid');

// GET /api/masks/list - список всех масок
router.get('/list', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM masks WHERE "isAvailable" = 1 ORDER BY name');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/masks/detail - детали конкретной маски
router.get('/detail', (req, res) => {
    const { id } = req.query;
    if (!id) {
        return res.status(400).json({ error: 'Mask ID required' });
    }
    
    const mask = db.getMaskById(id);
    if (!mask) {
        return res.status(404).json({ error: 'Mask not found' });
    }
    
    res.json(mask);
});

// GET /api/masks/nearby - маски рядом с точкой
router.get('/nearby', (req, res) => {
    const { lat, lng, radius = 1000 } = req.query;
    
    if (!lat || !lng) {
        return res.status(400).json({ error: 'Latitude and longitude required' });
    }
    
    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const searchRadius = parseFloat(radius);
    
    const allMasks = db.getAllMasks();
    const nearbyMasks = allMasks
        .map(mask => ({
            ...mask,
            distance: calculateDistance(userLat, userLng, mask.latitude, mask.longitude)
        }))
        .filter(mask => mask.distance <= searchRadius)
        .sort((a, b) => a.distance - b.distance);
    
    res.json(nearbyMasks);
});

// POST /api/masks/activate - активация маски по геолокации
router.post('/activate', (req, res) => {
    const { userId, maskId, latitude, longitude, telegramData } = req.body;
    
    if (!userId || !latitude || !longitude) {
        return res.status(400).json({ 
            success: false, 
            error: 'missing_fields',
            message: 'Не хватает данных: userId, latitude, longitude' 
        });
    }
    
    const userLat = parseFloat(latitude);
    const userLng = parseFloat(longitude);
    
    // Если указан конкретный maskId
    if (maskId) {
        const mask = db.getMaskById(maskId);
        if (!mask) {
            return res.status(404).json({ 
                success: false, 
                error: 'mask_not_found',
                message: 'Маска не найдена' 
            });
        }
        
        const distance = calculateDistance(userLat, userLng, mask.latitude, mask.longitude);
        
        if (distance > ACTIVATION_RADIUS_METERS) {
            return res.json({
                success: false,
                error: 'too_far',
                message: `Вы слишком далеко (${Math.round(distance)}м). Подойдите ближе (в радиусе ${ACTIVATION_RADIUS_METERS}м)`,
                distance: Math.round(distance)
            });
        }
        
        // Проверяем, не активирована ли уже
        const existing = db.getActivationByUserAndMask(userId, mask.id);
        if (existing) {
            return res.json({
                success: false,
                error: 'already_activated',
                message: 'Вы уже активировали эту маску! Ищите следующую.',
                activatedAt: existing.activatedAt
            });
        }
        
        // Создаём активацию
        const activation = db.saveActivation({
            userId,
            maskId: mask.id,
            latitude: userLat,
            longitude: userLng,
            telegramData: telegramData || {}
        });
        
        return res.json({
            success: true,
            message: `Поздравляем! Вы активировали маску "${mask.name}"`,
            mask: {
                id: mask.id,
                name: mask.name,
                fullDescription: mask.fullDescription,
                activationPhotoHash: mask.activationPhotoHash,
                audioGuideHash: mask.audioGuideHash,
                price: mask.price,
                isAvailable: mask.isAvailable
            },
            activation
        });
    }
    
    // Если maskId не указан - ищем ближайшую маску
    const allMasks = db.getAllMasks();
    let nearestMask = null;
    let minDistance = Infinity;
    
    for (const mask of allMasks) {
        const distance = calculateDistance(userLat, userLng, mask.latitude, mask.longitude);
        if (distance <= ACTIVATION_RADIUS_METERS && distance < minDistance) {
            minDistance = distance;
            nearestMask = mask;
        }
    }
    
    if (!nearestMask) {
        return res.json({
            success: false,
            error: 'no_mask_nearby',
            message: `Рядом нет масок. Подойдите к любой маске в радиусе ${ACTIVATION_RADIUS_METERS}м`
        });
    }
    
    // Проверяем, не активирована ли уже
    const existing = db.getActivationByUserAndMask(userId, nearestMask.id);
    if (existing) {
        return res.json({
            success: false,
            error: 'already_activated',
            message: 'Вы уже активировали эту маску! Ищите следующую.router.post('/activate', async (req, res) => {
    const { userId, maskId, latitude, longitude, telegramData } = req.body;
    
    if (!userId || !latitude || !longitude) {
        return res.status(400).json({ 
            success: false, 
            error: 'missing_fields',
            message: 'Не хватает данных' 
        });
    }
    
    const userLat = parseFloat(latitude);
    const userLng = parseFloat(longitude);
    const ACTIVATION_RADIUS_METERS = 50;
    
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
    
    try {
        // Если указан конкретный maskId
        if (maskId) {
            const maskResult = await db.query('SELECT * FROM masks WHERE id = $1', [maskId]);
            if (maskResult.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'mask_not_found', message: 'Маска не найдена' });
            }
            const mask = maskResult.rows[0];
            
            const distance = calculateDistance(userLat, userLng, mask.latitude, mask.longitude);
            
            if (distance > ACTIVATION_RADIUS_METERS) {
                return res.json({
                    success: false,
                    error: 'too_far',
                    message: `Вы слишком далеко (${Math.round(distance)}м). Подойдите ближе (в радиусе ${ACTIVATION_RADIUS_METERS}м)`,
                    distance: Math.round(distance)
                });
            }
            
            const existingResult = await db.query(
                'SELECT * FROM user_activations WHERE "userId" = $1 AND "maskId" = $2',
                [userId, mask.id]
            );
            
            if (existingResult.rows.length > 0) {
                return res.json({
                    success: false,
                    error: 'already_activated',
                    message: 'Вы уже активировали эту маску! Ищите следующую.',
                    activatedAt: existingResult.rows[0].activatedAt
                });
            }
            
            const activationId = uuidv4();
            await db.query(`
                INSERT INTO user_activations (id, "userId", "maskId", latitude, longitude, "telegramData")
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [activationId, userId, mask.id, userLat, userLng, JSON.stringify(telegramData || {})]);
            
            // Обновляем прогресс маршрутов
            await updateRouteProgress(userId, mask.id);
            
            return res.json({
                success: true,
                message: `Поздравляем! Вы активировали маску "${mask.name}"`,
                mask: {
                    id: mask.id,
                    name: mask.name,
                    fullDescription: mask.fullDescription,
                    activationPhotoHash: mask.activationPhotoHash,
                    audioGuideHash: mask.audioGuideHash,
                    price: { amount: mask.priceAmount, currency: 'RUB' },
                    isAvailable: mask.isAvailable === 1
                },
                activation: { id: activationId }
            });
        }
        
        // Если maskId не указан - ищем ближайшую маску
        const allMasks = await db.query('SELECT * FROM masks');
        let nearestMask = null;
        let minDistance = Infinity;
        
        for (const mask of allMasks.rows) {
            const distance = calculateDistance(userLat, userLng, mask.latitude, mask.longitude);
            if (distance <= ACTIVATION_RADIUS_METERS && distance < minDistance) {
                minDistance = distance;
                nearestMask = mask;
            }
        }
        
        if (!nearestMask) {
            return res.json({
                success: false,
                error: 'no_mask_nearby',
                message: `Рядом нет масок. Подойдите к любой маске в радиусе ${ACTIVATION_RADIUS_METERS}м`
            });
        }
        
        const existingResult = await db.query(
            'SELECT * FROM user_activations WHERE "userId" = $1 AND "maskId" = $2',
            [userId, nearestMask.id]
        );
        
        if (existingResult.rows.length > 0) {
            return res.json({
                success: false,
                error: 'already_activated',
                message: 'Вы уже активировали эту маску! Ищите следующую.',
                activatedAt: existingResult.rows[0].activatedAt
            });
        }
        
        const activationId = uuidv4();
        await db.query(`
            INSERT INTO user_activations (id, "userId", "maskId", latitude, longitude, "telegramData")
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [activationId, userId, nearestMask.id, userLat, userLng, JSON.stringify(telegramData || {})]);
        
        await updateRouteProgress(userId, nearestMask.id);
        
        res.json({
            success: true,
            message: `Поздравляем! Вы активировали маску "${nearestMask.name}"`,
            mask: {
                id: nearestMask.id,
                name: nearestMask.name,
                fullDescription: nearestMask.fullDescription,
                activationPhotoHash: nearestMask.activationPhotoHash,
                audioGuideHash: nearestMask.audioGuideHash,
                price: { amount: nearestMask.priceAmount, currency: 'RUB' },
                isAvailable: nearestMask.isAvailable === 1
            },
            activation: { id: activationId }
        });
    } catch (err) {
        console.error('Activation error:', err);
        res.status(500).json({ success: false, message: 'Ошибка активации' });
    }
});

// Функция обновления прогресса маршрутов
async function updateRouteProgress(userId, maskId) {
    try {
        const routeMasksResult = await db.query('SELECT "routeId" FROM route_masks WHERE "maskId" = $1', [maskId]);
        const routeIds = routeMasksResult.rows.map(r => r.routeId);
        
        for (const routeId of routeIds) {
            const masksInRouteResult = await db.query('SELECT "maskId" FROM route_masks WHERE "routeId" = $1', [routeId]);
            const allMasksInRoute = masksInRouteResult.rows.map(r => r.maskId);
            
            const activatedResult = await db.query(
                'SELECT "maskId" FROM user_activations WHERE "userId" = $1 AND "maskId" = ANY($2::text[])',
                [userId, allMasksInRoute]
            );
            const activatedCount = activatedResult.rows.length;
            const totalMasks = allMasksInRoute.length;
            const progressPercent = totalMasks > 0 ? Math.round((activatedCount / totalMasks) * 100) : 0;
            const isCompleted = activatedCount === totalMasks && totalMasks > 0;
            
            const existingProgress = await db.query(
                'SELECT * FROM user_route_progress WHERE "userId" = $1 AND "routeId" = $2',
                [userId, routeId]
            );
            
            if (existingProgress.rows.length > 0) {
                await db.query(`
                    UPDATE user_route_progress 
                    SET "progressPercent" = $1, "masksActivated" = $2, "completedAt" = $3
                    WHERE "userId" = $4 AND "routeId" = $5
                `, [progressPercent, activatedCount, isCompleted ? new Date().toISOString() : null, userId, routeId]);
            } else {
                const id = uuidv4();
                await db.query(`
                    INSERT INTO user_route_progress (id, "userId", "routeId", "progressPercent", "masksActivated", "completedAt")
                    VALUES ($1, $2, $3, $4, $5, $6)
                `, [id, userId, routeId, progressPercent, activatedCount, isCompleted ? new Date().toISOString() : null]);
            }
        }
    } catch (err) {
        console.error('Error updating route progress:', err);
    }
}

module.exports = router;