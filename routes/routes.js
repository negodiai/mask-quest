const express = require('express');
const router = express.Router();
const db = require('../database');
const { v4: uuidv4 } = require('uuid');

// GET /api/routes/list - список маршрутов с прогрессом (только опубликованные)
router.get('/list', async (req, res) => {
    const { userId } = req.query;
    
    try {
        // Получаем только активные маршруты (isActive = 1)
        const routesResult = await db.query(`
            SELECT * FROM routes WHERE "isActive" = 1 ORDER BY name
        `);
        const routes = routesResult.rows;
        
        // Получаем все связи маршрутов с масками
        const routeMasksResult = await db.query('SELECT * FROM route_masks');
        const routeMasks = routeMasksResult.rows;
        
        // Если нет userId, возвращаем только маршруты без прогресса
        if (!userId) {
            const routesSimple = routes.map(route => ({
                ...route,
                totalMasks: routeMasks.filter(rm => rm.routeId === route.id).length,
                activatedCount: 0,
                progressPercent: 0,
                isCompleted: false
            }));
            return res.json(routesSimple);
        }
        
        // Получаем активации пользователя
        const activationsResult = await db.query(`
            SELECT "maskId" FROM user_activations WHERE "userId" = $1
        `, [userId]);
        const activatedMaskIds = new Set(activationsResult.rows.map(a => a.maskId));
        
        // Формируем маршруты с прогрессом
        const routesWithProgress = [];
        
        for (const route of routes) {
            const masksInRoute = routeMasks.filter(rm => rm.routeId === route.id);
            const totalMasks = masksInRoute.length;
            const activatedCount = masksInRoute.filter(rm => activatedMaskIds.has(rm.maskId)).length;
            const progressPercent = totalMasks > 0 ? Math.round((activatedCount / totalMasks) * 100) : 0;
            const isCompleted = (activatedCount === totalMasks && totalMasks > 0);
            
            // Обновляем прогресс в таблице user_route_progress
            if (userId) {
                const existingProgress = await db.query(`
                    SELECT * FROM user_route_progress WHERE "userId" = $1 AND "routeId" = $2
                `, [userId, route.id]);
                
                if (existingProgress.rows.length === 0) {
                    await db.query(`
                        INSERT INTO user_route_progress (id, "userId", "routeId", "progressPercent", "masksActivated")
                        VALUES ($1, $2, $3, $4, $5)
                    `, [uuidv4(), userId, route.id, progressPercent, activatedCount]);
                } else {
                    await db.query(`
                        UPDATE user_route_progress 
                        SET "progressPercent" = $1, "masksActivated" = $2,
                            "completedAt" = CASE WHEN $3 = true AND "completedAt" IS NULL THEN CURRENT_TIMESTAMP ELSE "completedAt" END
                        WHERE "userId" = $4 AND "routeId" = $5
                    `, [progressPercent, activatedCount, isCompleted, userId, route.id]);
                }
            }
            
            routesWithProgress.push({
                ...route,
                totalMasks,
                activatedCount,
                progressPercent,
                isCompleted
            });
        }
        
        res.json(routesWithProgress);
    } catch (err) {
        console.error('Error in /routes/list:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/routes/detail - детали маршрута
router.get('/detail', async (req, res) => {
    const { id, userId } = req.query;
    
    if (!id) {
        return res.status(400).json({ error: 'Route ID required' });
    }
    
    try {
        const routeResult = await db.query('SELECT * FROM routes WHERE id = $1', [id]);
        if (routeResult.rows.length === 0) {
            return res.status(404).json({ error: 'Route not found' });
        }
        const route = routeResult.rows[0];
        
        // Получаем маски маршрута
        const routeMasksResult = await db.query(`
            SELECT rm."order", rm."maskId", m.* 
            FROM route_masks rm
            JOIN masks m ON rm."maskId" = m.id
            WHERE rm."routeId" = $1
            ORDER BY rm."order" ASC
        `, [id]);
        
        // Получаем активации пользователя
        let activatedMaskIds = new Set();
        if (userId) {
            const activationsResult = await db.query(`
                SELECT "maskId" FROM user_activations WHERE "userId" = $1
            `, [userId]);
            activatedMaskIds = new Set(activationsResult.rows.map(a => a.maskId));
        }
        
        const masks = routeMasksResult.rows.map(mask => ({
            id: mask.id,
            name: mask.name,
            description: mask.description,
            latitude: mask.latitude,
            longitude: mask.longitude,
            photoHash: mask.photoHash,
            order: mask.order,
            isActivated: activatedMaskIds.has(mask.id)
        }));
        
        const activatedCount = masks.filter(m => m.isActivated).length;
        const progressPercent = masks.length > 0 ? Math.round((activatedCount / masks.length) * 100) : 0;
        
        res.json({
            ...route,
            masks,
            totalMasks: masks.length,
            activatedCount,
            progressPercent,
            isCompleted: activatedCount === masks.length && masks.length > 0
        });
    } catch (err) {
        console.error('Error in /routes/detail:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;