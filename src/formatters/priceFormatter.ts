import type { CryptoWatchlistSnapshot } from '../prices/types';
import type { WatchlistCoin } from '../settings/watchlistStore';

export interface HudText {
  timestamp: string;
  rows: [string, string, string, string];
  activityGauge: string;
}

export interface HudPageContext {
  currentPage: number;
  totalPages: number;
}

export function formatHudSnapshot(snapshot: CryptoWatchlistSnapshot, page?: HudPageContext): HudText {
  const localTime = formatLocalTime(snapshot.updatedAt);

  return {
    timestamp: hasMultiplePages(page) ? `LAST ${localTime} ${formatPageLabel(page)}` : `LAST UPDATED ${localTime}`,
    rows: normalizeRows(snapshot.assets.map((asset) => formatPriceRow(asset.coin.symbol, asset.price))),
    activityGauge: snapshot.marketActivity ? formatActivityGauge(snapshot.marketActivity.score) : '',
  };
}

export function formatKeyRequiredHud(): HudText {
  return {
    timestamp: '',
    rows: ['KEY REQUIRED', 'OPEN PHONE', '', ''],
    activityGauge: '',
  };
}

export function formatLoadingHud(coins: WatchlistCoin[], page?: HudPageContext): HudText {
  return {
    timestamp: hasMultiplePages(page) ? `PAGE ${page.currentPage + 1}/${page.totalPages}` : '',
    rows: normalizeRows(coins.map((coin) => `${coin.symbol.padEnd(6)}LOADING`)),
    activityGauge: '',
  };
}

export function getHudActivityRowIndex(text: HudText): number {
  if (!text.activityGauge) {
    return -1;
  }

  for (let index = text.rows.length - 1; index >= 0; index -= 1) {
    if (text.rows[index].trim()) {
      return index;
    }
  }

  return -1;
}

function formatActivityGauge(score: number): string {
  const tickCount = 7;
  const pointerIndex = Math.round((clamp(score, 0, 100) / 100) * (tickCount - 1));
  const ticks = Array.from({ length: tickCount }, (_, index) => (index === pointerIndex ? '^' : '-')).join('');

  return `QUIET \\${ticks}/ ACTIVE`;
}

function formatUsd(value: number): string {
  const isSubDollar = value < 1;
  const minimumFractionDigits = isSubDollar ? 4 : 2;
  const maximumFractionDigits = isSubDollar ? 8 : 2;

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value);
}

function formatLocalTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function formatPriceRow(symbol: string, price: number): string {
  return `${symbol.padEnd(6)}${formatUsd(price).padStart(7)}`;
}

function normalizeRows(rows: string[]): HudText['rows'] {
  return [rows[0] ?? '', rows[1] ?? '', rows[2] ?? '', rows[3] ?? ''];
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function hasMultiplePages(page: HudPageContext | undefined): page is HudPageContext {
  return Boolean(page && page.totalPages > 1);
}

function formatPageLabel(page: HudPageContext): string {
  return `P${page.currentPage + 1}/${page.totalPages}`;
}
