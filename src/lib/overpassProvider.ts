import type { LiquorStore, LiquorStoreProvider } from '../types/store';
import { CONFIG } from './config';
import { resolveAddress, resolveStoreName } from './osmFormat';
import type { OsmTags } from './osmFormat';
import { buildLiquorNameRegex } from './liquorMatching';
import { scoreLiquorCandidate, LIQUOR_CONFIDENCE_THRESHOLD } from './liquorScoring';
import type { LiquorScoreResult } from './liquorScoring';

type OverpassElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: OsmTags;
};

type OverpassResponse = {
  elements: OverpassElement[];
};

/** One attempt against a single Overpass mirror, reported to an optional logger. */
export type OverpassMirrorAttempt = {
  endpoint: string;
  ok: boolean;
  status?: number;
  timedOut: boolean;
  durationMs: number;
  error?: string;
};

/**
 * Optional hook invoked once per mirror attempt (success or failure).
 * Used by the server-side API route to log which mirrors were tried,
 * without changing anything about the browser/CLI callers that don't
 * pass one.
 */
export type OverpassRequestLogger = (attempt: OverpassMirrorAttempt) => void;

/** Broader shop categories worth inspecting locally even with no
 * alcohol tag - a real liquor counter/store can end up mis-tagged as
 * any of these. We do NOT accept these on tag alone; scoreLiquorCandidate
 * still requires an alcohol tag or a name match. */
const BROADER_SHOP_CATEGORIES = ['supermarket', 'convenience', 'general', 'department_store'];

export function buildQuery(lat: number, lon: number, radiusMeters: number): string {
  const around = `around:${radiusMeters},${lat},${lon}`;
  const nameRegex = buildLiquorNameRegex();

  const filters = [
    // Layer 1: explicit, unambiguous alcohol retail tags.
    `node["shop"="alcohol"](${around});`,
    `way["shop"="alcohol"](${around});`,
    `node["shop"="wine"](${around});`,
    `way["shop"="wine"](${around});`,
    `node["shop"="beverages"]["alcohol"="yes"](${around});`,
    `way["shop"="beverages"]["alcohol"="yes"](${around});`,
    // Layer 4: broader shop categories that sometimes carry an explicit
    // alcohol tag (a bottle counter inside a bigger store) - filtered
    // further by the scorer, not accepted on category alone.
    ...BROADER_SHOP_CATEGORIES.flatMap((category) => [
      `node["shop"="${category}"](${around});`,
      `way["shop"="${category}"](${around});`,
    ]),
    // Layers 2+3: anything nearby whose *name* looks like a liquor
    // retailer, regardless of its shop category - this is what catches
    // a real, mis-tagged/untagged store like "Liquor King" sitting next
    // to a Shoprite with no alcohol-specific tag at all. Scoped to
    // elements that carry *some* shop tag (any value) rather than every
    // named element in range - matching against every road, bus stop,
    // and building near a point is what was causing queries to hang
    // against the real Overpass API.
    `nwr["shop"]["name"~"${nameRegex}",i](${around});`,
  ].join('\n      ');

  return `
    [out:json][timeout:${Math.round(CONFIG.overpassTimeoutMs / 1000)}];
    (
      ${filters}
    );
    out center tags;
  `.trim();
}

