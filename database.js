const { Pool } = require('pg');

// Получаем URL базы данных из переменных окружения Railway
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error('❌ DATABASE_URL не найдена! Добавьте PostgreSQL базу данных в Railway');
}

const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl ? { rejectUnauthorized: false } : false
});

// Функция инициализации таблиц (будет вызвана позже)
async function initDatabase() {
    if (!databaseUrl) {
        console.log('⚠️ База данных не настроена, пропускаем инициализацию');
        return;
    }
    
    try {
        // Создание таблиц
        await pool.query(`
            CREATE TABLE IF NOT EXISTS masks (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                "fullDescription" TEXT,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                address TEXT,
                "qrCode" TEXT UNIQUE,
                "photoHash" TEXT,
                "photo2" TEXT,
                "photo3" TEXT,
                "activationPhotoHash" TEXT,
                "audioGuideHash" TEXT,
                "priceAmount" INTEGER,
                "priceCurrency" TEXT DEFAULT 'RUB',
                "isAvailable" INTEGER DEFAULT 1,
                "yandexMapLink" TEXT,
                "googleMapLink" TEXT,
                "twoGisLink" TEXT,
                "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS routes (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                difficulty TEXT,
                "durationMinutes" INTEGER,
                "distanceKm" REAL,
                color TEXT,
                "isActive" INTEGER DEFAULT 1,
                "centerLat" REAL,
                "centerLng" REAL,
                zoom INTEGER DEFAULT 14,
                "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS route_masks (
                id SERIAL PRIMARY KEY,
                "routeId" TEXT NOT NULL,
                "maskId" TEXT NOT NULL,
                "order" INTEGER DEFAULT 0,
                FOREIGN KEY ("routeId") REFERENCES routes(id) ON DELETE CASCADE,
                FOREIGN KEY ("maskId") REFERENCES masks(id) ON DELETE CASCADE,
                UNIQUE("routeId", "maskId")
            )
        `);
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_activations (
                id TEXT PRIMARY KEY,
                "userId" TEXT NOT NULL,
                "maskId" TEXT NOT NULL,
                "activatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                latitude REAL,
                longitude REAL,
                "telegramData" TEXT,
                FOREIGN KEY ("maskId") REFERENCES masks(id) ON DELETE CASCADE
            )
        `);
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_route_progress (
                id TEXT PRIMARY KEY,
                "userId" TEXT NOT NULL,
                "routeId" TEXT NOT NULL,
                "completedAt" TIMESTAMP,
                "progressPercent" INTEGER DEFAULT 0,
                "masksActivated" INTEGER DEFAULT 0,
                FOREIGN KEY ("routeId") REFERENCES routes(id) ON DELETE CASCADE,
                UNIQUE("userId", "routeId")
            )
        `);
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS admin_logs (
                id SERIAL PRIMARY KEY,
                "adminId" TEXT NOT NULL,
                action TEXT NOT NULL,
                "targetId" TEXT,
                details TEXT,
                "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        console.log('✅ База данных PostgreSQL инициализирована');
    } catch (error) {
        console.error('❌ Ошибка инициализации БД:', error.message);
    }
}

// Получить только опубликованные маски
async function getPublishedMasks() {
    const result = await pool.query('SELECT * FROM masks WHERE "isAvailable" = 1 ORDER BY name');
    return result.rows;
}

// Запускаем инициализацию (без top-level await)
initDatabase();

module.exports = pool;