export const DEFAULT_CAREER = 'ARCHMAGE';
export const DEFAULT_ARMOR_TYPE = 'ROBE';

// Supported careers (values match scraped filenames)
export const CAREERS = [
	'ARCHMAGE','BLACKGUARD','BLACK_ORC','BRIGHT_WIZARD','CHOPPA','CHOSEN','DISCIPLE_OF_KHAINE','ENGINEER','IRON_BREAKER','KNIGHT_OF_THE_BLAZING_SUN','MAGUS','MARAUDER','RUNE_PRIEST','SHADOW_WARRIOR','SHAMAN','SLAYER','SORCERER','SQUIG_HERDER','SWORD_MASTER','WARRIOR_PRIEST','WHITE_LION','WITCH_ELF','WITCH_HUNTER','ZEALOT'
];

// Build a prioritized list of data paths for a given career.
// Order: career Sovereign → legacy career/type (ROBE) → combined Sovereign (filter client-side)
// Static data paths removed for Pages; live GraphQL is the only source.

// Mapping from UI career identifiers to Race enum values (as exposed by GraphQL)
export const CAREER_TO_RACE = {
	ARCHMAGE: 'HIGH_ELF',
	BLACKGUARD: 'DARK_ELF',
	BLACK_ORC: 'ORC',
	BRIGHT_WIZARD: 'EMPIRE',
	CHOPPA: 'ORC',
	CHOSEN: 'CHAOS',
	DISCIPLE_OF_KHAINE: 'DARK_ELF',
	ENGINEER: 'DWARF',
	IRON_BREAKER: 'DWARF',
	KNIGHT_OF_THE_BLAZING_SUN: 'EMPIRE',
	MAGUS: 'CHAOS',
	MARAUDER: 'CHAOS',
	RUNE_PRIEST: 'DWARF',
	SHADOW_WARRIOR: 'HIGH_ELF',
	SHAMAN: 'GOBLIN',
	SLAYER: 'DWARF',
	SORCERER: 'DARK_ELF',
	SQUIG_HERDER: 'GOBLIN',
	SWORD_MASTER: 'HIGH_ELF',
	WARRIOR_PRIEST: 'EMPIRE',
	WHITE_LION: 'HIGH_ELF',
	WITCH_ELF: 'DARK_ELF',
	WITCH_HUNTER: 'EMPIRE',
	ZEALOT: 'CHAOS'
};

// Optional: Race to Realm (ORDER/DESTRUCTION) context
export const RACE_TO_REALM = {
	DWARF: 'ORDER',
	HIGH_ELF: 'ORDER',
	EMPIRE: 'ORDER',
	ORC: 'DESTRUCTION',
	GOBLIN: 'DESTRUCTION',
	DARK_ELF: 'DESTRUCTION',
	CHAOS: 'DESTRUCTION'
};

// Career icon URLs from killboard (slug = display name, lowercase, words hyphenated; single-word careers have no hyphen)
export const CAREER_ICON_URLS = {
	ARCHMAGE: 'https://killboard.returnofreckoning.com/images/icons/archmage.png',
	BLACKGUARD: 'https://killboard.returnofreckoning.com/images/icons/black-guard.png',
	BLACK_ORC: 'https://killboard.returnofreckoning.com/images/icons/black-orc.png',
	BRIGHT_WIZARD: 'https://killboard.returnofreckoning.com/images/icons/bright-wizard.png',
	CHOPPA: 'https://killboard.returnofreckoning.com/images/icons/choppa.png',
	CHOSEN: 'https://killboard.returnofreckoning.com/images/icons/chosen.png',
	DISCIPLE_OF_KHAINE: 'https://killboard.returnofreckoning.com/images/icons/disciple-of-khaine.png',
	ENGINEER: 'https://killboard.returnofreckoning.com/images/icons/engineer.png',
	IRON_BREAKER: 'https://killboard.returnofreckoning.com/images/icons/ironbreaker.png',
	KNIGHT_OF_THE_BLAZING_SUN: 'https://killboard.returnofreckoning.com/images/icons/knight-of-the-blazing-sun.png',
	MAGUS: 'https://killboard.returnofreckoning.com/images/icons/magus.png',
	MARAUDER: 'https://killboard.returnofreckoning.com/images/icons/marauder.png',
	RUNE_PRIEST: 'https://killboard.returnofreckoning.com/images/icons/rune-priest.png',
	SHADOW_WARRIOR: 'https://killboard.returnofreckoning.com/images/icons/shadow-warrior.png',
	SHAMAN: 'https://killboard.returnofreckoning.com/images/icons/shaman.png',
	SLAYER: 'https://killboard.returnofreckoning.com/images/icons/slayer.png',
	SORCERER: 'https://killboard.returnofreckoning.com/images/icons/sorcerer.png',
	SQUIG_HERDER: 'https://killboard.returnofreckoning.com/images/icons/squig-herder.png',
		SWORD_MASTER: 'https://killboard.returnofreckoning.com/images/icons/sword-master.png',
	WARRIOR_PRIEST: 'https://killboard.returnofreckoning.com/images/icons/warrior-priest.png',
	WHITE_LION: 'https://killboard.returnofreckoning.com/images/icons/white-lion.png',
	WITCH_ELF: 'https://killboard.returnofreckoning.com/images/icons/witch-elf.png',
	WITCH_HUNTER: 'https://killboard.returnofreckoning.com/images/icons/witch-hunter.png',
	ZEALOT: 'https://killboard.returnofreckoning.com/images/icons/zealot.png'
};
