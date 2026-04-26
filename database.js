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
                    // Добавляем поле для подзаголовка
        try {
            await pool.query(`ALTER TABLE masks ADD COLUMN IF NOT EXISTS subtitle TEXT`);
            console.log('✅ Добавлено поле subtitle');
        } catch (err) {
            console.log('Поле subtitle уже существует или ошибка:', err.message);
        }
            
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
                latitude REAL,
                longitude REAL,
                address TEXT,
                "qrCode" TEXT UNIQUE,
                "photoHash" TEXT,
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

                // Убираем NOT NULL с полей latitude, longitude (если есть ограничения)
        try {
            await pool.query(`ALTER TABLE masks ALTER COLUMN latitude DROP NOT NULL`);
            await pool.query(`ALTER TABLE masks ALTER COLUMN longitude DROP NOT NULL`);
            console.log('✅ Убраны NOT NULL ограничения с latitude, longitude');
        } catch (err) {
            console.log('Ошибка при снятии NOT NULL:', err.message);
        }

                // Добавляем поле number, если его нет
        try {
            await pool.query(`ALTER TABLE masks ADD COLUMN IF NOT EXISTS number INTEGER`);
            console.log('✅ Поле number добавлено в таблицу masks');
        } catch (err) {
            console.log('Поле number уже существует или ошибка:', err.message);
        }
        
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
            ALTER TABLE masks ADD COLUMN IF NOT EXISTS number INTEGER
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

                        // Добавляем новые поля для текстов эпох и подзаголовка
        try {
            await pool.query(`ALTER TABLE masks ADD COLUMN IF NOT EXISTS present_text TEXT`);
            await pool.query(`ALTER TABLE masks ADD COLUMN IF NOT EXISTS ussr_text TEXT`);
            await pool.query(`ALTER TABLE masks ADD COLUMN IF NOT EXISTS past_text TEXT`);
            await pool.query(`ALTER TABLE masks ADD COLUMN IF NOT EXISTS subtitle TEXT`);
            console.log('✅ Добавлены поля present_text, ussr_text, past_text, subtitle');
        } catch (err) {
            console.log('Поля уже существуют или ошибка:', err.message);
        }

                // Добавляем поле isAvailable для маршрутов (если нет)
        try {
            await pool.query(`ALTER TABLE routes ADD COLUMN IF NOT EXISTS "isAvailable" INTEGER DEFAULT 0`);
            console.log('✅ Добавлено поле isAvailable для маршрутов');
        } catch (err) {
            console.log('Поле isAvailable уже существует:', err.message);
        }
        
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

initDatabase();

module.exports = pool;