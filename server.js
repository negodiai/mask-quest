const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Подключаем базу данных PostgreSQL
const db = require('./database');

// Импортируем наши маршруты (API)
const masksRoutes = require('./routes/masks');
const activateByQrRoutes = require('./routes/activate-by-qr');
const routesRoutes = require('./routes/routes');
const userRoutes = require('./routes/user');
const seedRoutes = require('./routes/seed');
const redirectRoutes = require('./routes/redirect');
const adminRoutes = require('./routes/admin');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Настройка хранения файлов
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'public', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB лимит

const app = express();
const PORT = process.env.PORT || 3000;

// Настройки сервера
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Подключаем наши API
app.use('/api/masks', masksRoutes);
app.use('/api/masks', activateByQrRoutes);
app.use('/api/routes', routesRoutes);
app.use('/api/user', userRoutes);
app.use('/api/seed', seedRoutes);
app.use('/scan', redirectRoutes);
app.use('/api/admin', adminRoutes);

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Запускаем сервер
app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});

// Обработка ошибок базы данных
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
});