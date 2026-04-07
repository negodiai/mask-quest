const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Путь к файлу базы данных
const dbPath = path.join(__dirname, 'data', 'quest.db');

// Создаём подключение
const db = new sqlite3.Database(dbPath);

// Инициализация таблиц
db.serialize(() => {
    // Таблица масок
    db.run(`
        CREATE TABLE IF NOT EXISTS masks (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            fullDescription TEXT,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            address TEXT,
            qrCode TEXT UNIQUE,
            photoHash TEXT,
            activationPhotoHash TEXT,
            audioGuideHash TEXT,
            priceAmount INTEGER,
            priceCurrency TEXT DEFAULT 'RUB',
            isAvailable INTEGER DEFAULT 1,
            yandexMapLink TEXT,
            googleMapLink TEXT,
            twoGisLink TEXT,
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Таблица маршрутов
    db.run(`
        CREATE TABLE IF NOT EXISTS routes (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            difficulty TEXT,
            durationMinutes INTEGER,
            distanceKm REAL,
            color TEXT,
            isActive INTEGER DEFAULT 1,
            centerLat REAL,
            centerLng REAL,
            zoom INTEGER DEFAULT 14,
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Таблица связи масок и маршрутов
    db.run(`
        CREATE TABLE IF NOT EXISTS route_masks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            routeId TEXT NOT NULL,
            maskId TEXT NOT NULL,
            "order" INTEGER DEFAULT 0,
            FOREIGN KEY (routeId) REFERENCES routes(id) ON DELETE CASCADE,
            FOREIGN KEY (maskId) REFERENCES masks(id) ON DELETE CASCADE,
            UNIQUE(routeId, maskId)
        )
    `);
    
    // Таблица активаций пользователей
    db.run(`
        CREATE TABLE IF NOT EXISTS user_activations (
            id TEXT PRIMARY KEY,
            userId TEXT NOT NULL,
            maskId TEXT NOT NULL,
            activatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
            latitude REAL,
            longitude REAL,
            telegramData TEXT,
            FOREIGN KEY (maskId) REFERENCES masks(id) ON DELETE CASCADE
        )
    `);
    
    // Таблица прогресса маршрутов
    db.run(`
        CREATE TABLE IF NOT EXISTS user_route_progress (
            id TEXT PRIMARY KEY,
            userId TEXT NOT NULL,
            routeId TEXT NOT NULL,
            completedAt TEXT,
            progressPercent INTEGER DEFAULT 0,
            masksActivated INTEGER DEFAULT 0,
            FOREIGN KEY (routeId) REFERENCES routes(id) ON DELETE CASCADE,
            UNIQUE(userId, routeId)
        )
    `);
    
    // Таблица для статистики (логирование действий)
    db.run(`
        CREATE TABLE IF NOT EXISTS admin_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            adminId TEXT NOT NULL,
            action TEXT NOT NULL,
            targetId TEXT,
            details TEXT,
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    console.log('✅ База данных инициализирована');
});

module.exports = db;