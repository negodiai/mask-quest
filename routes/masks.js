const express = require('express');
const router = express.Router();
const db = require('../database');
const { v4: uuidv4 } = require('uuid');

// Функция обновления прогресса маршрутов для пользователя
async function updateUserRouteProgress(userId) {
    try {
        const routesResult = await db.query('SELECT id FROM routes WHERE "isActive" = 1');
        const routes = routesResult.rows;
        
        const activationsResult = await db.query(
            'SELECT "maskId" FROM user_activations WHERE "userId" = $1',
            [userId]
        );
        const activatedMaskIds = new Set(activationsResult.rows.map(r => r.maskId));
        
        const routeMasksResult = await db.query('SELECT * FROM route_masks');
        const routeMasks = routeMasksResult.rows;
        
        for (const route of routes) {
            const masksInRoute = routeMasks.filter(rm => rm.routeId === route.id);
            const totalMasks = masksInRoute.length;
            const activatedCount = masksInRoute.filter(rm => activatedMaskIds.has(rm.maskId)).length;
            
            const progressPercent = totalMasks > 0 ? Math.round((activatedCount / totalMasks) * 100) : 0;
            const isCompleted = activatedCount === totalMasks && totalMasks > 0;
            
            const existingResult = await db.query(
                'SELECT * FROM user_route_progress WHERE "userId" = $1 AND "routeId" = $2',
                [userId, route.id]
            );
            
            if (existingResult.rows.length > 0) {
                await db.query(`
                    UPDATE user_route_progress 
                    SET "progressPercent" = $1, "masksActivated" = $2, "completedAt" = $3
                    WHERE "userId" = $4 AND "routeId" = $5
                `, [progressPercent, activatedCount, isCompleted ? new Date().toISOString() : null, userId, route.id]);
            } else if (activatedCount > 0) {
                await db.query(`
                    INSERT INTO user_route_progress (id, "userId", "routeId", "progressPercent", "masksActivated", "completedAt")
                    VALUES ($1, $2, $3, $4, $5, $6)
                `, [uuidv4(), userId, route.id, progressPercent, activatedCount, isCompleted ? new Date().toISOString() : null]);
            }
        }
        
        console.log(`Прогресс маршрутов обновлён для пользователя ${userId}`);
    } catch (err) {
        console.error('Ошибка обновления прогресса маршрутов:', err);
    }
}

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
            number: mask.number,
            name: mask.name,
            description: mask.description,
            fullDescription: mask.fullDescription,
            photoHash: mask.photoHash,
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

// POST /api/masks/activate-by-qr - активация маски по QR-коду (номеру маски)
router.post('/activate-by-qr', async (req, res) => {
    const { userId, maskId, telegramData } = req.body;
    
    if (!userId || !maskId) {
        return res.status(400).json({ 
            success: false, 
            message: 'Не хватает данных: userId и maskId обязательны' 
        });
    }
    
    try {
        const maskResult = await db.query('SELECT * FROM masks WHERE id = $1', [maskId]);
        
        if (maskResult.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Маска с таким QR-кодом не найдена' 
            });
        }
        
        const mask = maskResult.rows[0];
        
        const existingResult = await db.query(
            'SELECT * FROM user_activations WHERE "userId" = $1 AND "maskId" = $2',
            [userId, mask.id]
        );
        
        if (existingResult.rows.length > 0) {
            return res.json({
                success: false,
                message: 'Вы уже активировали эту маску',
                activatedAt: existingResult.rows[0].activatedAt
            });
        }
        
        const activationId = uuidv4();
        const now = new Date().toISOString();
        await db.query(`
            INSERT INTO user_activations (id, "userId", "maskId", latitude, longitude, "telegramData", "activatedAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [activationId, userId, mask.id, null, null, JSON.stringify(telegramData || {}), now]);
        
        await updateUserRouteProgress(userId);
        
        res.json({
            success: true,
            message: `Маска "${mask.name}" активирована!`,
            mask: {
                id: mask.id,
                number: mask.number,
                name: mask.name,
                fullDescription: mask.fullDescription,
                activationPhotoHash: mask.activationPhotoHash,
                audioGuideHash: mask.audioGuideHash,
                price: { amount: mask.priceAmount, currency: mask.priceCurrency || 'RUB' },
                isAvailable: mask.isAvailable === 1
            }
        });
    } catch (error) {
        console.error('Activation error:', error);
        res.status(500).json({ 
            success: false, 
            message: '❌ Ошибка активации. Попробуйте позже.' 
        });
    }
});

module.exports = router;