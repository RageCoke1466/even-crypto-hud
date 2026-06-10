import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WATCHLIST,
  addCoinToWatchlist,
  createWatchlistStore,
  loadWatchlistFromBridgeStorage,
  moveWatchlistCoin,
  removeWatchlistCoin,
  saveWatchlistToBridgeStorage,
  searchCoinCatalog,
  type CoinCatalogEntry,
} from './watchlistStore';

const catalog: CoinCatalogEntry[] = [
  { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' },
  { id: 'bitcoin-bep2', symbol: 'btcb', name: 'Bitcoin BEP2' },
  { id: 'wrapped-bitcoin', symbol: 'wbtc', name: 'Wrapped Bitcoin' },
  { id: 'ethereum', symbol: 'eth', name: 'Ethereum' },
  { id: 'solana', symbol: 'sol', name: 'Solana' },
];

describe('searchCoinCatalog', () => {
  it('ranks exact symbol matches before id/name matches and hides selected coins', () => {
    const results = searchCoinCatalog(catalog, 'btc', [
      { id: 'wrapped-bitcoin', symbol: 'WBTC', name: 'Wrapped Bitcoin' },
    ]);

    expect(results).toEqual([
      { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
      { id: 'bitcoin-bep2', symbol: 'BTCB', name: 'Bitcoin BEP2' },
    ]);
  });

  it('limits search results to eight coins', () => {
    const manyCoins = Array.from({ length: 10 }, (_, index) => ({
      id: `coin-${index}`,
      symbol: `coin${index}`,
      name: `Coin ${index}`,
    }));

    expect(searchCoinCatalog(manyCoins, 'coin', [])).toHaveLength(8);
  });
});

describe('watchlist editing helpers', () => {
  it('adds, removes, and moves coins while preserving order', () => {
    const start = [{ id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' }];
    const withEth = addCoinToWatchlist(start, { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' });
    const moved = moveWatchlistCoin(withEth, 'ethereum', 'up');
    const removed = removeWatchlistCoin(moved, 'bitcoin');

    expect(withEth).toEqual([
      { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
      { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
    ]);
    expect(moved).toEqual([
      { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
      { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
    ]);
    expect(removed).toEqual([{ id: 'ethereum', symbol: 'ETH', name: 'Ethereum' }]);
  });

  it('does not add the same coin twice', () => {
    const start = [{ id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' }];

    expect(addCoinToWatchlist(start, { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' })).toEqual(start);
  });

  it('allows removing the last coin without restoring defaults', () => {
    expect(removeWatchlistCoin([{ id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' }], 'bitcoin')).toEqual([]);
  });
});

describe('createWatchlistStore', () => {
  it('persists watchlists as JSON coin objects', () => {
    const storage = new Map<string, string>();
    const store = createWatchlistStore({
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    });

    store.save([{ id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' }]);

    expect(store.load()).toEqual([{ id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' }]);
  });

  it('loads an empty watchlist when no watchlist has been saved', () => {
    const storage = new Map<string, string>();
    const store = createWatchlistStore({
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    });

    expect(store.load()).toEqual([]);
  });

  it('persists an intentionally empty watchlist', () => {
    const storage = new Map<string, string>();
    const store = createWatchlistStore({
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    });

    store.save([]);

    expect(storage.get('even-crypto:watchlist')).toBe('[]');
    expect(store.load()).toEqual([]);
  });

  it('migrates old comma-separated symbols to default CoinGecko coin IDs', () => {
    const storage = new Map<string, string>([['even-crypto:watchlist', 'BTC, ETH, SOL']]);
    const store = createWatchlistStore({
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    });

    expect(store.load()).toEqual(DEFAULT_WATCHLIST.slice(0, 3));
  });
});

describe('Even App bridge watchlist storage', () => {
  it('loads normalized watchlists from Even App bridge storage', async () => {
    const bridgeStorage = {
      getLocalStorage: async (key: string) =>
        key === 'even-crypto:watchlist'
          ? JSON.stringify([{ id: 'dogecoin', symbol: 'doge', name: 'Dogecoin' }])
          : '',
      setLocalStorage: async () => true,
    };

    await expect(loadWatchlistFromBridgeStorage(bridgeStorage)).resolves.toEqual([
      { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin' },
    ]);
  });

  it('does not restore a watchlist when Even App bridge storage is empty', async () => {
    const bridgeStorage = {
      getLocalStorage: async () => '',
      setLocalStorage: async () => true,
    };

    await expect(loadWatchlistFromBridgeStorage(bridgeStorage)).resolves.toBeNull();
  });

  it('saves normalized watchlists through Even App bridge storage', async () => {
    const storage = new Map<string, string>();
    const bridgeStorage = {
      getLocalStorage: async (key: string) => storage.get(key) ?? '',
      setLocalStorage: async (key: string, value: string) => {
        storage.set(key, value);
        return true;
      },
    };

    await expect(
      saveWatchlistToBridgeStorage(bridgeStorage, [
        { id: 'dogecoin', symbol: 'doge', name: 'Dogecoin' },
        { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin' },
      ]),
    ).resolves.toBe(true);

    expect(JSON.parse(storage.get('even-crypto:watchlist') ?? '')).toEqual([
      { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin' },
    ]);
  });
});
