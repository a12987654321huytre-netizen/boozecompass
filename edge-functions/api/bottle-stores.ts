// Server-side Overpass proxy.
//
// Root cause of the Safari bug: the browser called public Overpass
// mirrors directly. Some of those mirrors fail outright in Safari
// (connection/CORS failures Brave and Chrome didn't hit) while working
// fine in other browsers. Moving the request here sidesteps the problem
// entirely - server -> Overpass is never subject to browser CORS at all.
//
// This route accepts exactly the inputs the app already sends
// (`lat`, `lon`, `radius`) and does nothing else with the request - it
// can never become an open Overpass proxy. All query-building and
// candidate classification is delegated to the existing, unit-tested
// `OverpassLiquorStoreProvider` (see `src/lib/overpassProvider.ts`) so
// which OSM objects count as a "bottle store" is identical to what the
// browser used to compute itself; nothing about that logic changes here.

import {
  OverpassLiquorStoreProvider,
  type OverpassMirrorAttempt,
  type OverpassRequestLogger,
} from '../../src/lib/overpassProvider';
import { CONFIG } from '../../src/lib/config';
import type { LiquorStore } from '../../src/types/store';

type EdgeOneEventContext = {
  request: Request;
  env: Record<string, unknown>;
};

const CACHE_NAME = 'bottle-stores-v1';

// Same freshness window the client's own localStorage cache already
// uses (CONFIG.cacheMaxAgeMs) - no reason for the edge cache to be
// staler or fresher than what the app already treats as "fresh enough".
const CACHE_TTL_SECONDS = Math.round(CONFIG.cacheMaxAgeMs / 1000);

// Coordinates are bucketed to 3 decimal places (~110m) for cache-key
// purposes only. The Overpass query itself still uses the exact
// submitted coordinates on a cache miss. At the app's minimum 5km
// search radius, a ~110m bucket can't meaningfully change which stores
// come back.
const CACHE_COORD_PRECISION = 3;

const MIN_RADIUS_METERS = CONFIG.searchRadiiMeters[0];
const MAX_RADIUS_METERS = CONFIG.searchRadiiMeters[CONFIG.searchRadiiMeters.length - 1];

function jsonResponse(
  body: unknown,
  status: number,
  extraHeaders?: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

/** Numeric, finite, and within [min, max] - anything else is rejected. */
function parseBoundedNumber(value: string | null, min: number, max: number): number | null {
  if (value === null || value.trim() === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

/** Cache key built from bucketed coordinates, not the raw request URL. */
function buildCacheKey(request: Request, lat: number, lon: number, radius: number): Request {
  const url = new URL(request.url);
  url.search = '';
  url.searchParams.set('lat', lat.toFixed(CACHE_COORD_PRECISION));
  url.searchParams.set('lon', lon.toFixed(CACHE_COORD_PRECISION));
  url.searchParams.set('radius', String(radius));
  return new Request(url.toString(), { method: 'GET' });
}

export async function onRequest(context: EdgeOneEventContext): Promise<Response> {
  const { request } = context;

  if (request.method !== 'GET') {
    return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);
  }

  const startedAt = Date.now();
  const url = new URL(request.url);

  const lat = parseBoundedNumber(url.searchParams.get('lat'), -90, 90);
  const lon = parseBoundedNumber(url.searchParams.get('lon'), -180, 180);
  const radius = parseBoundedNumber(
    url.searchParams.get('radius'),
    MIN_RADIUS_METERS,
    MAX_RADIUS_METERS
  );

  if (lat === null || lon === null || radius === null) {
    return jsonResponse({ error: 'INVALID_PARAMS' }, 400);
  }

  // Server-side cache: an identical (bucketed) lat/lon/radius within the
  // TTL window skips Overpass entirely. Purely an optimisation - any
  // failure here just falls through to a live query.
  let cache: Cache | null = null;
  let cacheKey: Request | null = null;
  try {
    cache = await caches.open(CACHE_NAME);
    cacheKey = buildCacheKey(request, lat, lon, radius);
    const cached = await cache.match(cacheKey);
    if (cached) {
      return cached;
    }
  } catch {
    cache = null;
  }

  const attempts: OverpassMirrorAttempt[] = [];
  const logAttempt: OverpassRequestLogger = (attempt) => {
    attempts.push(attempt);
  };

  const provider = new OverpassLiquorStoreProvider();
  let stores: LiquorStore[];
  try {
    stores = await provider.findNearby(lat, lon, radius, logAttempt);
  } catch (err) {
    // Log technical detail server-side only - the frontend gets a clean
    // error code and shows its existing "map gods are sulking" screen.
    // Coordinates are logged as coarse (~11km) buckets, not the exact
    // user location.
    console.error(
      JSON.stringify({
        route: 'bottle-stores',
        outcome: 'all_mirrors_failed',
        latBucket: lat.toFixed(1),
        lonBucket: lon.toFixed(1),
        radius,
        attempts,
        totalDurationMs: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      })
    );
    return jsonResponse({ error: 'UPSTREAM_UNAVAILABLE' }, 502);
  }

  const succeeded = attempts.find((a) => a.ok);
  console.log(
    JSON.stringify({
      route: 'bottle-stores',
      outcome: 'success',
      latBucket: lat.toFixed(1),
      lonBucket: lon.toFixed(1),
      radius,
      resultCount: stores.length,
      succeededEndpoint: succeeded?.endpoint,
      attempts,
      totalDurationMs: Date.now() - startedAt,
    })
  );

  const response = jsonResponse({ stores }, 200, {
    'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
  });

  if (cache && cacheKey) {
    try {
      await cache.put(cacheKey, response.clone());
    } catch {
      // Non-fatal - this result just won't be cached.
    }
  }

  return response;
}
