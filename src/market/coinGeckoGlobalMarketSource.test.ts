import { describe, expect, it, vi } from 'vitest';
import { CoinGeckoGlobalMarketSource } from './coinGeckoGlobalMarketSource';

describe('CoinGeckoGlobalMarketSource', () => {
  it('fetches global market data with the user demo key header and maps 24h market cap change to a gauge score', async () => {
    const fetchFn = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: {
            market_cap_change_percentage_24h_usd: 2.2,
            volume_change_percentage_24h_usd: 12.5,
            updated_at: 1779878351,
          },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const source = new CoinGeckoGlobalMarketSource({ apiKey: 'cg_demo_123', fetchFn });

    await expect(source.getLatest()).resolves.toEqual({
      score: 72,
      marketCapChangePercentage24hUsd: 2.2,
      volumeChangePercentage24hUsd: 12.5,
      updatedAt: new Date('2026-05-27T10:39:11.000Z'),
      provider: 'coingecko',
    });
    expect(fetchFn).toHaveBeenCalledWith('https://api.coingecko.com/api/v3/global', {
      headers: {
        accept: 'application/json',
        'x-cg-demo-api-key': 'cg_demo_123',
      },
    });
  });

  it('reports rate-limit failures as stable messages', async () => {
    const fetchFn = vi.fn(async () => new Response('nope', { status: 429 }));
    const source = new CoinGeckoGlobalMarketSource({ apiKey: 'cg_demo_123', fetchFn });

    await expect(source.getLatest()).rejects.toThrow('CoinGecko global market rate limit reached');
  });

  it('reports HTTP failures as stable messages', async () => {
    const fetchFn = vi.fn(async () => new Response('nope', { status: 500 }));
    const source = new CoinGeckoGlobalMarketSource({ apiKey: 'cg_demo_123', fetchFn });

    await expect(source.getLatest()).rejects.toThrow('CoinGecko global market request failed with status 500');
  });

  it('rejects responses without a valid market cap change', async () => {
    const fetchFn = vi.fn(async () =>
      new Response(JSON.stringify({ data: { updated_at: 1779878351 } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const source = new CoinGeckoGlobalMarketSource({ apiKey: 'cg_demo_123', fetchFn });

    await expect(source.getLatest()).rejects.toThrow(
      'CoinGecko global market response did not include a valid 24h market cap change',
    );
  });
});
