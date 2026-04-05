const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname);
const MASKS_FILE = path.join(DATA_DIR, 'masks.json');
const ROUTES_FILE = path.join(DATA_DIR, 'routes.json');
const ROUTE_MASKS_FILE = path.join(DATA_DIR, 'routeMasks.json');
const ACTIVATIONS_FILE = path.join(DATA_DIR, 'activations.json');

// Функции для работы с JSON-файлами
function readJSON(filePath) {
    if (!fs.existsSync(filePath)) return [];
    const data = fs.readFileSync(filePath, 'utf-8');
    return data ? JSON.parse(data) : [];
}

function writeJSON(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// === Маски ===
function getAllMasks() {
    return readJSON(MASKS_FILE);
}

function getMaskById(id) {
    const masks = getAllMasks();
    return masks.find(m => m.id === id);
}

function getMaskByQrCode(qrCode) {
    const masks = getAllMasks();
    return masks.find(m => m.qrCode === qrCode);
}

function saveMask(mask) {
    const masks = getAllMasks();
    masks.push(mask);
    writeJSON(MASKS_FILE, masks);
    return mask;
}

function saveMasks(masks) {
    writeJSON(MASKS_FILE, masks);
}

// === Маршруты ===
function getAllRoutes() {
    return readJSON(ROUTES_FILE);
}

function getRouteById(id) {
    const routes = getAllRoutes();
    return routes.find(r => r.id === id);
}

function saveRoute(route) {
    const routes = getAllRoutes();
    routes.push(route);
    writeJSON(ROUTES_FILE, routes);
    return route;
}

function saveRoutes(routes) {
    writeJSON(ROUTES_FILE, routes);
}

// === Связь маршрутов и масок ===
function getAllRouteMasks() {
    return readJSON(ROUTE_MASKS_FILE);
}

function getRouteMasksByRouteId(routeId) {
    const routeMasks = getAllRouteMasks();
    return routeMasks.filter(rm => rm.routeId === routeId).sort((a, b) => a.order - b.order);
}

function saveRouteMask(routeMask) {
    const routeMasks = getAllRouteMasks();
    routeMasks.push(routeMask);
    writeJSON(ROUTE_MASKS_FILE, routeMasks);
}

function saveRouteMasks(routeMasks) {
    writeJSON(ROUTE_MASKS_FILE, routeMasks);
}

// === Активации пользователей ===
function getAllActivations() {
    return readJSON(ACTIVATIONS_FILE);
}

function getActivationsByUserId(userId) {
    const activations = getAllActivations();
    return activations.filter(a => a.userId === userId);
}

function getActivationByUserAndMask(userId, maskId) {
    const activations = getAllActivations();
    return activations.find(a => a.userId === userId && a.maskId === maskId);
}

function saveActivation(activation) {
    const activations = getAllActivations();
    activation.id = Date.now().toString();
    activation.activatedAt = new Date().toISOString();
    activations.push(activation);
    writeJSON(ACTIVATIONS_FILE, activations);
    return activation;
}

// === Прогресс пользователя ===
function getUserProgress(userId) {
    const activations = getActivationsByUserId(userId);
    const uniqueMaskIds = new Set(activations.map(a => a.maskId));
    const activatedMasks = uniqueMaskIds.size;
    
    // Считаем пройденные маршруты
    const routes = getAllRoutes();
    const routeMasks = getAllRouteMasks();
    let completedRoutes = 0;
    
    for (const route of routes) {
        const masksInRoute = routeMasks.filter(rm => rm.routeId === route.id);
        const activatedInRoute = masksInRoute.filter(rm => 
            activations.some(a => a.maskId === rm.maskId)
        ).length;
        
        if (activatedInRoute === masksInRoute.length && masksInRoute.length > 0) {
            completedRoutes++;
        }
    }
    
    return {
        activatedMasks,
        totalMasks: getAllMasks().length,
        completedRoutes,
        totalRoutes: routes.length
    };
}

module.exports = {
    getAllMasks,
    getMaskById,
    getMaskByQrCode,
    saveMask,
    saveMasks,
    getAllRoutes,
    getRouteById,
    saveRoute,
    saveRoutes,
    getAllRouteMasks,
    getRouteMasksByRouteId,
    saveRouteMask,
    saveRouteMasks,
    getAllActivations,
    getActivationsByUserId,
    getActivationByUserAndMask,
    saveActivation,
    getUserProgress
};