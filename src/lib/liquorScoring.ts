import type { OsmTags } from './osmFormat';
import { matchesKnownBrand, matchesGenericLiquorKeyword } from './liquorMatching';

export type ScoreReason = {
  signal: string;
  score: number;
};

export type LiquorScoreResult = {
  score: number;
  accepted: boolean;
  reasons: ScoreReason[];
};

/**
 * Below this, we don't consider it a liquor store. Keeps a plain
 * Shoprite/Checkers/SPAR/Pick n Pay with no alcohol signal at all (score
 * 0) firmly excluded, while accepting anything with a real signal.
 */
export const LIQUOR_CONFIDENCE_THRESHOLD = 70;

const ALCOHOL_SHOP_TYPES = new Set(['supermarket', 'convenience', 'general', 'department_store']);

/**
 * Score how likely an OSM element (by its tags and name) is to be a
 * genuine liquor retailer. Multiple signals can fire independently -
 * we report all of them (useful for the debug tool) and take the
 * strongest one as the overall score, rather than summing them, so a
 * confident single signal isn't penalised for lacking others.
 */
export function scoreLiquorCandidate(tags: OsmTags, name: string): LiquorScoreResult {
  const reasons: ScoreReason[] = [];

  // -- Layer 1: strong, explicit OSM category tags --
  if (tags.shop === 'alcohol') {
    reasons.push({ signal: 'shop=alcohol', score: 100 });
  }
  if (tags.shop === 'wine') {
    reasons.push({ signal: 'shop=wine', score: 90 });
  }
  if (tags.shop === 'beverages' && tags.alcohol === 'yes') {
    reasons.push({ signal: 'shop=beverages + alcohol=yes', score: 90 });
  }
  if (tags.alcohol === 'yes' && tags.shop && !ALCOHOL_SHOP_TYPES.has(tags.shop)) {
    reasons.push({ signal: `shop=${tags.shop} + alcohol=yes`, score: 90 });
  }

  // -- Layer 2: known SA liquor-retail banner in the name --
  if (matchesKnownBrand(name)) {
    reasons.push({ signal: 'known SA liquor brand name', score: 95 });
  }

  // -- Layer 3: generic liquor-related name fragment --
  if (matchesGenericLiquorKeyword(name)) {
    reasons.push({ signal: 'generic liquor-related name fragment', score: 85 });
  }

  // -- Layer 4: supermarket/convenience/general store that explicitly
  // tags alcohol sales. Lower confidence than a dedicated liquor shop -
  // this is "the bottle counter inside a bigger store", not "every
  // supermarket". A plain supermarket with NO alcohol tag and no name
  // match gets no reason here, and correctly scores 0.
  if (tags.alcohol === 'yes' && tags.shop && ALCOHOL_SHOP_TYPES.has(tags.shop)) {
    reasons.push({ signal: `shop=${tags.shop} + alcohol=yes (attached counter)`, score: 75 });
  }

  const score = reasons.reduce((max, r) => Math.max(max, r.score), 0);

  if (reasons.length === 0) {
    reasons.push({ signal: 'no alcohol tag or liquor-related name match', score: 0 });
  }

  return {
    score,
    accepted: score >= LIQUOR_CONFIDENCE_THRESHOLD,
    reasons,
  };
}
