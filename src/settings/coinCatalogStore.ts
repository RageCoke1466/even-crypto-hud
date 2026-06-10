import type { CoinCatalogEntry } from './watchlistStore';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const CATALOG_KEY = 'even-crypto:coin-catalog';
const FETCHED_AT_KEY = 'even-crypto:coin-catalog-fetched-at';
const FRESH_MS = 30 * 60 * 1000;

export function createCoinCatalogStore(storage: StorageLike) {
  return {
    loadFresh(now: Date): CoinCatalogEntry[] | null {
      const fetchedAt = loadFetchedAt(storage);

      if (!fetchedAt || now.getTime() - fetchedAt.getTime() > FRESH_MS) {
        return null;
      }

      return loadCatalog(storage);
    },
    loadAny(): CoinCatalogEntry[] | null {
      return loadCatalog(storage);
    },
    save(catalog: CoinCatalogEntry[], fetchedAt: Date): void {
      storage.setItem(CATALOG_KEY, JSON.stringify(catalog.map(normalizeCoin)));
      storage.setItem(FETCHED_AT_KEY, fetchedAt.toISOString());
    },
    clear(): void {
      storage.removeItem(CATALOG_KEY);
      storage.removeItem(FETCHED_AT_KEY);
    },
  };
}

export function createBrowserCoinCatalogStore() {
  return createCoinCatalogStore(window.localStorage);
}

function loadCatalog(storage: StorageLike): CoinCatalogEntry[] | null {
  const raw = storage.getItem(CATALOG_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return null;
    }

    return parsed.filter(isCoinCatalogEntry).map(normalizeCoin);
  } catch {
    return null;
  }
}

function loadFetchedAt(storage: StorageLike): Date | null {
  const raw = storage.getItem(FETCHED_AT_KEY);

  if (!raw) {
    return null;
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeCoin(coin: CoinCatalogEntry): CoinCatalogEntry {
  return {
    id: coin.id,
    symbol: coin.symbol.toUpperCase(),
    name: coin.name,
  };
}

function isCoinCatalogEntry(value: unknown): value is CoinCatalogEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const coin = value as Record<string, unknown>;
  return typeof coin.id === 'string' && typeof coin.symbol === 'string' && typeof coin.name === 'string';
}
