/**
 * Probe killboard icon URLs for all careers and print a JSON mapping.
 * Uses known URL pattern: https://killboard.returnofreckoning.com/images/icons/<slug>.png
 * Generates candidate slugs per career and checks which returns HTTP 200.
 */

const https = require('https');

const CAREERS = [
  'ARCHMAGE','BLACKGUARD','BLACK_ORC','BRIGHT_WIZARD','CHOPPA','CHOSEN','DISCIPLE_OF_KHAINE','ENGINEER','IRON_BREAKER','KNIGHT_OF_THE_BLAZING_SUN','MAGUS','MARAUDER','RUNE_PRIEST','SHADOW_WARRIOR','SHAMAN','SLAYER','SORCERER','SQUIG_HERDER','SWORD_MASTER','WARRIOR_PRIEST','WHITE_LION','WITCH_ELF','WITCH_HUNTER','ZEALOT'
];

const BASE = 'https://killboard.returnofreckoning.com/images/icons';

function toHyphenSlug(career) {
  return career.toLowerCase().replace(/_/g, '-');
}

// Some careers are single-word in-game (IRONBREAKER, SWORDMASTER, BLACKGUARD)
function toConcatenatedSlug(career) {
  return career.toLowerCase().replace(/_/g, '').replace(/\s+/g, '');
}

// Additional hand-crafted aliases when both above fail
const EXTRA_ALIASES = {
  BLACKGUARD: ['black-guard'],
  IRON_BREAKER: ['ironbreaker'],
  SWORD_MASTER: ['swordmaster']
};

function head(url) {
  return new Promise((resolve) => {
    const req = https.request(url, { method: 'HEAD' }, (res) => {
      // Consume and end
      res.resume();
      resolve({ statusCode: res.statusCode, url });
    });
    req.on('error', () => resolve({ statusCode: 0, url }));
    req.end();
  });
}

async function findIconForCareer(career) {
  const candidates = new Set();
  candidates.add(toHyphenSlug(career));
  candidates.add(toConcatenatedSlug(career));
  const extra = EXTRA_ALIASES[career];
  if (extra) extra.forEach((s) => candidates.add(s));

  for (const slug of candidates) {
    const url = `${BASE}/${slug}.png`;
    const { statusCode } = await head(url);
    if (statusCode === 200) return url;
  }
  return null;
}

async function main() {
  const mapping = {};
  for (const c of CAREERS) {
    const url = await findIconForCareer(c);
    mapping[c] = url;
  }
  // Print results; missing ones will be null.
  console.log(JSON.stringify(mapping, null, 2));
}

main();
