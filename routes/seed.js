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
    { name: "Берёзовая", description: "Уютная улица в центре Калининграда", address: "ул. Берёзовая", lat: 54.679629, lng: 20.463649 },
    { name: "ВБ наш", description: "Торговая точка у Березовой", address: "ул. Березовая, у магазина ВБ", lat: 54.680082, lng: 20.466036 },
    { name: "Вход спар", description: "Вход в торговый центр СПАР", address: "ул. Березовая, вход в СПАР", lat: 54.681311, lng: 20.468169 },
    { name: "Почта", description: "Отделение почты России", address: "ул. Березовая, почтовое отделение", lat: 54.681408, lng: 20.473440 },
    { name: "Цветы Голландии", description: "Магазин цветов", address: "ул. Березовая, Цветы Голландии", lat: 54.681312, lng: 20.476823 },
    { name: "Калитка церковь", description: "Калитка у церкви", address: "ул. Березовая, у церкви", lat: 54.681478, lng: 20.480457 },
    { name: "Вход киноленд", description: "Вход в кинотеатр Киноленд", address: "ул. Березовая, вход в Киноленд", lat: 54.681653, lng: 20.482549 },
    { name: "Кофейня на летнем", description: "Уютная кофейня на Летнем озере", address: "ул. Березовая, кофейня на Летнем", lat: 54.677289, lng: 20.486619 },
    { name: "Мост на летнем", description: "Мост через Летнее озеро", address: "ул. Березовая, мост на Летнем", lat: 54.676579, lng: 20.489302 },
    { name: "Еще кофейня летнее", description: "Еще одна кофейня у Летнего озера", address: "ул. Березовая, кофейня у Летнего озера", lat: 54.675016, lng: 20.486887 }
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
                
                masks.push({
                    id: `mask_${i + 1}`,
                    name: maskData.name,
                    description: maskData.description,
                    fullDescription: `${maskData.description}. Это одна из уникальных масок туристического квеста "НЕГОДЯЙ" в Калининграде. Отсканируйте QR-код рядом с маской, чтобы активировать её и получить доступ к эксклюзивному контенту.`,
                    latitude: maskData.lat,
                    longitude: maskData.lng,
                    address: maskData.address,
                    qrCode: `MASK_KGD_${i + 1}`,
                    photoHash: null,
                    activationPhotoHash: null,
                    audioGuideHash: null,
                    price: { amount: 15000 + i * 1000, currency: "RUB" },
                    isAvailable: true,
                    yandexMapLink: makeYandexMapLink(maskData.lat, maskData.lng),
                    googleMapLink: null,
                    twoGisLink: null
                });
            }
        
                const routes = [
            {
                id: "route_1",
                name: "Березовая улица",
                description: "Прогулка по главной улице района",
                difficulty: "easy",
                durationMinutes: 45,
                distanceKm: 1.2,
                color: "#3B82F6",
                isActive: true,
                centerLat: 54.679629,
                centerLng: 20.463649,
                zoom: 16
            },
            {
                id: "route_2",
                name: "Летнее озеро",
                description: "Прогулка вокруг Летнего озера",
                difficulty: "easy",
                durationMinutes: 60,
                distanceKm: 1.5,
                color: "#10B981",
                isActive: true,
                centerLat: 54.677289,
                centerLng: 20.486619,
                zoom: 16
            },
            {
                id: "route_3",
                name: "Вокруг района",
                description: "Полный маршрут по всем локациям района",
                difficulty: "medium",
                durationMinutes: 90,
                distanceKm: 2.5,
                color: "#8B5CF6",
                isActive: true,
                centerLat: 54.679629,
                centerLng: 20.463649,
                zoom: 15
            }
        ];
        
                const routeMasks = [
            // Маршрут 1 (Березовая улица): маски 1-5
            { routeId: "route_1", maskId: "mask_1", order: 1 },
            { routeId: "route_1", maskId: "mask_2", order: 2 },
            { routeId: "route_1", maskId: "mask_3", order: 3 },
            { routeId: "route_1", maskId: "mask_4", order: 4 },
            { routeId: "route_1", maskId: "mask_5", order: 5 },
            // Маршрут 2 (Летнее озеро): маски 6-8
            { routeId: "route_2", maskId: "mask_6", order: 1 },
            { routeId: "route_2", maskId: "mask_7", order: 2 },
            { routeId: "route_2", maskId: "mask_8", order: 3 },
            // Маршрут 3 (Вокруг района): маски 9-10 + остальные
            { routeId: "route_3", maskId: "mask_9", order: 1 },
            { routeId: "route_3", maskId: "mask_10", order: 2 },
            { routeId: "route_3", maskId: "mask_1", order: 3 },
            { routeId: "route_3", maskId: "mask_2", order: 4 },
            { routeId: "route_3", maskId: "mask_3", order: 5 },
            { routeId: "route_3", maskId: "mask_4", order: 6 },
            { routeId: "route_3", maskId: "mask_5", order: 7 },
            { routeId: "route_3", maskId: "mask_6", order: 8 },
            { routeId: "route_3", maskId: "mask_7", order: 9 },
            { routeId: "route_3", maskId: "mask_8", order: 10 }
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