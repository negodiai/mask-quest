const express = require('express');
const router = express.Router();
const db = require('../database');
const { v4: uuidv4 } = require('uuid');

// POST /api/masks/activate-by-qr - активация маски по QR-коду (без геолокации)
router.post('/activate-by-qr', async (req, res) => {
    const { userId, maskId, telegramData } = req.body;
    
    console.log('=== АКТИВАЦИЯ ПО QR ===');
    console.log('userId:', userId);
    console.log('maskId:', maskId);
    
    if (!userId || !maskId) {
        return res.status(400).json({ 
            success: false, 
            message: 'Не хватает данных: userId и maskId обязательны' 
        });
    }
    
    try {
        // Находим маску по ID
        const maskResult = await db.query('SELECT * FROM masks WHERE id = $1', [maskId]);
        
        if (maskResult.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Маска с таким QR-кодом не найдена' 
            });
        }
        
        const mask = maskResult.rows[0];
        
        // Проверяем, не активирована ли уже
        const existingResult = await db.query(
            'SELECT * FROM user_activations WHERE "userId" = $1 AND "maskId" = $2',
            [userId, mask.id]
        );
        
        if (existingResult.rows.length > 0) {
            return res.json({
                success: false,
                message: 'Вы уже активировали эту маску! Ищите следующую.',
                activatedAt: existingResult.rows[0].activatedAt
            });
        }
        
        // Создаём активацию (геолокация не нужна, ставим null)
        const activationId = uuidv4();
        await db.query(`
            INSERT INTO user_activations (id, "userId", "maskId", latitude, longitude, "telegramData")
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [activationId, userId, mask.id, null, null, JSON.stringify(telegramData || {})]);
        
        // Обновляем прогресс маршрутов
        await updateRouteProgress(userId, mask.id, db);
        
        res.json({
            success: true,
            message: `Поздравляем! Вы активировали маску "${mask.name}"`,
            mask: {
                id: mask.id,
                name: mask.name,
                fullDescription: mask.fullDescription,
                activationPhotoHash: mask.activationPhotoHash,
                audioGuideHash: mask.audioGuideHash,
                price: { amount: mask.priceAmount, currency: mask.priceCurrency || 'RUB' },
                isAvailable: mask.isAvailable === 1
            },
            activation: { id: activationId }
        });
    } catch (error) {
        console.error('Activation error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Ошибка активации. Попробуйте позже.' 
        });
    }
});

// Функция обновления прогресса маршрутов
async function updateRouteProgress(userId, maskId, db) {
    try {
        // Получаем все маршруты, содержащие эту маску
        const routeMasksResult = await db.query(`
            SELECT "routeId" FROM route_masks WHERE "maskId" = $1
        `, [maskId]);
        
        for (const rm of routeMasksResult.rows) {
            const routeId = rm.routeId;
            
            // Получаем все маски маршрута
            const masksInRoute = await db.query(`
                SELECT "maskId" FROM route_masks WHERE "routeId" = $1
            `, [routeId]);
            
            // Получаем активированные маски пользователя в этом маршруте
            const activatedMasks = await db.query(`
                SELECT "maskId" FROM user_activations 
                WHERE "userId" = $1 AND "maskId" IN (${masksInRoute.rows.map((_, i) => `$${i + 2}`).join(',')})
            `, [userId, ...masksInRoute.rows.map(r => r.maskId)]);
            
            const totalMasks = masksInRoute.rows.length;
            const activatedCount = activatedMasks.rows.length;
            const progressPercent = totalMasks > 0 ? Math.round((activatedCount / totalMasks) * 100) : 0;
            const isCompleted = activatedCount === totalMasks && totalMasks > 0;
            
            // Обновляем или создаём прогресс
            await db.query(`
                INSERT INTO user_route_progress (id, "userId", "routeId", "progressPercent", "masksActivated", "completedAt")
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT ("userId", "routeId") DO UPDATE SET
                    "progressPercent" = EXCLUDED."progressPercent",
                    "masksActivated" = EXCLUDED."masksActivated",
                    "completedAt" = EXCLUDED."completedAt"
            `, [uuidv4(), userId, routeId, progressPercent, activatedCount, isCompleted ? new Date().toISOString() : null]);
        }
    } catch (err) {
        console.error('Error updating route progress:', err);
    }
}

module.exports = router;