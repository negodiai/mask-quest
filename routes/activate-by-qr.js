const express = require('express');
const router = express.Router();
const db = require('../database');
const { v4: uuidv4 } = require('uuid');

// POST /api/masks/activate-by-qr - активация маски по QR-коду
router.post('/activate-by-qr', async (req, res) => {
    const { userId, maskId, telegramData } = req.body;
    
    if (!userId || !maskId) {
        return res.status(400).json({ 
            success: false, 
            message: 'Не хватает данных: userId и maskId обязательны' 
        });
    }
    
    try {
        // Находим маску по ID из QR-кода
        const maskResult = await db.query('SELECT * FROM masks WHERE id = $1 OR "qrCode" = $1', [maskId, maskId]);
        
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
        
        // Создаём активацию
        const activationId = uuidv4();
        await db.query(`
            INSERT INTO user_activations (id, "userId", "maskId", latitude, longitude, "telegramData")
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [activationId, userId, mask.id, null, null, JSON.stringify(telegramData || {})]);
        
        // Обновляем прогресс маршрутов (опционально)
        await updateRouteProgress(userId, mask.id);
        
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
            }
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
async function updateRouteProgress(userId, maskId) {
    try {
        // Получаем все маршруты, содержащие эту маску
        const routesResult = await db.query(`
            SELECT r.id, r.name, COUNT(rm."maskId") as total_masks
            FROM routes r
            JOIN route_masks rm ON r.id = rm."routeId"
            WHERE rm."maskId" = $1 AND r."isActive" = 1
            GROUP BY r.id
        `, [maskId]);
        
        for (const route of routesResult.rows) {
            // Получаем количество активированных масок в этом маршруте
            const progressResult = await db.query(`
                SELECT COUNT(*) as activated
                FROM user_activations ua
                JOIN route_masks rm ON ua."maskId" = rm."maskId"
                WHERE ua."userId" = $1 AND rm."routeId" = $2
            `, [userId, route.id]);
            
            const activatedCount = parseInt(progressResult.rows[0]?.activated) || 0;
            const totalMasks = parseInt(route.total_masks);
            const progressPercent = totalMasks > 0 ? Math.round((activatedCount / totalMasks) * 100) : 0;
            const isCompleted = activatedCount === totalMasks && totalMasks > 0;
            
            // Обновляем или создаём прогресс
            const existingProgress = await db.query(
                'SELECT * FROM user_route_progress WHERE "userId" = $1 AND "routeId" = $2',
                [userId, route.id]
            );
            
            if (existingProgress.rows.length > 0) {
                await db.query(`
                    UPDATE user_route_progress 
                    SET "progressPercent" = $1, "masksActivated" = $2, 
                        "completedAt" = CASE WHEN $3 THEN CURRENT_TIMESTAMP ELSE "completedAt" END
                    WHERE "userId" = $4 AND "routeId" = $5
                `, [progressPercent, activatedCount, isCompleted, userId, route.id]);
            } else {
                const progressId = uuidv4();
                await db.query(`
                    INSERT INTO user_route_progress (id, "userId", "routeId", "progressPercent", "masksActivated", "completedAt")
                    VALUES ($1, $2, $3, $4, $5, $6)
                `, [progressId, userId, route.id, progressPercent, activatedCount, isCompleted ? new Date().toISOString() : null]);
            }
        }
    } catch (err) {
        console.error('Error updating route progress:', err);
    }
}

module.exports = router;