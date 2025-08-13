export const DEFAULT_CAREER = 'ARCHMAGE';
export const DEFAULT_ARMOR_TYPE = 'ROBE';
export const DATA_URL = (career = DEFAULT_CAREER, type = DEFAULT_ARMOR_TYPE) => `/data/items_${career}_${type}.json`;

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
	`/data/kb_${cl}_all_sovereign.json`,
		`/data/items_ALL_SOVEREIGN.json`,
		`/data/items_${c}_SOVEREIGN.json`,
		`/data/items_${c}_${DEFAULT_ARMOR_TYPE}.json`,
		`/data/items_OTHERS_SOVEREIGN.json`,
		// Robe Sovereign items scraped from killboard (career-scoped)
		`/data/kb_${cl}_robe_sovereign.json`,
		// Newly scraped killboard accessories (career-scoped) fallback
		`/data/kb_${cl}_accessories_6.json`,
	];
}
