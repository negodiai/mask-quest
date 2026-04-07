const express = require('express');
const router = express.Router();
const db = require('../data/db');

// GET /api/routes/list - список маршрутов с прогрессом
router.get('/list', (req, res) => {
    const { userId } = req.query;
    const routes = db.getAllRoutes();
    
    if (!userId) {
        return res.json(routes);
    }
    
    // Получаем все активации пользователя
    const activations = db.getActivationsByUserId(userId);
    const routeMasks = db.getAllRouteMasks();
    
    const routesWithProgress = routes.map(route => {
        const masksInRoute = routeMasks.filter(rm => rm.routeId === route.id);
        const totalMasks = masksInRoute.length;
        const activatedCount = masksInRoute.filter(rm => 
            activations.some(a => a.maskId === rm.maskId)
        ).length;
        
        return {
            ...route,
            totalMasks,
            activatedCount,
            progressPercent: totalMasks > 0 ? Math.round((activatedCount / totalMasks) * 100) : 0,
            isCompleted: activatedCount === totalMasks && totalMasks > 0
        };
    });
    
    res.json(routesWithProgress);
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