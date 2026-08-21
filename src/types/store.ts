export type LiquorStore = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  distanceMeters?: number;
  bearingDegrees?: number;
  openingHours?: string;
  address?: string;
  source: 'osm';
  /**
   * How confident the classifier is that this is really a liquor
   * retailer (0-100). Not shown in the UI - the app stays a one-screen
   * compass - but available for debugging/tuning via the discovery
   * debug script.
   */
  matchConfidence?: number;
  /** Human-readable reasons the classifier accepted this candidate. */
  matchReasons?: string[];
};

export type OpenState = 'open' | 'closed' | 'unknown';

export type StoreStatus = {
  state: OpenState;
  /** e.g. "Open until 20:00" or "Opens at 09:00" — omitted when not confidently known. */
  label?: string;
};

/**
 * Anything that can find liquor stores near a point implements this.
 * The UI only ever talks to this interface, so the OSM/Overpass backend
 * can later be swapped for a self-hosted cache, PostGIS, or another POI
 * provider without touching a single component.
 */
export interface LiquorStoreProvider {
  findNearby(
    latitude: number,
    longitude: number,
    radiusMeters: number
  ): Promise<LiquorStore[]>;
}
