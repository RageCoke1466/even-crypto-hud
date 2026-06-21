import {
  formatHudSnapshot,
  formatKeyRequiredHud,
  formatLoadingHud,
  type HudPageContext,
  type HudText,
} from './formatters/priceFormatter';
import type { CryptoWatchlistSnapshot } from './prices/types';
import type { WatchlistCoin } from './settings/watchlistStore';

export interface CryptoAppState {
  message: string;
  hudText: HudText;
  shouldFetch: boolean;
}

export function buildMissingKeyState(): CryptoAppState {
  return {
    message: 'Paste a CoinGecko Demo API key on the phone to start watchlist updates.',
    hudText: formatKeyRequiredHud(),
    shouldFetch: false,
  };
}

export function buildSnapshotState(snapshot: CryptoWatchlistSnapshot, page?: HudPageContext): CryptoAppState {
  const symbols = snapshot.assets.map((asset) => asset.coin.symbol).join(', ');

  return {
    message: `${symbols} updated from CoinGecko.`,
    hudText: formatHudSnapshot(snapshot, page),
    shouldFetch: true,
  };
}

export function buildLoadingState(coins: WatchlistCoin[], page?: HudPageContext): CryptoAppState {
  const symbols = coins.map((coin) => coin.symbol).join(', ');

  return {
    message: `Fetching ${symbols} from CoinGecko...`,
    hudText: formatLoadingHud(coins, page),
    shouldFetch: true,
  };
}

export function buildEmptyWatchlistState(): CryptoAppState {
  return {
    message: 'Add a coin to your watchlist to start updates.',
    hudText: {
      timestamp: '',
      rows: ['', '', '', ''],
      activityGauge: '',
    },
    shouldFetch: false,
  };
}

export function buildErrorState(message: string, previousHud: HudText): CryptoAppState {
  return {
    message,
    hudText: previousHud,
    shouldFetch: true,
  };
}
