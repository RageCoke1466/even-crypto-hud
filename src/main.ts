import './styles.css';
import {
  buildEmptyWatchlistState,
  buildErrorState,
  buildLoadingState,
  buildMissingKeyState,
  buildSnapshotState,
  type CryptoAppState,
} from './app';
import { connectEvenBridge, hasEvenHostBridge } from './even/bridge';
import { createCryptoHudPage, updateCryptoHudPage } from './even/cryptoPage';
import type { HudText } from './formatters/priceFormatter';
import { CoinGeckoCoinCatalogSource } from './prices/coinCatalogSource';
import { CoinGeckoPriceSource } from './prices/coingeckoPriceSource';
import {
  clearApiKeyFromBridgeStorage,
  createBrowserApiKeyStore,
  loadApiKeyFromBridgeStorage,
  saveApiKeyToBridgeStorage,
} from './settings/apiKeyStore';
import { createBrowserCoinCatalogStore } from './settings/coinCatalogStore';
import {
  DEFAULT_WATCHLIST,
  addCoinToWatchlist,
  createBrowserWatchlistStore,
  loadWatchlistFromBridgeStorage,
  moveWatchlistCoin,
  removeWatchlistCoin,
  saveWatchlistToBridgeStorage,
  searchCoinCatalog,
  type CoinCatalogEntry,
  type WatchlistCoin,
} from './settings/watchlistStore';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const root = document.querySelector<HTMLElement>('#app');

if (!root) {
  throw new Error('App root not found');
}

const keyStore = createBrowserApiKeyStore();
const watchlistStore = createBrowserWatchlistStore();
const coinCatalogStore = createBrowserCoinCatalogStore();
const elements = renderShell(root);

let evenBridge: Awaited<ReturnType<typeof connectEvenBridge>> | null = null;
let glassesPageCreated = false;
let currentHudText: HudText = buildMissingKeyState().hudText;
let coinCatalog: CoinCatalogEntry[] = coinCatalogStore.loadFresh(new Date()) ?? coinCatalogStore.loadAny() ?? [
  ...DEFAULT_WATCHLIST,
];

startApp();

function startApp(): void {
  bindEvents();
  renderWatchlistControls();
  renderCoinSearchResults();
  renderState(keyStore.load() ? buildLoadingState(getVisibleWatchlist()) : buildMissingKeyState());
  void connectBridgeInBackground();
  void loadCoinCatalogInBackground();
  void refreshPrice();

  window.setInterval(() => {
    if (keyStore.load()) {
      void refreshPrice();
    }
  }, REFRESH_INTERVAL_MS);
}

function bindEvents(): void {
  elements.form.addEventListener('submit', (event) => {
    event.preventDefault();
    const apiKey = elements.apiKeyInput.value;
    keyStore.save(apiKey);
    void persistApiKeyToBridgeStorage(apiKey);
    void loadCoinCatalogInBackground();
    void refreshPrice();
  });

  elements.clearButton.addEventListener('click', () => {
    keyStore.clear();
    void clearApiKeyInBridgeStorage();
    elements.apiKeyInput.value = '';
    renderState(buildMissingKeyState());
    void syncGlasses(buildMissingKeyState().hudText);
  });

  elements.refreshButton.addEventListener('click', () => {
    void loadCoinCatalogInBackground();
    void refreshPrice();
  });

  elements.refreshWatchlistButton.addEventListener('click', () => {
    void refreshWatchlistFromBridgeStorage();
  });

  elements.coinSearchInput.addEventListener('input', () => {
    renderCoinSearchResults();
  });

  elements.resultsList.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-action="add-coin"]');

    if (!button?.dataset.coinId) {
      return;
    }

    const coin = coinCatalog.find((catalogCoin) => catalogCoin.id === button.dataset.coinId);

    if (!coin) {
      return;
    }

    saveWatchlist(addCoinToWatchlist(watchlistStore.load(), coin));
    elements.coinSearchInput.value = '';
    renderWatchlistControls();
    renderCoinSearchResults();
    void refreshPrice({ syncLoadingToGlasses: true });
  });

  elements.watchlistList.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');

    if (!button?.dataset.coinId) {
      return;
    }

    const action = button.dataset.action;
    const watchlist = watchlistStore.load();

    if (action === 'remove-coin') {
      saveWatchlist(removeWatchlistCoin(watchlist, button.dataset.coinId));
    }

    if (action === 'move-coin-up') {
      saveWatchlist(moveWatchlistCoin(watchlist, button.dataset.coinId, 'up'));
    }

    if (action === 'move-coin-down') {
      saveWatchlist(moveWatchlistCoin(watchlist, button.dataset.coinId, 'down'));
    }

    renderWatchlistControls();
    renderCoinSearchResults();
    void refreshPrice({ syncLoadingToGlasses: true });
  });
}

