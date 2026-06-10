import { describe, expect, it } from 'vitest';
import { hasEvenHostBridge } from './bridge';

describe('hasEvenHostBridge', () => {
  it('returns false when the Flutter handler is missing', () => {
    expect(hasEvenHostBridge({})).toBe(false);
  });

  it('returns true when the Flutter handler is available', () => {
    expect(
      hasEvenHostBridge({
        flutter_inappwebview: {
          callHandler: () => undefined,
        },
      }),
    ).toBe(true);
  });
});
