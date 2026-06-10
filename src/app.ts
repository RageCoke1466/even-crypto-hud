import {
  formatHudSnapshot,
  formatKeyRequiredHud,
  formatLoadingHud,
  type HudText,
} from './formatters/priceFormatter';
import type { CryptoWatchlistSnapshot } from './prices/types';
import type { WatchlistCoin } from './settings/watchlistStore';

export type AppStatus = 'missing-key' | 'loading' | 'ready' | 'error';

export interface CryptoAppState {
  status: AppStatus;
  message: string;
  hudText: HudText;
  shouldFetch: boolean;
}

export function buildMissingKeyState(): CryptoAppState {
  return {
    status: 'missing-key',
    message: 'Paste a CoinGecko Demo API key on the phone to start watchlist updates.',
    hudText: formatKeyRequiredHud(),
    shouldFetch: false,
  };
}

export function buildSnapshotState(snapshot: CryptoWatchlistSnapshot): CryptoAppState {
  const symbols = snapshot.assets.map((asset) => asset.coin.symbol).join(', ');

  return {
    status: 'ready',
    message: `${symbols} updated from CoinGecko.`,
    hudText: formatHudSnapshot(snapshot),
    shouldFetch: true,
  };
}

export function buildLoadingState(coins: WatchlistCoin[]): CryptoAppState {
  const symbols = coins.map((coin) => coin.symbol).join(', ');

  return {
    status: 'loading',
    message: `Fetching ${symbols} from CoinGecko...`,
    hudText: formatLoadingHud(coins),
    shouldFetch: true,
  };
}

export function buildEmptyWatchlistState(): CryptoAppState {
  return {
    status: 'ready',
    message: 'Add a coin to your watchlist to start updates.',
    hudText: {
      timestamp: '',
      rows: ['', '', '', ''],
    },
    shouldFetch: false,
  };
}

export function buildErrorState(message: string, previousHud: HudText): CryptoAppState {
  return {
    status: 'error',
    message,
    hudText: previousHud,
    shouldFetch: true,
  };
}
