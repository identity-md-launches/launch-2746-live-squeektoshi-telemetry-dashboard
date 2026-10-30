# Squeektoshi live

A static, responsive Squeekchain telemetry dashboard. It reads the two public APIs directly from the browser every 15 seconds. No backend, wallet, account, API key, or environment file is required.

The finished website is included in **`dist/`**, together with the complete React/TypeScript source and npm lockfile. The export uses relative asset URLs and hash anchors, so it works at a static hosting subpath without route rewrites. Serve `dist/` over HTTP(S); opening an ES-module app through `file://` is not supported.

## Install, develop, preview, rebuild

Use Node **22.12 or newer** and npm. Node 24 was used for validation.

```sh
npm ci
npm run dev
```

To preview the included production export, run:

```sh
npm run preview
```

Open the URL printed by Vite. To rebuild the export from source:

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

`npm run build` replaces `dist/`. Keep the whole directory in the submission, including its fonts, favicon, share image, CSS and JavaScript. Vite's `base` is explicitly `./` in `vite.config.ts`. The site has no external font or image dependencies. The public API is the only runtime data dependency.

## What the readings mean

| Display | Public API field / calculation |
| --- | --- |
| Wheel status | `/v1/status`: `measurement.coreStatus`, freshness and observation age |
| RPM | `measurement.rpmMilli / 1,000` |
| Ground speed | `measurement.speedMmPerSecond / 1,000`, in metres/second |
| Distance | `measurement.distanceMm / 1,000`, in metres; the current hardware counter, not an invented lifetime total |
| Next Squeek block | `builder.projected.blockHeight + 1` |
| Block progress | `builder.projected.blockProgress / 1,000,000,000 × 100` |
| Completed / confirmed blocks | `builder.projected.blockHeight` / `builder.anchor.blockHeight` |
| SQK mined / cap | `/v1/economy/state`: `supply.miningMintedBaseUnits` / `supply.capBaseUnits`, using `asset.decimals` |
| Current / last settled round | `lifecycle.currentRound` / status `builder.anchor.settledThroughRound` |
| Settlement queue | Status `settlementQueue.state`, buffer count, enabled flag and incident/reason |
| Network | Economy `chain.target` and `chain.chainId`; the observed public API reports Sepolia |

Sources: [status API](https://api.squeekchain.com/v1/status), [economy API](https://api.squeekchain.com/v1/economy/state). The block-unit denominator was also checked against Squeekchain's publicly served frontend schema.

Token amounts stay in integer base units using `BigInt`. Compact values and the full amount beneath the supply bar are truncated, not rounded, to two decimal places. Hardware values are rounded to two decimal places in the summary; the readings table retains up to three.

## Interactions and failure behavior

- **Refresh now** fetches both sources and announces the manual result. A request pair has a 10-second timeout and cannot overlap another pair.
- **Pause updates** stops the 15-second timer and wheel animation. A request already in flight may finish. Manual refresh still works. Resume requests a reading immediately and restarts the timer. An online event also attempts recovery.
- **Wheel activity** switches between RPM and distance, and between 15 minutes and one hour. Its accessible table exposes the same observations. History is held only in memory for this visit, bounded to 300 points and one hour; reloading clears it.
- Observations are deduplicated by source time and counter epoch. Stale/fault observations are excluded from new chart points; gaps over 45 seconds and counter resets break the plotted line. The app never fabricates historical readings.
- Missing readings use a dash with unavailable progress semantics. HTTP errors, malformed JSON/schema changes and timeouts retain the last successful response for the affected source. An explicit API `unavailable` response is shown as unavailable. The other source can continue updating.
- Measurement freshness follows the API's flag and `staleAfterSeconds`. Source snapshots older than 120 seconds also display a warning. **Behind the readings** exposes source timestamps and endpoint errors. Local times use the browser's timezone.
- Browsers can throttle timers in background tabs. No service worker or hidden background service is used.

## Checks

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium webkit
npm run validate
npm run validate -- --live
```

Playwright requires its standard browser OS dependencies. `scripts/validate.mjs` starts a temporary foreground HTTP server, checks the production export at `/preview/`, and closes the server and browsers on completion. Its default output is `test/scratch/interaction-validation/` (not delivered); use `--out <directory>` to change that. The deterministic run intercepts the API with clearly separated test fixtures, uses an accelerated clock, and exercises states that the live service cannot reliably produce on demand. `--live` uses the actual public endpoints without interception.

Actual worker results on the final source:

| Check | Result |
| --- | --- |
| TypeScript typecheck | Passed |
| Unit tests | 6 passed; exact token arithmetic, schema rejection, freshness and observation handling |
| Production build | Passed; complete export is 491,000 bytes across 7 files |
| Clean lockfile install and rebuild | Passed; byte-for-byte identical export |
| Chromium + WebKit deterministic interactions | 30 checks passed; no test failures |
| Live public API smoke checks | 20 checks passed across Chromium and WebKit; both endpoints supplied actual readings |
| Automated accessibility scan | 0 violations in each browser for the tested WCAG A/AA rules |
| Responsive reflow | No horizontal overflow at 320, 390, 768, 1024 or 1440 pixels |
| 200% root text enlargement | Passed at 1440 pixels in both browsers; this is separate from native browser zoom |
| Pinned taste@1 design probe | 16/16 passed on the final export |

The live smoke outcome, six-domain review, screenshots, resolved findings and remaining verification limitations are recorded in [artifacts/validation.md](artifacts/validation.md). These are worker observations, not independent certification. [DESIGN.md](DESIGN.md) describes the implemented design system; [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) preserves attribution and runtime licenses.

## Project map

- `src/api.ts`: selected API schemas, precise formatting, freshness and history rules.
- `src/useTelemetry.ts`: polling, timeout, independent resource recovery and visit history.
- `src/App.tsx`: dashboard, source disclosure and hash navigation.
- `src/components/`: wheel illustration and accessible activity chart/table.
- `src/styles.css`: tokens, components, responsive layout and motion preferences.
- `public/`: locally bundled runtime assets and font license.
- `tests/`, `scripts/validate.mjs`: unit tests and production interaction validation; never imported by the app.
- `dist/`: complete static production export, intentionally included.
- `artifacts/`: validation evidence, export hashes and share-image source.

No dependency directories, package caches, vendored registry, tarballs, submodules, credentials or environment files are part of the deliverable. The explicit path and ignore budgets are in the validation report.
