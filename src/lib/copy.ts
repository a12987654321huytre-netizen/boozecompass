/**
 * Distance-dependent commentary. The whole app is dry and instrument-y,
 * so this is where the personality lives - one line per 500m band from
 * 0 to 25km, no repeats, no randomization. It should read like a dry
 * South African friend making an offhand comment, not a mascot with a
 * catchphrase - so it leans on understatement and mild disbelief rather
 * than repeating the same handful of words, and only reaches for local
 * language occasionally rather than every line.
 */

const QUIPS: string[] = [
  "Basically next door.",
  "Still lekker close.",
  "Just down the road.",
  "Easy enough.",
  "A little leg stretch.",
  "Not far. Don't overthink it.",
  "Okay, slightly less convenient.",
  "Still well within reason.",
  "You're not exactly popping next door.",
  "Ja, that's manageable.",
  "Right. We're going places.",
  "Could've been closer, hey.",
  "This is becoming an outing.",
  "Ag, it's not that bad.",
  "You've committed now.",
  "Might as well check the specials.",
  "Getting a bit ambitious.",
  "Not exactly around the corner.",
  "Okay, now now is becoming later later.",
  "Ten kays. Yoh.",
  "We're properly looking now.",
  "This had better be a decent shop.",
  "Bit of a schlep.",
  "You may be gone a while.",
  "This has developed into plans.",
  "Ask yourself how badly you want this.",
  "Somewhere out there, apparently.",
  "Too far to turn philosophical now.",
  'We\'ve stretched "nearby" quite far here.',
  "Nou ja. Onwards.",
  'This is no longer "just popping out".',
  "Someone's going to ask where you went.",
  "Definitely an outing now.",
  "You could've packed padkos.",
  "At least you'll see a bit of the country.",
  "This escalated quietly.",
  "We're in deep now.",
  '"Nearby" is doing a lot of work here.',
  "At this point, phone first.",
  "Twenty kays. Respectfully: yoh.",
  "Okay. This is a trek.",
  "Bring snacks. Seriously.",
  "We've crossed into journey territory.",
  "Ja no, that's far.",
  "You'd better really like their selection.",
  "There had better be parking.",
  "Nou ja. We've come this far.",
  "This search has become personal.",
  "At this point they should know you're coming.",
  "That is a moerse trek. Pack snacks.",
];

const INTERVAL_METERS = 500;

/**
 * One quip per 500m band from 0 up to 25km (QUIPS[0] covers [0, 500),
 * QUIPS[1] covers [500, 1000), ... QUIPS[49] covers [24500, 25000)).
 * Anything at or beyond 25km - which can happen since the search radius
 * climbs past 25km up to a 50km cap - holds on the last (strongest) line
 * rather than running out of ladder.
 */
export function distanceQuip(meters: number): string {
  const index = Math.min(Math.floor(Math.max(meters, 0) / INTERVAL_METERS), QUIPS.length - 1);
  return QUIPS[index];
}
