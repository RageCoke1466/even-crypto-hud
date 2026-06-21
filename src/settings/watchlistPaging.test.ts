import { describe, expect, it } from 'vitest';
import {
  WATCHLIST_PAGE_SIZE,
  getNextWatchlistPageIndex,
  getWatchlistPage,
  getWatchlistPageCount,
} from './watchlistPaging';
import type { WatchlistCoin } from './watchlistStore';

const watchlist: WatchlistCoin[] = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
  { id: 'solana', symbol: 'SOL', name: 'Solana' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP' },
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin' },
  { id: 'cardano', symbol: 'ADA', name: 'Cardano' },
];

describe('watchlist paging', () => {
  it('splits watchlist coins into four-row glasses pages', () => {
    expect(WATCHLIST_PAGE_SIZE).toBe(4);
    expect(getWatchlistPageCount(watchlist)).toBe(2);
    expect(getWatchlistPage(watchlist, 0).map((coin) => coin.id)).toEqual([
      'bitcoin',
      'ethereum',
      'solana',
      'ripple',
    ]);
    expect(getWatchlistPage(watchlist, 1).map((coin) => coin.id)).toEqual(['dogecoin', 'cardano']);
  });

  it('wraps manual page movement at the start and end of the watchlist', () => {
    expect(getNextWatchlistPageIndex(0, watchlist, 'next')).toBe(1);
    expect(getNextWatchlistPageIndex(1, watchlist, 'next')).toBe(0);
    expect(getNextWatchlistPageIndex(0, watchlist, 'previous')).toBe(1);
    expect(getNextWatchlistPageIndex(1, watchlist, 'previous')).toBe(0);
  });
});
