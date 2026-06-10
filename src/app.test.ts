import { describe, expect, it } from 'vitest';
import { buildEmptyWatchlistState, buildLoadingState, buildMissingKeyState, buildSnapshotState } from './app';
import type { WatchlistCoin } from './settings/watchlistStore';

const watchlist: WatchlistCoin[] = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
  { id: 'solana', symbol: 'SOL', name: 'Solana' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP' },
];

describe('app state helpers', () => {
  it('uses onboarding state when the CoinGecko key is missing', () => {
    expect(buildMissingKeyState()).toEqual({
      status: 'missing-key',
      message: 'Paste a CoinGecko Demo API key on the phone to start watchlist updates.',
      hudText: {
        timestamp: '',
        rows: ['KEY REQUIRED', 'OPEN PHONE', '', ''],
      },
      shouldFetch: false,
    });
  });

  it('uses selected symbols while loading a watchlist', () => {
    expect(buildLoadingState(watchlist.slice(0, 2))).toEqual({
      status: 'loading',
      message: 'Fetching BTC, ETH from CoinGecko...',
      hudText: {
        timestamp: '',
        rows: ['BTC   LOADING', 'ETH   LOADING', '', ''],
      },
      shouldFetch: true,
    });
  });

  it('uses an idle state when the watchlist is empty', () => {
    expect(buildEmptyWatchlistState()).toEqual({
      status: 'ready',
      message: 'Add a coin to your watchlist to start updates.',
      hudText: {
        timestamp: '',
        rows: ['', '', '', ''],
      },
      shouldFetch: false,
    });
  });

  it('uses formatted HUD text for a loaded watchlist snapshot', () => {
    const updatedAt = new Date('2026-06-07T21:32:00.000Z');
    const localTime = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(updatedAt);
    const state = buildSnapshotState({
      quoteSymbol: 'USD',
      assets: [
        {
          coin: watchlist[0],
          quoteSymbol: 'USD',
          price: 67412.42,
          updatedAt,
          provider: 'coingecko',
        },
        {
          coin: watchlist[1],
          quoteSymbol: 'USD',
          price: 3540.12,
          updatedAt,
          provider: 'coingecko',
        },
        {
          coin: watchlist[2],
          quoteSymbol: 'USD',
          price: 172.4,
          updatedAt,
          provider: 'coingecko',
        },
        {
          coin: watchlist[3],
          quoteSymbol: 'USD',
          price: 2.41,
          updatedAt,
          provider: 'coingecko',
        },
      ],
      updatedAt,
      provider: 'coingecko',
    });

    expect(state).toEqual({
      status: 'ready',
      message: 'BTC, ETH, SOL, XRP updated from CoinGecko.',
      hudText: {
        timestamp: `LAST UPDATED ${localTime}`,
        rows: ['BTC   $67,412', 'ETH    $3,540', 'SOL      $172', 'XRP     $2.41'],
      },
      shouldFetch: true,
    });
  });
});
