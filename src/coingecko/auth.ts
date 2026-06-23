export function buildCoinGeckoDemoUrl(url: string, apiKey: string): string {
  const authenticatedUrl = new URL(url);
  authenticatedUrl.searchParams.set('x_cg_demo_api_key', apiKey);
  return authenticatedUrl.toString();
}
