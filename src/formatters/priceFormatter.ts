import type { CryptoWatchlistSnapshot } from '../prices/types';
import type { WatchlistCoin } from '../settings/watchlistStore';

export interface HudText {
  timestamp: string;
  rows: [string, string, string, string];
}

export function formatHudSnapshot(snapshot: CryptoWatchlistSnapshot): HudText {
  return {
    timestamp: `LAST UPDATED ${formatLocalTime(snapshot.updatedAt)}`,
    rows: normalizeRows(snapshot.assets.map((asset) => formatPriceRow(asset.coin.symbol, asset.price))),
  };
}

export function formatKeyRequiredHud(): HudText {
  return {
    timestamp: '',
    rows: ['KEY REQUIRED', 'OPEN PHONE', '', ''],
  };
}

export function formatLoadingHud(coins: WatchlistCoin[]): HudText {
  return {
    timestamp: '',
    rows: normalizeRows(coins.map((coin) => `${coin.symbol.padEnd(6)}LOADING`)),
  };
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
