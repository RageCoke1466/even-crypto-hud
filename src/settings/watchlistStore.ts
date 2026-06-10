export interface CoinCatalogEntry {
  id: string;
  symbol: string;
  name: string;
}

export type WatchlistCoin = CoinCatalogEntry;

export const DEFAULT_WATCHLIST: WatchlistCoin[] = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
  { id: 'solana', symbol: 'SOL', name: 'Solana' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP' },
];

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface BridgeStorageLike {
  getLocalStorage(key: string): Promise<string>;
  setLocalStorage(key: string, value: string): Promise<boolean>;
}

const DEFAULT_KEY = 'even-crypto:watchlist';
const MAX_SEARCH_RESULTS = 8;

const LEGACY_SYMBOL_TO_COIN: Record<string, WatchlistCoin> = Object.fromEntries(
  DEFAULT_WATCHLIST.map((coin) => [coin.symbol, coin]),
);

export function searchCoinCatalog(
  catalog: CoinCatalogEntry[],
  query: string,
  selectedCoins: WatchlistCoin[],
): WatchlistCoin[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  const selectedIds = new Set(selectedCoins.map((coin) => coin.id));

  return catalog
    .filter((coin) => !selectedIds.has(coin.id))
    .map(normalizeCoin)
    .map((coin) => ({ coin, rank: searchRank(coin, normalizedQuery) }))
    .filter((result) => result.rank > 0)
    .sort((a, b) => a.rank - b.rank || a.coin.symbol.localeCompare(b.coin.symbol))
    .slice(0, MAX_SEARCH_RESULTS)
    .map((result) => result.coin);
}

export function addCoinToWatchlist(watchlist: WatchlistCoin[], coin: WatchlistCoin): WatchlistCoin[] {
  if (watchlist.some((item) => item.id === coin.id)) {
    return watchlist;
  }

  return [...watchlist, normalizeCoin(coin)];
}

export function removeWatchlistCoin(watchlist: WatchlistCoin[], coinId: string): WatchlistCoin[] {
  return watchlist.filter((coin) => coin.id !== coinId);
}

export function moveWatchlistCoin(
  watchlist: WatchlistCoin[],
  coinId: string,
  direction: 'up' | 'down',
): WatchlistCoin[] {
  const index = watchlist.findIndex((coin) => coin.id === coinId);

  if (index === -1) {
    return watchlist;
  }

  const targetIndex = direction === 'up' ? index - 1 : index + 1;

  if (targetIndex < 0 || targetIndex >= watchlist.length) {
    return watchlist;
  }

  const next = [...watchlist];
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  return next;
}

export function createWatchlistStore(storage: StorageLike, key = DEFAULT_KEY) {
  return {
    load(): WatchlistCoin[] {
      const value = storage.getItem(key);
      return parseStoredWatchlist(value);
    },
    save(watchlist: WatchlistCoin[]): void {
      storage.setItem(key, JSON.stringify(normalizeWatchlist(watchlist)));
    },
    clear(): void {
      storage.removeItem(key);
    },
  };
}

export function createBrowserWatchlistStore() {
  return createWatchlistStore(window.localStorage);
}

export async function loadWatchlistFromBridgeStorage(
  bridgeStorage: BridgeStorageLike,
  key = DEFAULT_KEY,
): Promise<WatchlistCoin[] | null> {
  const value = await bridgeStorage.getLocalStorage(key);

  if (!value || value.trim().length === 0) {
    return null;
  }

  return parseStoredWatchlist(value);
}

export async function saveWatchlistToBridgeStorage(
  bridgeStorage: BridgeStorageLike,
  watchlist: WatchlistCoin[],
  key = DEFAULT_KEY,
): Promise<boolean> {
  return bridgeStorage.setLocalStorage(key, JSON.stringify(normalizeWatchlist(watchlist)));
}

function parseStoredWatchlist(value: string | null): WatchlistCoin[] {
  if (!value || value.trim().length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (Array.isArray(parsed)) {
      return normalizeWatchlist(parsed.filter(isWatchlistCoin));
    }
  } catch {
    return parseLegacySymbols(value);
  }

  return [];
}

function parseLegacySymbols(value: string): WatchlistCoin[] {
  const seen = new Set<string>();
  const coins: WatchlistCoin[] = [];

  for (const raw of value.split(',')) {
    const symbol = raw.trim().toUpperCase();
    const coin = LEGACY_SYMBOL_TO_COIN[symbol];

    if (coin && !seen.has(coin.id)) {
      seen.add(coin.id);
      coins.push(coin);
    }
  }

  return coins.length > 0 ? coins : [];
}

function normalizeWatchlist(watchlist: WatchlistCoin[]): WatchlistCoin[] {
  const seen = new Set<string>();
  const normalized: WatchlistCoin[] = [];

  for (const coin of watchlist) {
    if (!seen.has(coin.id)) {
      seen.add(coin.id);
      normalized.push(normalizeCoin(coin));
    }
  }

  return normalized;
}

function normalizeCoin(coin: CoinCatalogEntry): WatchlistCoin {
  return {
    id: coin.id,
    symbol: coin.symbol.toUpperCase(),
    name: coin.name,
  };
}

function searchRank(coin: WatchlistCoin, query: string): number {
  const symbol = coin.symbol.toLowerCase();
  const id = coin.id.toLowerCase();
  const name = coin.name.toLowerCase();

  if (symbol === query) return 1;
  if (id === query) return 2;
  if (symbol.startsWith(query)) return 3;
  if (name.startsWith(query)) return 4;
  if (name.includes(query) || id.includes(query)) return 5;
  return 0;
}

function isWatchlistCoin(value: unknown): value is WatchlistCoin {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const coin = value as Record<string, unknown>;
  return typeof coin.id === 'string' && typeof coin.symbol === 'string' && typeof coin.name === 'string';
}
