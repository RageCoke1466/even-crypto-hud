import { describe, expect, it } from 'vitest';
import { buildCryptoHudPage, buildCryptoHudUpdates } from './cryptoPage';

const hudText = {
  timestamp: 'LAST UPDATED 14:32',
  rows: ['BTC   $67,412', 'ETH    $3,540', 'SOL      $172', 'XRP     $2.41'] as [
    string,
    string,
    string,
    string,
  ],
};

describe('buildCryptoHudPage', () => {
  it('creates a watchlist card with one border, a top-right timestamp, and four row containers', () => {
    const page = buildCryptoHudPage(hudText);

    expect(page.containerTotalNum).toBe(6);
    expect(page.textObject).toHaveLength(6);
    expect(page.textObject?.map((container) => container.containerName)).toEqual([
      'card',
      'timestamp',
      'row1',
      'row2',
      'row3',
      'row4',
    ]);

    const card = page.textObject?.find((container) => container.containerName === 'card');
    const timestamp = page.textObject?.find((container) => container.containerName === 'timestamp');
    const row1 = page.textObject?.find((container) => container.containerName === 'row1');
    const row4 = page.textObject?.find((container) => container.containerName === 'row4');

    expect(card).toMatchObject({
      xPosition: 22,
      yPosition: 22,
      width: 532,
      height: 244,
      borderWidth: 3,
      borderColor: 8,
      borderRadius: 0,
      content: '',
    });
    expect(timestamp).toMatchObject({
      containerID: 2,
      xPosition: 314,
      yPosition: 82,
      width: 214,
      height: 38,
      content: 'LAST UPDATED 14:32',
    });
    expect(row1).toMatchObject({
      containerID: 3,
      xPosition: 48,
      yPosition: 82,
      width: 480,
      height: 38,
      content: 'BTC   $67,412',
    });
    expect(row4).toMatchObject({
      containerID: 6,
      xPosition: 48,
      yPosition: 208,
      width: 480,
      height: 38,
      content: 'XRP     $2.41',
    });
    expect(page.textObject?.map((container) => container.content).join(' ')).not.toContain('24h');
  });

  it('uses the root card as the only event capture container', () => {
    const page = buildCryptoHudPage(hudText);
    const eventCaptureContainers = page.textObject?.filter((container) => container.isEventCapture === 1);

    expect(eventCaptureContainers?.map((container) => container.containerName)).toEqual(['card']);
    expect(
      page.textObject
        ?.filter((container) => container.containerName !== 'card')
        .every((container) => container.isEventCapture === 0),
    ).toBe(true);
  });
});

describe('buildCryptoHudUpdates', () => {
  it('builds in-place text updates for the timestamp and four rows', () => {
    const updates = buildCryptoHudUpdates(hudText);

    expect(updates).toHaveLength(5);
    expect(updates).toEqual([
      {
        containerID: 2,
        containerName: 'timestamp',
        contentOffset: 0,
        contentLength: 18,
        content: 'LAST UPDATED 14:32',
      },
      {
        containerID: 3,
        containerName: 'row1',
        contentOffset: 0,
        contentLength: 32,
        content: 'BTC   $67,412'.padEnd(32, ' '),
      },
      {
        containerID: 4,
        containerName: 'row2',
        contentOffset: 0,
        contentLength: 32,
        content: 'ETH    $3,540'.padEnd(32, ' '),
      },
      {
        containerID: 5,
        containerName: 'row3',
        contentOffset: 0,
        contentLength: 32,
        content: 'SOL      $172'.padEnd(32, ' '),
      },
      {
        containerID: 6,
        containerName: 'row4',
        contentOffset: 0,
        contentLength: 32,
        content: 'XRP     $2.41'.padEnd(32, ' '),
      },
    ]);
  });

  it('pads shorter update content so stale row text is cleared on glasses', () => {
    const updates = buildCryptoHudUpdates({
      timestamp: '',
      rows: ['BTC   $67,412', 'ETH    $3,540', '', ''] as [string, string, string, string],
    });

    const timestamp = updates.find((update) => update.containerName === 'timestamp');
    const row3 = updates.find((update) => update.containerName === 'row3');
    const row4 = updates.find((update) => update.containerName === 'row4');

    expect(timestamp).toMatchObject({
      contentLength: 18,
      content: '                  ',
    });
    expect(row3).toMatchObject({
      contentLength: 32,
      content: '                                ',
    });
    expect(row4).toMatchObject({
      contentLength: 32,
      content: '                                ',
    });
  });
});
