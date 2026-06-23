import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WatchlistCoin } from './settings/watchlistStore';

const bridgeState = vi.hoisted(() => ({
  hasBridge: false,
  evenHubCallbacks: [] as Array<
    (event: {
      listEvent?: { eventType?: number };
      textEvent?: { eventType?: number };
      sysEvent?: { eventType?: number };
    }) => void
  >,
  bridge: {
    getLocalStorage: vi.fn(),
    setLocalStorage: vi.fn(),
    createStartUpPageContainer: vi.fn(),
    rebuildPageContainer: vi.fn(),
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

const marketActivityState = vi.hoisted(() => ({
  requests: 0,
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

vi.mock('./market/coinGeckoMarketActivitySource', () => ({
  CoinGeckoMarketActivitySource: class {
    async getLatest() {
      marketActivityState.requests += 1;

      if (marketActivityState.nextError) {
        const error = marketActivityState.nextError;
        marketActivityState.nextError = null;
        throw error;
      }

      return {
        score: 50,
        volumeActivityScore: 40,
        volatilityActivityScore: 60,
        trendingActivityScore: 50,
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
    bridgeState.bridge.rebuildPageContainer.mockReset();
    bridgeState.bridge.rebuildPageContainer.mockResolvedValue(true);
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
    marketActivityState.requests = 0;
    marketActivityState.nextError = null;

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

  it('renders coin search controls, an empty watchlist, and the glasses layout guide', async () => {
    await import('./main');

    const appTitle = document.querySelector<HTMLElement>('.eyebrow');
    const coinSearchInput = document.querySelector<HTMLInputElement>('#coin-search');
    const refreshWatchlistButton = document.querySelector<HTMLButtonElement>('[data-action="refresh-watchlist"]');
    const refreshNowButton = document.querySelector<HTMLButtonElement>('[data-action="refresh"]');
    const watchlistInput = document.querySelector<HTMLInputElement>('#watchlist-symbols');
    const chips = Array.from(document.querySelectorAll<HTMLElement>('[data-role="watchlist-chip"]'));
    const watchlistRegion = document.querySelector<HTMLElement>('[data-role="preview-watchlist-region"]');
    const statusRegion = document.querySelector<HTMLElement>('[data-role="preview-status-region"]');
    const momentumRegion = document.querySelector<HTMLElement>('[data-role="preview-momentum-region"]');

    expect(appTitle?.textContent).toBe('Crypto Hub');
    expect(document.body.textContent).not.toContain('Even G2 Crypto HUD');
    expect(document.body.textContent).not.toContain('Crypto watchlist, one glance.');
    expect(document.querySelector('a[href="https://docs.coingecko.com/docs/setting-up-your-api-key"]')).toBeNull();
    expect(document.querySelector('a[href="https://www.coingecko.com/en/api"]')).toBeNull();
    expect(document.body.textContent).toContain('Market activity by CoinGecko');
    expect(document.body.textContent).not.toContain('Data provided by CoinGecko');
    expect(coinSearchInput?.placeholder).toBe('Search by symbol, name, or id');
    expect(refreshWatchlistButton?.textContent).toBe('Refresh watchlist');
    expect(refreshNowButton).toBeNull();
    expect(watchlistInput).toBeNull();
    expect(chips.map((chip) => chip.dataset.coinId)).toEqual([]);
    expect(watchlistRegion?.textContent).toContain('Watchlist');
    expect(statusRegion?.textContent).toContain('Live status');
    expect(momentumRegion?.textContent).toContain('Market momentum');
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

  it('replaces the key-required glasses HUD with loading rows when a key is saved', async () => {
    bridgeState.hasBridge = true;
    bridgeState.bridge.getLocalStorage.mockImplementation(async (key: string) => {
      if (key === 'even-crypto:watchlist') {
        return JSON.stringify([{ id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' }]);
      }

      return '';
    });

    await import('./main');
    await flushAsyncWork();

    const initialPage = bridgeState.bridge.createStartUpPageContainer.mock.calls.at(-1)?.[0];
    const initialRows = initialPage.textObject
      ?.filter((container: { containerName?: string }) => container.containerName?.startsWith('row'))
      .map((container: { content?: string }) => container.content);
    const initialRow1Update = bridgeState.bridge.textContainerUpgrade.mock.calls
      .map((call) => call[0])
      .find((update) => update.containerName === 'row1');

    expect(initialRows).toEqual(['KEY REQUIRED', 'OPEN PHONE', '', '']);
    expect(initialRow1Update?.content).toContain('KEY REQUIRED');

    bridgeState.bridge.textContainerUpgrade.mockClear();
    priceState.nextError = new Error('CoinGecko rate limit reached');
    const apiKeyInput = document.querySelector<HTMLInputElement>('#coingecko-key');
    const form = document.querySelector<HTMLFormElement>('.key-form');

    apiKeyInput!.value = 'cg_demo_saved';
    form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushAsyncWork();

    const row1Update = bridgeState.bridge.textContainerUpgrade.mock.calls
      .map((call) => call[0])
      .find((update) => update.containerName === 'row1');

    expect(row1Update?.content).toContain('BTC   LOADING');
    expect(document.querySelector('[data-role="message"]')?.textContent).toBe('CoinGecko rate limit reached');
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
    expect(marketActivityState.requests).toBeGreaterThan(0);
    expect(document.querySelector('[data-role="preview-momentum-region"]')?.textContent).toContain('Market momentum');
  });

  it('reorders watchlist coins without refetching prices or market activity', async () => {
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

    const requestCount = priceState.requestedCoinIds.length;
    const marketActivityRequestCount = marketActivityState.requests;
    bridgeState.bridge.textContainerUpgrade.mockClear();

    document
      .querySelector<HTMLButtonElement>('[data-role="watchlist-chip"][data-coin-id="bitcoin"] [data-action="move-coin-down"]')
      ?.click();
    await flushAsyncWork();

    const chips = Array.from(document.querySelectorAll<HTMLElement>('[data-role="watchlist-chip"]'));
    const updates = bridgeState.bridge.textContainerUpgrade.mock.calls.map((call) => call[0]);

    expect(chips.map((chip) => chip.dataset.coinId)).toEqual(['ethereum', 'bitcoin', 'solana']);
    expect(
      JSON.parse(window.localStorage.getItem('even-crypto:watchlist') ?? '').map((coin: WatchlistCoin) => coin.id),
    ).toEqual(['ethereum', 'bitcoin', 'solana']);
    expect(priceState.requestedCoinIds).toHaveLength(requestCount);
    expect(marketActivityState.requests).toBe(marketActivityRequestCount);
    expect(updates.find((update) => update.containerName === 'row1')?.content).toContain('ETH   $1,676.00');
    expect(updates.find((update) => update.containerName === 'row2')?.content).toContain('BTC   $62,914.00');
  });

  it('keeps watchlist prices visible when market activity data is unavailable', async () => {
    bridgeState.hasBridge = true;
    marketActivityState.nextError = new Error('CoinGecko market activity rate limit reached');
    bridgeState.bridge.getLocalStorage.mockImplementation(async (key: string) => {
      if (key === 'even-crypto:coingecko-api-key') {
        return 'cg_demo_saved';
      }

      if (key === 'even-crypto:watchlist') {
        return JSON.stringify([{ id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' }]);
      }

      return '';
    });

    await import('./main');
    await flushAsyncWork();

    const firstPage = bridgeState.bridge.createStartUpPageContainer.mock.calls.at(-1)?.[0];
    const firstPageRows = firstPage.textObject
      ?.filter((container: { containerName?: string }) => container.containerName?.startsWith('row'))
      .map((container: { content?: string }) => container.content);

    expect(priceState.requestedCoinIds).toContainEqual(['bitcoin']);
    expect(marketActivityState.requests).toBeGreaterThan(0);
    expect(firstPageRows).toEqual(['BTC   $62,914.00', '', '', '']);
    expect(document.querySelector('[data-role="message"]')?.textContent).toBe('BTC updated from CoinGecko.');
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

  it('rebuilds an existing native glasses page when startup create is rejected', async () => {
    bridgeState.hasBridge = true;
    bridgeState.bridge.createStartUpPageContainer.mockResolvedValue(1);
    bridgeState.bridge.getLocalStorage.mockImplementation(async (key: string) => {
      if (key === 'even-crypto:coingecko-api-key') {
        return 'cg_demo_saved';
      }

      if (key === 'even-crypto:watchlist') {
        return JSON.stringify([{ id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' }]);
      }

      return '';
    });

    await import('./main');
    await flushAsyncWork();

    const rebuiltPage = bridgeState.bridge.rebuildPageContainer.mock.calls.at(-1)?.[0];
    const row1Update = bridgeState.bridge.textContainerUpgrade.mock.calls
      .map((call) => call[0])
      .filter((update) => update.containerName === 'row1')
      .at(-1);
    const activityGaugeUpdate = bridgeState.bridge.textContainerUpgrade.mock.calls
      .map((call) => call[0])
      .filter((update) => update.containerName === 'activityGauge')
      .at(-1);

    expect(rebuiltPage.textObject?.find((container: { containerName?: string }) => container.containerName === 'row1'))
      .toMatchObject({
        content: 'BTC   $62,914.00',
      });
    expect(row1Update?.content).toContain('BTC   $62,914.00');
    expect(activityGaugeUpdate?.content).toContain('QUIET \\---^---/ ACTIVE');
  });

  it('fetches every saved watchlist coin and pages the glasses HUD with scroll gestures', async () => {
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
          { id: 'ripple', symbol: 'XRP', name: 'XRP' },
          { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin' },
          { id: 'cardano', symbol: 'ADA', name: 'Cardano' },
        ]);
      }

      return '';
    });

    await import('./main');
    await flushAsyncWork();

    const firstPage = bridgeState.bridge.createStartUpPageContainer.mock.calls.at(-1)?.[0];
    const firstPageActivityGauge = firstPage.textObject?.find((container: { containerName?: string }) => {
      return container.containerName === 'activityGauge';
    });
    const firstPageUpdates = bridgeState.bridge.textContainerUpgrade.mock.calls.map((call) => call[0]);
    const latestFirstPageUpdate = (containerName: string) => {
      return firstPageUpdates.filter((update) => update.containerName === containerName).at(-1);
    };

    expect(priceState.requestedCoinIds).toContainEqual([
      'bitcoin',
      'ethereum',
      'solana',
      'ripple',
      'dogecoin',
      'cardano',
    ]);
    expect(firstPageActivityGauge).toMatchObject({
      yPosition: 193,
    });
    expect(latestFirstPageUpdate('timestamp')?.content).toMatch(/^LAST \d{2}:\d{2} P1\/2/);
    expect(latestFirstPageUpdate('row1')?.content).toContain('BTC   $62,914.00');
    expect(latestFirstPageUpdate('row2')?.content).toContain('ETH   $1,676.00');
    expect(latestFirstPageUpdate('row3')?.content).toContain('SOL    $66.00');
    expect(latestFirstPageUpdate('row4')?.content).toContain('XRP     $1.16');
    expect(document.querySelector<HTMLElement>('[data-role="first-four-note"]')?.hidden).toBe(false);
    expect(document.querySelector('[data-role="preview-watchlist-region"]')?.textContent).toContain('Watchlist');

    bridgeState.bridge.textContainerUpgrade.mockClear();
    bridgeState.bridge.createStartUpPageContainer.mockClear();
    bridgeState.bridge.rebuildPageContainer.mockClear();
    const requestCount = priceState.requestedCoinIds.length;
    const marketActivityRequestCount = marketActivityState.requests;

    await bridgeState.evenHubCallbacks[0]({ textEvent: { eventType: 2 } });
    await flushAsyncWork();

    const secondPageUpdates = bridgeState.bridge.textContainerUpgrade.mock.calls.map((call) => call[0]);

    expect(priceState.requestedCoinIds).toHaveLength(requestCount);
    expect(marketActivityState.requests).toBe(marketActivityRequestCount);
    expect(bridgeState.bridge.createStartUpPageContainer).not.toHaveBeenCalled();
    expect(bridgeState.bridge.rebuildPageContainer).not.toHaveBeenCalled();
    expect(secondPageUpdates.find((update) => update.containerName === 'row1')?.content).toContain('DOGE    $1.00');
    expect(secondPageUpdates.find((update) => update.containerName === 'row2')?.content).toContain('ADA     $1.00');
    expect(secondPageUpdates.find((update) => update.containerName === 'row3')?.content).toBe(
      '                                ',
    );
    expect(secondPageUpdates.find((update) => update.containerName === 'row4')?.content).toBe(
      '                                ',
    );
    expect(secondPageUpdates.find((update) => update.containerName === 'timestamp')?.content).toMatch(
      /^LAST \d{2}:\d{2} P2\/2/,
    );
    expect(secondPageUpdates.find((update) => update.containerName === 'activityGauge')?.content).toContain(
      'QUIET \\---^---/ ACTIVE',
    );
    expect(document.querySelector('[data-role="preview-watchlist-region"]')?.textContent).toContain('Watchlist');

    bridgeState.bridge.textContainerUpgrade.mockClear();
    bridgeState.bridge.createStartUpPageContainer.mockClear();
    bridgeState.bridge.rebuildPageContainer.mockClear();

    await bridgeState.evenHubCallbacks[0]({ textEvent: { eventType: 1 } });
    await flushAsyncWork();

    const firstPageAgainUpdates = bridgeState.bridge.textContainerUpgrade.mock.calls.map((call) => call[0]);

    expect(bridgeState.bridge.createStartUpPageContainer).not.toHaveBeenCalled();
    expect(bridgeState.bridge.rebuildPageContainer).not.toHaveBeenCalled();
    expect(firstPageAgainUpdates.find((update) => update.containerName === 'row1')?.content).toContain(
      'BTC   $62,914.00',
    );
    expect(firstPageAgainUpdates.find((update) => update.containerName === 'timestamp')?.content).toMatch(
      /^LAST \d{2}:\d{2} P1\/2/,
    );
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
