export const DEFAULT_CAREER = 'ARCHMAGE';
export const DEFAULT_ARMOR_TYPE = 'ROBE';
// Vite injects the correct base at build time (e.g., '/rorplanner/' on GitHub Pages)
export const BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) ? import.meta.env.BASE_URL : '/';
export const DATA_URL = (career = DEFAULT_CAREER, type = DEFAULT_ARMOR_TYPE) => `${BASE}data/items_${career}_${type}.json`;

// Supported careers (values match scraped filenames)
export const CAREERS = [
	'ARCHMAGE','BLACKGUARD','BLACK_ORC','BRIGHT_WIZARD','CHOPPA','CHOSEN','DISCIPLE_OF_KHAINE','ENGINEER','IRON_BREAKER','KNIGHT_OF_THE_BLAZING_SUN','MAGUS','MARAUDER','RUNE_PRIEST','SHADOW_WARRIOR','SHAMAN','SLAYER','SORCERER','SQUIG_HERDER','SWORD_MASTER','WARRIOR_PRIEST','WHITE_LION','WITCH_ELF','WITCH_HUNTER','ZEALOT'
];

// Build a prioritized list of data paths for a given career.
// Order: career Sovereign → legacy career/type (ROBE) → combined Sovereign (filter client-side)
export function getCareerDataPaths(career) {
	const c = (career || DEFAULT_CAREER).toUpperCase();
	const cl = (career || DEFAULT_CAREER).toLowerCase();
	return [
	// Highest priority: full Killboard scrape per-career (all Sovereign types)
	`${BASE}data/kb_${cl}_all_sovereign.json`,
		`${BASE}data/items_ALL_SOVEREIGN.json`,
		`${BASE}data/items_${c}_SOVEREIGN.json`,
		`${BASE}data/items_${c}_${DEFAULT_ARMOR_TYPE}.json`,
		`${BASE}data/items_OTHERS_SOVEREIGN.json`,
		// Robe Sovereign items scraped from killboard (career-scoped)
		`${BASE}data/kb_${cl}_robe_sovereign.json`,
		// Newly scraped killboard accessories (career-scoped) fallback
		`${BASE}data/kb_${cl}_accessories_6.json`,
	];
}
