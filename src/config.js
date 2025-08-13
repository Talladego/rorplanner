export const DEFAULT_CAREER = 'ARCHMAGE';
export const DEFAULT_ARMOR_TYPE = 'ROBE';

// Supported careers (values match scraped filenames)
export const CAREERS = [
	'ARCHMAGE','BLACKGUARD','BLACK_ORC','BRIGHT_WIZARD','CHOPPA','CHOSEN','DISCIPLE_OF_KHAINE','ENGINEER','IRON_BREAKER','KNIGHT_OF_THE_BLAZING_SUN','MAGUS','MARAUDER','RUNE_PRIEST','SHADOW_WARRIOR','SHAMAN','SLAYER','SORCERER','SQUIG_HERDER','SWORD_MASTER','WARRIOR_PRIEST','WHITE_LION','WITCH_ELF','WITCH_HUNTER','ZEALOT'
];

// Build a prioritized list of data paths for a given career.
// Order: career Sovereign → legacy career/type (ROBE) → combined Sovereign (filter client-side)
// Static data paths removed for Pages; live GraphQL is the only source.
