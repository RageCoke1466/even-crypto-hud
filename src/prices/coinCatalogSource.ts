import type { CoinCatalogEntry } from '../settings/watchlistStore';

const COIN_LIST_URL = 'https://api.coingecko.com/api/v3/coins/list';

type FetchFn = typeof fetch;

interface CoinGeckoCoinCatalogSourceOptions {
  apiKey: string;
  fetchFn?: FetchFn;
}

interface CoinGeckoCoinListEntry {
  id?: unknown;
  symbol?: unknown;
  name?: unknown;
}

export class CoinGeckoCoinCatalogSource {
  private readonly apiKey: string;
  private readonly fetchFn: FetchFn;

  constructor(options: CoinGeckoCoinCatalogSourceOptions) {
    this.apiKey = options.apiKey;
    this.fetchFn = options.fetchFn ?? fetch.bind(globalThis);
  }

  async getCoins(): Promise<CoinCatalogEntry[]> {
    const response = await this.fetchFn(COIN_LIST_URL, {
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

    const data = (await response.json()) as CoinGeckoCoinListEntry[];

    if (!Array.isArray(data)) {
      throw new Error('CoinGecko coin catalog response was not a list');
    }

    return data.flatMap((coin): CoinCatalogEntry[] => {
      if (typeof coin.id !== 'string' || typeof coin.symbol !== 'string' || typeof coin.name !== 'string') {
        return [];
      }

      return [
        {
          id: coin.id,
          symbol: coin.symbol.toUpperCase(),
          name: coin.name,
        },
      ];
    });
  }
}
