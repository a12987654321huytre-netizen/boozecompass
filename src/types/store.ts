import type { OsmTags } from '../lib/osmFormat';
import type { LiquorScoreResult } from '../lib/liquorScoring';
import type { SAProvince } from '../lib/saGeography';

export type LiquorLocationType = 'standalone' | 'attached-counter';

export type LiquorSource =
  | 'osm'
  | 'osm-seed'
  | 'curated'
  | 'cache'
  | 'google-places'
  | 'places-fallback';

export type LiquorStore = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  distanceMeters?: number;
  bearingDegrees?: number;
  openingHours?: string;
  address?: string;
  source: LiquorSource;
  locationType?: LiquorLocationType;
  parentName?: string;
  brand?: string;
  matchConfidence?: number;
  matchReasons?: string[];
  alternativeNames?: string[];
  identitySource?: string;
  osmId?: string;
  googlePlaceId?: string;
  phone?: string;
  website?: string;
  province?: SAProvince;
  city?: string;
};

export type OpenState = 'open' | 'closed' | 'unknown';

export type StoreStatus = {
  state: OpenState;
  label?: string;
};

export type DiscoveredCandidate = {
  id: string;
  latitude: number;
  longitude: number;
  rawTags: OsmTags;
  score: LiquorScoreResult;
  source: LiquorSource;
  osmId?: string;
  googlePlaceId?: string;
  curatedName?: string;
  curatedType?: LiquorLocationType;
  curatedParentName?: string;
};

export interface LiquorStoreProvider {
  findNearby(
    latitude: number,
    longitude: number,
    radiusMeters: number
  ): Promise<LiquorStore[]>;
}

export type CoverageLevel = 'none' | 'thin' | 'ok' | 'strong';

export type DiscoveryMeta = {
  fromCache: boolean;
  cacheStale: boolean;
  overpassAttempted: boolean;
  overpassSucceeded: boolean;
  fallbackAttempted: boolean;
  coverage: CoverageLevel;
  sourcesUsed: LiquorSource[];
  rejectedCount: number;
};
