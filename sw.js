// IndexedDB ヘルパー (login.js/app.jsと共通)
const DB_NAME = 'food-alert-db';
const DB_VERSION = 1;
const USERS_STORE = 'users';
const FOODS_STORE = 'foods';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = (event) => reject('IndexedDB error: ' + request.error);
    request.onsuccess = (event) => resolve(event.target.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(USERS_STORE)) {
        db.createObjectStore(USERS_STORE, { keyPath: 'username' });
      }
      if (!db.objectStoreNames.contains(FOODS_STORE)) {
        const foodStore = db.createObjectStore(FOODS_STORE, { keyPath: 'id' });
        foodStore.createIndex('by_user', 'username', { unique: false });
      }
    };
  });
}

async function dbGetAll(storeName, indexName, key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const source = indexName ? store.index(indexName) : store;
        const request = source.getAll(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// --- Service Worker 本体 ---

self.addEventListener('install', (e)=>{
  e.waitUntil(caches.open('fa-v1').then(c=>c.addAll([
    './','./index.html','./login.html','./style.css','./app.js','./login.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'
  ])));
  self.skipWaiting();
});

self.addEventListener('activate', (e)=>{ e.waitUntil(self.clients.claim()); });

self.addEventListener('fetch', (e)=>{ e.respondWith(caches.match(e.request).then(res=>res||fetch(e.request))); });

// --- ここからが追加した機能 ---

// 定期的なバックグラウンド同期イベント
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-expiry-foods') {
    event.waitUntil(checkFoodsAndNotify());
  }
});

// 期限をチェックして通知を出す関数
async function checkFoodsAndNotify() {
  const allFoods = await dbGetAll(FOODS_STORE);
  const now = Date.now();
  const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
  
  // 期限が2日以内に迫っている食材をフィルタリング
  const nearExpiryFoods = allFoods.filter(food => {
    return food.expiry - now <= twoDaysMs;
  });

  if (nearExpiryFoods.length > 0) {
    const title = '賞味期限が近い食材があります！';
    const message = nearExpiryFoods.slice(0, 3).map(f => f.name).join('、') +
                  (nearExpiryFoods.length > 3 ? ` 他${nearExpiryFoods.length - 3}件` : '');
    
    // 通知を表示
    await self.registration.showNotification(title, {
      body: message,
      icon: './icon-192.png',
      tag: 'expiry-notification' // 同じタグの通知は上書きされる
    });
  }
}