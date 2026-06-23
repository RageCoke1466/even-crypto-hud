import type { MarketActivitySnapshot } from './types';

const GLOBAL_MARKET_URL = 'https://api.coingecko.com/api/v3/global';
const TOP_MARKETS_URL =
  'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&price_change_percentage=24h';
const TRENDING_URL = 'https://api.coingecko.com/api/v3/search/trending';
const COIN_MARKETS_BY_IDS_URL =
  'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids={ids}&price_change_percentage=24h';

const GLOBAL_VOLUME_WEIGHT = 0.7;
const TOP_COIN_VOLUME_WEIGHT = 0.3;
const VOLUME_SCORE_MIN_TURNOVER_PERCENT = 2;
const VOLUME_SCORE_MAX_TURNOVER_PERCENT = 10;
const VOLATILITY_SCORE_MIN_ABS_CHANGE_PERCENT = 0.75;
const VOLATILITY_SCORE_MAX_ABS_CHANGE_PERCENT = 5;

const STABLECOIN_IDS = new Set([
  'tether',
  'usd-coin',
  'usds',
  'dai',
  'first-digital-usd',
  'ethena-usde',
  'usdd',
  'paypal-usd',
  'true-usd',
  'frax',
  'usde',
  'usdt0',
  'susds',
  'usdb',
  'usdp',
  'gemini-dollar',
  'liquity-usd',
]);
const STABLECOIN_SYMBOLS = new Set([
  'usdt',
  'usdc',
  'usds',
  'dai',
  'fdusd',
  'usde',
  'usdd',
  'pyusd',
  'tusd',
  'frax',
  'usdt0',
  'susds',
  'usdb',
  'usdp',
  'gusd',
  'lusd',
]);

type FetchFn = typeof fetch;

interface CoinGeckoMarketActivitySourceOptions {
  apiKey: string;
  fetchFn?: FetchFn;
}

interface CoinGeckoGlobalMarketResponse {
  data?: {
    total_market_cap?: {
      usd?: number;
    };
    total_volume?: {
      usd?: number;
    };
    updated_at?: number;
  };
}

interface CoinGeckoMarketCoin {
  id?: string;
  symbol?: string;
  market_cap?: number;
  total_volume?: number;
  price_change_percentage_24h?: number;
  price_change_percentage_24h_in_currency?: number;
}

interface CoinGeckoTrendingResponse {
  coins?: Array<{
    item?: {
      id?: string;
    };
  }>;
}

interface MarketTotals {
  marketCapUsd: number;
  volumeUsd: number;
}

export class CoinGeckoMarketActivitySource {
  private readonly apiKey: string;
  private readonly fetchFn: FetchFn;

  constructor(options: CoinGeckoMarketActivitySourceOptions) {
    this.apiKey = options.apiKey;
    this.fetchFn = options.fetchFn ?? fetch.bind(globalThis);
  }

  async getLatest(): Promise<MarketActivitySnapshot> {
    const [globalMarket, topMarkets, trending] = await Promise.all([
      this.fetchJson<CoinGeckoGlobalMarketResponse>(GLOBAL_MARKET_URL),
      this.fetchJson<CoinGeckoMarketCoin[]>(TOP_MARKETS_URL),
      this.fetchJson<CoinGeckoTrendingResponse>(TRENDING_URL),
    ]);

    const totals = parseGlobalMarketTotals(globalMarket);
    const updatedAt = parseGlobalMarketUpdatedAt(globalMarket);
    const topNonStableMarkets = parseMarketCoins(topMarkets).filter((coin) => !isStablecoin(coin));
    const trendingMarkets = await this.fetchTrendingMarkets(trending);
    const volumeActivityScore = calculateVolumeActivityScore(totals, topNonStableMarkets);
    const volatilityActivityScore = calculateVolatilityActivityScore(topNonStableMarkets);
    const trendingActivityScore = calculateTrendingActivityScore(trendingMarkets);

    return {
      score: Math.round(volumeActivityScore * 0.45 + volatilityActivityScore * 0.35 + trendingActivityScore * 0.2),
      volumeActivityScore,
      volatilityActivityScore,
      trendingActivityScore,
      updatedAt,
      provider: 'coingecko',
    };
  }

