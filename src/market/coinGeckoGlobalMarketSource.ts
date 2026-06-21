import type { MarketGaugeSnapshot } from './types';

const GLOBAL_MARKET_URL = 'https://api.coingecko.com/api/v3/global';
const MARKET_CAP_CHANGE_FULL_SCALE_PERCENT = 5;

type FetchFn = typeof fetch;

interface CoinGeckoGlobalMarketSourceOptions {
  apiKey: string;
  fetchFn?: FetchFn;
}

interface CoinGeckoGlobalMarketResponse {
  data?: {
    market_cap_change_percentage_24h_usd?: number;
    volume_change_percentage_24h_usd?: number;
    updated_at?: number;
  };
}

export class CoinGeckoGlobalMarketSource {
  private readonly apiKey: string;
  private readonly fetchFn: FetchFn;

  constructor(options: CoinGeckoGlobalMarketSourceOptions) {
    this.apiKey = options.apiKey;
    this.fetchFn = options.fetchFn ?? fetch.bind(globalThis);
  }

  async getLatest(): Promise<MarketGaugeSnapshot> {
    const response = await this.fetchFn(GLOBAL_MARKET_URL, {
      headers: {
        accept: 'application/json',
        'x-cg-demo-api-key': this.apiKey,
      },
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error('CoinGecko API key is invalid');
    }

    if (response.status === 429) {
      throw new Error('CoinGecko global market rate limit reached');
    }

    if (!response.ok) {
      throw new Error(`CoinGecko global market request failed with status ${response.status}`);
    }

    const data = (await response.json()) as CoinGeckoGlobalMarketResponse;
    const marketCapChange = data.data?.market_cap_change_percentage_24h_usd;
    const updatedAt = data.data?.updated_at;

    if (typeof marketCapChange !== 'number' || Number.isNaN(marketCapChange)) {
      throw new Error('CoinGecko global market response did not include a valid 24h market cap change');
    }

    if (typeof updatedAt !== 'number' || !Number.isFinite(updatedAt) || updatedAt <= 0) {
      throw new Error('CoinGecko global market response did not include a valid timestamp');
    }

    return {
      score: marketCapChangeToScore(marketCapChange),
      marketCapChangePercentage24hUsd: marketCapChange,
      volumeChangePercentage24hUsd: data.data?.volume_change_percentage_24h_usd,
      updatedAt: new Date(updatedAt * 1000),
      provider: 'coingecko',
    };
  }
}

function marketCapChangeToScore(changePercentage: number): number {
  const normalized =
    ((changePercentage + MARKET_CAP_CHANGE_FULL_SCALE_PERCENT) / (MARKET_CAP_CHANGE_FULL_SCALE_PERCENT * 2)) * 100;

  return Math.round(clamp(normalized, 0, 100));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
