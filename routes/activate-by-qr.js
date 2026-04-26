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
                message: 'Вы уже активировали эту маску!',
                activatedAt: existingResult.rows[0].activatedAt
            });
        }
        
        // Создаём активацию
            const activationId = uuidv4();
        const now = new Date().toISOString();
        await db.query(`
            INSERT INTO user_activations (id, "userId", "maskId", latitude, longitude, "telegramData", "activatedAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [activationId, userId, mask.id, null, null, JSON.stringify(telegramData || {}), now]);
        
        // Обновляем прогресс маршрутов
        await updateUserRouteProgress(userId);
        
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

module.exports = router;