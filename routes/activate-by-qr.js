const express = require('express');
const router = express.Router();
const db = require('../database');
const { v4: uuidv4 } = require('uuid');

// POST /api/masks/activate-by-qr - активация маски по QR-коду
router.post('/activate-by-qr', async (req, res) => {
    const { userId, qrCode, telegramData } = req.body;
    
    console.log('=== АКТИВАЦИЯ ПО QR ===');
    console.log('userId:', userId);
    console.log('qrCode:', qrCode);
    
    if (!userId || !qrCode) {
        return res.status(400).json({ 
            success: false, 
            message: 'Не хватает данных: userId и qrCode обязательны' 
        });
    }
    
    try {
        // Ищем маску по QR-коду
        const maskResult = await db.query(
            'SELECT * FROM masks WHERE "qrCode" = $1 AND "isAvailable" = 1',
            [qrCode]
        );
        
        if (maskResult.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Маска с таким QR-кодом не найдена или ещё не опубликована' 
            });
        }
        
        const mask = maskResult.rows[0];
        
        // Проверяем, не активирована ли уже эта маска пользователем
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
            INSERT INTO user_activations (id, "userId", "maskId", "telegramData")
            VALUES ($1, $2, $3, $4)
        `, [activationId, userId, mask.id, JSON.stringify(telegramData || {})]);
        
        // Обновляем прогресс маршрутов (если нужно)
        // Это можно добавить позже
        
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

module.exports = router;