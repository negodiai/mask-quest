const { Pool } = require('pg');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error('❌ DATABASE_URL не найдена! Добавьте PostgreSQL базу данных в Railway');
}

const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl ? { rejectUnauthorized: false } : false
});

// Функция для вставки маски
async function insertMask(mask) {
    await pool.query(`
        INSERT INTO masks (id, name, description, "fullDescription", latitude, longitude, address, "qrCode", "priceAmount", "isAvailable", "yandexMapLink")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO NOTHING
    `, [mask.id, mask.name, mask.description, mask.fullDescription, mask.latitude, mask.longitude, mask.address, mask.qrCode, mask.priceAmount, mask.isAvailable, mask.yandexMapLink]);
}

// Функция для вставки маршрута
async function insertRoute(route) {
    await pool.query(`
        INSERT INTO routes (id, name, description, difficulty, "durationMinutes", "distanceKm", color, "centerLat", "centerLng", zoom, "isActive")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO NOTHING
    `, [route.id, route.name, route.description, route.difficulty, route.durationMinutes, route.distanceKm, route.color, route.centerLat, route.centerLng, route.zoom, route.isActive]);
}

// Функция для вставки связи маски с маршрутом
async function insertRouteMask(routeId, maskId, order) {
    await pool.query(`
        INSERT INTO route_masks ("routeId", "maskId", "order")
        VALUES ($1, $2, $3)
        ON CONFLICT ("routeId", "maskId") DO NOTHING
    `, [routeId, maskId, order]);
}

// Данные для Калининграда (ваши 10 локаций)
const kaliningradMasks = [
    { id: "mask_1", name: "Берёзовая", description: "Уютная улица в центре Калининграда", fullDescription: "Уютная улица в центре Калининграда. Это одна из уникальных масок туристического квеста 'НЕГОДЯЙ'.", latitude: 54.679629, longitude: 20.463649, address: "ул. Берёзовая", qrCode: "MASK_KGD_1", priceAmount: 15000, isAvailable: 1, yandexMapLink: "https://yandex.ru/maps/?pt=20.463649,54.679629&z=18" },
    { id: "mask_2", name: "ВБ наш", description: "Торговая точка у Березовой", fullDescription: "Торговая точка у Березовой. Это одна из уникальных масок туристического квеста 'НЕГОДЯЙ'.", latitude: 54.680082, longitude: 20.466036, address: "ул. Березовая, у магазина ВБ", qrCode: "MASK_KGD_2", priceAmount: 15000, isAvailable: 1, yandexMapLink: "https://yandex.ru/maps/?pt=20.466036,54.680082&z=18" },
    { id: "mask_3", name: "Вход спар", description: "Вход в торговый центр СПАР", fullDescription: "Вход в торговый центр СПАР. Это одна из уникальных масок туристического квеста 'НЕГОДЯЙ'.", latitude: 54.681311, longitude: 20.468169, address: "ул. Березовая, вход в СПАР", qrCode: "MASK_KGD_3", priceAmount: 15000, isAvailable: 1, yandexMapLink: "https://yandex.ru/maps/?pt=20.468169,54.681311&z=18" },
    { id: "mask_4", name: "Почта", description: "Отделение почты России", fullDescription: "Отделение почты России. Это одна из уникальных масок туристического квеста 'НЕГОДЯЙ'.", latitude: 54.681408, longitude: 20.473440, address: "ул. Березовая, почтовое отделение", qrCode: "MASK_KGD_4", priceAmount: 15000, isAvailable: 1, yandexMapLink: "https://yandex.ru/maps/?pt=20.473440,54.681408&z=18" },
    { id: "mask_5", name: "Цветы Голландии", description: "Магазин цветов", fullDescription: "Магазин цветов. Это одна из уникальных масок туристического квеста 'НЕГОДЯЙ'.", latitude: 54.681312, longitude: 20.476823, address: "ул. Березовая, Цветы Голландии", qrCode: "MASK_KGD_5", priceAmount: 15000, isAvailable: 1, yandexMapLink: "https://yandex.ru/maps/?pt=20.476823,54.681312&z=18" },
    { id: "mask_6", name: "Калитка церковь", description: "Калитка у церкви", fullDescription: "Калитка у церкви. Это одна из уникальных масок туристического квеста 'НЕГОДЯЙ'.", latitude: 54.681478, longitude: 20.480457, address: "ул. Березовая, у церкви", qrCode: "MASK_KGD_6", priceAmount: 15000, isAvailable: 1, yandexMapLink: "https://yandex.ru/maps/?pt=20.480457,54.681478&z=18" },
    { id: "mask_7", name: "Вход киноленд", description: "Вход в кинотеатр Киноленд", fullDescription: "Вход в кинотеатр Киноленд. Это одна из уникальных масок туристического квеста 'НЕГОДЯЙ'.", latitude: 54.681653, longitude: 20.482549, address: "ул. Березовая, вход в Киноленд", qrCode: "MASK_KGD_7", priceAmount: 15000, isAvailable: 1, yandexMapLink: "https://yandex.ru/maps/?pt=20.482549,54.681653&z=18" },
    { id: "mask_8", name: "Кофейня на летнем", description: "Уютная кофейня на Летнем озере", fullDescription: "Уютная кофейня на Летнем озере. Это одна из уникальных масок туристического квеста 'НЕГОДЯЙ'.", latitude: 54.677289, longitude: 20.486619, address: "ул. Березовая, кофейня на Летнем", qrCode: "MASK_KGD_8", priceAmount: 15000, isAvailable: 1, yandexMapLink: "https://yandex.ru/maps/?pt=20.486619,54.677289&z=18" },
    { id: "mask_9", name: "Мост на летнем", description: "Мост через Летнее озеро", fullDescription: "Мост через Летнее озеро. Это одна из уникальных масок туристического квеста 'НЕГОДЯЙ'.", latitude: 54.676579, longitude: 20.489302, address: "ул. Березовая, мост на Летнем", qrCode: "MASK_KGD_9", priceAmount: 15000, isAvailable: 1, yandexMapLink: "https://yandex.ru/maps/?pt=20.489302,54.676579&z=18" },
    { id: "mask_10", name: "Еще кофейня летнее", description: "Еще одна кофейня у Летнего озера", fullDescription: "Еще одна кофейня у Летнего озера. Это одна из уникальных масок туристического квеста 'НЕГОДЯЙ'.", latitude: 54.675016, longitude: 20.486887, address: "ул. Березовая, кофейня у Летнего озера", qrCode: "MASK_KGD_10", priceAmount: 15000, isAvailable: 1, yandexMapLink: "https://yandex.ru/maps/?pt=20.486887,54.675016&z=18" }
];

