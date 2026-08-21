/**
 * All the tunable knobs for the data layer live here so nobody has to go
 * hunting through components to change a radius or a cache duration.
 */
export const CONFIG = {
  /**
   * Radii (metres) to try in order, both for automatic widening when a
   * search finds nothing, and for the manual "Widen the net" action.
   * Starts at 5km, jumps to 10km, then climbs in 5km steps up to a
   * 50km cap.
   */
  searchRadiiMeters: [5000, 10000, 15000, 20000, 25000, 30000, 35000, 40000, 45000, 50000] as number[],

  /** Default first query radius. */
  initialRadiusMeters: 5000,

  /** How long a cached store list stays fresh before we consider re-querying. */
  cacheMaxAgeMs: 30 * 60 * 1000, // 30 minutes

  /** Re-query if the user has wandered this far from where we last queried. */
  refreshDistanceMeters: 2500,

  /** Overpass endpoints to try, in order, on failure/timeout. */
  overpassEndpoints: [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
  ],

  /** Abort a single Overpass request after this long. */
  overpassTimeoutMs: 12000,

  /** localStorage key for the cached store dataset. */
  cacheStorageKey: 'booze-compass:store-cache:v1',

  /** localStorage key for the user's "nearest" vs "nearest open" preference. */
  filterPrefStorageKey: 'booze-compass:filter-pref:v1',

  /** How many degrees of raw heading jitter to smooth away per frame. */
  headingSmoothingAlpha: 0.18,

  /** Max degrees the arrow may step per animation frame (caps overshoot). */
  headingMaxStepPerFrame: 6,

  /** Distance at which we consider the user to have arrived. */
  arrivalRadiusMeters: 40,
} as const;
