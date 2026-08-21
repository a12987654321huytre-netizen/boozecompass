import { describe, it, expect } from 'vitest';
import { distanceQuip } from '../copy';

describe('distanceQuip', () => {
  it('returns the correct line at every required boundary', () => {
    const cases: Array<[number, string]> = [
      [0, "Basically next door."],
      [499, "Basically next door."],
      [500, "Still lekker close."],
      [999, "Still lekker close."],
      [1000, "Just down the road."],
      [1499, "Just down the road."],
      [1500, "Easy enough."],
      [4999, "Ja, that's manageable."],
      [5000, "Right. We're going places."],
      [9999, "Ten kays. Yoh."],
      [10000, "We're properly looking now."],
      [14999, "Nou ja. Onwards."],
      [15000, 'This is no longer "just popping out".'],
      [19999, "Twenty kays. Respectfully: yoh."],
      [20000, "Okay. This is a trek."],
      [24499, "At this point they should know you're coming."],
      [24500, "That is a moerse trek. Pack snacks."],
      [24999, "That is a moerse trek. Pack snacks."],
      [25000, "That is a moerse trek. Pack snacks."],
    ];

    for (const [meters, expected] of cases) {
      expect(distanceQuip(meters)).toBe(expected);
    }
  });

  it('maps every 500m interval from 0 to 25km to exactly one distinct quip, no gaps or overlaps', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const lower = i * 500;
      const upper = lower + 499;
      const lowerQuip = distanceQuip(lower);
      const upperQuip = distanceQuip(upper);
      expect(lowerQuip).toBe(upperQuip);
      seen.add(lowerQuip);
    }
    expect(seen.size).toBe(50);
  });

  it('holds on the final line for distances beyond 25km (search radius climbs to 50km)', () => {
    expect(distanceQuip(30000)).toBe('That is a moerse trek. Pack snacks.');
    expect(distanceQuip(50000)).toBe('That is a moerse trek. Pack snacks.');
  });

  it('is deterministic - same distance always returns the same line', () => {
    expect(distanceQuip(4200)).toBe(distanceQuip(4200));
  });

  it('is stable across repeated calls, not randomized', () => {
    const lines = new Set<string>();
    for (let i = 0; i < 20; i++) {
      lines.add(distanceQuip(4200));
    }
    expect(lines.size).toBe(1);
  });

  it('never returns anything that could read as encouraging drinking and driving', () => {
    const bannedPhrases = ['for the road', 'drink and drive', 'one for the drive'];
    for (const meters of [10, 100, 500, 3000, 8000, 24999, 40000]) {
      const line = distanceQuip(meters).toLowerCase();
      for (const phrase of bannedPhrases) {
        expect(line).not.toContain(phrase);
      }
    }
  });

  it('does not overuse the retired filler words from the old copy', () => {
    // Word-boundary match so "properly" (used deliberately) doesn't
    // false-positive on "proper", and "committed" (the verb, used
    // deliberately) is distinct from "commitment" (the retired noun).
    const bannedWords = [/\bmission\b/, /\bcommitment\b/, /\bproper\b/, /\bbottle store\b/, /\bkilometre/];
    for (let i = 0; i < 50; i++) {
      const line = distanceQuip(i * 500).toLowerCase();
      for (const pattern of bannedWords) {
        expect(line).not.toMatch(pattern);
      }
    }
  });

  it('handles negative input by clamping to the closest line', () => {
    expect(distanceQuip(-5)).toBe('Basically next door.');
  });
});
