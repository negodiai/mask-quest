const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Импортируем наши маршруты (API)
const masksRoutes = require('./routes/masks');
const routesRoutes = require('./routes/routes');
const userRoutes = require('./routes/user');
const seedRoutes = require('./routes/seed');

const db = require('./database');

const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

// Подключаем PostgreSQL
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Настройки сервера
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Подключаем наши API
app.use('/api/masks', masksRoutes);
app.use('/api/routes', routesRoutes);
app.use('/api/user', userRoutes);
app.use('/api/seed', seedRoutes);

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

process.on('unhandledRejection', (err) {
    console.error('Unhandled Rejection:', err);
});