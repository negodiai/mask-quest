const express = require('express');
const router = express.Router();
const db = require('../data/db');
const { calculateDistance, ACTIVATION_RADIUS_METERS } = require('../utils/geo');

// GET /api/masks/list - список всех масок
router.get('/list', async (req, res) => {
    try {
        // Возвращаем только опубликованные маски (isAvailable = 1)
        const result = await db.query(`
            SELECT id, name, description, latitude, longitude, "photoHash", "isAvailable", 
                   "priceAmount", "priceCurrency", "yandexMapLink", "googleMapLink", "twoGisLink"
            FROM masks 
            WHERE "isAvailable" = 1
            ORDER BY name
        `);
        
        const safeMasks = result.rows.map(m => ({
            id: m.id,
            name: m.name,
            description: m.description,
            latitude: m.latitude,
            longitude: m.longitude,
            photoHash: m.photoHash,
            isAvailable: m.isAvailable === 1,
            price: { amount: m.priceAmount, currency: m.priceCurrency || 'RUB' },
            yandexMapLink: m.yandexMapLink,
            googleMapLink: m.googleMapLink,
            twoGisLink: m.twoGisLink
        }));
        
        res.json(safeMasks);
    } catch (err) {
        console.error('Error loading masks list:', err);
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
        console.error('Error loading mask detail:', err);
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
        // Получаем только опубликованные маски
        const result = await db.query('SELECT * FROM masks WHERE "isAvailable" = 1');
        const allMasks = result.rows;
        
        const nearbyMasks = allMasks
            .map(mask => ({
                ...mask,
                distance: calculateDistance(userLat, userLng, mask.latitude, mask.longitude)
            }))
            .filter(mask => mask.distance <= searchRadius)
            .sort((a, b) => a.distance - b.distance);
        
        res.json(nearbyMasks);
    } catch (err) {
        console.error('Error loading nearby masks:', err);
        res.status(500).json({ error: err.message });
    }
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
            message: 'Вы уже активировали эту маску! Ищите следующую.',
            activatedAt: existing.activatedAt
        });
    }
    
    // Создаём активацию
    const activation = db.saveActivation({
        userId,
        maskId: nearestMask.id,
        latitude: userLat,
        longitude: userLng,
        telegramData: telegramData || {}
    });
    
    res.json({
        success: true,
        message: `Поздравляем! Вы активировали маску "${nearestMask.name}"`,
        mask: {
            id: nearestMask.id,
            name: nearestMask.name,
            fullDescription: nearestMask.fullDescription,
            activationPhotoHash: nearestMask.activationPhotoHash,
            audioGuideHash: nearestMask.audioGuideHash,
            price: nearestMask.price,
            isAvailable: nearestMask.isAvailable
        },
        activation
    });
});

module.exports = router;