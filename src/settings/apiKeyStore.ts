const DEFAULT_KEY = 'even-crypto:coingecko-api-key';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface BridgeStorageLike {
  getLocalStorage(key: string): Promise<string>;
  setLocalStorage(key: string, value: string): Promise<boolean>;
}

export function createApiKeyStore(storage: StorageLike, key = DEFAULT_KEY) {
  return {
    load(): string | null {
      return normalizeApiKey(storage.getItem(key));
    },
    save(apiKey: string): void {
      storage.setItem(key, apiKey.trim());
    },
    clear(): void {
      storage.removeItem(key);
    },
  };
}

export async function loadApiKeyFromBridgeStorage(
  bridgeStorage: BridgeStorageLike,
  key = DEFAULT_KEY,
): Promise<string | null> {
  return normalizeApiKey(await bridgeStorage.getLocalStorage(key));
}

export async function saveApiKeyToBridgeStorage(
  bridgeStorage: BridgeStorageLike,
  apiKey: string,
  key = DEFAULT_KEY,
): Promise<boolean> {
  return bridgeStorage.setLocalStorage(key, apiKey.trim());
}

export async function clearApiKeyFromBridgeStorage(
  bridgeStorage: BridgeStorageLike,
  key = DEFAULT_KEY,
): Promise<boolean> {
  return bridgeStorage.setLocalStorage(key, '');
}

export function createBrowserApiKeyStore() {
  return createApiKeyStore(window.localStorage);
}

function normalizeApiKey(value: string | null): string | null {
  const normalized = value?.trim() ?? '';
  return normalized.length > 0 ? normalized : null;
}