async function connectBridgeInBackground(): Promise<void> {
  if (!hasEvenHostBridge(window)) {
    updateBridgeStatus('Even bridge not detected. Open in simulator or on G2 to render glasses HUD.');
    return;
  }

  updateBridgeStatus('Waiting for Even bridge...');

  window.setTimeout(() => {
    if (!evenBridge) {
      updateBridgeStatus('Even bridge not detected yet. Open in simulator or on G2 to render glasses HUD.');
    }
  }, 3000);

  try {
    evenBridge = await connectEvenBridge();
    updateBridgeStatus('Even bridge connected.');
    logInfo('Even bridge connected');
    const restoredWatchlist = await restoreWatchlistFromBridgeStorage();
    const restoredApiKey = await restoreApiKeyFromBridgeStorage();

    if (restoredWatchlist && !restoredApiKey) {
      await refreshPrice();
      return;
    }

    if (!restoredWatchlist && !restoredApiKey) {
      await syncGlasses(currentHudText);
    }
  } catch (error) {
    updateBridgeStatus(`Even bridge error: ${messageFrom(error)}`);
  }
}

async function restoreApiKeyFromBridgeStorage(): Promise<boolean> {
  if (!evenBridge) {
    return false;
  }

  try {
    const bridgeApiKey = await loadApiKeyFromBridgeStorage(evenBridge);
    const localApiKey = keyStore.load();

    if (bridgeApiKey) {
      if (bridgeApiKey === localApiKey) {
        return false;
      }

      keyStore.save(bridgeApiKey);
      elements.apiKeyInput.value = bridgeApiKey;
      logInfo('API key restored from Even storage');
      await loadCoinCatalogInBackground();
      await refreshPrice();
      return true;
    }

    if (localApiKey) {
      await saveApiKeyToBridgeStorage(evenBridge, localApiKey);
    }
  } catch (error) {
    updateBridgeStatus(`Even storage error: ${messageFrom(error)}`);
  }

  return false;
}

async function restoreWatchlistFromBridgeStorage(): Promise<boolean> {
  if (!evenBridge) {
    return false;
  }

  try {
    const bridgeWatchlist = await loadWatchlistFromBridgeStorage(evenBridge);
    const localWatchlist = watchlistStore.load();

    if (bridgeWatchlist) {
      if (areWatchlistsEqual(bridgeWatchlist, localWatchlist)) {
        return false;
      }

      watchlistStore.save(bridgeWatchlist);
      renderWatchlistControls();
      renderCoinSearchResults();
      logInfo(`Watchlist restored from Even storage (${bridgeWatchlist.length} coins)`);
      return true;
    }

    await saveWatchlistToBridgeStorage(evenBridge, localWatchlist);
    logInfo(`Watchlist synced to Even storage (${localWatchlist.length} coins)`);
  } catch (error) {
    updateBridgeStatus(`Even watchlist storage error: ${messageFrom(error)}`);
    logError('Even watchlist storage error', error);
  }

  return false;
}

async function refreshWatchlistFromBridgeStorage(): Promise<void> {
  if (!evenBridge) {
    updateBridgeStatus('Even bridge not connected. Open in simulator or on G2 to sync watchlist.');
    logWarn('Cannot refresh watchlist before Even bridge connects');
    return;
  }

  try {
    const bridgeWatchlist = await loadWatchlistFromBridgeStorage(evenBridge);

    if (!bridgeWatchlist) {
      elements.message.textContent = 'No saved watchlist found in Even storage.';
      logWarn('No saved watchlist found in Even storage');
      return;
    }

    watchlistStore.save(bridgeWatchlist);
    renderWatchlistControls();
    renderCoinSearchResults();
    logInfo(`Watchlist refreshed from Even storage (${bridgeWatchlist.length} coins)`);
    await refreshPrice({ syncLoadingToGlasses: true });
  } catch (error) {
    elements.message.textContent = `Watchlist sync failed: ${messageFrom(error)}`;
    logError('Watchlist sync failed', error);
  }
}

