const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Настройка хранения файлов
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../public/uploads');
        // Создаём папку, если её нет
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

// Фильтр для проверки типа файла
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
        cb(null, true);
    } else {
        cb(new Error('Только изображения!'));
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB лимит
});

// Загрузка нескольких фото для маски
router.post('/mask-photos/:maskId', upload.array('photos', 3), async (req, res) => {
    try {
        const { maskId } = req.params;
        
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'Нет загруженных файлов' });
        }
        
        const photoUrls = req.files.map(file => `/uploads/${file.filename}`);
        
        // Сохраняем фото в базе данных
        const db = require('../database');
        
        // Получаем текущие фото маски
        const maskResult = await db.query('SELECT "photoHash", "photo2", "photo3" FROM masks WHERE id = $1', [maskId]);
        
        if (maskResult.rows.length === 0) {
            return res.status(404).json({ error: 'Маска не найдена' });
        }
        
        // Обновляем фото (первое фото - photoHash, остальные - photo2, photo3)
        const updateData = {
            photoHash: photoUrls[0] || maskResult.rows[0].photoHash,
            photo2: photoUrls[1] || null,
            photo3: photoUrls[2] || null
        };
        
        await db.query(`
            UPDATE masks 
            SET "photoHash" = $1, "photo2" = $2, "photo3" = $3
            WHERE id = $4
        `, [updateData.photoHash, updateData.photo2, updateData.photo3, maskId]);
        
        res.json({ 
            success: true, 
            photos: photoUrls,
            message: 'Фото загружены успешно'
        });
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Получить фото маски
router.get('/mask-photos/:maskId', async (req, res) => {
    try {
        const { maskId } = req.params;
        const db = require('../database');
        
        const result = await db.query('SELECT "photoHash", "photo2", "photo3" FROM masks WHERE id = $1', [maskId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Маска не найдена' });
        }
        
        const photos = [
            result.rows[0].photoHash,
            result.rows[0].photo2,
            result.rows[0].photo3
        ].filter(p => p);
        
        res.json({ photos });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;