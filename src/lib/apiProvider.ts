import type { LiquorStore, LiquorStoreProvider } from '../types/store';

type BottleStoresSuccessResponse = { stores: LiquorStore[] };

/**
 * Talks to our own same-origin API instead of public Overpass mirrors
 * directly. The backend (see `edge-functions/api/bottle-stores.ts`) does
 * exactly what `OverpassLiquorStoreProvider` used to do in the browser -
 * build the same query, try mirrors in order, classify candidates - this
 * class just fetches the already-normalized result.
 *
 * This exists because calling public Overpass mirrors directly from the
 * browser turned out to be unreliable cross-browser: Safari in
 * particular couldn't reach some mirrors at all (CORS/connection
 * failures that Brave/Chrome didn't hit). Moving the request server-side
 * sidesteps browser CORS enforcement entirely, since server -> Overpass
 * is never subject to it.
 */
export class ApiLiquorStoreProvider implements LiquorStoreProvider {
  async findNearby(
    latitude: number,
    longitude: number,
    radiusMeters: number
  ): Promise<LiquorStore[]> {
    const params = new URLSearchParams({
      lat: String(latitude),
      lon: String(longitude),
      radius: String(radiusMeters),
    });

    const response = await fetch(`/api/bottle-stores?${params.toString()}`);

    if (!response.ok) {
      // The API always returns a clean `{ error }` body for known
      // failure modes (see bottle-stores.ts) - the caller
      // (useNearbyLiquorStores) just needs this to throw so it can fall
      // back to the cache or show the existing friendly error screen.
      // No technical detail needs to reach the UI.
      throw new Error(`bottle-stores request failed with status ${response.status}`);
    }

    const data = (await response.json()) as BottleStoresSuccessResponse;
    return data.stores;
  }
}
