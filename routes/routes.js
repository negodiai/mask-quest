const express = require('express');
const router = express.Router();
const db = require('../data/db');

// GET /api/routes/list - список маршрутов с прогрессом
// GET /api/routes/list - список маршрутов с прогрессом (только опубликованные)
router.get('/list', async (req, res) => {
    const { userId } = req.query;
    
    try {
        // Возвращаем только активные маршруты (isActive = 1)
        const result = await db.query(`
            SELECT * FROM routes WHERE "isActive" = 1 ORDER BY name
        `);
        const routes = result.rows;
        
        if (!userId) {
            return res.json(routes);
        }
        
        // Получаем активации пользователя
        const activations = await db.query(`
            SELECT "maskId" FROM user_activations WHERE "userId" = $1
        `, [userId]);
        const activatedMaskIds = new Set(activations.rows.map(a => a.maskId));
        
        // Получаем связи маршрутов с масками
        const routeMasksResult = await db.query('SELECT * FROM route_masks');
        const routeMasks = routeMasksResult.rows;
        
        const routesWithProgress = await Promise.all(routes.map(async (route) => {
            const masksInRoute = routeMasks.filter(rm => rm.routeId === route.id);
            const totalMasks = masksInRoute.length;
            const activatedCount = masksInRoute.filter(rm => activatedMaskIds.has(rm.maskId)).length;
            const progressPercent = totalMasks > 0 ? Math.round((activatedCount / totalMasks) * 100) : 0;
            
            // Проверяем, пройден ли маршрут
            let isCompleted = false;
            if (activatedCount === totalMasks && totalMasks > 0) {
                isCompleted = true;
                // Обновляем прогресс в таблице user_route_progress
                await db.query(`
                    INSERT INTO user_route_progress (id, "userId", "routeId", "completedAt", "progressPercent", "masksActivated")
                    VALUES (uuid_generate_v4(), $1, $2, CURRENT_TIMESTAMP, $3, $4)
                    ON CONFLICT ("userId", "routeId") DO UPDATE SET
                        "completedAt" = CASE WHEN EXCLUDED."progressPercent" = 100 THEN CURRENT_TIMESTAMP ELSE user_route_progress."completedAt" END,
                        "progressPercent" = EXCLUDED."progressPercent",
                        "masksActivated" = EXCLUDED."masksActivated"
                `, [userId, route.id, progressPercent, activatedCount]);
            }
            
            return {
                ...route,
                totalMasks,
                activatedCount,
                progressPercent,
                isCompleted
            };
        }));
        
        res.json(routesWithProgress);
    } catch (err) {
        console.error('Error in /routes/list:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/routes/detail - детали маршрута
router.get('/detail', (req, res) => {
    const { id, userId } = req.query;
    
    if (!id) {
        return res.status(400).json({ error: 'Route ID required' });
    }
    
    const route = db.getRouteById(id);
    if (!route) {
        return res.status(404).json({ error: 'Route not found' });
    }
    
    const routeMasks = db.getRouteMasksByRouteId(id);
    const allMasks = db.getAllMasks();
    const activations = userId ? db.getActivationsByUserId(userId) : [];
    
    const masks = routeMasks.map(rm => {
        const mask = allMasks.find(m => m.id === rm.maskId);
        if (!mask) return null;
        
        return {
            id: mask.id,
            name: mask.name,
            description: mask.description,
            latitude: mask.latitude,
            longitude: mask.longitude,
            photoHash: mask.photoHash,
            order: rm.order,
            isActivated: activations.some(a => a.maskId === mask.id)
        };
    }).filter(Boolean);
    
    const activatedCount = masks.filter(m => m.isActivated).length;
    
    res.json({
        ...route,
        masks,
        totalMasks: masks.length,
        activatedCount,
        progressPercent: masks.length > 0 ? Math.round((activatedCount / masks.length) * 100) : 0,
        isCompleted: activatedCount === masks.length && masks.length > 0
    });
});

module.exports = router;