import { describe, it, expect } from 'vitest';
import { scoreLiquorCandidate, LIQUOR_CONFIDENCE_THRESHOLD } from '../liquorScoring';

describe('scoreLiquorCandidate - explicit OSM tags', () => {
  it('scores shop=alcohol at 100', () => {
    const result = scoreLiquorCandidate({ shop: 'alcohol' }, 'Some Bottle Store');
    expect(result.score).toBe(100);
    expect(result.accepted).toBe(true);
  });

  it('scores shop=wine at 90', () => {
    const result = scoreLiquorCandidate({ shop: 'wine' }, 'La Cave');
    expect(result.score).toBe(90);
    expect(result.accepted).toBe(true);
  });

  it('scores shop=beverages + alcohol=yes at 90', () => {
    const result = scoreLiquorCandidate({ shop: 'beverages', alcohol: 'yes' }, 'Drinks Depot');
    expect(result.score).toBe(90);
    expect(result.accepted).toBe(true);
  });

  it('does not score shop=beverages alone (no alcohol tag) as a liquor tag signal', () => {
    const result = scoreLiquorCandidate({ shop: 'beverages' }, 'Just A Drinks Shop');
    // No tag signal, no name signal either - should be 0.
    expect(result.score).toBe(0);
    expect(result.accepted).toBe(false);
  });
});

describe('scoreLiquorCandidate - the real Stellenbosch case: Liquor King', () => {
  it('accepts "Liquor King" tagged only as a plain convenience store (no alcohol tag at all)', () => {
    // This is exactly the failure mode described: a real bottle store
    // that OSM has mis-tagged as a generic shop with no alcohol tag -
    // it must still be found, via the name match.
    const result = scoreLiquorCandidate({ shop: 'convenience' }, 'Liquor King');
    expect(result.accepted).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(LIQUOR_CONFIDENCE_THRESHOLD);
    expect(result.reasons.some((r) => r.signal.includes('known SA liquor brand'))).toBe(true);
  });

  it('accepts "Liquor King" with no shop tag at all', () => {
    const result = scoreLiquorCandidate({}, 'Liquor King Khayamandi');
    expect(result.accepted).toBe(true);
  });
});

describe('scoreLiquorCandidate - known brand name', () => {
  it('scores a known SA brand name match at 95', () => {
    const result = scoreLiquorCandidate({ shop: 'convenience' }, 'TOPS at SPAR');
    expect(result.score).toBe(95);
    expect(result.accepted).toBe(true);
  });

  it('known brand name match beats an explicit shop=wine tag if both present (95 vs 90, max wins)', () => {
    const result = scoreLiquorCandidate({ shop: 'wine' }, 'Checkers LiquorShop');
    expect(result.score).toBe(95);
  });
});

describe('scoreLiquorCandidate - generic name keyword', () => {
  it('scores a generic liquor-related name fragment at 85', () => {
    const result = scoreLiquorCandidate({ shop: 'general' }, "Jan's Bottle Store");
    expect(result.score).toBe(85);
    expect(result.accepted).toBe(true);
  });
});

describe('scoreLiquorCandidate - supermarket/convenience with an explicit alcohol tag', () => {
  it('scores a supermarket with alcohol=yes at 75 (attached counter, lower confidence)', () => {
    const result = scoreLiquorCandidate({ shop: 'supermarket', alcohol: 'yes' }, 'Some Supermarket');
    expect(result.score).toBe(75);
    expect(result.accepted).toBe(true);
  });

  it('scores a convenience store with alcohol=yes at 75', () => {
    const result = scoreLiquorCandidate({ shop: 'convenience', alcohol: 'yes' }, 'Corner Cafe');
    expect(result.score).toBe(75);
    expect(result.accepted).toBe(true);
  });
});

describe('scoreLiquorCandidate - must NOT classify every supermarket as a liquor store', () => {
  it('rejects a plain Shoprite with no alcohol tag and no liquor branding', () => {
    const result = scoreLiquorCandidate({ shop: 'supermarket' }, 'Shoprite Stellenbosch');
    expect(result.score).toBe(0);
    expect(result.accepted).toBe(false);
  });

  it('rejects a plain SPAR', () => {
    const result = scoreLiquorCandidate({ shop: 'supermarket' }, 'SPAR Die Boord');
    expect(result.accepted).toBe(false);
  });

  it('rejects a Pick n Pay with no liquor signal', () => {
    const result = scoreLiquorCandidate({ shop: 'supermarket' }, 'Pick n Pay Eikestad Mall');
    expect(result.accepted).toBe(false);
  });

  it('rejects an unrelated bakery', () => {
    const result = scoreLiquorCandidate({ shop: 'bakery' }, 'Village Bakery');
    expect(result.accepted).toBe(false);
  });
});

describe('scoreLiquorCandidate - reasons are always populated for debugging', () => {
  it('gives a rejection reason even at score 0', () => {
    const result = scoreLiquorCandidate({ shop: 'bakery' }, 'Village Bakery');
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('can report multiple independent signals at once', () => {
    // shop=alcohol AND a known brand name both fire.
    const result = scoreLiquorCandidate({ shop: 'alcohol' }, 'TOPS at SPAR');
    expect(result.reasons.length).toBeGreaterThanOrEqual(2);
    expect(result.score).toBe(100); // strongest signal wins, not summed
  });
});
