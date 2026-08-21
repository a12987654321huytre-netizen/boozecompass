# Booze Compass

**Open. Point. Booze.**

A stupid-simple, cheap-to-run PWA that points you toward the nearest liquor
store. Open the app, allow location, and a giant compass arrow rotates to
track the nearest bottle store as you move and turn.

There is no map screen, no account, no dashboard. The arrow is the product.

---

## 1. Install dependencies

```bash
npm install
```

Requires Node 18+.

## 2. Run locally

```bash
npm run dev
```

Opens on `http://localhost:5173`. Your desktop browser almost certainly has
no GPS or compass hardware — use the **DEV** panel in the bottom-right
corner (only rendered in dev mode, never in production) to punch in a fake
latitude/longitude/heading and simulate movement/rotation.

To test on a real phone during development, run `npm run dev -- --host` and
open the printed network URL on your phone (same Wi-Fi network). Real GPS
and compass permissions only work over `https://` or `localhost`, so for
full on-device testing, deploy a preview build (step 4) instead.

## 3. Run tests

```bash
npm test
```

Unit tests cover the geographic math (`src/lib/__tests__/geo.test.ts`) —
Haversine distance against known city-to-city distances, bearing
calculation, angle normalization, and shortest-path smoothing (so the
needle never does an awkward 359°→0° spin) — plus OSM tag handling
(`src/lib/__tests__/osmFormat.test.ts`) for name/address fallbacks and
liquor-store classification.

## 4. Build the production version

```bash
npm run build
```

Outputs a static site to `dist/` — plain HTML/CSS/JS, installable as a PWA.
No server required at runtime.

```bash
npm run preview
```

serves that build locally so you can sanity-check it before deploying.

## 5. Deploy

`dist/` is the static frontend, served over HTTPS (geolocation and
device-orientation APIs require a secure context). Store lookups go
through `edge-functions/api/bottle-stores.ts` (see below) rather than
calling Overpass directly from the browser, so the deploy target needs
to build/run that function alongside the static site - currently
Tencent EdgeOne Pages, which does this automatically for a project with
an `edge-functions/` directory at the repo root. Push the whole repo
(not just `dist/`); EdgeOne runs `npm run build` for the static site and
separately bundles `edge-functions/` from source, so it needs `src/`
present to resolve the function's imports.

If you swap hosts later, they need an equivalent (Cloudflare Pages
Functions, Vercel Edge Functions, etc.) - a static-only host without that
capability will need `src/lib/apiProvider.ts` swapped back out for
something that can run server-side.

Once deployed, open the URL on a phone and use "Add to Home Screen" to
install it as a standalone app.

---

## How the OSM query works

All store data comes from **OpenStreetMap** via the public **Overpass
API** — no Google Places, no per-request billing, no API key.

