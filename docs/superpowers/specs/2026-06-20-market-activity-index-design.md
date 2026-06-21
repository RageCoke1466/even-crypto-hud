# Market Activity Index Design

## Goal

Replace the current market movement gauge with a CoinGecko-only Market Activity Index. The index answers one question: is the overall crypto market quiet or active right now?

This is not a Fear & Greed score. It must not be compared against CoinMarketCap or Alternative.me Fear & Greed values, because those products use different proprietary or external inputs.

## User-Facing Behavior

The glasses HUD right-lower gauge displays a compact activity scale:

```text
QUIET \---^---/ ACTIVE
```

The app does not show the numeric score, market state label, Fear & Greed text, or individual component values on the glasses. The phone preview mirrors the same gauge line.

If activity data cannot be fetched, the watchlist prices remain visible and the activity gauge is blank.

## Data Sources

Use CoinGecko only:

- `/api/v3/global` for total market cap and total volume.
- `/api/v3/coins/markets` for top market-cap coin volume and absolute 24h price movement.
- `/api/v3/search/trending` for currently trending coins.

No Alternative.me, CoinMarketCap, social, Google Trends, or derivatives data is used.

## Score Model

The Market Activity Index is a 0-100 score:

```text
Activity Score =
45% Volume Activity
35% Volatility Activity
20% Trending Activity
```

`Volume Activity` measures whether money is moving. It uses global volume relative to global market cap, plus broad top-coin volume when available.

`Volatility Activity` measures whether prices are moving. Direction does not matter: a large down move and a large up move both count as active.

`Trending Activity` measures whether attention is concentrated in currently trending coins. Trending coins with meaningful volume and movement increase activity.

Stablecoins should be excluded from top-coin volatility calculations because their low price movement would incorrectly make the market look quiet. Stablecoin volume may still contribute to global volume, because it reflects market trading activity.

## Display Mapping

The existing seven-tick gauge remains:

```text
QUIET \-------/ ACTIVE
```

The pointer position is calculated by clamping the score to 0-100 and mapping it across seven ticks. A score near 0 points left, near 50 points center, and near 100 points right.

## Error Handling

CoinGecko authentication, rate-limit, and HTTP errors should produce stable error messages in the market activity source. The main app should catch those failures, log a warning, and continue displaying watchlist prices without the activity gauge.

## Testing

Tests should cover:

- The source calls only CoinGecko endpoints with the user's demo API key.
- Volume, volatility, and trending components combine into the expected score.
- Stablecoins are excluded from volatility calculations.
- Missing or invalid required response fields fail with stable messages.
- Formatter output uses `QUIET` and `ACTIVE` without numeric score or status text.
- The app keeps prices visible when activity data is unavailable.
