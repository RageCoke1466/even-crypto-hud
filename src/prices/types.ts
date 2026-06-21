import type { WatchlistCoin } from '../settings/watchlistStore';
import type { MarketGaugeSnapshot } from '../market/types';

export interface CryptoPriceSnapshot {
  coin: WatchlistCoin;
  quoteSymbol: 'USD';
  price: number;
  updatedAt: Date;
  provider: 'coingecko' | 'mock';
}

export interface CryptoWatchlistSnapshot {
  quoteSymbol: 'USD';
  assets: CryptoPriceSnapshot[];
  updatedAt: Date;
  provider: 'coingecko' | 'mock';
  marketGauge?: MarketGaugeSnapshot;
}

export interface PriceProvider {
  getPrices(coins: WatchlistCoin[]): Promise<CryptoWatchlistSnapshot>;
}
