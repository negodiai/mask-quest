const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

// Создаём папку для загрузок, если её нет
const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Настройка хранилища для multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueName = uuidv4() + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Только изображения!'), false);
        }
    }
});

// Загрузка фото для маски
router.post('/mask-photo/:maskId', upload.single('photo'), async (req, res) => {
    const { maskId } = req.params;
    
    if (!req.file) {
        return res.status(400).json({ error: 'Файл не загружен' });
    }
    
    const photoUrl = `/uploads/${req.file.filename}`;
    
    try {
        await db.query('UPDATE masks SET "photoHash" = $1 WHERE id = $2', [photoUrl, maskId]);
        res.json({ success: true, photoUrl });
    } catch (err) {
        console.error('Save photo error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;