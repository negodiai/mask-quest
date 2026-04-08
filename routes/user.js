const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/user/progress - прогресс пользователя
router.get('/progress', async (req, res) => {
    const { userId } = req.query;
    
    if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
    }
    
    try {
        // Количество активированных масок
        const activationsResult = await db.query(
            'SELECT COUNT(DISTINCT "maskId") as count FROM user_activations WHERE "userId" = $1',
            [userId]
        );
        const activatedMasks = parseInt(activationsResult.rows[0]?.count) || 0;
        
        // Общее количество масок
        const totalMasksResult = await db.query(
            'SELECT COUNT(*) as count FROM masks WHERE "isAvailable" = 1'
        );
        const totalMasks = parseInt(totalMasksResult.rows[0]?.count) || 0;
        
        // Количество пройденных маршрутов
        const completedRoutesResult = await db.query(
            'SELECT COUNT(*) as count FROM user_route_progress WHERE "userId" = $1 AND "completedAt" IS NOT NULL',
            [userId]
        );
        const completedRoutes = parseInt(completedRoutesResult.rows[0]?.count) || 0;
        
        // Общее количество маршрутов
        const totalRoutesResult = await db.query(
            'SELECT COUNT(*) as count FROM routes WHERE "isActive" = 1'
        );
        const totalRoutes = parseInt(totalRoutesResult.rows[0]?.count) || 0;
        
        res.json({
            activatedMasks,
            totalMasks,
            completedRoutes,
            totalRoutes
        });
    } catch (err) {
        console.error('Progress error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/user/activations - история активаций пользователя
router.get('/activations', async (req, res) => {
    const { userId } = req.query;
    
    console.log('=== /activations вызван ===');
    console.log('userId:', userId);
    
    if (!userId) {
        console.log('Ошибка: нет userId');
        return res.status(400).json({ error: 'User ID required' });
    }
    
    try {
        const result = await db.query(`
            SELECT ua.*, m.name, m.description, m."fullDescription", m."photoHash", 
                   m."activationPhotoHash", m."audioGuideHash", m."priceAmount", 
                   m."priceCurrency", m."isAvailable"
            FROM user_activations ua
            JOIN masks m ON ua."maskId" = m.id
            WHERE ua."userId" = $1
            ORDER BY ua."activatedAt" DESC
        `, [userId]);
        
        console.log('Найдено активаций:', result.rows.length);
        
        const activations = result.rows.map(row => ({
            id: row.id,
            activatedAt: row.activatedAt,
            mask: {
                id: row.maskId,
                name: row.name,
                description: row.description,
                fullDescription: row.fullDescription,
                photoHash: row.photoHash,
                activationPhotoHash: row.activationPhotoHash,
                audioGuideHash: row.audioGuideHash,
                price: { amount: row.priceAmount, currency: row.priceCurrency || 'RUB' },
                isAvailable: row.isAvailable === 1
            }
        }));
        
        res.json(activations);
    } catch (err) {
        console.error('Activations error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;