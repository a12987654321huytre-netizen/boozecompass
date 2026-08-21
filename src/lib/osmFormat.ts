/** Raw OSM tag bag - values are always strings or undefined. */
export type OsmTags = Record<string, string | undefined>;

/**
 * OSM data is inconsistent. Never surface raw IDs or "undefined" to the
 * customer - fall back to a tasteful generic label instead.
 */
export function resolveStoreName(tags: OsmTags): string {
  const name = tags.name || tags['name:en'] || tags.brand;
  if (name && name.trim().length > 0) return name.trim();
  return 'Liquor store';
}

/**
 * Combine addr:* tags into a single readable line, e.g.
 * "12 Main Street, Stellenbosch". Omits anything that's missing rather
 * than printing "undefined" or leaving stray commas.
 */
export function resolveAddress(tags: OsmTags): string | undefined {
  const houseNumber = tags['addr:housenumber'];
  const street = tags['addr:street'];
  const suburb = tags['addr:suburb'];
  const city = tags['addr:city'];

  const streetLine = [houseNumber, street].filter(Boolean).join(' ');
  const parts = [streetLine, suburb, city].filter(
    (part) => part && part.trim().length > 0
  );

  if (parts.length === 0) return undefined;
  return parts.join(', ');
}

// Liquor-store classification used to live here as a simple boolean tag
// check. It's been replaced by the confidence-scored classifier in
// `liquorScoring.ts`, which layers OSM tags together with name matching
// (see `liquorMatching.ts`) to catch real stores that are mis-tagged or
// untagged in OSM - e.g. a genuine bottle store tagged as a plain
// "convenience" shop. Every case the old boolean check accepted still
// scores in the top tier there, so nothing regresses.