The query itself runs server-side, in `edge-functions/api/bottle-stores.ts`
- the browser calls our own `/api/bottle-stores?lat=...&lon=...&radius=...`
and never talks to Overpass directly. This exists because calling public
Overpass mirrors straight from the browser turned out to be unreliable
cross-browser (Safari in particular couldn't reach some mirrors at all -
CORS/connection failures Brave and Chrome didn't hit). The edge function
reuses `OverpassLiquorStoreProvider` (below) unchanged, so which OSM
objects count as a "bottle store" is identical to what the browser used
to compute itself.

Discovery is layered, because South African OSM tagging is inconsistent
enough that a real bottle store can be untagged, mis-tagged as a plain
convenience store, or only identifiable from its name:

1. **Explicit OSM tags** (`src/lib/overpassProvider.ts`) — `shop=alcohol`,
   `shop=wine`, `shop=beverages` with `alcohol=yes`.
2. **Known SA liquor-retail banners** (`src/lib/liquorMatching.ts`) — a
   curated list of ~50 real chains and their spelling variants (TOPS,
   Checkers LiquorShop, Liquor King, Ultra Liquors, PicardiRebel, etc.),
   matched against the business name after normalizing case, punctuation,
   and spacing.
3. **Generic liquor-related name fragments** — "bottle store", "liquor
   shop", "drankwinkel", bare "liquor", and similar, for stores that
   aren't a known chain but obviously are one anyway.
4. **Broader shop categories** — the query also pulls in nearby
   supermarkets/convenience/general stores so layers 2 and 3 can inspect
   their names even when they carry no alcohol tag at all. A plain
   Shoprite or SPAR with no liquor signal still scores 0 and is excluded
   — this only catches genuinely liquor-branded businesses that happen to
   be tagged as a generic shop type.
5. **Attached alcohol counters** — a supermarket/convenience store that
   explicitly tags `alcohol=yes` is accepted at a lower confidence tier
   than a dedicated liquor shop.

Every candidate gets a **confidence score** (`src/lib/liquorScoring.ts`,
`scoreLiquorCandidate`) from 0–100, combining whichever of the above
signals fire, and only candidates scoring ≥ 70
(`LIQUOR_CONFIDENCE_THRESHOLD`) are returned. The score isn't summed
across signals — it's the strongest single signal, so a candidate isn't
penalised for lacking corroborating tags.

Multiple public Overpass mirrors are configured
(`src/lib/config.ts` → `overpassEndpoints`); requests are aborted after
12 seconds and the app never retries forever or hammers a single
endpoint. Messy OSM data (missing names, missing hours, missing
addresses) is handled in `src/lib/osmFormat.ts` — an unnamed shop becomes
"Liquor store", a partial address just omits the missing parts.

`opening_hours` tags are parsed with the `opening_hours` npm library
(`src/lib/storeStatus.ts`), loaded **lazily** via dynamic import so its
~1MB parser doesn't block the app's initial load. Ambiguous or
unparseable hours resolve to "unknown", never a guess — the "Nearest
open" filter only excludes stores it can *confidently* determine are
closed.

### Debugging discovery for a specific location

```bash
npm run debug:discovery -- -33.9346 18.8601 800
```

Prints every raw OSM candidate Overpass returned near that point — name,
raw tags, computed confidence score, and exactly why it was accepted or
rejected. Run it with the coordinates of wherever coverage looks wrong to
see what OSM actually has there and whether the classifier is missing a
real store or correctly excluding a false positive. Needs real internet
access to a public Overpass endpoint (not run automatically anywhere).

## Where query radius / cache settings live

Every tunable constant is in one file: **`src/lib/config.ts`**.

| Setting | Purpose |
|---|---|
| `searchRadiiMeters` | Radii tried in order (5 → 10 → 20 → 50 km) when widening a search that found nothing |
| `cacheMaxAgeMs` | How long a cached store list stays fresh (default 30 min) |
| `refreshDistanceMeters` | How far the user must wander before we re-query Overpass (default 2.5 km) |
| `overpassEndpoints` | Ordered list of public Overpass mirrors |
| `overpassTimeoutMs` | Per-request timeout |
| `arrivalRadiusMeters` | Distance at which the "YOU HAVE ARRIVED" screen appears |
| `headingSmoothingAlpha` / `headingMaxStepPerFrame` | Compass jitter smoothing |

**Caching strategy** (`src/lib/storeCache.ts` +
`src/hooks/useNearbyLiquorStores.ts`): on load, the app queries Overpass
once, caches the full result set (with coordinates) in `localStorage`, and
then does **all** distance/bearing recalculation locally as the user's GPS
position updates — no new network request per GPS tick. A fresh Overpass
query only happens when the cache is stale, the user has moved more than
`refreshDistanceMeters` from where it was queried, or the user taps
refresh. If Overpass is unreachable, the app falls back to the cached
store list (with a small "Using cached locations" indicator) rather than
failing outright.

## How to swap data providers later

The UI never talks to Overpass (or any other data source) directly — it
only knows about the `LiquorStoreProvider` interface in
`src/types/store.ts`:

```ts
interface LiquorStoreProvider {
  findNearby(
    latitude: number,
    longitude: number,
    radiusMeters: number
  ): Promise<LiquorStore[]>
}
```

Two implementations exist today, on either side of the network boundary:

- `src/lib/apiProvider.ts` (`ApiLiquorStoreProvider`) - what the browser
  actually uses (see `src/hooks/useNearbyLiquorStores.ts`). Just fetches
  `/api/bottle-stores` and returns the normalized result.
- `src/lib/overpassProvider.ts` (`OverpassLiquorStoreProvider`) - the real
  Overpass query-building and classification logic. Used by
  `edge-functions/api/bottle-stores.ts` (server-side) and by
  `scripts/debug-discovery.ts` (a dev CLI that queries Overpass directly
  from your machine, unrelated to the deployed app).

To move to a self-hosted Overpass instance, a cached backend, Supabase +
PostGIS, an imported OSM extract, or another POI provider entirely: write
a new class implementing `LiquorStoreProvider` and swap what
`edge-functions/api/bottle-stores.ts` instantiates. The browser side
(`apiProvider.ts`) doesn't need to change at all, since it only ever
talks to our own `/api/bottle-stores` endpoint.

---

## Architecture at a glance

```
edge-functions/
  api/
    bottle-stores.ts         server-side Overpass proxy (validates input,
                              runs OverpassLiquorStoreProvider, edge-caches,
                              logs mirror attempts) - browser calls this,
                              never Overpass directly
src/
  lib/
    geo.ts                 distance, bearing, angle math (pure, unit-tested)
    config.ts               every tunable constant
    osmFormat.ts             messy-OSM-tag -> clean name/address
    liquorMatching.ts        SA brand list, generic keywords, name normalisation
    liquorScoring.ts         confidence scoring that combines tags + name signals
    overpassProvider.ts      the only file that knows Overpass query syntax -
                              runs server-side (edge function) and in the
                              debug CLI, not in the browser
    apiProvider.ts            what the browser actually calls - fetches
                              /api/bottle-stores, nothing else
    storeCache.ts             localStorage cache for the store dataset
    storeStatus.ts            lazy-loaded opening_hours parsing
    directions.ts             launches native/default maps app
    copy.ts                   dry humor lines keyed off distance
  hooks/
    useGeolocation.ts          GPS watch, pauses when tab hidden, dev override
    useDeviceHeading.ts        iOS permission flow, Android heading, smoothing
    useNearbyLiquorStores.ts   fetch/cache/widen orchestration
    useCompassBearing.ts       destination bearing + device heading -> rotation
    useStoreStatuses.ts        async open/closed status per store
    useFilterPreference.ts     "Nearest" vs "Nearest open", persisted
    useDevSimulation.ts        dev-only fake GPS/heading state
  components/
    CompassArrow.tsx           the SVG instrument - shortest-path swing animation
    MainScreen.tsx              the one screen that matters
    StartScreen.tsx, EnableCompassPrompt.tsx   permission flow
    StateScreens.tsx            loading / empty / error / arrived states
    DevPanel.tsx                 dev-only, never rendered in production
  types/store.ts             LiquorStore + LiquorStoreProvider
scripts/
  debug-discovery.ts          CLI: print every OSM candidate + score for a location
```

## Design decisions worth knowing about

- **No interactive map.** The whole point is that the arrow knows — a map
  would be a second product bolted onto this one.
- **No accounts, no tracking, no stored location history.** Location is
  used only to query nearby stores and compute a bearing, and is never
  sent anywhere else.
- **Compass fallback.** If `DeviceOrientationEvent` is unavailable
  (desktop, unsupported browser, denied permission), the app does not
  fake a rotating arrow — it shows distance + a plain-language direction
  ("620 m northeast") and a Directions button instead.
- **Responsible by design.** No "grab one for the road" copy, no
  drink-driving framing — this app finds stores, nothing more.

## Known limitations / next steps

- The public Overpass mirrors are still free but rate-limited and
  occasionally slow under load. `edge-functions/api/bottle-stores.ts` now
  fronts them with server-side mirror fallback and a short-lived edge
  cache, but a sustained traffic spike could still exhaust all three
  mirrors at once - if that becomes a real problem, a self-hosted
  Overpass instance or an imported OSM extract is the next step (see
  `LiquorStoreProvider` above - the swap only touches the edge function).
- iOS orientation heading (`webkitCompassHeading`) is generally reliable;
  Android's `deviceorientationabsolute` heading accuracy varies by device
  and may need on-device calibration (spinning the phone in a figure-8),
  which is a platform-level gesture the app can't trigger itself.