async function persistApiKeyToBridgeStorage(apiKey: string): Promise<void> {
  if (!evenBridge) {
    return;
  }

  try {
    const saved = await saveApiKeyToBridgeStorage(evenBridge, apiKey);
    if (!saved) {
      updateBridgeStatus('Even storage did not save API key.');
    }
  } catch (error) {
    updateBridgeStatus(`Even storage error: ${messageFrom(error)}`);
  }
}

async function clearApiKeyInBridgeStorage(): Promise<void> {
  if (!evenBridge) {
    return;
  }

  try {
    const cleared = await clearApiKeyFromBridgeStorage(evenBridge);
    if (!cleared) {
      updateBridgeStatus('Even storage did not clear API key.');
    }
  } catch (error) {
    updateBridgeStatus(`Even storage error: ${messageFrom(error)}`);
  }
}

function saveWatchlist(watchlist: WatchlistCoin[]): void {
  watchlistStore.save(watchlist);
  void persistWatchlistToBridgeStorage(watchlist);
}

async function persistWatchlistToBridgeStorage(watchlist: WatchlistCoin[]): Promise<void> {
  if (!evenBridge) {
    return;
  }

  try {
    const saved = await saveWatchlistToBridgeStorage(evenBridge, watchlist);
    if (!saved) {
      updateBridgeStatus('Even storage did not save watchlist.');
      logWarn('Even storage did not save watchlist');
    }
  } catch (error) {
    updateBridgeStatus(`Even watchlist storage error: ${messageFrom(error)}`);
    logError('Even watchlist storage error', error);
  }
}

async function loadCoinCatalogInBackground(): Promise<void> {
  const apiKey = keyStore.load();

  if (!apiKey) {
    coinCatalog = coinCatalogStore.loadAny() ?? [...DEFAULT_WATCHLIST];
    renderCoinSearchResults();
    return;
  }

  const freshCatalog = coinCatalogStore.loadFresh(new Date());

  if (freshCatalog) {
    coinCatalog = freshCatalog;
    renderCoinSearchResults();
    return;
  }

  try {
    const fetchedCatalog = await new CoinGeckoCoinCatalogSource({ apiKey }).getCoins();
    coinCatalogStore.save(fetchedCatalog, new Date());
    coinCatalog = fetchedCatalog;
    renderCoinSearchResults();
  } catch (error) {
    const staleCatalog = coinCatalogStore.loadAny();

    if (staleCatalog) {
      coinCatalog = staleCatalog;
      elements.message.textContent = `Using cached coin list. ${messageFrom(error)}`;
      renderCoinSearchResults();
      return;
    }

    coinCatalog = [...DEFAULT_WATCHLIST];
    elements.message.textContent = `Coin list unavailable. ${messageFrom(error)}`;
    renderCoinSearchResults();
  }
}

async function refreshPrice(options: { syncLoadingToGlasses?: boolean } = {}): Promise<void> {
  const apiKey = keyStore.load();
  const visibleWatchlist = getVisibleWatchlist();
  renderWatchlistControls();

  if (!apiKey) {
    const state = buildMissingKeyState();
    renderState(state);
    await syncGlasses(state.hudText);
    return;
  }

  if (visibleWatchlist.length === 0) {
    const state = buildEmptyWatchlistState();
    renderState(state);
    await syncGlasses(state.hudText);
    return;
  }

  const loadingState = buildLoadingState(visibleWatchlist);
  renderState(loadingState);

  if (options.syncLoadingToGlasses) {
    await syncGlasses(loadingState.hudText);
  }

  try {
    const snapshot = await new CoinGeckoPriceSource({ apiKey }).getPrices(visibleWatchlist);
    const state = buildSnapshotState(snapshot);
    renderState(state);
    await syncGlasses(state.hudText);
  } catch (error) {
    const state = buildErrorState(messageFrom(error), currentHudText);
    renderState(state);
    await syncGlasses(state.hudText);
  }
}

