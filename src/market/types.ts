export interface MarketGaugeSnapshot {
  score: number;
  marketCapChangePercentage24hUsd: number;
  volumeChangePercentage24hUsd?: number;
  updatedAt: Date;
  provider: 'coingecko';
}
