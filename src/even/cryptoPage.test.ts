import { describe, expect, it } from 'vitest';
import { buildCryptoHudPage, buildCryptoHudUpdates, getCryptoHudLayoutKey } from './cryptoPage';

const hudText = {
  timestamp: 'LAST UPDATED 14:32',
  rows: ['BTC   $67,412', 'ETH    $3,540', 'SOL      $172', 'XRP     $2.41'] as [
    string,
    string,
    string,
    string,
  ],
  activityGauge: 'QUIET \\---^---/ ACTIVE',
};

describe('buildCryptoHudPage', () => {
  it('creates a watchlist card within the simulator container limit', () => {
    const page = buildCryptoHudPage(hudText);

    expect(page.containerTotalNum).toBeLessThanOrEqual(8);
    expect(page.containerTotalNum).toBe(7);
    expect(page.textObject).toHaveLength(7);
    expect(page.textObject?.map((container) => container.containerName)).toEqual([
      'card',
      'timestamp',
      'row1',
      'row2',
      'row3',
      'row4',
      'activityGauge',
    ]);

    const card = page.textObject?.find((container) => container.containerName === 'card');
    const timestamp = page.textObject?.find((container) => container.containerName === 'timestamp');
    const row1 = page.textObject?.find((container) => container.containerName === 'row1');
    const row4 = page.textObject?.find((container) => container.containerName === 'row4');
    const activityGauge = page.textObject?.find((container) => container.containerName === 'activityGauge');

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
      height: 32,
      content: 'BTC   $67,412',
    });
    expect(row4).toMatchObject({
      containerID: 6,
      xPosition: 48,
      yPosition: 193,
      width: 480,
      height: 32,
      content: 'XRP     $2.41',
    });
    expect(activityGauge).toMatchObject({
      containerID: 7,
      xPosition: 300,
      yPosition: 193,
      width: 228,
      height: 32,
      content: 'QUIET \\---^---/ ACTIVE',
    });
    expect(activityGauge?.yPosition).toBe(row4?.yPosition);
    expect(page.textObject?.map((container) => container.content).join(' ')).not.toContain('24h');
  });

  it('places the activity gauge beside the last populated token row on short pages', () => {
    const page = buildCryptoHudPage({
      timestamp: 'LAST UPDATED 14:32',
      rows: ['DOGE    $1.00', 'ADA     $1.00', '', ''],
      activityGauge: 'QUIET \\---^---/ ACTIVE',
    });

    expect(page.textObject?.find((container) => container.containerName === 'activityGauge')).toMatchObject({
      yPosition: 119,
      content: 'QUIET \\---^---/ ACTIVE',
    });
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

    expect(updates).toHaveLength(6);
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
      {
        containerID: 7,
        containerName: 'activityGauge',
        contentOffset: 0,
        contentLength: 24,
        content: 'QUIET \\---^---/ ACTIVE'.padEnd(24, ' '),
      },
    ]);
  });

  it('keeps the activity gauge update targeted at the reusable gauge container', () => {
    const updates = buildCryptoHudUpdates({
      timestamp: 'LAST UPDATED 14:32',
      rows: ['DOGE    $1.00', 'ADA     $1.00', '', ''],
      activityGauge: 'QUIET \\---^---/ ACTIVE',
    });

    expect(updates).toContainEqual(
      expect.objectContaining({
        containerName: 'activityGauge',
        content: 'QUIET \\---^---/ ACTIVE'.padEnd(24, ' '),
      }),
    );
  });

  it('pads shorter update content so stale row text is cleared on glasses', () => {
    const updates = buildCryptoHudUpdates({
      timestamp: '',
      rows: ['BTC   $67,412', 'ETH    $3,540', '', ''] as [string, string, string, string],
      activityGauge: '',
    });

    const timestamp = updates.find((update) => update.containerName === 'timestamp');
    const row3 = updates.find((update) => update.containerName === 'row3');
    const row4 = updates.find((update) => update.containerName === 'row4');
    const activityGauge = updates.find((update) => update.containerName === 'activityGauge');

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
    expect(activityGauge).toMatchObject({
      contentLength: 24,
      content: '                        ',
    });
  });
});

describe('getCryptoHudLayoutKey', () => {
  it('changes when the market activity gauge needs to move to a different row', () => {
    expect(getCryptoHudLayoutKey(hudText)).toBe('activity-row:3');
    expect(
      getCryptoHudLayoutKey({
        timestamp: 'LAST UPDATED 14:32',
        rows: ['DOGE    $1.00', 'ADA     $1.00', '', ''],
        activityGauge: 'QUIET \\---^---/ ACTIVE',
      }),
    ).toBe('activity-row:1');
  });
});
