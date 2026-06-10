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
    };
    const localTime = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(updatedAt);

    const formatted = formatHudSnapshot(snapshot);

    expect(formatted).toEqual({
      timestamp: `LAST UPDATED ${localTime}`,
      rows: ['BTC   $67,412', 'ETH    $3,540', 'SOL      $172', 'XRP     $2.41'],
    });
    expect([formatted.timestamp, ...formatted.rows].join(' ')).not.toContain('24h');
  });
});

describe('formatKeyRequiredHud', () => {
  it('formats a stable onboarding state for the glasses', () => {
    expect(formatKeyRequiredHud()).toEqual({
      timestamp: '',
      rows: ['KEY REQUIRED', 'OPEN PHONE', '', ''],
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
    });
  });
});
