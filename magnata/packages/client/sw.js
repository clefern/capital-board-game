const CACHE_NAME = 'magnata-v5';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/main.css',
  '/css/board.css',
  '/css/hud.css',
  '/css/cards.css',
  '/css/modals.css',
  '/js/main.js',
  '/js/config/constants.js',
  '/js/config/board-layout.js',
  '/js/config/cards-data.js',
  '/js/core/GameState.js',
  '/js/core/Player.js',
  '/js/core/Business.js',
  '/js/core/Deck.js',
  '/js/core/TurnManager.js',
  '/js/core/BonusCalculator.js',
  '/js/core/BotAI.js',
  '/js/core/SaveManager.js',
  '/js/board/BoardRenderer.js',
  '/js/board/PawnAnimator.js',
  '/js/ui/HudPanel.js',
  '/js/ui/CardHand.js',
  '/js/ui/DiceRoller.js',
  '/js/ui/StockExchange.js',
  '/js/ui/VictoryScreen.js',
  '/js/ui/TradeDialog.js',
  '/js/ui/TutorialScreen.js',
  '/js/minigames/MinigameManager.js',
  '/js/minigames/MakeChange.js',
  '/js/minigames/CoinCatch.js',
  '/js/minigames/MemoryGame.js',
  '/js/minigames/FindTheKey.js',
  '/js/utils/EventBus.js',
  '/js/utils/SoundManager.js',
  '/js/ui/GameIcons.js',
  '/js/network/SocketClient.js',
  '/js/network/NetworkAdapter.js',
  '/js/network/LobbyUI.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first: sempre busca versão nova, fallback para cache se offline
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
