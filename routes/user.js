const express = require('express');
const router = express.Router();
const db = require('../data/db');

// GET /api/user/progress - прогресс пользователя
router.get('/progress', (req, res) => {
    const { userId } = req.query;
    
    if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
    }
    
    const progress = db.getUserProgress(userId);
    res.json(progress);
});

// GET /api/user/activations - история активаций пользователя
router.get('/activations', (req, res) => {
    const { userId } = req.query;
    
    if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
    }
    
    const activations = db.getActivationsByUserId(userId);
    const allMasks = db.getAllMasks();
    
    const activationsWithDetails = activations.map(act => {
        const mask = allMasks.find(m => m.id === act.maskId);
        return {
            id: act.id,
            activatedAt: act.activatedAt,
            mask: mask ? {
                id: mask.id,
                name: mask.name,
                description: mask.description,
                fullDescription: mask.fullDescription,
                photoHash: mask.photoHash,
                activationPhotoHash: mask.activationPhotoHash,
                audioGuideHash: mask.audioGuideHash,
                price: mask.price,
                isAvailable: mask.isAvailable
            } : null
        };
    });
    
    res.json(activationsWithDetails);
});

module.exports = router;