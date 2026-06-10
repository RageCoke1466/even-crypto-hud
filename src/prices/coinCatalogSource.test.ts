import { describe, expect, it, vi } from 'vitest';
import { CoinGeckoCoinCatalogSource } from './coinCatalogSource';

describe('CoinGeckoCoinCatalogSource', () => {
  it('fetches the CoinGecko catalog with the demo key header and normalizes symbols', async () => {
    const fetchFn = vi.fn(async () =>
      new Response(JSON.stringify([{ id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const source = new CoinGeckoCoinCatalogSource({ apiKey: 'cg_demo_123', fetchFn });

    await expect(source.getCoins()).resolves.toEqual([{ id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' }]);
    expect(fetchFn).toHaveBeenCalledWith('https://api.coingecko.com/api/v3/coins/list', {
      headers: {
        accept: 'application/json',
        'x-cg-demo-api-key': 'cg_demo_123',
      },
    });
  });

  it('reports auth and rate-limit failures with stable messages', async () => {
    const fetchFn = vi.fn(async () => new Response('nope', { status: 429 }));
    const source = new CoinGeckoCoinCatalogSource({ apiKey: 'cg_demo_123', fetchFn });

    await expect(source.getCoins()).rejects.toThrow('CoinGecko rate limit reached');
  });
});
