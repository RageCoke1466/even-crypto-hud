import type { WatchlistCoin } from '../settings/watchlistStore';
import type { CryptoPriceSnapshot, CryptoWatchlistSnapshot, PriceProvider } from './types';

const SIMPLE_PRICE_URL = 'https://api.coingecko.com/api/v3/simple/price';

type FetchFn = typeof fetch;

interface CoinGeckoPriceSourceOptions {
  apiKey: string;
  fetchFn?: FetchFn;
  now?: () => Date;
}

type CoinGeckoSimplePriceResponse = Record<string, { usd?: number } | undefined>;

export class CoinGeckoPriceSource implements PriceProvider {
  private readonly apiKey: string;
  private readonly fetchFn: FetchFn;
  private readonly now: () => Date;

  constructor(options: CoinGeckoPriceSourceOptions) {
    this.apiKey = options.apiKey;
    this.fetchFn = options.fetchFn ?? fetch.bind(globalThis);
    this.now = options.now ?? (() => new Date());
  }

  async getPrices(coins: WatchlistCoin[]): Promise<CryptoWatchlistSnapshot> {
    const requestedAt = this.now();
    const ids = coins.map((coin) => coin.id);
    const params = new URLSearchParams({
      ids: ids.join(','),
      vs_currencies: 'usd',
    });

    const response = await this.fetchFn(`${SIMPLE_PRICE_URL}?${params.toString()}`, {
      headers: {
        accept: 'application/json',
        'x-cg-demo-api-key': this.apiKey,
      },
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error('CoinGecko API key is invalid');
    }

    if (response.status === 429) {
      throw new Error('CoinGecko rate limit reached');
    }

    if (!response.ok) {
      throw new Error(`CoinGecko request failed with status ${response.status}`);
    }

    const data = (await response.json()) as CoinGeckoSimplePriceResponse;
    const assets = coins.flatMap((coin): CryptoPriceSnapshot[] => {
      const price = data[coin.id]?.usd;

      if (typeof price !== 'number' || Number.isNaN(price)) {
        return [];
      }

      return [
        {
          coin,
          quoteSymbol: 'USD',
          price,
          updatedAt: requestedAt,
          provider: 'coingecko',
        },
      ];
    });

    if (assets.length === 0) {
      throw new Error('CoinGecko response did not include requested USD prices');
    }

    return {
      quoteSymbol: 'USD',
      assets,
      updatedAt: requestedAt,
      provider: 'coingecko',
    };
  }

  async getBtcUsd(): Promise<CryptoPriceSnapshot> {
    const snapshot = await this.getPrices([{ id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' }]);
    return snapshot.assets[0];
  }
}
