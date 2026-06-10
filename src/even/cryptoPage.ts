import {
  CreateStartUpPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
  type EvenAppBridge,
} from '@evenrealities/even_hub_sdk';
import type { HudText } from '../formatters/priceFormatter';

const CONTAINERS = {
  card: { id: 1, name: 'card' },
  timestamp: { id: 2, name: 'timestamp' },
  row1: { id: 3, name: 'row1' },
  row2: { id: 4, name: 'row2' },
  row3: { id: 5, name: 'row3' },
  row4: { id: 6, name: 'row4' },
} as const;
const TIMESTAMP_UPDATE_LENGTH = 18;
const ROW_UPDATE_LENGTH = 32;

export function buildCryptoHudPage(text: HudText): CreateStartUpPageContainer {
  return new CreateStartUpPageContainer({
    containerTotalNum: 6,
    textObject: [
      new TextContainerProperty({
        xPosition: 22,
        yPosition: 22,
        width: 532,
        height: 244,
        borderWidth: 3,
        borderColor: 8,
        borderRadius: 0,
        paddingLength: 0,
        containerID: CONTAINERS.card.id,
        containerName: CONTAINERS.card.name,
        content: '',
        isEventCapture: 0,
      }),
      new TextContainerProperty({
        xPosition: 314,
        yPosition: 82,
        width: 214,
        height: 38,
        borderWidth: 0,
        borderColor: 0,
        borderRadius: 0,
        paddingLength: 0,
        containerID: CONTAINERS.timestamp.id,
        containerName: CONTAINERS.timestamp.name,
        content: text.timestamp,
        isEventCapture: 0,
      }),
      buildRowContainer(CONTAINERS.row1.id, CONTAINERS.row1.name, 82, text.rows[0]),
      buildRowContainer(CONTAINERS.row2.id, CONTAINERS.row2.name, 124, text.rows[1]),
      buildRowContainer(CONTAINERS.row3.id, CONTAINERS.row3.name, 166, text.rows[2]),
      buildRowContainer(CONTAINERS.row4.id, CONTAINERS.row4.name, 208, text.rows[3]),
    ],
  });
}

export function buildCryptoHudUpdates(text: HudText): TextContainerUpgrade[] {
  return [
    buildTextUpdate(CONTAINERS.timestamp.id, CONTAINERS.timestamp.name, text.timestamp, TIMESTAMP_UPDATE_LENGTH),
    buildTextUpdate(CONTAINERS.row1.id, CONTAINERS.row1.name, text.rows[0], ROW_UPDATE_LENGTH),
    buildTextUpdate(CONTAINERS.row2.id, CONTAINERS.row2.name, text.rows[1], ROW_UPDATE_LENGTH),
    buildTextUpdate(CONTAINERS.row3.id, CONTAINERS.row3.name, text.rows[2], ROW_UPDATE_LENGTH),
    buildTextUpdate(CONTAINERS.row4.id, CONTAINERS.row4.name, text.rows[3], ROW_UPDATE_LENGTH),
  ];
}

export async function createCryptoHudPage(bridge: EvenAppBridge, text: HudText) {
  return bridge.createStartUpPageContainer(buildCryptoHudPage(text));
}

export async function updateCryptoHudPage(bridge: EvenAppBridge, text: HudText): Promise<boolean[]> {
  const updates = buildCryptoHudUpdates(text);
  return Promise.all(updates.map((update) => bridge.textContainerUpgrade(update)));
}

function buildTextUpdate(
  containerID: number,
  containerName: string,
  content: string,
  minimumClearLength: number,
): TextContainerUpgrade {
  const clearContent = content.padEnd(Math.max(content.length, minimumClearLength), ' ');

  return new TextContainerUpgrade({
    containerID,
    containerName,
    contentOffset: 0,
    contentLength: clearContent.length,
    content: clearContent,
  });
}

function buildRowContainer(
  containerID: number,
  containerName: string,
  yPosition: number,
  content: string,
): TextContainerProperty {
  return new TextContainerProperty({
    xPosition: 48,
    yPosition,
    width: 480,
    height: 38,
    borderWidth: 0,
    borderColor: 0,
    borderRadius: 0,
    paddingLength: 0,
    containerID,
    containerName,
    content,
    isEventCapture: 0,
  });
}
