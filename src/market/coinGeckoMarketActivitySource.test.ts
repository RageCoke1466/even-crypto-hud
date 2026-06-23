import { describe, expect, it, vi } from 'vitest';
import { CoinGeckoMarketActivitySource } from './coinGeckoMarketActivitySource';

const GLOBAL_MARKET_URL = 'https://api.coingecko.com/api/v3/global';
const TOP_MARKETS_URL =
  'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&price_change_percentage=24h';
const TRENDING_URL = 'https://api.coingecko.com/api/v3/search/trending';
const TRENDING_MARKETS_URL =
  'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,solana&price_change_percentage=24h';
const API_KEY = 'cg_demo_123';

describe('CoinGeckoMarketActivitySource', () => {
  it('combines volume, volatility, and trending activity into a CoinGecko-only score', async () => {
    const fetchFn = vi.fn(async (url: string | URL | Request) => {
      switch (String(url)) {
        case withDemoKey(GLOBAL_MARKET_URL):
          return jsonResponse({
            data: {
              total_market_cap: { usd: 1000 },
              total_volume: { usd: 50 },
              updated_at: 1779878351,
            },
          });
        case withDemoKey(TOP_MARKETS_URL):
          return jsonResponse([
            {
              id: 'bitcoin',
              symbol: 'btc',
              market_cap: 600,
              total_volume: 30,
              price_change_percentage_24h: 4,
            },
            {
              id: 'ethereum',
              symbol: 'eth',
              market_cap: 400,
              total_volume: 20,
              price_change_percentage_24h: -4,
            },
            {
              id: 'tether',
              symbol: 'usdt',
              market_cap: 2000,
              total_volume: 1000,
              price_change_percentage_24h: 20,
            },
          ]);
        case withDemoKey(TRENDING_URL):
          return jsonResponse({
            coins: [
              { item: { id: 'bitcoin' } },
              { item: { id: 'tether' } },
              { item: { id: 'solana' } },
            ],
          });
        case withDemoKey(TRENDING_MARKETS_URL):
          return jsonResponse([
            {
              id: 'bitcoin',
              symbol: 'btc',
              market_cap: 100,
              total_volume: 6.8,
              price_change_percentage_24h: 3.3,
            },
            {
              id: 'solana',
              symbol: 'sol',
              market_cap: 100,
              total_volume: 6.8,
              price_change_percentage_24h: -3.3,
            },
          ]);
        default:
          throw new Error(`Unexpected URL: ${String(url)}`);
      }
    });
    const source = new CoinGeckoMarketActivitySource({ apiKey: API_KEY, fetchFn });

    await expect(source.getLatest()).resolves.toEqual({
      score: 56,
      volumeActivityScore: 38,
      volatilityActivityScore: 76,
      trendingActivityScore: 60,
      updatedAt: new Date('2026-05-27T10:39:11.000Z'),
      provider: 'coingecko',
    });
    expect(fetchFn).toHaveBeenCalledTimes(4);
    for (const url of [GLOBAL_MARKET_URL, TOP_MARKETS_URL, TRENDING_URL, TRENDING_MARKETS_URL]) {
      expect(fetchFn).toHaveBeenCalledWith(withDemoKey(url));
    }
  });

  it('excludes stablecoins from volatility calculations', async () => {
    const fetchFn = buildFetchFn({
      global: {
        data: {
          total_market_cap: { usd: 1000 },
          total_volume: { usd: 50 },
          updated_at: 1779878351,
        },
      },
      topMarkets: [
        {
          id: 'bitcoin',
          symbol: 'btc',
          market_cap: 100,
          total_volume: 5,
          price_change_percentage_24h: 1,
        },
        {
          id: 'usd-coin',
          symbol: 'usdc',
          market_cap: 1000,
          total_volume: 900,
          price_change_percentage_24h: 35,
        },
      ],
      trending: { coins: [] },
      trendingMarkets: [],
    });
    const source = new CoinGeckoMarketActivitySource({ apiKey: API_KEY, fetchFn });

    const activity = await source.getLatest();

    expect(activity.volatilityActivityScore).toBe(6);
  });

  it('keeps the market activity score when trending market details fail', async () => {
    const fetchFn = vi.fn(async (url: string | URL | Request) => {
      switch (String(url)) {
        case withDemoKey(GLOBAL_MARKET_URL):
          return jsonResponse({
            data: {
              total_market_cap: { usd: 1000 },
              total_volume: { usd: 50 },
              updated_at: 1779878351,
            },
          });
        case withDemoKey(TOP_MARKETS_URL):
          return jsonResponse([
            {
              id: 'bitcoin',
              symbol: 'btc',
              market_cap: 600,
              total_volume: 30,
              price_change_percentage_24h: 4,
            },
            {
              id: 'ethereum',
              symbol: 'eth',
              market_cap: 400,
              total_volume: 20,
              price_change_percentage_24h: -4,
            },
          ]);
        case withDemoKey(TRENDING_URL):
          return jsonResponse({
            coins: [{ item: { id: 'bitcoin' } }, { item: { id: 'solana' } }],
          });
        case withDemoKey(TRENDING_MARKETS_URL):
          throw new TypeError('Load failed');
        default:
          throw new Error(`Unexpected URL: ${String(url)}`);
      }
    });
    const source = new CoinGeckoMarketActivitySource({ apiKey: API_KEY, fetchFn });

    await expect(source.getLatest()).resolves.toEqual({
      score: 44,
      volumeActivityScore: 38,
      volatilityActivityScore: 76,
      trendingActivityScore: 0,
      updatedAt: new Date('2026-05-27T10:39:11.000Z'),
      provider: 'coingecko',
    });
  });

  it('reports rate-limit failures as stable messages', async () => {
    const fetchFn = vi.fn(async () => new Response('nope', { status: 429 }));
    const source = new CoinGeckoMarketActivitySource({ apiKey: API_KEY, fetchFn });

    await expect(source.getLatest()).rejects.toThrow('CoinGecko market activity rate limit reached');
  });

  it('rejects responses without a valid total market cap', async () => {
    const fetchFn = buildFetchFn({
      global: { data: { total_volume: { usd: 50 }, updated_at: 1779878351 } },
      topMarkets: [],
      trending: { coins: [] },
      trendingMarkets: [],
    });
    const source = new CoinGeckoMarketActivitySource({ apiKey: API_KEY, fetchFn });

    await expect(source.getLatest()).rejects.toThrow(
      'CoinGecko market activity response did not include a valid total market cap',
    );
  });
});

function buildFetchFn(fixtures: {
  global: unknown;
  topMarkets: unknown;
  trending: unknown;
  trendingMarkets: unknown;
}) {
  return vi.fn(async (url: string | URL | Request) => {
    switch (String(url)) {
      case withDemoKey(GLOBAL_MARKET_URL):
        return jsonResponse(fixtures.global);
      case withDemoKey(TOP_MARKETS_URL):
        return jsonResponse(fixtures.topMarkets);
      case withDemoKey(TRENDING_URL):
        return jsonResponse(fixtures.trending);
      default:
        return jsonResponse(fixtures.trendingMarkets);
    }
  });
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function withDemoKey(url: string): string {
  const authenticatedUrl = new URL(url);
  authenticatedUrl.searchParams.set('x_cg_demo_api_key', API_KEY);
  return authenticatedUrl.toString();
}
