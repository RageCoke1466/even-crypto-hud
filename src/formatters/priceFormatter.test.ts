import { describe, expect, it } from 'vitest';
import { formatHudSnapshot, formatKeyRequiredHud, formatLoadingHud } from './priceFormatter';
import type { CryptoWatchlistSnapshot } from '../prices/types';

describe('formatHudSnapshot', () => {
  it('formats a watchlist card with local time and without 24h comparison text', () => {
    const updatedAt = new Date('2026-06-07T21:32:00.000Z');
    const snapshot: CryptoWatchlistSnapshot = {
      quoteSymbol: 'USD',
      assets: [
        {
          coin: { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
          quoteSymbol: 'USD',
          price: 67412.42,
          updatedAt,
          provider: 'coingecko',
        },
        {
          coin: { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
          quoteSymbol: 'USD',
          price: 3540.12,
          updatedAt,
          provider: 'coingecko',
        },
        {
          coin: { id: 'solana', symbol: 'SOL', name: 'Solana' },
          quoteSymbol: 'USD',
          price: 172.4,
          updatedAt,
          provider: 'coingecko',
        },
        {
          coin: { id: 'ripple', symbol: 'XRP', name: 'XRP' },
          quoteSymbol: 'USD',
          price: 2.41,
          updatedAt,
          provider: 'coingecko',
        },
      ],
      updatedAt,
      provider: 'coingecko',
      marketActivity: {
        score: 50,
        volumeActivityScore: 40,
        volatilityActivityScore: 60,
        trendingActivityScore: 50,
        updatedAt,
        provider: 'coingecko',
      },
    };
    const localTime = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(updatedAt);

    const formatted = formatHudSnapshot(snapshot);

    expect(formatted).toEqual({
      timestamp: `LAST UPDATED ${localTime}`,
      rows: ['BTC   $67,412.42', 'ETH   $3,540.12', 'SOL   $172.40', 'XRP     $2.41'],
      activityGauge: 'QUIET \\---^---/ ACTIVE',
    });
    expect(formatted).not.toHaveProperty('activityScore');
    expect([formatted.timestamp, ...formatted.rows].join(' ')).not.toContain('24h');
  });

  it('formats sub-dollar prices with at least four and at most eight decimals', () => {
    const updatedAt = new Date('2026-06-07T21:32:00.000Z');
    const snapshot: CryptoWatchlistSnapshot = {
      quoteSymbol: 'USD',
      assets: [
        {
          coin: { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin' },
          quoteSymbol: 'USD',
          price: 0.123456789,
          updatedAt,
          provider: 'coingecko',
        },
        {
          coin: { id: 'cardano', symbol: 'ADA', name: 'Cardano' },
          quoteSymbol: 'USD',
          price: 0.5,
          updatedAt,
          provider: 'coingecko',
        },
        {
          coin: { id: 'shiba-inu', symbol: 'SHIB', name: 'Shiba Inu' },
          quoteSymbol: 'USD',
          price: 0.000012345678,
          updatedAt,
          provider: 'coingecko',
        },
      ],
      updatedAt,
      provider: 'coingecko',
    };

    expect(formatHudSnapshot(snapshot)).toMatchObject({
      rows: ['DOGE  $0.12345679', 'ADA   $0.5000', 'SHIB  $0.00001235', ''],
      activityGauge: '',
    });
  });

  it('maps high activity scores toward ACTIVE', () => {
    const updatedAt = new Date('2026-06-07T21:32:00.000Z');
    const snapshot: CryptoWatchlistSnapshot = {
      quoteSymbol: 'USD',
      assets: [
        {
          coin: { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
          quoteSymbol: 'USD',
          price: 67412.42,
          updatedAt,
          provider: 'coingecko',
        },
      ],
      updatedAt,
      provider: 'coingecko',
      marketActivity: {
        score: 88,
        volumeActivityScore: 90,
        volatilityActivityScore: 85,
        trendingActivityScore: 88,
        updatedAt,
        provider: 'coingecko',
      },
    };

    const formatted = formatHudSnapshot(snapshot);

    expect(formatted).toMatchObject({
      activityGauge: 'QUIET \\-----^-/ ACTIVE',
    });
    expect(formatted).not.toHaveProperty('activityScore');
  });
});

describe('formatKeyRequiredHud', () => {
  it('formats a stable onboarding state for the glasses', () => {
    expect(formatKeyRequiredHud()).toEqual({
      timestamp: '',
      rows: ['KEY REQUIRED', 'OPEN PHONE', '', ''],
      activityGauge: '',
    });
  });
});

describe('formatLoadingHud', () => {
  it('keeps the selected watchlist visible while prices load', () => {
    expect(
      formatLoadingHud([
        { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
        { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
      ]),
    ).toEqual({
      timestamp: '',
      rows: ['BTC   LOADING', 'ETH   LOADING', '', ''],
      activityGauge: '',
    });
  });
});
