import type { LiquorStore } from '../types/store';
import { CONFIG } from './config';

type CacheEntry = {
  queryLat: number;
  queryLon: number;
  radiusMeters: number;
  fetchedAt: number;
  stores: LiquorStore[];
};

export function readCache(): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CONFIG.cacheStorageKey);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry;
  } catch {
    // Corrupt cache, private-browsing quota errors, etc. - just treat as empty.
    return null;
  }
}

export function writeCache(entry: CacheEntry): void {
  try {
    localStorage.setItem(CONFIG.cacheStorageKey, JSON.stringify(entry));
  } catch {
    // Storage full or unavailable - non-fatal, we just won't have a cache.
  }
}

export function isCacheStale(entry: CacheEntry): boolean {
  return Date.now() - entry.fetchedAt > CONFIG.cacheMaxAgeMs;
}

/** True once the user has wandered far enough that we should re-query. */
export function isCacheOutOfRange(distanceFromQueryOriginMeters: number): boolean {
  return distanceFromQueryOriginMeters > CONFIG.refreshDistanceMeters;
}

export type { CacheEntry };