async function syncGlasses(hudText: HudText): Promise<void> {
  currentHudText = hudText;

  if (!evenBridge) {
    renderPreview(hudText);
    return;
  }

  if (!glassesPageCreated) {
    const result = await createCryptoHudPage(evenBridge, hudText);
    glassesPageCreated = result === 0;
    updateBridgeStatus(glassesPageCreated ? 'Glasses HUD created.' : `Glasses HUD create failed: ${result}`);
    renderPreview(hudText);
    return;
  }

  await updateCryptoHudPage(evenBridge, hudText);
  renderPreview(hudText);
}

function renderState(state: CryptoAppState): void {
  elements.statusValue.textContent = state.status;
  elements.statusValue.dataset.status = state.status;
  elements.message.textContent = state.message;
  elements.refreshButton.disabled = !state.shouldFetch;
  renderPreview(state.hudText);
}

function renderPreview(hudText: HudText): void {
  elements.previewTimestamp.textContent = hudText.timestamp;
  elements.previewRows.forEach((row, index) => {
    row.textContent = hudText.rows[index];
  });
}

function updateBridgeStatus(message: string): void {
  elements.bridgeStatus.textContent = message;
}

function areWatchlistsEqual(first: WatchlistCoin[], second: WatchlistCoin[]): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function logInfo(message: string): void {
  console.info(`[even-crypto] ${message}`);
}

function logWarn(message: string): void {
  console.warn(`[even-crypto] ${message}`);
}

function logError(message: string, error: unknown): void {
  console.error(`[even-crypto] ${message}: ${messageFrom(error)}`);
}

function renderCoinSearchResults(): void {
  const results = searchCoinCatalog(coinCatalog, elements.coinSearchInput.value, watchlistStore.load());

  elements.resultsList.replaceChildren(...results.map(buildCoinResultElement));
}

function renderWatchlistControls(): void {
  const watchlist = watchlistStore.load();

  elements.watchlistList.replaceChildren(...watchlist.map((coin, index) => buildWatchlistElement(coin, index, watchlist.length)));
  elements.firstFourNote.hidden = watchlist.length <= 4;
}

function getVisibleWatchlist(): WatchlistCoin[] {
  return watchlistStore.load().slice(0, 4);
}

function buildCoinResultElement(coin: WatchlistCoin): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'coin-result';

  const label = document.createElement('span');
  label.textContent = `${coin.symbol} - ${coin.name}`;

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Add';
  button.dataset.action = 'add-coin';
  button.dataset.coinId = coin.id;

  item.append(label, button);
  return item;
}

function buildWatchlistElement(coin: WatchlistCoin, index: number, watchlistLength: number): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'watchlist-chip';
  item.dataset.role = 'watchlist-chip';
  item.dataset.coinId = coin.id;

  const label = document.createElement('span');
  label.textContent = `${coin.symbol} - ${coin.name}`;

  const actions = document.createElement('div');
  actions.className = 'chip-actions';
  actions.append(
    buildWatchlistButton('move-coin-up', coin.id, 'Up', index === 0),
    buildWatchlistButton('move-coin-down', coin.id, 'Down', index === watchlistLength - 1),
    buildWatchlistButton('remove-coin', coin.id, 'Remove', false),
  );

  item.append(label, actions);
  return item;
}

function buildWatchlistButton(action: string, coinId: string, label: string, disabled: boolean): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.dataset.action = action;
  button.dataset.coinId = coinId;
  button.disabled = disabled;
  return button;
}

