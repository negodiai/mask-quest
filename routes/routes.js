const express = require('express');
const router = express.Router();
const db = require('../data/db');

// GET /api/routes/list - список маршрутов с прогрессом
router.get('/list', async (req, res) => {
    const { userId } = req.query;
    
    try {
        const routesResult = await db.query('SELECT * FROM routes WHERE "isActive" = 1 ORDER BY name');
        const routes = routesResult.rows;
        
        if (!userId) {
            return res.json(routes);
        }
        
        // Получаем активации пользователя
        const activationsResult = await db.query('SELECT "maskId" FROM user_activations WHERE "userId" = $1', [userId]);
        const activatedMaskIds = new Set(activationsResult.rows.map(r => r.maskId));
        
        // Получаем связи маршрутов и масок
        const routeMasksResult = await db.query('SELECT "routeId", "maskId" FROM route_masks');
        const routeMasks = routeMasksResult.rows;
        
        const routesWithProgress = await Promise.all(routes.map(async (route) => {
            const masksInRoute = routeMasks.filter(rm => rm.routeId === route.id);
            const totalMasks = masksInRoute.length;
            const activatedCount = masksInRoute.filter(rm => activatedMaskIds.has(rm.maskId)).length;
            const progressPercent = totalMasks > 0 ? Math.round((activatedCount / totalMasks) * 100) : 0;
            const isCompleted = activatedCount === totalMasks && totalMasks > 0;
            
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