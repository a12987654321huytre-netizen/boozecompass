import { describe, it, expect } from 'vitest';
import { buildQuery } from '../overpassProvider';

describe('buildQuery - regression guard against unscoped name-regex scans', () => {
  // A name-regex query with no tag constraint at all (`nwr["name"~...]`)
  // asks Overpass to scan every named element near the point - roads,
  // bus stops, buildings, everything - against a 1000+ character regex.
  // That's what caused real-world queries to hang indefinitely against
  // the public Overpass API (this file's tests never caught it before
  // because mocked tests don't reflect real query cost). The name-regex
  // clause must always be scoped to elements that already carry a shop
  // tag.
  it('scopes the name-regex query to elements with a shop tag', () => {
    const query = buildQuery(-33.9321, 18.8602, 5000);
    expect(query).toContain('nwr["shop"]["name"~"');
  });

  it('never emits an unscoped nwr[name~...] query with no other tag filter', () => {
    const query = buildQuery(-33.9321, 18.8602, 5000);
    // Every line containing a name regex filter must also mention
    // ["shop"] somewhere on that same line.
    const lines = query.split('\n').filter((line) => line.includes('"name"~"'));
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line).toContain('["shop"]');
    }
  });

  it('still includes the explicit shop=alcohol/wine/beverages tag queries', () => {
    const query = buildQuery(-33.9321, 18.8602, 5000);
    expect(query).toContain('"shop"="alcohol"');
    expect(query).toContain('"shop"="wine"');
    expect(query).toContain('"shop"="beverages"');
  });

  it('produces valid, non-empty Overpass QL with the radius embedded', () => {
    const query = buildQuery(-33.9321, 18.8602, 12345);
    expect(query).toContain('around:12345,-33.9321,18.8602');
    expect(query.length).toBeGreaterThan(0);
  });
});
