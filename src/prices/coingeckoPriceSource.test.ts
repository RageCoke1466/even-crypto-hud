import { describe, expect, it, vi } from 'vitest';
import { CoinGeckoPriceSource } from './coingeckoPriceSource';
import type { WatchlistCoin } from '../settings/watchlistStore';

const watchlist: WatchlistCoin[] = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
  { id: 'solana', symbol: 'SOL', name: 'Solana' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP' },
];

describe('CoinGeckoPriceSource', () => {
  it('fetches a watchlist with query-string auth to avoid browser preflights', async () => {
    const fetchFn = vi.fn(async () =>
      new Response(
        JSON.stringify({
          bitcoin: { usd: 67412.42 },
          ethereum: { usd: 3540.12 },
          solana: { usd: 172.4 },
          ripple: { usd: 2.41 },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const source = new CoinGeckoPriceSource({
      apiKey: 'cg_demo_123',
      fetchFn,
      now: () => new Date('2026-06-07T21:32:00.000Z'),
    });

    const snapshot = await source.getPrices(watchlist);

    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin%2Cethereum%2Csolana%2Cripple&vs_currencies=usd&precision=full&x_cg_demo_api_key=cg_demo_123',
    );
    expect(snapshot).toEqual({
      quoteSymbol: 'USD',
      assets: [
        {
          coin: { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
          quoteSymbol: 'USD',
          price: 67412.42,
          updatedAt: new Date('2026-06-07T21:32:00.000Z'),
          provider: 'coingecko',
        },
        {
          coin: { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
          quoteSymbol: 'USD',
          price: 3540.12,
          updatedAt: new Date('2026-06-07T21:32:00.000Z'),
          provider: 'coingecko',
        },
        {
          coin: { id: 'solana', symbol: 'SOL', name: 'Solana' },
          quoteSymbol: 'USD',
          price: 172.4,
          updatedAt: new Date('2026-06-07T21:32:00.000Z'),
          provider: 'coingecko',
        },
        {
          coin: { id: 'ripple', symbol: 'XRP', name: 'XRP' },
          quoteSymbol: 'USD',
          price: 2.41,
          updatedAt: new Date('2026-06-07T21:32:00.000Z'),
          provider: 'coingecko',
        },
      ],
      updatedAt: new Date('2026-06-07T21:32:00.000Z'),
      provider: 'coingecko',
    });
  });

  it('reports auth and rate-limit failures as stable messages', async () => {
    const fetchFn = vi.fn(async () => new Response('nope', { status: 429 }));
    const source = new CoinGeckoPriceSource({
      apiKey: 'cg_demo_123',
      fetchFn,
      now: () => new Date('2026-06-07T21:32:00.000Z'),
    });

    await expect(source.getPrices([watchlist[0]])).rejects.toThrow('CoinGecko rate limit reached');
  });

  it('reports an empty response as a stable message', async () => {
    const fetchFn = vi.fn(async () =>
      new Response(JSON.stringify({ bitcoin: {} }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const source = new CoinGeckoPriceSource({
      apiKey: 'cg_demo_123',
      fetchFn,
      now: () => new Date('2026-06-07T21:32:00.000Z'),
    });

    await expect(source.getPrices([watchlist[0]])).rejects.toThrow(
      'CoinGecko response did not include requested USD prices',
    );
  });
});
