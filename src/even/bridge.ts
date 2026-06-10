import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk';

interface EvenHostLike {
  flutter_inappwebview?: {
    callHandler?: unknown;
  };
}

export function hasEvenHostBridge(host: unknown = globalThis): boolean {
  const candidate = host as EvenHostLike;
  return typeof candidate.flutter_inappwebview?.callHandler === 'function';
}

export async function connectEvenBridge() {
  return waitForEvenAppBridge();
}