async function fetchFromEndpoint(
  endpoint: string,
  query: string,
  onAttempt?: OverpassRequestLogger
): Promise<OverpassResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.overpassTimeoutMs);
  const startedAt = Date.now();
  let status: number | undefined;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: controller.signal,
    });
    status = response.status;

    if (!response.ok) {
      throw new Error(`Overpass endpoint ${endpoint} returned ${response.status}`);
    }
    const data = (await response.json()) as OverpassResponse;
    onAttempt?.({ endpoint, ok: true, status, timedOut: false, durationMs: Date.now() - startedAt });
    return data;
  } catch (err) {
    onAttempt?.({
      endpoint,
      ok: false,
      status,
      timedOut: controller.signal.aborted,
      durationMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export type DebugCandidate = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  rawTags: OsmTags;
  score: LiquorScoreResult;
};

function elementCoords(element: OverpassElement): { lat: number; lon: number } | null {
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  if (lat == null || lon == null) return null;
  return { lat, lon };
}

function dedupeElements(elements: OverpassElement[]): OverpassElement[] {
  const seen = new Set<string>();
  const result: OverpassElement[] = [];
  for (const element of elements) {
    const key = `${element.type}-${element.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(element);
  }
  return result;
}

async function runOverpassQuery(
  latitude: number,
  longitude: number,
  radiusMeters: number,
  onAttempt?: OverpassRequestLogger
): Promise<OverpassElement[]> {
  const query = buildQuery(latitude, longitude, radiusMeters);

  let lastError: unknown;
  for (const endpoint of CONFIG.overpassEndpoints) {
    try {
      const data = await fetchFromEndpoint(endpoint, query, onAttempt);
      return dedupeElements(data.elements);
    } catch (err) {
      lastError = err;
      // Try the next mirror.
    }
  }
  throw lastError instanceof Error ? lastError : new Error('All Overpass endpoints failed');
}

/**
 * Live Overpass-backed provider. Tries each configured endpoint in order
 * (public Overpass mirrors occasionally fall over or rate-limit) and gives
 * up cleanly rather than retrying forever - callers decide whether to
 * widen the radius or surface an error.
 *
 * Classification is layered: explicit OSM alcohol tags, known SA liquor
 * banners in the name, generic liquor-related name fragments, and
 * alcohol-tagged counters inside bigger stores are all scored (see
 * `liquorScoring.ts`) and only candidates above the confidence threshold
 * are returned from `findNearby`. `findNearbyDebug` returns everything,
 * accepted or not, with the reasoning - see `scripts/debug-discovery.ts`.
 */
export class OverpassLiquorStoreProvider implements LiquorStoreProvider {
  async findNearby(
    latitude: number,
    longitude: number,
    radiusMeters: number,
    onAttempt?: OverpassRequestLogger
  ): Promise<LiquorStore[]> {
    const elements = await runOverpassQuery(latitude, longitude, radiusMeters, onAttempt);

    const scored = elements
      .map((element) => this.toCandidate(element))
      .filter((c): c is DebugCandidate => c !== null);

    const accepted = scored.filter((c) => c.score.accepted);

    // De-dupe: the same real-world shop can appear as both a node and
    // its containing way, or match both the tag query and the name
    // regex query.
    const seen = new Set<string>();
    const stores: LiquorStore[] = [];
    for (const candidate of accepted) {
      const key = `${candidate.name.toLowerCase()}|${candidate.latitude.toFixed(4)}|${candidate.longitude.toFixed(4)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      stores.push({
        id: candidate.id,
        name: candidate.name,
        latitude: candidate.latitude,
        longitude: candidate.longitude,
        openingHours: candidate.rawTags.opening_hours,
        address: resolveAddress(candidate.rawTags),
        source: 'osm',
        matchConfidence: candidate.score.score,
        matchReasons: candidate.score.reasons.map((r) => r.signal),
      });
    }
    return stores;
  }

  /**
   * Returns every raw candidate Overpass returned near a point, scored
   * and annotated with accept/reject reasoning - accepted or not. Used
   * by the debug CLI, never by the app itself.
   */
  async findNearbyDebug(
    latitude: number,
    longitude: number,
    radiusMeters: number,
    onAttempt?: OverpassRequestLogger
  ): Promise<DebugCandidate[]> {
    const elements = await runOverpassQuery(latitude, longitude, radiusMeters, onAttempt);
    return elements
      .map((element) => this.toCandidate(element))
      .filter((c): c is DebugCandidate => c !== null)
      .sort((a, b) => b.score.score - a.score.score);
  }

  private toCandidate(element: OverpassElement): DebugCandidate | null {
    const coords = elementCoords(element);
    if (!coords) return null;

    const tags = element.tags ?? {};
    const name = resolveStoreName(tags);
    const score = scoreLiquorCandidate(tags, name);

    return {
      id: `osm-${element.type}-${element.id}`,
      name,
      latitude: coords.lat,
      longitude: coords.lon,
      rawTags: tags,
      score,
    };
  }
}

export { LIQUOR_CONFIDENCE_THRESHOLD };
