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

// Функция для выполнения миграций
async function runMigrations() {
    try {
        // Проверяем и преобразуем поле activatedAt из TEXT в TIMESTAMP
        const columnCheck = await pool.query(`
            SELECT data_type 
            FROM information_schema.columns 
            WHERE table_name = 'user_activations' AND column_name = 'activatedAt'
        `);
        
        if (columnCheck.rows.length > 0 && columnCheck.rows[0].data_type === 'text') {
            console.log('🔄 Миграция: преобразуем activatedAt из TEXT в TIMESTAMP');
            
            // Создаем временную колонку с типом TIMESTAMP
            await pool.query(`ALTER TABLE user_activations ADD COLUMN IF NOT EXISTS "activatedAt_new" TIMESTAMP`);
            
            // Копируем данные с преобразованием
            await pool.query(`
                UPDATE user_activations 
                SET "activatedAt_new" = TO_TIMESTAMP("activatedAt", 'YYYY-MM-DD HH24:MI:SS') 
                WHERE "activatedAt" IS NOT NULL AND "activatedAt" != ''
            `);
            
            // Удаляем старую колонку и переименовываем новую
            await pool.query(`ALTER TABLE user_activations DROP COLUMN "activatedAt"`);
            await pool.query(`ALTER TABLE user_activations RENAME COLUMN "activatedAt_new" TO "activatedAt"`);
            
            console.log('✅ Миграция activatedAt завершена');
        }
        
        // Аналогично для completedAt в user_route_progress
        const columnCheck2 = await pool.query(`
            SELECT data_type 
            FROM information_schema.columns 
            WHERE table_name = 'user_route_progress' AND column_name = 'completedAt'
        `);
        
        if (columnCheck2.rows.length > 0 && columnCheck2.rows[0].data_type === 'text') {
            console.log('🔄 Миграция: преобразуем completedAt из TEXT в TIMESTAMP');
            
            await pool.query(`ALTER TABLE user_route_progress ADD COLUMN IF NOT EXISTS "completedAt_new" TIMESTAMP`);
            await pool.query(`
                UPDATE user_route_progress 
                SET "completedAt_new" = TO_TIMESTAMP("completedAt", 'YYYY-MM-DD HH24:MI:SS') 
                WHERE "completedAt" IS NOT NULL AND "completedAt" != ''
            `);
            await pool.query(`ALTER TABLE user_route_progress DROP COLUMN "completedAt"`);
            await pool.query(`ALTER TABLE user_route_progress RENAME COLUMN "completedAt_new" TO "completedAt"`);
            
            console.log('✅ Миграция completedAt завершена');
        }
    } catch (err) {
        console.log('Миграция не требуется или ошибка:', err.message);
    }
}

// Инициализация таблиц
async function initDatabase() {
    if (!databaseUrl) {
        console.log('⚠️ База данных не настроена, пропускаем инициализацию');
        return;
    }
    
    try {
        // Создаём таблицы с правильными типами
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
        
        // Запускаем миграции для преобразования существующих данных
        await runMigrations();
        
        console.log('✅ База данных PostgreSQL инициализирована');
    } catch (error) {
        console.error('❌ Ошибка инициализации БД:', error.message);
    }
}

        // Миграция: добавляем поля photo2 и photo3, если их нет
        try {
            await pool.query(`ALTER TABLE masks ADD COLUMN IF NOT EXISTS "photo2" TEXT`);
            await pool.query(`ALTER TABLE masks ADD COLUMN IF NOT EXISTS "photo3" TEXT`);
            console.log('✅ Поля photo2 и photo3 добавлены');
        } catch (err) {
            console.log('Миграция photo2/photo3 не требуется:', err.message);
        }

// Получить только опубликованные маски
async function getPublishedMasks() {
    const result = await pool.query('SELECT * FROM masks WHERE "isAvailable" = 1 ORDER BY name');
    return result.rows;
}

initDatabase();

module.exports = pool;