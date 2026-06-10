import type { WatchlistCoin } from '../settings/watchlistStore';
import type { CryptoPriceSnapshot, CryptoWatchlistSnapshot, PriceProvider } from './types';

const MOCK_PRICES_BY_ID: Record<string, number> = {
  bitcoin: 67412,
  ethereum: 3540,
  solana: 172,
  ripple: 2.41,
};

export class MockPriceSource implements PriceProvider {
  async getPrices(coins: WatchlistCoin[]): Promise<CryptoWatchlistSnapshot> {
    const updatedAt = new Date();
    const assets: CryptoPriceSnapshot[] = coins.map((coin) => ({
      coin,
      quoteSymbol: 'USD',
      price: MOCK_PRICES_BY_ID[coin.id] ?? 1,
      updatedAt,
      provider: 'mock',
    }));

    return {
      quoteSymbol: 'USD',
      assets,
      updatedAt,
      provider: 'mock',
    };
  }

  async getBtcUsd(): Promise<CryptoPriceSnapshot> {
    const snapshot = await this.getPrices([{ id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' }]);
    return snapshot.assets[0];
  }
}
