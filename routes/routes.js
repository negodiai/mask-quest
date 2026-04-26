const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/routes/list - список маршрутов с прогрессом
router.get('/list', async (req, res) => {
    const { userId } = req.query;
    
    try {
        // Получаем только опубликованные маршруты (isAvailable = 1)
        const routesResult = await db.query(`
            SELECT * FROM routes WHERE "isAvailable" = 1 ORDER BY name
        `);
        const routes = routesResult.rows;
        
        // Если нет userId, возвращаем просто маршруты без прогресса
        if (!userId) {
            return res.json(routes);
        }
        
        // Получаем активации пользователя
        const activationsResult = await db.query(`
            SELECT "maskId" FROM user_activations WHERE "userId" = $1
        `, [userId]);
        const activatedMaskIds = new Set(activationsResult.rows.map(r => r.maskId));
        
        // Получаем связи маршрутов и масок
        const routeMasksResult = await db.query(`SELECT * FROM route_masks`);
        const routeMasks = routeMasksResult.rows;
        
        // Для каждого маршрута считаем прогресс
        const routesWithProgress = [];
        
        for (const route of routes) {
            // Маски в этом маршруте
            const masksInRoute = routeMasks.filter(rm => rm.routeId === route.id);
            const totalMasks = masksInRoute.length;
            
            // Активированные маски в этом маршруте
            const activatedCount = masksInRoute.filter(rm => activatedMaskIds.has(rm.maskId)).length;
            
            const progressPercent = totalMasks > 0 ? Math.round((activatedCount / totalMasks) * 100) : 0;
            const isCompleted = activatedCount === totalMasks && totalMasks > 0;
            
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

// GET /api/routes/detail - детали маршрута с масками
router.get('/detail', async (req, res) => {
    const { id, userId } = req.query;
    
    if (!id) {
        return res.status(400).json({ error: 'Route ID required' });
    }
    
    try {
        // Получаем маршрут
        const routeResult = await db.query(`SELECT * FROM routes WHERE id = $1`, [id]);
        if (routeResult.rows.length === 0) {
            return res.status(404).json({ error: 'Route not found' });
        }
        const route = routeResult.rows[0];
        
        // Получаем маски маршрута
        const routeMasksResult = await db.query(`
            SELECT rm.*, m.name, m.description, m.latitude, m.longitude, m."photoHash"
            FROM route_masks rm
            JOIN masks m ON rm."maskId" = m.id
            WHERE rm."routeId" = $1
            ORDER BY rm."order" ASC
        `, [id]);
        
        // Получаем активации пользователя (если userId указан)
        let activatedMaskIds = new Set();
        if (userId) {
            const activationsResult = await db.query(`
                SELECT "maskId" FROM user_activations WHERE "userId" = $1
            `, [userId]);
            activatedMaskIds = new Set(activationsResult.rows.map(r => r.maskId));
        }
        
        const masks = routeMasksResult.rows.map(rm => ({
            id: rm.maskId,
            name: rm.name,
            description: rm.description,
            latitude: rm.latitude,
            longitude: rm.longitude,
            photoHash: rm.photoHash,
            order: rm.order,
            isActivated: activatedMaskIds.has(rm.maskId)
        }));
        
        const activatedCount = masks.filter(m => m.isActivated).length;
        
        res.json({
            ...route,
            masks,
            totalMasks: masks.length,
            activatedCount,
            progressPercent: masks.length > 0 ? Math.round((activatedCount / masks.length) * 100) : 0,
            isCompleted: activatedCount === masks.length && masks.length > 0
        });
    } catch (err) {
        console.error('Error in /routes/detail:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;