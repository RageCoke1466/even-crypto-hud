import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WatchlistCoin } from './settings/watchlistStore';

const bridgeState = vi.hoisted(() => ({
  hasBridge: false,
  evenHubCallbacks: [] as Array<(event: { textEvent?: { eventType?: number }; sysEvent?: { eventType?: number } }) => void>,
  bridge: {
    getLocalStorage: vi.fn(),
    setLocalStorage: vi.fn(),
    createStartUpPageContainer: vi.fn(),
    textContainerUpgrade: vi.fn(),
    shutDownPageContainer: vi.fn(),
    onEvenHubEvent: vi.fn(),
  },
}));

const priceState = vi.hoisted(() => ({
  requestedApiKeys: [] as string[],
  requestedCoinIds: [] as string[][],
  nextError: null as Error | null,
}));

vi.mock('./even/bridge', () => ({
  hasEvenHostBridge: () => bridgeState.hasBridge,
  connectEvenBridge: vi.fn(async () => bridgeState.bridge),
}));

vi.mock('./prices/coinCatalogSource', () => ({
  CoinGeckoCoinCatalogSource: class {
    async getCoins() {
      return [
        { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
        { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
        { id: 'solana', symbol: 'SOL', name: 'Solana' },
        { id: 'ripple', symbol: 'XRP', name: 'XRP' },
      ];
    }
  },
}));

vi.mock('./prices/coingeckoPriceSource', () => ({
  CoinGeckoPriceSource: class {
    private readonly apiKey: string;

    constructor(options: { apiKey: string }) {
      this.apiKey = options.apiKey;
      priceState.requestedApiKeys.push(options.apiKey);
    }

    async getPrices(coins: WatchlistCoin[]) {
      priceState.requestedCoinIds.push(coins.map((coin) => coin.id));

      if (priceState.nextError) {
        const error = priceState.nextError;
        priceState.nextError = null;
        throw error;
      }

      return {
        quoteSymbol: 'USD',
        assets: coins.map((coin, index) => ({
          coin,
          quoteSymbol: 'USD',
          price: [62914, 1676, 66, 1.16][index] ?? 1,
          updatedAt: new Date('2026-06-07T22:58:00.000Z'),
          provider: 'coingecko',
        })),
        updatedAt: new Date('2026-06-07T22:58:00.000Z'),
        provider: 'coingecko',
      };
    }
  },
}));

async function flushAsyncWork(): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, 0));
  await Promise.resolve();
}