  private async fetchTrendingMarkets(trending: CoinGeckoTrendingResponse): Promise<CoinGeckoMarketCoin[]> {
    const ids = unique(
      (trending.coins ?? [])
        .map((coin) => coin.item?.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
        .filter((id) => !isStablecoin({ id })),
    );

    if (ids.length === 0) {
      return [];
    }

    const encodedIds = ids.map((id) => encodeURIComponent(id)).join(',');
    const url = COIN_MARKETS_BY_IDS_URL.replace('{ids}', encodedIds);

    try {
      return parseMarketCoins(await this.fetchJson<CoinGeckoMarketCoin[]>(url)).filter((coin) => !isStablecoin(coin));
    } catch {
      return [];
    }
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const response = await this.fetchFn(url, {
      headers: {
        accept: 'application/json',
        'x-cg-demo-api-key': this.apiKey,
      },
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error('CoinGecko API key is invalid');
    }

    if (response.status === 429) {
      throw new Error('CoinGecko market activity rate limit reached');
    }

    if (!response.ok) {
      throw new Error(`CoinGecko market activity request failed with status ${response.status}`);
    }

    return (await response.json()) as T;
  }
}

function parseGlobalMarketTotals(response: CoinGeckoGlobalMarketResponse): MarketTotals {
  const marketCapUsd = response.data?.total_market_cap?.usd;
  const volumeUsd = response.data?.total_volume?.usd;

  if (typeof marketCapUsd !== 'number' || !Number.isFinite(marketCapUsd) || marketCapUsd <= 0) {
    throw new Error('CoinGecko market activity response did not include a valid total market cap');
  }

  if (typeof volumeUsd !== 'number' || !Number.isFinite(volumeUsd) || volumeUsd < 0) {
    throw new Error('CoinGecko market activity response did not include a valid total volume');
  }

  return { marketCapUsd, volumeUsd };
}

function parseGlobalMarketUpdatedAt(response: CoinGeckoGlobalMarketResponse): Date {
  const updatedAt = response.data?.updated_at;

  if (typeof updatedAt !== 'number' || !Number.isFinite(updatedAt) || updatedAt <= 0) {
    throw new Error('CoinGecko market activity response did not include a valid timestamp');
  }

  return new Date(updatedAt * 1000);
}

function parseMarketCoins(response: CoinGeckoMarketCoin[]): CoinGeckoMarketCoin[] {
  if (!Array.isArray(response)) {
    throw new Error('CoinGecko market activity coin response was not a list');
  }

  return response;
}

function calculateVolumeActivityScore(totals: MarketTotals, topMarkets: CoinGeckoMarketCoin[]): number {
  const globalTurnoverScore = turnoverToScore(totals.volumeUsd, totals.marketCapUsd);
  const topTotals = topMarkets.reduce(
    (sum, coin) => {
      if (isPositiveNumber(coin.market_cap) && isNonNegativeNumber(coin.total_volume)) {
        return {
          marketCapUsd: sum.marketCapUsd + coin.market_cap,
          volumeUsd: sum.volumeUsd + coin.total_volume,
        };
      }

      return sum;
    },
    { marketCapUsd: 0, volumeUsd: 0 },
  );

  if (topTotals.marketCapUsd <= 0) {
    return Math.round(globalTurnoverScore);
  }

  return Math.round(
    globalTurnoverScore * GLOBAL_VOLUME_WEIGHT +
      turnoverToScore(topTotals.volumeUsd, topTotals.marketCapUsd) * TOP_COIN_VOLUME_WEIGHT,
  );
}

function calculateVolatilityActivityScore(markets: CoinGeckoMarketCoin[]): number {
  const totals = markets.reduce(
    (sum, coin) => {
      const change = getPriceChangePercentage24h(coin);

      if (isPositiveNumber(coin.market_cap) && typeof change === 'number') {
        return {
          marketCapUsd: sum.marketCapUsd + coin.market_cap,
          weightedAbsChange: sum.weightedAbsChange + coin.market_cap * Math.abs(change),
        };
      }

      return sum;
    },
    { marketCapUsd: 0, weightedAbsChange: 0 },
  );

  if (totals.marketCapUsd <= 0) {
    return 0;
  }

  return Math.round(volatilityToScore(totals.weightedAbsChange / totals.marketCapUsd));
}

function calculateTrendingActivityScore(markets: CoinGeckoMarketCoin[]): number {
  const scores = markets.flatMap((coin) => {
    const change = getPriceChangePercentage24h(coin);

    if (!isPositiveNumber(coin.market_cap) || !isNonNegativeNumber(coin.total_volume) || typeof change !== 'number') {
      return [];
    }

    const turnoverScore = turnoverToScore(coin.total_volume, coin.market_cap);
    const volatilityScore = volatilityToScore(Math.abs(change));

    return [(turnoverScore + volatilityScore) / 2];
  });

  if (scores.length === 0) {
    return 0;
  }

  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

function turnoverToScore(volumeUsd: number, marketCapUsd: number): number {
  return scoreLinear(
    (volumeUsd / marketCapUsd) * 100,
    VOLUME_SCORE_MIN_TURNOVER_PERCENT,
    VOLUME_SCORE_MAX_TURNOVER_PERCENT,
  );
}

function volatilityToScore(absChangePercentage: number): number {
  return scoreLinear(
    absChangePercentage,
    VOLATILITY_SCORE_MIN_ABS_CHANGE_PERCENT,
    VOLATILITY_SCORE_MAX_ABS_CHANGE_PERCENT,
  );
}

function getPriceChangePercentage24h(coin: CoinGeckoMarketCoin): number | undefined {
  const change = coin.price_change_percentage_24h ?? coin.price_change_percentage_24h_in_currency;
  return typeof change === 'number' && Number.isFinite(change) ? change : undefined;
}

function isStablecoin(coin: Pick<CoinGeckoMarketCoin, 'id' | 'symbol'>): boolean {
  const id = coin.id?.toLowerCase();
  const symbol = coin.symbol?.toLowerCase();

  return (id !== undefined && STABLECOIN_IDS.has(id)) || (symbol !== undefined && STABLECOIN_SYMBOLS.has(symbol));
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function scoreLinear(value: number, minimum: number, maximum: number): number {
  return clamp(((value - minimum) / (maximum - minimum)) * 100, 0, 100);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}