const routes = [
    { id: "route_1", name: "Березовая улица", description: "Прогулка по главной улице района", difficulty: "easy", durationMinutes: 45, distanceKm: 1.2, color: "#3B82F6", centerLat: 54.679629, centerLng: 20.463649, zoom: 16, isActive: 1 },
    { id: "route_2", name: "Летнее озеро", description: "Прогулка вокруг Летнего озера", difficulty: "easy", durationMinutes: 60, distanceKm: 1.5, color: "#10B981", centerLat: 54.677289, centerLng: 20.486619, zoom: 16, isActive: 1 },
    { id: "route_3", name: "Вокруг района", description: "Полный маршрут по всем локациям района", difficulty: "medium", durationMinutes: 90, distanceKm: 2.5, color: "#8B5CF6", centerLat: 54.679629, centerLng: 20.463649, zoom: 15, isActive: 1 }
];

const routeMasks = [
    // Маршрут 1: маски 1-5
    { routeId: "route_1", maskId: "mask_1", order: 1 },
    { routeId: "route_1", maskId: "mask_2", order: 2 },
    { routeId: "route_1", maskId: "mask_3", order: 3 },
    { routeId: "route_1", maskId: "mask_4", order: 4 },
    { routeId: "route_1", maskId: "mask_5", order: 5 },
    // Маршрут 2: маски 6-8
    { routeId: "route_2", maskId: "mask_6", order: 1 },
    { routeId: "route_2", maskId: "mask_7", order: 2 },
    { routeId: "route_2", maskId: "mask_8", order: 3 },
    // Маршрут 3: все маски
    { routeId: "route_3", maskId: "mask_1", order: 1 },
    { routeId: "route_3", maskId: "mask_2", order: 2 },
    { routeId: "route_3", maskId: "mask_3", order: 3 },
    { routeId: "route_3", maskId: "mask_4", order: 4 },
    { routeId: "route_3", maskId: "mask_5", order: 5 },
    { routeId: "route_3", maskId: "mask_6", order: 6 },
    { routeId: "route_3", maskId: "mask_7", order: 7 },
    { routeId: "route_3", maskId: "mask_8", order: 8 },
    { routeId: "route_3", maskId: "mask_9", order: 9 },
    { routeId: "route_3", maskId: "mask_10", order: 10 }
];

// Инициализация таблиц и заполнение данными
async function initDatabase() {
    if (!databaseUrl) {
        console.log('⚠️ База данных не настроена, пропускаем инициализацию');
        return;
    }
    
    try {
        // Создание таблиц (как было ранее)
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
                "activationPhotoHash" TEXT,
                "audioGuideHash" TEXT,
                "priceAmount" INTEGER,
                "priceCurrency" TEXT DEFAULT 'RUB',
                "isAvailable" INTEGER DEFAULT 1,
                "yandexMapLink" TEXT,
                "googleMapLink" TEXT,
                "twoGisLink" TEXT,
                "createdAt" TEXT DEFAULT CURRENT_TIMESTAMP
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
                "createdAt" TEXT DEFAULT CURRENT_TIMESTAMP
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
                "activatedAt" TEXT DEFAULT CURRENT_TIMESTAMP,
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
                "completedAt" TEXT,
                "progressPercent" INTEGER DEFAULT 0,
                "masksActivated" INTEGER DEFAULT 0,
                FOREIGN KEY ("routeId") REFERENCES routes(id) ON DELETE CASCADE,
                UNIQUE("userId", "routeId")
            )
        `);
        
        // Заполнение данными (если таблицы пустые)
        const masksCount = await pool.query('SELECT COUNT(*) as count FROM masks');
        if (parseInt(masksCount.rows[0].count) === 0) {
            console.log('📦 Заполняем базу данными...');
            
            for (const mask of kaliningradMasks) {
                await insertMask(mask);
            }
            
            for (const route of routes) {
                await insertRoute(route);
            }
            
            for (const rm of routeMasks) {
                await insertRouteMask(rm.routeId, rm.maskId, rm.order);
            }
            
            console.log('✅ База данных заполнена тестовыми данными');
        } else {
            console.log('✅ База данных уже содержит данные');
        }
        
        console.log('✅ База данных PostgreSQL инициализирована');
    } catch (error) {
        console.error('❌ Ошибка инициализации БД:', error.message);
    }
}

initDatabase();

module.exports = pool;