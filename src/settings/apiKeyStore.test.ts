import { describe, expect, it } from 'vitest';
import {
  clearApiKeyFromBridgeStorage,
  createApiKeyStore,
  loadApiKeyFromBridgeStorage,
  saveApiKeyToBridgeStorage,
} from './apiKeyStore';

describe('createApiKeyStore', () => {
  it('saves trimmed CoinGecko keys', () => {
    const storage = new Map<string, string>();
    const store = createApiKeyStore({
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    });

    store.save('  cg_demo_123  ');

    expect(store.load()).toBe('cg_demo_123');
  });

  it('clears saved CoinGecko keys', () => {
    const storage = new Map<string, string>([['even-crypto:coingecko-api-key', 'cg_demo_123']]);
    const store = createApiKeyStore({
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    });

    store.clear();

    expect(store.load()).toBeNull();
  });

  it('loads trimmed CoinGecko keys from Even App bridge storage', async () => {
    const bridgeStorage = {
      getLocalStorage: async (key: string) => (key === 'even-crypto:coingecko-api-key' ? '  cg_demo_bridge  ' : ''),
      setLocalStorage: async () => true,
    };

    await expect(loadApiKeyFromBridgeStorage(bridgeStorage)).resolves.toBe('cg_demo_bridge');
  });

  it('saves and clears CoinGecko keys through Even App bridge storage', async () => {
    const storage = new Map<string, string>();
    const bridgeStorage = {
      getLocalStorage: async (key: string) => storage.get(key) ?? '',
      setLocalStorage: async (key: string, value: string) => {
        storage.set(key, value);
        return true;
      },
    };

    await expect(saveApiKeyToBridgeStorage(bridgeStorage, '  cg_demo_bridge  ')).resolves.toBe(true);
    expect(storage.get('even-crypto:coingecko-api-key')).toBe('cg_demo_bridge');

    await expect(clearApiKeyFromBridgeStorage(bridgeStorage)).resolves.toBe(true);
    expect(storage.get('even-crypto:coingecko-api-key')).toBe('');
  });
});
