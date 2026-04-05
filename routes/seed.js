const express = require('express');
const router = express.Router();
const db = require('../data/db');

// Центр Калининграда
const KALININGRAD_CENTER = { lat: 54.679629, lng: 20.463649 };

// Функция для генерации точек вокруг центра
function generateNearbyPoint(centerLat, centerLng, radiusKm = 1) {
    const radiusDegrees = radiusKm / 111.32;
    const u = Math.random();
    const v = Math.random();
    const w = radiusDegrees * Math.sqrt(u);
    const t = 2 * Math.PI * v;
    const dx = w * Math.cos(t);
    const dy = w * Math.sin(t);
    return {
        lat: centerLat + dx,
        lng: centerLng + dy
    };
}

// 10 масок Калининграда
const kaliningradMasks = [
    { name: "Маска Королевских ворот", description: "У исторических Королевских ворот", address: "ул. Фрунзе, 112" },
    { name: "Маска Кафедрального собора", description: "На острове Канта, у собора", address: "Остров Канта, 1" },
    { name: "Маска Рыбной деревни", description: "В районе Рыбной деревни", address: "ул. Октябрьская, 6" },
    { name: "Маска Музея Мирового океана", description: "У набережной Музея Мирового океана", address: "наб. Петра Великого, 1" },
    { name: "Маска Площади Победы", description: "На главной площади города", address: "пл. Победы, 1" },
    { name: "Маска Амалиенау", description: "В историческом районе Амалиенау", address: "ул. Кутузова, 22" },
    { name: "Маска Южного вокзала", description: "У здания Южного вокзала", address: "ул. Железнодорожная, 10" },
    { name: "Маска Зоопарка", description: "У входа в Калининградский зоопарк", address: "пр. Мира, 26" },
    { name: "Маска Дома Советов", description: "У знаменитого Дома Советов", address: "пл. Центральная, 1" },
    { name: "Маска Фридландских ворот", description: "У Фридландских ворот", address: "ул. Дзержинского, 30" }
];

function makeYandexMapLink(lat, lng) {
    return `https://yandex.ru/maps/?pt=${lng},${lat}&z=18&l=map`;
}

// POST /api/seed/data
router.get('/data', (req, res) => {
    try {
        console.log('Создание тестовых данных...');
        
        const masks = [];
        
        for (let i = 0; i < kaliningradMasks.length; i++) {
            const maskData = kaliningradMasks[i];
            let lat, lng;
            if (i === 0) {
                lat = KALININGRAD_CENTER.lat;
                lng = KALININGRAD_CENTER.lng;
            } else {
                const point = generateNearbyPoint(KALININGRAD_CENTER.lat, KALININGRAD_CENTER.lng, 1.0);
                lat = point.lat;
                lng = point.lng;
            }
            
            masks.push({
                id: `mask_${i + 1}`,
                name: maskData.name,
                description: maskData.description,
                fullDescription: `${maskData.description}. Это одна из уникальных масок туристического квеста "Underground Mask" в Калининграде. Отсканируйте QR-код рядом с маской, чтобы активировать её.`,
                latitude: lat,
                longitude: lng,
                address: maskData.address,
                qrCode: `MASK_KGD_${i + 1}`,
                photoHash: null,
                activationPhotoHash: null,
                audioGuideHash: null,
                price: { amount: 15000 + i * 1000, currency: "RUB" },
                isAvailable: true,
                yandexMapLink: makeYandexMapLink(lat, lng),
                googleMapLink: null,
                twoGisLink: null
            });
        }
        
        const routes = [
    {
        id: "route_1",
        name: "Исторический центр Калининграда",
        description: "Прогулка по историческим местам сердца Калининграда.",
        difficulty: "easy",
        durationMinutes: 90,
        distanceKm: 2.5,
        color: "#3B82F6",
        isActive: true,
        centerLat: 54.7062,   // Королевские ворота
        centerLng: 20.5098,
        zoom: 15
    },
    {
        id: "route_2",
        name: "Парки и набережные",
        description: "Маршрут через живописные парки и набережные.",
        difficulty: "easy",
        durationMinutes: 60,
        distanceKm: 1.8,
        color: "#10B981",
        isActive: true,
        centerLat: 54.6833,   // Кафедральный собор
        centerLng: 20.4975,
        zoom: 15
    },
    {
        id: "route_3",
        name: "Современный Калининград",
        description: "Знакомство с современными достопримечательностями.",
        difficulty: "medium",
        durationMinutes: 120,
        distanceKm: 3.2,
        color: "#8B5CF6",
        isActive: true,
        centerLat: 54.7195,   // Площадь Победы
        centerLng: 20.4884,
        zoom: 14
    }
];
        
        const routeMasks = [
            { routeId: "route_1", maskId: "mask_1", order: 1 },
            { routeId: "route_1", maskId: "mask_2", order: 2 },
            { routeId: "route_1", maskId: "mask_3", order: 3 },
            { routeId: "route_1", maskId: "mask_4", order: 4 },
            { routeId: "route_1", maskId: "mask_5", order: 5 },
            { routeId: "route_2", maskId: "mask_6", order: 1 },
            { routeId: "route_2", maskId: "mask_7", order: 2 },
            { routeId: "route_2", maskId: "mask_8", order: 3 },
            { routeId: "route_3", maskId: "mask_9", order: 1 },
            { routeId: "route_3", maskId: "mask_10", order: 2 }
        ];
        
        db.saveMasks(masks);
        db.saveRoutes(routes);
        db.saveRouteMasks(routeMasks);
        
        console.log('Создано масок:', masks.length);
        console.log('Создано маршрутов:', routes.length);
        
        res.json({
            success: true,
            message: "Тестовые данные для Калининграда созданы!",
            masksCount: masks.length,
            routesCount: routes.length
        });
        
    } catch (error) {
        console.error('Seed error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;