describe('phone UI shell', () => {
  beforeEach(() => {
    vi.resetModules();
    bridgeState.hasBridge = false;
    bridgeState.bridge.getLocalStorage.mockReset();
    bridgeState.bridge.setLocalStorage.mockReset();
    bridgeState.bridge.createStartUpPageContainer.mockReset();
    bridgeState.bridge.createStartUpPageContainer.mockResolvedValue(0);
    bridgeState.bridge.textContainerUpgrade.mockReset();
    bridgeState.bridge.textContainerUpgrade.mockResolvedValue(true);
    bridgeState.bridge.shutDownPageContainer.mockReset();
    bridgeState.bridge.shutDownPageContainer.mockResolvedValue(true);
    bridgeState.evenHubCallbacks = [];
    bridgeState.bridge.onEvenHubEvent.mockReset();
    bridgeState.bridge.onEvenHubEvent.mockImplementation((callback) => {
      bridgeState.evenHubCallbacks.push(callback);
      return () => undefined;
    });
    priceState.requestedApiKeys = [];
    priceState.requestedCoinIds = [];
    priceState.nextError = null;

    const storage = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
        clear: () => storage.clear(),
      },
    });
    document.body.innerHTML = '<div id="app"></div>';
  });

  it('renders coin search controls, an empty watchlist, and the four-row glasses preview', async () => {
    await import('./main');

    const appTitle = document.querySelector<HTMLElement>('.eyebrow');
    const coinSearchInput = document.querySelector<HTMLInputElement>('#coin-search');
    const refreshWatchlistButton = document.querySelector<HTMLButtonElement>('[data-action="refresh-watchlist"]');
    const refreshNowButton = document.querySelector<HTMLButtonElement>('[data-action="refresh"]');
    const watchlistInput = document.querySelector<HTMLInputElement>('#watchlist-symbols');
    const chips = Array.from(document.querySelectorAll<HTMLElement>('[data-role="watchlist-chip"]'));
    const previewRows = Array.from(document.querySelectorAll<HTMLElement>('[data-role="preview-row"]'));

    expect(appTitle?.textContent).toBe('Crypto Hub');
    expect(document.body.textContent).not.toContain('Even G2 Crypto HUD');
    expect(document.body.textContent).not.toContain('Crypto watchlist, one glance.');
    expect(document.querySelector('a[href="https://docs.coingecko.com/docs/setting-up-your-api-key"]')).toBeNull();
    expect(document.querySelector('a[href="https://www.coingecko.com/en/api"]')).toBeNull();
    expect(coinSearchInput?.placeholder).toBe('Search by symbol, name, or id');
    expect(refreshWatchlistButton?.textContent).toBe('Refresh watchlist');
    expect(refreshNowButton).toBeNull();
    expect(watchlistInput).toBeNull();
    expect(chips.map((chip) => chip.dataset.coinId)).toEqual([]);
    expect(document.querySelector('[data-role="preview-timestamp"]')?.textContent).toBe('');
    expect(previewRows.map((row) => row.textContent)).toEqual(['KEY REQUIRED', 'OPEN PHONE', '', '']);
  });

  it('restores a saved CoinGecko key from Even App bridge storage after launch', async () => {
    bridgeState.hasBridge = true;
    bridgeState.bridge.getLocalStorage.mockResolvedValue('  cg_demo_saved  ');

    await import('./main');
    await flushAsyncWork();

    expect(document.querySelector<HTMLInputElement>('#coingecko-key')?.value).toBe('cg_demo_saved');
    expect(window.localStorage.getItem('even-crypto:coingecko-api-key')).toBe('cg_demo_saved');
    expect(priceState.requestedApiKeys).toEqual([]);
    expect(document.querySelector('[data-role="message"]')?.textContent).toBe(
      'Add a coin to your watchlist to start updates.',
    );
  });

  it('restores a saved watchlist from Even App bridge storage after launch', async () => {
    bridgeState.hasBridge = true;
    bridgeState.bridge.getLocalStorage.mockImplementation(async (key: string) => {
      if (key === 'even-crypto:coingecko-api-key') {
        return 'cg_demo_saved';
      }

      if (key === 'even-crypto:watchlist') {
        return JSON.stringify([
          { id: 'dogecoin', symbol: 'doge', name: 'Dogecoin' },
          { id: 'cardano', symbol: 'ada', name: 'Cardano' },
        ]);
      }

      return '';
    });

    await import('./main');
    await flushAsyncWork();

    const chips = Array.from(document.querySelectorAll<HTMLElement>('[data-role="watchlist-chip"]'));

    expect(chips.map((chip) => chip.dataset.coinId)).toEqual(['dogecoin', 'cardano']);
    expect(JSON.parse(window.localStorage.getItem('even-crypto:watchlist') ?? '')).toEqual([
      { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin' },
      { id: 'cardano', symbol: 'ADA', name: 'Cardano' },
    ]);
    expect(priceState.requestedCoinIds).toContainEqual(['dogecoin', 'cardano']);
  });

  it('refreshes watchlist controls from Even App bridge storage on request', async () => {
    let remoteWatchlist = '';
    bridgeState.hasBridge = true;
    bridgeState.bridge.getLocalStorage.mockImplementation(async (key: string) => {
      if (key === 'even-crypto:coingecko-api-key') {
        return 'cg_demo_saved';
      }

      if (key === 'even-crypto:watchlist') {
        return remoteWatchlist;
      }

      return '';
    });

    await import('./main');
    await flushAsyncWork();

    remoteWatchlist = JSON.stringify([{ id: 'dogecoin', symbol: 'doge', name: 'Dogecoin' }]);
    document.querySelector<HTMLButtonElement>('[data-action="refresh-watchlist"]')?.click();
    await flushAsyncWork();

    const chips = Array.from(document.querySelectorAll<HTMLElement>('[data-role="watchlist-chip"]'));

    expect(chips.map((chip) => chip.dataset.coinId)).toEqual(['dogecoin']);
    expect(priceState.requestedCoinIds).toContainEqual(['dogecoin']);
  });

  it('clears removed watchlist rows on glasses even when the provider refresh fails', async () => {
    bridgeState.hasBridge = true;
    bridgeState.bridge.getLocalStorage.mockImplementation(async (key: string) => {
      if (key === 'even-crypto:coingecko-api-key') {
        return 'cg_demo_saved';
      }

      if (key === 'even-crypto:watchlist') {
        return JSON.stringify([
          { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
          { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
          { id: 'solana', symbol: 'SOL', name: 'Solana' },
        ]);
      }

      return '';
    });

    await import('./main');
    await flushAsyncWork();
    bridgeState.bridge.textContainerUpgrade.mockClear();

    priceState.nextError = new Error('CoinGecko rate limit reached');
    document
      .querySelector<HTMLButtonElement>('[data-role="watchlist-chip"][data-coin-id="solana"] [data-action="remove-coin"]')
      ?.click();
    await flushAsyncWork();

    const chips = Array.from(document.querySelectorAll<HTMLElement>('[data-role="watchlist-chip"]'));
    const updates = bridgeState.bridge.textContainerUpgrade.mock.calls.map((call) => call[0]);
    const row3Updates = updates.filter((update) => update.containerName === 'row3');

    expect(chips.map((chip) => chip.dataset.coinId)).toEqual(['bitcoin', 'ethereum']);
    expect(priceState.requestedCoinIds).toContainEqual(['bitcoin', 'ethereum']);
    expect(row3Updates).toContainEqual(
      expect.objectContaining({
        containerName: 'row3',
        contentLength: 32,
        content: '                                ',
      }),
    );
    expect(document.querySelector('[data-role="message"]')?.textContent).toBe('CoinGecko rate limit reached');
  });

  it('registers EvenHub events and opens the system exit dialog on root double-tap', async () => {
    bridgeState.hasBridge = true;
    bridgeState.bridge.getLocalStorage.mockResolvedValue('');

    await import('./main');
    await flushAsyncWork();

    expect(bridgeState.bridge.onEvenHubEvent).toHaveBeenCalledTimes(1);
    expect(bridgeState.evenHubCallbacks).toHaveLength(1);

    await bridgeState.evenHubCallbacks[0]({ textEvent: { eventType: 3 } });
    await flushAsyncWork();

    expect(bridgeState.bridge.shutDownPageContainer).toHaveBeenCalledWith(1);
  });
});
