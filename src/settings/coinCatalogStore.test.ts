import { describe, expect, it } from 'vitest';
import { createCoinCatalogStore } from './coinCatalogStore';
import type { CoinCatalogEntry } from './watchlistStore';

const catalog: CoinCatalogEntry[] = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
];

function createStorage(entries: [string, string][] = []) {
  const storage = new Map<string, string>(entries);

  return {
    storage,
    store: createCoinCatalogStore({
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    }),
  };
}

describe('createCoinCatalogStore', () => {
  it('loads a fresh cached catalog within thirty minutes', () => {
    const { store } = createStorage([
      ['even-crypto:coin-catalog', JSON.stringify(catalog)],
      ['even-crypto:coin-catalog-fetched-at', '2026-06-07T21:40:00.000Z'],
    ]);

    expect(store.loadFresh(new Date('2026-06-07T22:00:00.000Z'))).toEqual(catalog);
  });

  it('returns null for stale cache but keeps stale catalog readable', () => {
    const { store } = createStorage([
      ['even-crypto:coin-catalog', JSON.stringify(catalog)],
      ['even-crypto:coin-catalog-fetched-at', '2026-06-07T21:29:00.000Z'],
    ]);

    expect(store.loadFresh(new Date('2026-06-07T22:00:00.000Z'))).toBeNull();
    expect(store.loadAny()).toEqual(catalog);
  });

  it('saves normalized catalog entries and fetch timestamp', () => {
    const { store, storage } = createStorage();

    store.save([{ id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' }], new Date('2026-06-07T22:00:00.000Z'));

    expect(JSON.parse(storage.get('even-crypto:coin-catalog') ?? '[]')).toEqual([
      { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
    ]);
    expect(storage.get('even-crypto:coin-catalog-fetched-at')).toBe('2026-06-07T22:00:00.000Z');
  });
});
