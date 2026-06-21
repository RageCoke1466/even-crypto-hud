export interface MarketActivitySnapshot {
  score: number;
  volumeActivityScore: number;
  volatilityActivityScore: number;
  trendingActivityScore: number;
  updatedAt: Date;
  provider: 'coingecko';
}
