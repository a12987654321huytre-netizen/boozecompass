import { useCallback, useEffect, useRef, useState } from 'react';
import type { LiquorStore } from '../types/store';
import { ApiLiquorStoreProvider } from '../lib/apiProvider';
import { CONFIG } from '../lib/config';
import { getDistanceMeters, calculateBearing } from '../lib/geo';
import { readCache, writeCache, isCacheStale, isCacheOutOfRange } from '../lib/storeCache';
import type { GeoPosition } from './useGeolocation';

const provider = new ApiLiquorStoreProvider();

type FetchState = 'idle' | 'loading' | 'widening' | 'error' | 'empty' | 'ready';

type UseNearbyLiquorStoresResult = {
  stores: LiquorStore[];
  state: FetchState;
  usingCache: boolean;
  errorMessage: string | null;
  currentRadiusMeters: number;
  /** Radius the next "Widen the net" click would move to, or null if already capped. */
  nextRadiusMeters: number | null;
  refresh: () => void;
  widenSearch: () => void;
  canWidenFurther: boolean;
};

export function useNearbyLiquorStores(
  position: GeoPosition | null
): UseNearbyLiquorStoresResult {
  const [stores, setStores] = useState<LiquorStore[]>([]);
  const [state, setState] = useState<FetchState>('idle');
  const [usingCache, setUsingCache] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [radiusIndex, setRadiusIndex] = useState(0);
  const queryOriginRef = useRef<{ lat: number; lon: number } | null>(null);
  const forceRefreshRef = useRef(false);
  const queryInFlightRef = useRef(false);

  const applyDistancesAndSort = useCallback(
    (rawStores: LiquorStore[], pos: GeoPosition): LiquorStore[] => {
      return rawStores
        .map((store) => ({
          ...store,
          distanceMeters: getDistanceMeters(
            pos.latitude,
            pos.longitude,
            store.latitude,
            store.longitude
          ),
          bearingDegrees: calculateBearing(
            pos.latitude,
            pos.longitude,
            store.latitude,
            store.longitude
          ),
        }))
        .sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
    },
    []
  );

  const runQuery = useCallback(
    async (pos: GeoPosition, radiusMeters: number) => {
      // Real GPS watches fire repeatedly (even for tiny jitter), which
      // re-triggers the effect below. Without this guard, a slow query
      // could get stacked with duplicate concurrent Overpass requests on
      // every subsequent GPS tick - worse than the caching this hook
      // exists to provide, and it can trip rate limits on the public
      // endpoints, making things even slower.
      if (queryInFlightRef.current) return;
      queryInFlightRef.current = true;

      setState((prev) => (prev === 'ready' ? 'widening' : 'loading'));
      setErrorMessage(null);
      try {
        const found = await provider.findNearby(pos.latitude, pos.longitude, radiusMeters);
        if (found.length === 0) {
          const nextIndex = CONFIG.searchRadiiMeters.indexOf(radiusMeters) + 1;
          if (nextIndex < CONFIG.searchRadiiMeters.length) {
            setRadiusIndex(nextIndex);
            return; // effect below will re-run with the wider radius
          }
          setStores([]);
          setState('empty');
          return;
        }

        const withDistances = applyDistancesAndSort(found, pos);
        setStores(withDistances);
        setUsingCache(false);
        setState('ready');
        queryOriginRef.current = { lat: pos.latitude, lon: pos.longitude };
        writeCache({
          queryLat: pos.latitude,
          queryLon: pos.longitude,
          radiusMeters,
          fetchedAt: Date.now(),
          stores: found,
        });
      } catch {
        // Network/Overpass failure: fall back to cache if we have one,
        // otherwise surface a friendly error.
        const cached = readCache();
        if (cached && cached.stores.length > 0) {
          setStores(applyDistancesAndSort(cached.stores, pos));
          setUsingCache(true);
          setState('ready');
        } else {
          setState('error');
          setErrorMessage(
            "Couldn't reach the map data. Check your connection and try again."
          );
        }
      } finally {
        queryInFlightRef.current = false;
      }
    },
    [applyDistancesAndSort]
  );

  useEffect(() => {
    if (!position) return;

    const cached = readCache();
    const requestedRadius = CONFIG.searchRadiiMeters[radiusIndex];
    const shouldUseCache =
      !forceRefreshRef.current &&
      cached &&
      !isCacheStale(cached) &&
      // The cache only covers what it was actually queried for - if the
      // user has clicked "Widen the net" to a radius bigger than what's
      // cached, we must re-query even though they haven't moved.
      cached.radiusMeters >= requestedRadius &&
      !isCacheOutOfRange(
        getDistanceMeters(position.latitude, position.longitude, cached.queryLat, cached.queryLon)
      );

    if (shouldUseCache && cached) {
      setStores(applyDistancesAndSort(cached.stores, position));
      setUsingCache(false);
      setState('ready');
      queryOriginRef.current = { lat: cached.queryLat, lon: cached.queryLon };
      return;
    }

    forceRefreshRef.current = false;
    void runQuery(position, requestedRadius);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.latitude, position?.longitude, radiusIndex]);

  const refresh = useCallback(() => {
    if (!position) return;
    forceRefreshRef.current = true;
    setRadiusIndex(0);
    void runQuery(position, CONFIG.searchRadiiMeters[0]);
  }, [position, runQuery]);

  const widenSearch = useCallback(() => {
    setRadiusIndex((prev) => Math.min(prev + 1, CONFIG.searchRadiiMeters.length - 1));
  }, []);

  const canWidenFurther = radiusIndex < CONFIG.searchRadiiMeters.length - 1;
  const nextRadiusMeters = canWidenFurther ? CONFIG.searchRadiiMeters[radiusIndex + 1] : null;

  return {
    stores,
    state,
    usingCache,
    errorMessage,
    currentRadiusMeters: CONFIG.searchRadiiMeters[radiusIndex],
    nextRadiusMeters,
    refresh,
    widenSearch,
    canWidenFurther,
  };
}