function renderShell(container: HTMLElement) {
  container.innerHTML = `
    <section class="workspace">
      <div class="panel">
        <p class="eyebrow">Even G2 Crypto HUD</p>
        <h1>Crypto watchlist, one glance.</h1>

        <form class="key-form">
          <label for="coingecko-key">CoinGecko Demo API key</label>
          <input id="coingecko-key" name="coingecko-key" type="password" autocomplete="off" placeholder="Paste your CoinGecko key" />
          <label for="coin-search">Add coin</label>
          <input id="coin-search" name="coin-search" type="text" autocomplete="off" placeholder="Search by symbol, name, or id" />
          <ul class="coin-results" data-role="coin-results"></ul>
          <div class="watchlist-editor">
            <div class="watchlist-title">
              <span>Watchlist</span>
              <button type="button" data-action="refresh-watchlist">Refresh watchlist</button>
            </div>
            <ul class="watchlist-list" data-role="watchlist-list"></ul>
            <p class="first-four-note" data-role="first-four-note" hidden>Only the first four coins appear on glasses.</p>
          </div>
          <div class="actions">
            <button type="submit">Save key</button>
            <button type="button" data-action="refresh">Refresh now</button>
            <button type="button" data-action="clear">Clear</button>
          </div>
        </form>

        <div class="help">
          <a href="https://docs.coingecko.com/docs/setting-up-your-api-key" target="_blank" rel="noreferrer">Get a CoinGecko API key</a>
          <span>Default refresh: 5 minutes</span>
          <a href="https://www.coingecko.com/en/api" target="_blank" rel="noreferrer">Data provided by CoinGecko</a>
        </div>

        <dl class="status-grid">
          <div>
            <dt>Provider</dt>
            <dd data-role="status">missing-key</dd>
          </div>
          <div>
            <dt>Bridge</dt>
            <dd data-role="bridge">Waiting for Even bridge...</dd>
          </div>
        </dl>

        <p class="message" data-role="message"></p>
      </div>

      <section class="preview-area" aria-label="Glasses preview">
        <div class="screen">
          <div class="hud-card">
            <div class="hud-timestamp" data-role="preview-timestamp"></div>
            <div class="hud-rows" aria-label="Watchlist preview rows">
              <div class="hud-row" data-role="preview-row">KEY REQUIRED</div>
              <div class="hud-row" data-role="preview-row">OPEN PHONE</div>
              <div class="hud-row" data-role="preview-row"></div>
              <div class="hud-row" data-role="preview-row"></div>
            </div>
          </div>
        </div>
      </section>
    </section>
  `;

  const apiKeyInput = container.querySelector<HTMLInputElement>('#coingecko-key');
  const coinSearchInput = container.querySelector<HTMLInputElement>('#coin-search');
  const form = container.querySelector<HTMLFormElement>('.key-form');
  const clearButton = container.querySelector<HTMLButtonElement>('[data-action="clear"]');
  const refreshButton = container.querySelector<HTMLButtonElement>('[data-action="refresh"]');
  const refreshWatchlistButton = container.querySelector<HTMLButtonElement>('[data-action="refresh-watchlist"]');
  const resultsList = container.querySelector<HTMLElement>('[data-role="coin-results"]');
  const watchlistList = container.querySelector<HTMLElement>('[data-role="watchlist-list"]');
  const firstFourNote = container.querySelector<HTMLElement>('[data-role="first-four-note"]');
  const statusValue = container.querySelector<HTMLElement>('[data-role="status"]');
  const bridgeStatus = container.querySelector<HTMLElement>('[data-role="bridge"]');
  const message = container.querySelector<HTMLElement>('[data-role="message"]');
  const previewTimestamp = container.querySelector<HTMLElement>('[data-role="preview-timestamp"]');
  const previewRows = Array.from(container.querySelectorAll<HTMLElement>('[data-role="preview-row"]'));

  if (
    !apiKeyInput ||
    !coinSearchInput ||
    !form ||
    !clearButton ||
    !refreshButton ||
    !refreshWatchlistButton ||
    !resultsList ||
    !watchlistList ||
    !firstFourNote ||
    !statusValue ||
    !bridgeStatus ||
    !message ||
    !previewTimestamp ||
    previewRows.length !== 4
  ) {
    throw new Error('Failed to render app shell');
  }

  const savedKey = keyStore.load();
  if (savedKey) {
    apiKeyInput.value = savedKey;
  }

  return {
    apiKeyInput,
    coinSearchInput,
    form,
    clearButton,
    refreshButton,
    refreshWatchlistButton,
    resultsList,
    watchlistList,
    firstFourNote,
    statusValue,
    bridgeStatus,
    message,
    previewTimestamp,
    previewRows,
  };
}
