/**
 * South African liquor-store brand and name-fragment recognition.
 *
 * OSM tagging for SA liquor retail is inconsistent - a real bottle store
 * (e.g. "Liquor King" next to a Shoprite) can easily be untagged,
 * mis-tagged as a generic convenience store, or missing entirely from
 * the "obvious" shop=alcohol/wine/beverages set. This module lets us
 * recognise a likely liquor store from its *name* as a second signal,
 * on top of (never instead of) OSM tags.
 */

/**
 * Normalise a business name for matching: lowercase, expand "&" to
 * "and", strip accents/punctuation, collapse whitespace. This makes
 * "PicardiRebel", "Picardi Rebel", "PICARDI REBEL" and "Picardi-Rebel"
 * all compare equal.
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9\s]/g, ' ') // punctuation -> space (handles PicardiRebel-style joins separately below)
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Known South African liquor-retail banners and chains, normalised.
 * Matched as a substring of the normalised business name, so
 * "Liquor King Khayamandi" or "Overland Liquors / Liquor King" both
 * match "liquor king".
 *
 * Deliberately includes common misspellings/spacing variants (e.g. both
 * "picardi rebel" and "picardirebel") since real OSM data contains both.
 */
export const KNOWN_SA_LIQUOR_BRANDS: readonly string[] = [
  'tops at spar',
  'spar tops',
  'tops',
  'checkers liquorshop',
  'checkers liquor',
  'shoprite liquorshop',
  'shoprite liquor',
  'market liquors',
  'market liquor',
  'food lovers market liquor',
  "food lover's market liquor",
  'foodlovers market liquor',
  'pick n pay liquor',
  'pnp liquor',
  'boxer liquor',
  'ok liquor',
  'liquor city',
  'liquor king',
  'liquor kings',
  'liquorking',
  'the liquor boys',
  'liquor boys',
  'ultra liquors express',
  'ultra liquors',
  'liberty liquors',
  'picardi rebel',
  'picardirebel',
  'blue bottle liquors xl',
  'blue bottle liquors express',
  'blue bottle liquors platinum',
  'blue bottle platinum',
  'blue bottle express',
  'blue bottle liquors',
  'liquors express',
  'liquor express',
  "big daddy's liquors",
  'big daddys liquors',
  'big daddy liquors',
  "diamond's discount liquor",
  'diamonds discount liquor',
  'norman goodfellows',
  'ngf',
  'whiskybrother',
  'whisky brother',
  'whisky emporium',
  "monty's liquor boutique",
  'montys liquor boutique',
  "king's liquor",
  'kings liquor',
  'grapevine blue bottle liquors',
  'grapevine liquors',
  'solly kramers',
  'tabooz',
  'liquor land',
  'liquorland',
  'loco liquor',
  'liquor legends',
  'model bottle store',
  'monument liquor warehouse',
  'wine and liquor',
  'western province cellars',
] as const;

/**
 * Generic name fragments that suggest a liquor retailer even when the
 * business isn't one of the known banners above. Lower confidence than
 * a known-brand match, but still a strong signal - virtually nothing
 * that isn't a liquor retailer puts "bottle store" or "drankwinkel" in
 * its name.
 *
 * "kelders" (cellars) is deliberately excluded on its own - it's too
 * generic and collides with unrelated place names (e.g. the town "De
 * Kelders"). "wynkelders" (wine cellars) is specific enough to keep.
 */
export const GENERIC_LIQUOR_NAME_FRAGMENTS: readonly string[] = [
  'liquor shop',
  'liquorshop',
  'liquor store',
  'liquor mart',
  'liquor warehouse',
  'discount liquor',
  'wholesale liquor',
  'bottle store',
  'bottlestore',
  'bottle shop',
  'wine and spirits',
  'wines and spirits',
  'wine and liquor',
  'drankwinkel',
  'drank winkel',
  'wynwinkel',
  'wyn and drank',
  'wynkelders',
  // Bare "liquor"/"liquors" last and least specific of this tier, but
  // still reliably alcohol-related as a business-name fragment.
  'liquors',
  'liquor',
] as const;

function containsFragment(normalized: string, fragment: string): boolean {
  return normalized.includes(fragment);
}

/** True if the name matches a known SA liquor-retail banner/chain. */
export function matchesKnownBrand(name: string): boolean {
  const normalized = normalizeName(name);
  return KNOWN_SA_LIQUOR_BRANDS.some((brand) => containsFragment(normalized, brand));
}

/** True if the name contains a generic liquor-retail keyword/phrase. */
export function matchesGenericLiquorKeyword(name: string): boolean {
  const normalized = normalizeName(name);
  return GENERIC_LIQUOR_NAME_FRAGMENTS.some((fragment) =>
    containsFragment(normalized, fragment)
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a single Overpass-compatible regex (PCRE-ish, case handled via
 * the ",i" flag in the query itself) that matches any of the known
 * brands or generic keywords in a `name` tag. Used to ask Overpass
 * directly for "anything nearby whose name looks like a liquor store",
 * regardless of its shop/amenity tag - this is what catches a
 * mis-tagged or untagged real bottle store like "Liquor King".
 */
export function buildLiquorNameRegex(): string {
  const allFragments = [...KNOWN_SA_LIQUOR_BRANDS, ...GENERIC_LIQUOR_NAME_FRAGMENTS];
  // De-dupe and sort longest-first (not required for regex correctness
  // here since we're not anchoring, but keeps the pattern tidier).
  const unique = Array.from(new Set(allFragments)).sort((a, b) => b.length - a.length);
  // Fragments are normalised (spaces, no punctuation) - allow a single
  // space OR hyphen OR nothing between words so it still matches
  // "Liquor-King" or "LiquorKing" in the raw (non-normalised) OSM name
  // that Overpass is matching against server-side.
  return unique.map((fragment) => escapeRegExp(fragment).replace(/\\ /g, '[ -]?')).join('|');
}
