export const WATCHLIST_PAGE_SIZE = 4;

export type WatchlistPageDirection = 'next' | 'previous';

export function getWatchlistPage<T>(items: T[], pageIndex: number): T[] {
  const normalizedPageIndex = normalizeWatchlistPageIndex(pageIndex, items);
  const start = normalizedPageIndex * WATCHLIST_PAGE_SIZE;
  return items.slice(start, start + WATCHLIST_PAGE_SIZE);
}

export function getWatchlistPageCount(items: readonly unknown[]): number {
  return Math.max(1, Math.ceil(items.length / WATCHLIST_PAGE_SIZE));
}

export function getNextWatchlistPageIndex<T>(
  currentPageIndex: number,
  items: T[],
  direction: WatchlistPageDirection,
): number {
  const pageCount = getWatchlistPageCount(items);

  if (pageCount <= 1) {
    return 0;
  }

  const normalizedPageIndex = normalizeWatchlistPageIndex(currentPageIndex, items);
  return direction === 'next'
    ? (normalizedPageIndex + 1) % pageCount
    : (normalizedPageIndex - 1 + pageCount) % pageCount;
}

export function normalizeWatchlistPageIndex(pageIndex: number, items: readonly unknown[]): number {
  const pageCount = getWatchlistPageCount(items);

  if (pageIndex < 0) {
    return 0;
  }

  return Math.min(pageIndex, pageCount - 1);
}
