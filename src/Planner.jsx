import { useEffect, useMemo, useState } from 'react';
import { fetchItems, fetchItemDetails } from './gqlClient';
import './Planner.css';
import { CAREERS, DEFAULT_CAREER } from './config';

const slots = [
  { name: "Event Item", gridArea: "event" },
  { name: "Pocket 1", gridArea: "pocket1" },
  { name: "Pocket 2", gridArea: "pocket2" },
  { name: "Helm", gridArea: "helm" },
  { name: "Shoulders", gridArea: "shoulders" },
  { name: "Cloak", gridArea: "cloak" },
  { name: "Body", gridArea: "body" },
  { name: "Gloves", gridArea: "gloves" },
  { name: "Belt", gridArea: "belt" },
  { name: "Boots", gridArea: "boots" },
  { name: "Main Hand", gridArea: "mainhand" },
  { name: "Off Hand", gridArea: "offhand" },
  { name: "Ranged Weapon", gridArea: "ranged" },
  { name: "Jewelry Slot 1", gridArea: "jewelry1" },
  { name: "Jewelry Slot 2", gridArea: "jewelry2" },
  { name: "Jewelry Slot 3", gridArea: "jewelry3" },
  { name: "Jewelry Slot 4", gridArea: "jewelry4" }
];

const statOrder = [
  'Strength','Ballistic Skill','Intelligence','Toughness','Weapon Skill','Initiative','Willpower','Wounds'
];

// Revert to per-slot filtering only; no career/type weapon logic for now.

function StatsPanel({ totals, activeSetBonuses, armorTotal = 0, resistTotals = { spirit: 0, elemental: 0, corporeal: 0 } }) {
  return (
    <div className="stats-panel">
      <div className="stats-lines">
        {statOrder.map((name) => (
          <div key={name} className="stats-line">
            <span className="label">{name}</span>
            <span className="value">{totals[name] || 0}</span>
          </div>
        ))}
      </div>
      <div className="stats-separator" />
      <div className="stats-lines">
        <div className="stats-line">
          <span className="label">Armor</span>
          <span className="value">{armorTotal || 0}</span>
        </div>
        <div className="stats-line">
          <span className="label">Spirit Resist</span>
          <span className="value">{resistTotals.spirit || 0}</span>
        </div>
        <div className="stats-line">
          <span className="label">Elemental Resist</span>
          <span className="value">{resistTotals.elemental || 0}</span>
        </div>
        <div className="stats-line">
          <span className="label">Corporeal Resist</span>
          <span className="value">{resistTotals.corporeal || 0}</span>
        </div>
      </div>
      {activeSetBonuses.length > 0 && (
        <div className="set-bonuses">
          <div className="set-bonuses-title">Active set bonuses</div>
          <div className="set-bonuses-list">
            {activeSetBonuses.map((g) => (
              <div key={g.name} className="set-bonuses-item">
                <div className="set-bonuses-name">{g.name}</div>
                <div className="set-bonuses-bonuses">
                  {g.bonuses.map((b, i) => (
                    <div key={i} className="set-bonuses-bonus">{b.pieces}pc: {b.bonus}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const EMPTY_ICON = "https://armory.returnofreckoning.com/item/1";
let ICON_FALLBACKS_CACHE = null;

function GearSlot({ name, gridArea, item, allItems, iconFallbacks, variant = 'grid' }) {
  const tipClass = `gear-tooltip`;
  const formatTitle = (s) => String(s || '').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  const buildSummary = () => {
    if (!item) return '';
    const det = item.details || {};
    const parts = [];
    const armor = det.armor || det.kv?.Armor;
    if (armor) parts.push(`Armor ${String(armor).replace(/[^0-9]/g, '')}`);
    const flatStats = Array.isArray(det.stats) ? det.stats.filter((s) => s && s.unit !== '%' && typeof s.value === 'number' && s.stat) : [];
    for (const s of flatStats.slice(0, 3)) {
      parts.push(`+${s.value} ${s.stat}`);
    }
    return parts.join(', ');
  };
  const buildTooltip = () => {
    if (!item) return null;
    const det = item.details || {};
  const rarity = String(item.rarity || det.rarity || '').toLowerCase();
    const il = Number(det.itemLevel || item.itemLevel || 0) || null;
    const slotLabel = item.slot || name;
    const armor = det.armor != null ? Number(String(det.armor).toString().match(/\d+/)?.[0] || 0) : null;
    const dps = det.dps != null ? Number(det.dps) : null;
    const speed = det.speed != null ? Number(det.speed) : null;
    const talis = det.talismanSlots != null ? Number(det.talismanSlots) : null;
    const reqCR = det.levelRequirement != null ? Number(det.levelRequirement) : null;
    const reqRR = det.renownRankRequirement != null ? Number(det.renownRankRequirement) : null;
    const unique = !!(item.uniqueEquipped || det.uniqueEquipped);
    const stats = Array.isArray(det.stats) ? det.stats : [];
    const setName = det.set?.name || det.itemSet?.name || '';
    const setBonuses = Array.isArray(det.set?.bonuses)
      ? det.set.bonuses
      : Array.isArray(det.itemSet?.bonuses)
        ? det.itemSet.bonuses.map(b => ({ pieces: b.itemsRequired, bonus: b.bonus?.__typename === 'ItemStat' ? `+ ${b.bonus.value}${b.bonus.percentage ? '% ' : ' '}${formatTitle(b.bonus.stat)}` : (b.bonus?.description || b.bonus?.name) }))
        : [];
    return (
      <div className={`tooltip-card ${rarity ? 'rarity-' + rarity : ''}`} role="tooltip">
        <div className="tooltip-header">
          <img className="tooltip-icon" src={iconUrl} alt="" />
          <div>
            <div className={`tooltip-name${det?.set?.name || det?.itemSet?.name ? ' name-set' : ''}`}>{item.name}</div>
          </div>
        </div>
        <div className="tooltip-body">
          {/* Unlabeled meta lines */}
          {(slotLabel || det?.type || il) && (
            <div className="tooltip-section">
              {slotLabel ? <div>{slotLabel}</div> : null}
              {det?.type ? <div>{String(det.type).replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</div> : null}
              {il ? <div>{il}</div> : null}
            </div>
          )}
          {(typeof armor === 'number' && armor > 0) || (typeof dps === 'number' && dps > 0) || (Array.isArray(stats) && stats.length > 0) ? (
            <div className="tooltip-section">
              <div className="section-title">Stats</div>
              <ul className="stat-list">
                {typeof armor === 'number' && armor > 0 ? (
                  <li className="stat-line"><span className="val" style={{ minWidth: 0, textAlign: 'left' }}>{armor}</span><span className="label">Armor</span></li>
                ) : null}
                {typeof dps === 'number' && dps > 0 ? (
                  <li className="stat-line"><span className="val" style={{ minWidth: 0, textAlign: 'left' }}>{dps.toFixed(2)}{typeof speed === 'number' && speed > 0 ? ` (Speed ${speed.toFixed(2)})` : ''}</span><span className="label">DPS</span></li>
                ) : null}
                {stats.map((s, i) => (
                  <li key={i} className="stat-line">
                    <span className="plus">+</span>
                    <span className="val">{typeof s.value === 'number' ? s.value : ''}{s.percentage || s.unit === '%' ? '%' : ''}</span>
                    <span className="label">{formatTitle(s.stat)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {/* Talisman slots as empty icons */}
          {typeof talis === 'number' && talis > 0 && (
            <div className="tooltip-section">
              <div className="section-title">Talisman Slots</div>
              <div className="talis-list">
                {Array.from({ length: talis }).map((_, i) => (
                  <div key={i} className="talis-line"><img className="talis-icon" src={'https://armory.returnofreckoning.com/icon/1'} alt="" /> Empty Talisman Slot</div>
                ))}
              </div>
            </div>
          )}
      {(reqCR || reqRR || unique || (Array.isArray(item?.careerRestriction) && item.careerRestriction.length)) && (
            <div className="tooltip-section">
              <div className="section-title">Requirements</div>
              <div className="req-lines">
        {reqCR ? <div className="req-line req-cr">Minimum Rank: {reqCR}</div> : null}
        {reqRR || reqRR === 0 ? <div className="req-line req-rr">Requires {reqRR} Renown</div> : null}
        {unique ? <div className="req-line req-unique">Unique-Equipped</div> : null}
        {Array.isArray(item?.careerRestriction) && item.careerRestriction.length ? (
          <div className="req-line">Career: {item.careerRestriction.map(c => String(c).replaceAll('_', ' ')).join(', ')}</div>
        ) : null}
              </div>
            </div>
          )}
          {Array.isArray(det?.abilities) && det.abilities.length > 0 && (
            <div className="tooltip-section">
              <div className="section-title">Abilities</div>
              <ul className="set-list">
                {det.abilities.map((ab, i) => (
                  <li key={i} className="set-line">{ab.name || (ab.description ? ab.description.slice(0, 80) + (ab.description.length > 80 ? '…' : '') : 'Ability')}</li>
                ))}
              </ul>
            </div>
          )}
          {Array.isArray(det?.buffs) && det.buffs.length > 0 && (
            <div className="tooltip-section">
              <div className="section-title">Buffs</div>
              <ul className="set-list">
                {det.buffs.map((bf, i) => (
                  <li key={i} className="set-line">{bf.name || (bf.description ? bf.description.slice(0, 80) + (bf.description.length > 80 ? '…' : '') : 'Buff')}</li>
                ))}
              </ul>
            </div>
          )}
          {det?.description && (
            <div className="tooltip-section">
              <div className="section-title">Description</div>
              <div style={{ opacity: 0.95 }}>{det.description}</div>
            </div>
          )}
          {setName && (
            <div className="tooltip-section">
              <div className="section-title">Set Info</div>
              <div>{setName}</div>
              <ul className="set-list">
                {(setBonuses || []).map((b, i) => (
                  <li key={i} className="set-line">({b.pieces} piece bonus): {b.bonus}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  };
  const computeSiblingFallback = () => {
    if (!item || !item.name) return null;
    const slotNorm = (s) => (s || '').trim().toLowerCase();
    const base = String(item.name)
      .replace(/\s+of\s+the\s+.+$/i, '')
      .replace(/\s+of\s+.+$/i, '')
      .trim();
    for (const it of allItems || []) {
      if (!it || String(it.id) === String(item.id)) continue;
      if (item.career && it.career && it.career !== item.career) continue;
      if (slotNorm(it.slot) !== slotNorm(item.slot)) continue;
      const nm = String(it.name || '');
      if (!nm.startsWith(base)) continue;
      const sibIconId = it?.details?.iconId || it?.iconId;
      if (sibIconId) return `https://armory.returnofreckoning.com/item/${sibIconId}`;
      const sibUrl = it?.details?.iconUrl || it?.iconUrl;
      if (sibUrl) return sibUrl;
    }
    return null;
  };
  const iconUrl = (() => {
    const iconId = item?.details?.iconId || item?.iconId;
    if (iconId) return `https://armory.returnofreckoning.com/item/${iconId}`;
    const fromUrl = item?.details?.iconUrl || item?.iconUrl;
    if (fromUrl) return fromUrl;
    const sib = computeSiblingFallback();
    if (sib) return sib;
    const slotKey = (item?.slot || name || '').trim().toLowerCase();
    const fb = iconFallbacks?.[slotKey];
    if (fb) return fb;
    return EMPTY_ICON;
  })();
  const itemLabel = item?.name || name;
  const summaryText = buildSummary();
  const titleText = item ? (summaryText ? `${itemLabel} — ${summaryText}` : itemLabel) : itemLabel;
  const rarityStr = String(item?.rarity || item?.details?.rarity || '').toLowerCase();
  const isSet = !!(item?.details?.set?.name || item?.details?.itemSet?.name);
  const rarityClass = isSet ? 'name-set' : (rarityStr ? `rarity-${rarityStr}` : '');
  if (variant !== 'grid') {
    return (
      <div className={variant === 'classic' ? 'classic-slot' : 'ror-slot'} style={gridArea ? { gridArea } : undefined}>
    {variant === 'classic' && (<div className="slot-label">{name}</div>)}
        {variant === 'ror' ? (() => {
          const lvl = Number(item?.details?.itemLevel || item?.itemLevel || 0) || null;
          const rightLines = item
            ? [
                String(itemLabel || '').trim() || name,
                name,
                lvl ? `Item Level ${lvl}` : null,
              ].filter(Boolean)
            : [name];
          return (
            <div className="slot-row">
      <div className="gear-slot" data-slotname={name} title={titleText} aria-label={titleText}>
                <img src={iconUrl} alt={item?.name || name} className="gear-icon" />
                <div className={tipClass}>{item ? buildTooltip() : ('Click to choose ' + name)}</div>
              </div>
        <div className="item-label-right" title={item ? `${itemLabel} — ${name}${lvl ? ` — iLvl ${lvl}` : ''}` : name}>
                {rightLines.map((ln, idx) => (
          <span key={idx} className={idx === 0 ? `line name-line ${rarityClass}` : 'line meta-line'}>{ln}</span>
                ))}
              </div>
            </div>
          );
        })() : (
      <div className="gear-slot" data-slotname={name} title={titleText} aria-label={titleText}>
            <img src={iconUrl} alt={item?.name || name} className="gear-icon" />
            <div className={tipClass}>{item ? buildTooltip() : ('Click to choose ' + name)}</div>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="gear-slot" style={{ gridArea }} data-slotname={name} title={titleText} aria-label={titleText}>
      <img src={iconUrl} alt={item?.name || name} className="gear-icon" />
      <div className={tipClass}>{item ? buildTooltip() : ('Click to choose ' + name)}</div>
  <div className={`gear-label ${rarityClass}`}>{itemLabel}</div>
    </div>
  );
}

function ItemPicker({ open, onClose, items, slotName, onPick, loading, error, filterName, setFilterName, filterStat, setFilterStat, filterRarity, setFilterRarity }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Select Item for {slotName}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <input
              placeholder="Filter name"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              style={{ flex: 1 }}
            />
            <select
              value={filterStat}
              onChange={(e) => setFilterStat(e.target.value)}
              title="Filter by stat"
            >
              <option value="">Any stat</option>
              {statOrder.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={filterRarity}
              onChange={(e) => setFilterRarity(e.target.value)}
              title="Filter by rarity"
            >
              <option value="">Any rarity</option>
              <option value="UTILITY">Utility</option>
              <option value="COMMON">Common</option>
              <option value="UNCOMMON">Uncommon</option>
              <option value="RARE">Rare</option>
              <option value="VERY_RARE">Very Rare</option>
              <option value="MYTHIC">Mythic</option>
            </select>
            <button onClick={() => { setFilterName(''); setFilterStat(''); setFilterRarity(''); }}>Clear</button>
          </div>
          {loading && <div>Loading…</div>}
          {error && <div style={{ color: 'crimson' }}>Failed to load items. {(error?.message || '').toString()}</div>}
          {!loading && !error && items && items.length === 0 && (
            <div>No items found.</div>
          )}
          {!loading && !error && items && items.length > 0 && (
            <div className="item-list">
      {items.map((it) => {
                const icon = it.iconUrl || it?.details?.iconUrl || (it?.details?.iconId ? `https://armory.returnofreckoning.com/item/${it.details.iconId}` : EMPTY_ICON);
    const isSet = !!(it?.itemSet?.name || it?.details?.set?.name || it?.details?.itemSet?.name);
    const rarityClass = isSet ? 'name-set' : (String(it?.rarity || '').toLowerCase() ? `rarity-${String(it?.rarity || '').toLowerCase()}` : '');
        return (
                  <button key={it.id} className="item-row" onClick={() => onPick(it)}>
                    <span className="item-left">
                      <img className="item-icon" src={icon} alt="" />
          <span className={`item-name ${rarityClass}`}>{it.name}</span>
                    </span>
                    <span className="item-slot">{it.slot || ''}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Planner({ variant = 'grid' }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSlot, setPickerSlot] = useState(null);
  const [allItems, setAllItems] = useState([]); // legacy; no static preload
  const [career, setCareer] = useState(DEFAULT_CAREER);
  const [careerRank, setCareerRank] = useState(40);
  const [renownRank, setRenownRank] = useState(80);
  const [filterName, setFilterName] = useState('');
  const [filterStat, setFilterStat] = useState('');
  const [filterRarity, setFilterRarity] = useState('');
  // Max caps removed; default filtering uses current Career Rank and Renown Rank
  const [equipped, setEquipped] = useState({}); // { [slotDisplayName]: item }
  const [iconFallbacks, setIconFallbacks] = useState(null); // no remote fallbacks on Pages
  const [setsIndex, setSetsIndex] = useState(null); // no static sets index on Pages
  const [pickerItems, setPickerItems] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState(null);

  // No static item preload on Pages; rely on live GraphQL only

  // No external icon fallbacks; default placeholder icon will be used

  // No static sets index; use bonuses from equipped item details

  // Load saved equipped items when career changes
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`equipped:${career}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          setEquipped(parsed);
          return;
        }
      }
    } catch {}
    setEquipped({});
  }, [career]);

  // Persist equipped items whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(`equipped:${career}`, JSON.stringify(equipped || {}));
    } catch {}
  }, [equipped, career]);

  const filteredItems = useMemo(() => {
    if (!pickerSlot) return [];
    // Normalize slot names to a common set; prefer exact matches
  const normalize = (s) => (s || '').trim().toLowerCase().replaceAll('jewellry', 'jewelry');
  const jewelrySlots = ['jewelry slot 1','jewelry slot 2','jewelry slot 3','jewelry slot 4'];
  const mapExact = new Map([
      ['main hand', ['main hand', 'right hand', 'mainhand']],
      ['off hand', ['off hand', 'left hand', 'offhand']],
      ['ranged weapon', ['ranged', 'ranged weapon']],
  ['event item', ['event', 'event item']],
  ['pocket 1', ['pocket 1','pocket1']],
  ['pocket 2', ['pocket 2','pocket2']],
  ['helm', ['helm']],
  ['shoulders', ['shoulder']],
  ['cloak', ['back']],
  ['body', ['body']],
  ['gloves', ['gloves']],
  ['belt', ['belt']],
  ['boots', ['boots']],
  // Any jewelry slot should accept jewelry terms and the 4 specific jewelry slot labels (no pocket/potion)
  ['jewelry slot 1', ['jewelry', 'jewelery', 'jewellery', 'jewel', 'accessory', 'accessories', 'ring', 'neck', 'necklace', 'amulet', 'talisman', 'trinket', 'pendant', 'charm', ...jewelrySlots]],
  ['jewelry slot 2', ['jewelry', 'jewelery', 'jewellery', 'jewel', 'accessory', 'accessories', 'ring', 'neck', 'necklace', 'amulet', 'talisman', 'trinket', 'pendant', 'charm', ...jewelrySlots]],
  ['jewelry slot 3', ['jewelry', 'jewelery', 'jewellery', 'jewel', 'accessory', 'accessories', 'ring', 'neck', 'necklace', 'amulet', 'talisman', 'trinket', 'pendant', 'charm', ...jewelrySlots]],
  ['jewelry slot 4', ['jewelry', 'jewelery', 'jewellery', 'jewel', 'accessory', 'accessories', 'ring', 'neck', 'necklace', 'amulet', 'talisman', 'trinket', 'pendant', 'charm', ...jewelrySlots]],
    ]);
    const target = normalize(pickerSlot);
    const acceptable = Array.from(new Set([...(mapExact.get(target) || []), target]));
    // Parse numeric rank requirements from details if present
    const canUse = (it) => {
      const det = it.details || {};
      // Exclude items above planner-entered caps
  const il = Number(det?.itemLevel || it?.itemLevel || 0);
  const reqLvlNum = Number(det?.levelRequirement || it?.levelRequirement || 0);
  const reqRRNum = Number(det?.renownRankRequirement || it?.renownRankRequirement || det?.renownRank || 0);
  if (reqLvlNum > careerRank) return false;
  if (reqRRNum > renownRank) return false;
      // Career restriction must include selected career, if present
      if (Array.isArray(it.careerRestriction) && it.careerRestriction.length) {
        const want = String(career || '').toUpperCase();
        if (!it.careerRestriction.includes(want)) return false;
      }
      // Extract minimum/career rank
      let reqRank = 0;
      const rrText = det.requiredRank || det.kv?.['Requires Rank'] || '';
      if (typeof rrText === 'string') {
        const m = rrText.match(/(\d+)/);
        if (m) reqRank = parseInt(m[1], 10);
      } else if (typeof rrText === 'number') {
        reqRank = rrText;
      }
      // Extract renown rank
      let reqRenown = 0;
      const renownText = det.renownRank || det.kv?.['Renown Rank'] || '';
      if (typeof renownText === 'string') {
        const m = renownText.match(/(\d+)/);
        if (m) reqRenown = parseInt(m[1], 10);
      } else if (typeof renownText === 'number') {
        reqRenown = renownText;
      }
      return careerRank >= reqRank && renownRank >= reqRenown;
    };
  const arr = allItems
      .filter((it) => acceptable.includes(normalize(it.slot)) && canUse(it))
      .filter((it) => {
        // Name filter
        if (filterName && !String(it.name || '').toLowerCase().includes(filterName.toLowerCase())) return false;
        // Stat presence filter
        if (filterStat) {
          const stats = it?.details?.stats || it?.stats || [];
          const has = stats.some(s => String(s?.stat || '').toLowerCase().includes(filterStat.toLowerCase()));
          if (!has) return false;
        }
      // Rarity filter
      if (filterRarity) {
        const r = String(it?.rarity || it?.details?.rarity || '').toUpperCase();
        if (r !== filterRarity) return false;
      }
        return true;
      })
      .sort((a,b) => {
        const ilA = Number(a?.details?.itemLevel || a?.itemLevel || 0);
        const ilB = Number(b?.details?.itemLevel || b?.itemLevel || 0);
        if (ilA !== ilB) return ilB - ilA;
        const rarOrder = ['UTILITY','COMMON','UNCOMMON','RARE','VERY_RARE','MYTHIC'];
        const ra = rarOrder.indexOf(String(a?.rarity || '').toUpperCase());
        const rb = rarOrder.indexOf(String(b?.rarity || '').toUpperCase());
        return (rb - ra);
      });
    const uniq = new Map();
    for (const it of arr) {
      const id = String(it?.id || '');
      if (!id) continue;
      const prev = uniq.get(id);
      if (!prev) uniq.set(id, it);
    }
    return Array.from(uniq.values());
  }, [allItems, pickerSlot, careerRank, renownRank, filterName, filterStat, filterRarity, career]);

  const onPick = async (item) => {
    // Pre-validate: slot-locked jewelry and unique items
    const normalize = (s) => (s || '').trim().toLowerCase();
    const isJewelrySlotName = (s) => /^jewelry slot [1-4]$/.test(normalize(s));
    const pickSlotNorm = normalize(pickerSlot || '');
    const itemSlotNorm = normalize(item?.slot || '');
    // Strict jewelry slot-lock based on EquipSlot enum: JEWELLERY1 is unlocked; others locked to their slot
    if (isJewelrySlotName(itemSlotNorm) && isJewelrySlotName(pickSlotNorm) && itemSlotNorm !== pickSlotNorm) {
      const raw = String(item?.slotRaw || item?.slot || '').toUpperCase();
      if (raw !== 'JEWELLERY1') {
      alert(`This jewel is locked to ${item.slot} and cannot be equipped in ${pickerSlot}.`);
      return;
      }
    }
    // Enforce uniqueEquipped from list data if available
    if (item?.uniqueEquipped) {
      const already = Object.values(equipped || {}).some((it) => it && String(it.id) === String(item.id));
      if (already) {
        alert('This item is unique and is already equipped in another slot.');
        return;
      }
    }
    try {
      // Hydrate details so totals and bonuses work consistently
      const detail = await fetchItemDetails(item.id);
      // Post-validate with authoritative details
  const isUnique = detail?.uniqueEquipped ?? item?.uniqueEquipped;
  if (isUnique) {
        const already = Object.values(equipped || {}).some((it) => it && String(it.id) === String(detail?.id || item.id));
        if (already) {
          alert('This item is unique and is already equipped in another slot.');
          return;
        }
      }
      const mapped = {
        id: String(detail?.id || item.id),
        name: detail?.name || item.name,
        slot: detail?.slot || item.slot,
        type: detail?.type || item?.type,
        rarity: detail?.rarity || item?.rarity,
        careerRestriction: Array.isArray(item?.careerRestriction) ? item.careerRestriction : undefined,
        career: career?.toUpperCase?.() || undefined,
        details: {
          armor: typeof detail?.armor === 'number' ? detail.armor : (item?.details?.armor ?? undefined),
          iconUrl: detail?.iconUrl || item.iconUrl,
          iconId: undefined,
          itemLevel: detail?.itemLevel,
          renownRank: detail?.renownRankRequirement,
          renownRankRequirement: detail?.renownRankRequirement,
          rarity: detail?.rarity || item?.rarity,
          type: detail?.type || item?.type,
          dps: detail?.dps,
          speed: detail?.speed,
          talismanSlots: detail?.talismanSlots,
          levelRequirement: detail?.levelRequirement,
          description: detail?.description,
          abilities: Array.isArray(detail?.abilities) ? detail.abilities : [],
          buffs: Array.isArray(detail?.buffs) ? detail.buffs : [],
          stats: Array.isArray(detail?.stats)
            ? detail.stats.map(s => ({
                stat: (s?.stat || '').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
                value: s?.value,
                unit: s?.percentage ? '%' : undefined,
              }))
            : [],
          set: detail?.itemSet ? {
            name: detail.itemSet.name,
            bonuses: (detail.itemSet.bonuses || []).map(b => {
              const pieces = b?.itemsRequired;
              const bonus = b?.bonus;
              if (!bonus) return null;
              if (bonus.__typename === 'ItemStat') {
                const statName = String(bonus.stat || '').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
                const val = bonus.value;
                const unit = bonus.percentage ? '%' : '';
                return { pieces, bonus: `+ ${val}${unit ? ' ' + unit : ''} ${statName}` };
              }
              if (bonus.__typename === 'Ability') {
                return { pieces, bonus: bonus.description || bonus.name || 'Ability' };
              }
              return null;
            }).filter(Boolean),
          } : undefined,
        },
      };
  if (pickerSlot) setEquipped((prev) => ({ ...prev, [pickerSlot]: mapped }));
    } catch {
      if (pickerSlot) setEquipped((prev) => ({ ...prev, [pickerSlot]: item }));
    } finally {
      setPickerOpen(false);
    }
  };

  // When opening the picker, fetch items for that slot and career via GraphQL
  useEffect(() => {
    let ignore = false;
    async function loadFromGraphQL() {
      if (!pickerOpen || !pickerSlot) return;
  // Live GraphQL enabled even on GitHub Pages; ensure endpoint allows CORS
      setPickerLoading(true);
      setPickerError(null);
    setPickerItems([]);
      try {
        // Normalize and map slot names (declare before use)
  const normalize = (s) => (s || '').trim().toLowerCase().replaceAll('jewellry', 'jewelry');
  const jewelrySlots = ['jewelry slot 1','jewelry slot 2','jewelry slot 3','jewelry slot 4'];
        const mapExact = new Map([
          ['main hand', ['main hand', 'right hand', 'mainhand']],
          ['off hand', ['off hand', 'left hand', 'offhand']],
          ['ranged weapon', ['ranged', 'ranged weapon']],
          ['event item', ['event', 'event item']],
          ['pocket 1', ['pocket 1','pocket1']],
          ['pocket 2', ['pocket 2','pocket2']],
          ['helm', ['helm']],
          ['shoulders', ['shoulder']],
          ['cloak', ['back']],
          ['body', ['body']],
          ['gloves', ['gloves']],
          ['belt', ['belt']],
          ['boots', ['boots']],
          ['jewelry slot 1', ['jewelry', 'jewelery', 'jewellery', 'jewel', 'accessory', 'accessories', 'ring', 'neck', 'necklace', 'amulet', 'talisman', 'trinket', 'pendant', 'charm', ...jewelrySlots]],
          ['jewelry slot 2', ['jewelry', 'jewelery', 'jewellery', 'jewel', 'accessory', 'accessories', 'ring', 'neck', 'necklace', 'amulet', 'talisman', 'trinket', 'pendant', 'charm', ...jewelrySlots]],
          ['jewelry slot 3', ['jewelry', 'jewelery', 'jewellery', 'jewel', 'accessory', 'accessories', 'ring', 'neck', 'necklace', 'amulet', 'talisman', 'trinket', 'pendant', 'charm', ...jewelrySlots]],
          ['jewelry slot 4', ['jewelry', 'jewelery', 'jewellery', 'jewel', 'accessory', 'accessories', 'ring', 'neck', 'necklace', 'amulet', 'talisman', 'trinket', 'pendant', 'charm', ...jewelrySlots]],
            // Any jewelry slot should accept jewelry terms and the 4 specific jewelry slot labels (no pocket/potion)
            ['jewelry slot 1', ['jewelry', 'jewelery', 'jewellery', 'jewel', 'accessory', 'accessories', 'ring', 'neck', 'necklace', 'amulet', 'talisman', 'trinket', 'pendant', 'charm', ...jewelrySlots]],
            ['jewelry slot 2', ['jewelry', 'jewelery', 'jewellery', 'jewel', 'accessory', 'accessories', 'ring', 'neck', 'necklace', 'amulet', 'talisman', 'trinket', 'pendant', 'charm', ...jewelrySlots]],
            ['jewelry slot 3', ['jewelry', 'jewelery', 'jewellery', 'jewel', 'accessory', 'accessories', 'ring', 'neck', 'necklace', 'amulet', 'talisman', 'trinket', 'pendant', 'charm', ...jewelrySlots]],
            ['jewelry slot 4', ['jewelry', 'jewelery', 'jewellery', 'jewel', 'accessory', 'accessories', 'ring', 'neck', 'necklace', 'amulet', 'talisman', 'trinket', 'pendant', 'charm', ...jewelrySlots]],
        ]);
  const target = normalize(pickerSlot);
        const isJewelryTarget = jewelrySlots.includes(target);
        // Fetch career-scoped; for jewelry, fetch with and without type filter and merge
  let itemsRawCareer = [];
        if (isJewelryTarget) {
          // Query specific accessory equip slots (JEWELLERY1..4) without name-based filters
          const slotsToTry = ['JEWELLERY1', 'JEWELLERY2', 'JEWELLERY3', 'JEWELLERY4'];
          const results = await Promise.all(slotsToTry.map(s => fetchItems({ career, perPage: 50, totalLimit: 500, slotEq: s, allowAnyName: true })));
          const byId = new Map();
          for (const arr of results) {
            for (const it of (arr || [])) byId.set(String(it.id), it);
          }
          itemsRawCareer = Array.from(byId.values());
        } else {
          // Ask server for exact slot
          const slotEnum = (() => {
            if (target === 'helm') return 'HELM';
            if (target === 'shoulders') return 'SHOULDER';
            if (target === 'cloak') return 'BACK';
            if (target === 'body') return 'BODY';
            if (target === 'gloves') return 'GLOVES';
            if (target === 'belt') return 'BELT';
            if (target === 'boots') return 'BOOTS';
            if (target === 'main hand') return 'MAIN_HAND';
            if (target === 'off hand') return 'OFF_HAND';
            if (target === 'ranged weapon') return 'RANGED_WEAPON';
            if (target === 'event item') return 'EVENT_ITEM';
            if (target === 'pocket 1') return 'POCKET1';
            if (target === 'pocket 2') return 'POCKET2';
            return undefined;
          })();
          // Try likely slot enum variants sequentially; skip invalid enum errors
          const slotVariants = (() => {
            if (target === 'helm') return ['HELM','HEAD'];
            if (target === 'shoulders') return ['SHOULDER','SHOULDERS'];
            if (target === 'cloak') return ['CLOAK','BACK','CAPE'];
            if (target === 'body') return ['CHEST','BODY'];
            if (target === 'gloves') return ['HANDS','GLOVES'];
            if (target === 'belt') return ['WAIST','BELT'];
            if (target === 'boots') return ['FEET','BOOTS'];
            if (target === 'main hand') return ['MAIN_HAND','MAINHAND'];
            if (target === 'off hand') return ['OFF_HAND','OFFHAND'];
            if (target === 'ranged weapon') return ['RANGED_WEAPON','RANGED'];
            if (target === 'event item') return ['EVENT_ITEM','EVENTITEM'];
            if (target === 'pocket 1') return ['POCKET1','POCKET_1'];
            if (target === 'pocket 2') return ['POCKET2','POCKET_2'];
            return [slotEnum].filter(Boolean);
          })();
          const byId = new Map();
          for (const sv of slotVariants) {
            try {
              const arr = await fetchItems({ career, perPage: 50, totalLimit: 500, slotEq: sv });
              for (const n of (arr || [])) byId.set(String(n.id), n);
              // If we found items for one variant, we can continue to merge, or break early; keep merging to be safe
            } catch (e) {
              // invalid enum value or other error; try next variant
              continue;
            }
          }
          // Include 2H for main hand visibility (many planners list 2H in main hand)
          if (target === 'main hand') {
            try {
              const twoHand = await fetchItems({ career, perPage: 50, totalLimit: 500, slotEq: 'TWO_HAND' });
              for (const n of (twoHand || [])) byId.set(String(n.id), n);
            } catch {}
          }
          // Fallback without career filter if results are unexpectedly sparse
          if (byId.size === 0) {
            for (const sv of slotVariants) {
              try {
                const noCareer = await fetchItems({ perPage: 50, totalLimit: 500, slotEq: sv, allowAnyName: true });
                for (const n of (noCareer || [])) byId.set(String(n.id), n);
                if (byId.size) break;
              } catch {}
            }
          }
          itemsRawCareer = Array.from(byId.values());
        }
        // Apply client-side slot filtering to handle naming differences (e.g., jewelry)
        const acceptable = Array.from(new Set([...(mapExact.get(target) || []), target]));
          const friendlySlot = (s) => {
          const raw = String(s || '').toUpperCase();
          if (/^JEWELLERY([1-4])$/.test(raw)) {
            const n = raw.slice(-1);
            return `jewelry slot ${n}`;
          }
            if (raw === 'HEAD' || raw === 'HELM') return 'helm';
            if (raw === 'SHOULDER' || raw === 'SHOULDERS') return 'shoulders';
            if (raw === 'CLOAK' || raw === 'BACK' || raw === 'CAPE') return 'cloak';
            if (raw === 'CHEST' || raw === 'BODY') return 'body';
            if (raw === 'HANDS' || raw === 'GLOVES') return 'gloves';
            if (raw === 'WAIST' || raw === 'BELT') return 'belt';
            if (raw === 'FEET' || raw === 'BOOTS') return 'boots';
            if (raw === 'POCKET1') return 'pocket 1';
            if (raw === 'POCKET2') return 'pocket 2';
            if (raw === 'EVENT_ITEM') return 'event item';
          return raw.replace(/_/g, ' ').toLowerCase();
        };
        // No broad accessory-like fallback; rely on exact mapping and raw equip slot checks
        const targetJewNum = isJewelryTarget ? Number((target.match(/(\d)$/) || [])[1] || 0) : 0;
        const itemsPre = (itemsRawCareer || [])
          .map((n) => ({ ...n, slotRaw: n.slot, slot: friendlySlot(n.slot) }));
        let items = itemsPre
          .filter((n) => {
            const ns = normalize(String(n.slot || ''));
            const raw = String(n.slotRaw || '').toUpperCase();
            if (isJewelryTarget && targetJewNum >= 1 && targetJewNum <= 4) {
              // JEWELLERY1 = unlocked; JEWELLERY2/3/4 = locked to that slot
              return raw === 'JEWELLERY1' || ns === `jewelry slot ${targetJewNum}`;
            }
            // For non-jewelry slots, require exact mapping or exact raw enum
            const allowed = new Set(slotVariants);
            if (target === 'main hand') allowed.add('TWO_HAND');
            const rawMatch = allowed.has(raw);
            return acceptable.includes(ns) || rawMatch;
          })
          .filter((n) => {
            // Rank caps
            const reqLvlNum = Number(n?.levelRequirement || 0);
            const reqRRNum = Number(n?.renownRankRequirement || 0);
            if (reqLvlNum > careerRank) return false;
            if (reqRRNum > renownRank) return false;
            // Name filter
            if (filterName && !String(n.name || '').toLowerCase().includes(filterName.toLowerCase())) return false;
            // Stat presence filter
            if (filterStat) {
              const stats = n?.stats || [];
              const has = stats.some(s => String(s?.stat || '').toLowerCase().includes(filterStat.toLowerCase()));
              if (!has) return false;
            }
            // Rarity filter
            if (filterRarity) {
              const r = String(n?.rarity || '').toUpperCase();
              if (r !== filterRarity) return false;
            }
            return true;
          })
          .filter((n) => {
            // Enforce career restrictions if provided
            if (Array.isArray(n.careerRestriction) && n.careerRestriction.length) {
              const want = String(career || '').toUpperCase();
              return n.careerRestriction.includes(want);
            }
            return true;
          })
          .sort((a,b) => {
            const ilA = Number(a?.itemLevel || 0);
            const ilB = Number(b?.itemLevel || 0);
            if (ilA !== ilB) return ilB - ilA;
            const rarOrder = ['UTILITY','COMMON','UNCOMMON','RARE','VERY_RARE','MYTHIC'];
            const ra = rarOrder.indexOf(String(a?.rarity || '').toUpperCase());
            const rb = rarOrder.indexOf(String(b?.rarity || '').toUpperCase());
            return (rb - ra);
          });
        // Hide unique items already equipped in another slot
        const equippedEntries = Object.entries(equipped || {});
        const uniqueIsEquippedElsewhere = (id) => equippedEntries.some(([slotName, it]) => it && String(it.id) === String(id) && slotName !== pickerSlot);
        items = items.filter((n) => !(n?.uniqueEquipped && uniqueIsEquippedElsewhere(n.id)));
        // If target is a jewelry slot and nothing matched, try without career filter as a fallback
        if (isJewelryTarget && items.length === 0) {
          // Retry without career; query accessory slots explicitly again
          const slotsToTry = ['JEWELLERY1', 'JEWELLERY2', 'JEWELLERY3', 'JEWELLERY4'];
          const results = await Promise.all(slotsToTry.map(s => fetchItems({ perPage: 50, totalLimit: 500, slotEq: s, allowAnyName: true })));
          const byId2 = new Map();
          for (const arr of results) for (const it of (arr || [])) byId2.set(String(it.id), it);
          const itemsRawAll = Array.from(byId2.values());
          items = (itemsRawAll || [])
            .map((n) => ({ ...n, slotRaw: n.slot, slot: friendlySlot(n.slot) }))
            .filter((n) => {
              const ns = normalize(String(n.slot || ''));
              const raw = String(n.slotRaw || '').toUpperCase();
              return raw === 'JEWELLERY1' || ns === `jewelry slot ${targetJewNum}`;
            })
            .sort((a,b) => (b.itemLevel || 0) - (a.itemLevel || 0));
          items = items.filter((n) => !(n?.uniqueEquipped && uniqueIsEquippedElsewhere(n.id)));
          // Final fallback: fetch any by slot without name filter
          if (items.length === 0) {
            const anyById = new Map();
            const more = await Promise.all(slotsToTry.map(s => fetchItems({ perPage: 50, totalLimit: 500, slotEq: s, allowAnyName: true })));
            for (const arr of more) for (const it of (arr || [])) anyById.set(String(it.id), it);
            const anyItems = Array.from(anyById.values());
            items = (anyItems || [])
              .map((n) => ({ ...n, slotRaw: n.slot, slot: friendlySlot(n.slot) }))
              .filter((n) => {
                const ns = normalize(String(n.slot || ''));
                const raw = String(n.slotRaw || '').toUpperCase();
                return raw === 'JEWELLERY1' || ns === `jewelry slot ${targetJewNum}`;
              })
              .sort((a,b) => (b.itemLevel || 0) - (a.itemLevel || 0));
            items = items.filter((n) => !(n?.uniqueEquipped && uniqueIsEquippedElsewhere(n.id)));
          }
        }
  if (import.meta && import.meta.env && import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          const expectedEnum = (() => {
            const t = target;
            if (t === 'helm') return ['HELM'];
            if (t === 'shoulders') return ['SHOULDER'];
            if (t === 'cloak') return ['BACK'];
            if (t === 'body') return ['BODY'];
            if (t === 'gloves') return ['GLOVES'];
            if (t === 'belt') return ['BELT'];
            if (t === 'boots') return ['BOOTS'];
            if (t === 'main hand') return ['MAIN_HAND'];
            if (t === 'off hand') return ['OFF_HAND'];
            if (t === 'ranged weapon') return ['RANGED_WEAPON'];
            return [];
          })();
          const mismatchedSlot = expectedEnum.length
            ? items.filter(it => !expectedEnum.includes(String(it.slotRaw || it.slot || '').toUpperCase())).length
            : 0;
          const careerWanted = String(career || '').toUpperCase();
          const careerMismatches = items.filter(it => Array.isArray(it.careerRestriction) && it.careerRestriction.length && !it.careerRestriction.includes(careerWanted)).length;
          console.debug('[Picker]', pickerSlot, 'raw=', (itemsRawCareer||[]).length, 'final=', items.length, 'slot-mismatch=', mismatchedSlot, 'career-mismatch=', careerMismatches);
        }
        if (!ignore) {
          setPickerItems(items || []);
        }
      } catch (e) {
        if (!ignore) setPickerError(e);
      } finally {
        if (!ignore) setPickerLoading(false);
      }
    }
    loadFromGraphQL();
    return () => { ignore = true; };
  }, [pickerOpen, pickerSlot, career, careerRank, renownRank, equipped, filterName, filterStat, filterRarity]);

  // Aggregate primary stats from equipped items and applicable set bonuses
  const totals = useMemo(() => {
  const keys = statOrder;
    const mapKey = (name) => {
      const n = (name || '').trim().toLowerCase();
      if (n === 'strength') return 'Strength';
      if (n === 'ballistic skill') return 'Ballistic Skill';
      if (n === 'intelligence') return 'Intelligence';
      if (n === 'toughness') return 'Toughness';
      if (n === 'weapon skill') return 'Weapon Skill';
      if (n === 'initiative') return 'Initiative';
      if (n === 'willpower') return 'Willpower';
      if (n === 'wounds') return 'Wounds';
      return null;
    };
    const out = Object.fromEntries(keys.map((k) => [k, 0]));
    const items = Object.values(equipped).filter(Boolean);
    // Base item stats
    for (const it of items) {
      const stats = it?.details?.stats || [];
      for (const s of stats) {
        if (s?.unit === '%') continue; // ignore percent for core totals
        const key = mapKey(s?.stat);
        if (key && typeof s?.value === 'number') out[key] += s.value;
      }
    }
    // Set bonuses
    const normalize = (s) => (s || '').trim().toLowerCase();
    const variantOf = (n) => {
      const m = String(n || '').match(/of the\s+([\w\-']+)/i);
      return m ? normalize(m[1]) : '';
    };
    const variantToSetKey = new Map();
    for (const it of items) {
      const sk = (it?.details?.setKey || '').trim();
      if (sk) {
        const v = variantOf(it?.name);
        if (v && !variantToSetKey.has(v)) variantToSetKey.set(v, sk);
      }
    }
    const setGroups = new Map(); // key -> { count, bonuses }
    for (const it of items) {
      let skey = (it?.details?.setKey || '').trim();
      let sname = it?.details?.set?.name || '';
      if (!skey) {
        const v = variantOf(it?.name);
        const inferred = v ? variantToSetKey.get(v) : '';
        if (inferred) skey = inferred;
      }
      const groupKey = skey || sname;
      if (!groupKey) continue;
      let bonuses = [];
      if (skey && setsIndex && setsIndex[skey]?.bonuses?.length) {
        bonuses = setsIndex[skey].bonuses;
      } else if (it?.details?.set?.bonuses?.length) {
        bonuses = it.details.set.bonuses;
      }
      const prev = setGroups.get(groupKey) || { count: 0, bonuses };
      prev.count += 1;
      if (!prev.bonuses?.length && bonuses?.length) prev.bonuses = bonuses;
      setGroups.set(groupKey, prev);
    }
    for (const [, grp] of setGroups) {
      const cnt = grp.count || 0;
      const bonuses = grp.bonuses || [];
      for (const b of bonuses) {
        if (!b || typeof b.pieces !== 'number' || b.pieces > cnt) continue;
        const line = b.bonus || '';
        // Support multiple bonuses separated by comma or 'and'
        const parts = String(line).split(/,| and /i).map((s) => s.trim()).filter(Boolean);
        for (const part of parts) {
          const mPct = part.match(/^\+\s*(\d+(?:\.\d+)?)%\s+(.+)$/i);
          if (mPct) continue; // skip percent
          const mFlat = part.match(/^\+\s*(\d+)\s+(.+)$/i);
          if (mFlat) {
            const val = parseInt(mFlat[1], 10);
            const key = mapKey(mFlat[2]);
            if (key) out[key] += val;
          }
        }
      }
    }
    return out;
  }, [equipped, setsIndex]);

  // defenses block moved below activeSetBonuses to avoid TDZ

  // Compute active set bonuses for display
  const activeSetBonuses = useMemo(() => {
    const items = Object.values(equipped).filter(Boolean);
    if (!items.length) return [];
    const normalize = (s) => (s || '').trim().toLowerCase();
    const variantOf = (n) => {
      const m = String(n || '').match(/of the\s+([\w\-']+)/i);
      return m ? normalize(m[1]) : '';
    };
    const variantToSetKey = new Map();
    for (const it of items) {
      const sk = (it?.details?.setKey || '').trim();
      if (sk) {
        const v = variantOf(it?.name);
        if (v && !variantToSetKey.has(v)) variantToSetKey.set(v, sk);
      }
    }
    // Build groups and pick active bonuses
    const groups = new Map(); // key -> { name, count, bonuses }
    for (const it of items) {
      let skey = (it?.details?.setKey || '').trim();
      if (!skey) {
        const v = variantOf(it?.name);
        const inferred = v ? variantToSetKey.get(v) : '';
        if (inferred) skey = inferred;
      }
      const sname = it?.details?.set?.name || (skey && setsIndex?.[skey]?.name) || '';
      const groupKey = skey || sname;
      if (!groupKey) continue;
      let bonuses = [];
      if (skey && setsIndex && setsIndex[skey]?.bonuses?.length) bonuses = setsIndex[skey].bonuses;
      else if (it?.details?.set?.bonuses?.length) bonuses = it.details.set.bonuses;
      const prev = groups.get(groupKey) || { name: sname || groupKey, count: 0, bonuses };
      prev.count += 1;
      if (!prev.bonuses?.length && bonuses?.length) prev.bonuses = bonuses;
      groups.set(groupKey, prev);
    }
    const out = [];
    for (const [, grp] of groups) {
      const act = (grp.bonuses || []).filter((b) => b && typeof b.pieces === 'number' && b.pieces <= grp.count);
      if (!act.length) continue;
      out.push({ name: grp.name, count: grp.count, bonuses: act });
    }
    return out;
  }, [equipped, setsIndex]);

  // Compute armor and resistances (spirit/elemental/corporeal) from equipped and active set bonuses
  const defenses = useMemo(() => {
    const out = { armor: 0, spirit: 0, elemental: 0, corporeal: 0 };
    const items = Object.values(equipped).filter(Boolean);
    // Armor from item details
    for (const it of items) {
      const det = it?.details || {};
      let armorVal = det?.armor;
      if (armorVal == null && det?.kv && det.kv.Armor != null) armorVal = det.kv.Armor;
      if (typeof armorVal === 'string') {
        const m = armorVal.match(/(\d+)/);
        if (m) armorVal = parseInt(m[1], 10);
      }
      if (typeof armorVal === 'number' && !Number.isNaN(armorVal)) out.armor += armorVal;
      // Resistances from item stats
      const stats = Array.isArray(det?.stats) ? det.stats : [];
      for (const s of stats) {
        const nm = String(s?.stat || '').toLowerCase();
        const val = typeof s?.value === 'number' ? s.value : 0;
        if (!val || s?.unit === '%') continue;
        if (nm.includes('resist')) {
          if (nm.includes('spirit')) out.spirit += val;
          else if (nm.includes('elemental')) out.elemental += val;
          else if (nm.includes('corporeal')) out.corporeal += val;
        }
      }
    }
    // Add resistances from active set bonuses text lines
    for (const grp of (activeSetBonuses || [])) {
      for (const b of (grp?.bonuses || [])) {
        const line = String(b?.bonus || '');
        const m = line.match(/^\+\s*(\d+)\s+(.+)$/i);
        if (!m) continue;
        const val = parseInt(m[1], 10);
        const label = m[2].toLowerCase();
  if (label.includes('armor')) { out.armor += val; continue; }
        if (label.includes('resist')) {
          if (label.includes('spirit')) out.spirit += val;
          else if (label.includes('elemental')) out.elemental += val;
          else if (label.includes('corporeal')) out.corporeal += val;
        }
      }
    }
    return out;
  }, [equipped, activeSetBonuses]);

  const Toolbar = (
    <div className={variant === 'classic' ? 'classic-toolbar' : 'toolbar'} style={{ display: 'flex', gap: 12 }}>
      <label>
        Career:
        <select value={career} onChange={(e) => setCareer(e.target.value)} style={{ marginLeft: 6 }}>
          {CAREERS.map((c) => (
            <option key={c} value={c}>{c.replaceAll('_', ' ')}</option>
          ))}
        </select>
      </label>
      <label>
        Career Rank:
        <input type="number" min={1} max={100} value={careerRank} onChange={(e) => setCareerRank(parseInt(e.target.value || 0, 10))} style={{ width: 70, marginLeft: 6 }} />
      </label>
      <label>
        Renown Rank:
        <input type="number" min={1} max={100} value={renownRank} onChange={(e) => setRenownRank(parseInt(e.target.value || 0, 10))} style={{ width: 70, marginLeft: 6 }} />
      </label>
      <button onClick={() => setEquipped({})}>Reset Gear</button>
    </div>
  );

  const renderGrid = () => (
    <div className="planner-container">
      <div
        className="planner-grid"
        onClick={(e) => {
          const el = e.target.closest('.gear-slot');
          if (!el) return;
          setPickerSlot(el.getAttribute('data-slotname'));
          setPickerOpen(true);
        }}
      >
        {Toolbar}
        {slots.map((slot) => (
          <GearSlot key={slot.name} name={slot.name} gridArea={slot.gridArea} item={equipped[slot.name]} allItems={allItems} iconFallbacks={iconFallbacks || {}} variant={variant} />
        ))}
        <StatsPanel totals={totals} activeSetBonuses={activeSetBonuses} armorTotal={defenses.armor} resistTotals={{ spirit: defenses.spirit, elemental: defenses.elemental, corporeal: defenses.corporeal }} />
      </div>
      <ItemPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        items={pickerItems && pickerItems.length ? pickerItems : filteredItems}
        slotName={pickerSlot}
        onPick={onPick}
        loading={pickerLoading}
        error={pickerError}
        filterName={filterName}
        setFilterName={setFilterName}
        filterStat={filterStat}
  setFilterStat={setFilterStat}
  filterRarity={filterRarity}
  setFilterRarity={setFilterRarity}
      />
    </div>
  );

  const renderClassic = () => {
    const byName = Object.fromEntries(slots.map(s => [s.name, s]));
  const leftArmorOrder = ['Helm', 'Shoulders', 'Cloak', 'Body', 'Gloves', 'Belt', 'Boots'];
    const jewelOrder = ['Jewelry Slot 1', 'Jewelry Slot 2', 'Jewelry Slot 3', 'Jewelry Slot 4'];
    const bottomWeapons = ['Main Hand', 'Off Hand', 'Ranged Weapon'];
    return (
      <div className="classic-container">
        <div
          className="classic-root"
          onClick={(e) => {
            const el = e.target.closest('.gear-slot');
            if (!el) return;
            setPickerSlot(el.getAttribute('data-slotname'));
            setPickerOpen(true);
          }}
        >
          {Toolbar}
          <div className="classic-gear-left">
            {leftArmorOrder.map((name) => {
              const s = byName[name];
              if (!s) return null;
              return (
                <GearSlot key={name} name={name} gridArea={undefined} item={equipped[name]} allItems={allItems} iconFallbacks={iconFallbacks || {}} variant={variant} />
              );
            })}
          </div>
          <div className="classic-doll" />
          <div className="classic-jewels">
            {jewelOrder.map((name) => (
              <GearSlot key={name} name={name} gridArea={undefined} item={equipped[name]} allItems={allItems} iconFallbacks={iconFallbacks || {}} variant={variant} />
            ))}
          </div>
          <div className="classic-right">
            <div className="classic-stats">
              <StatsPanel totals={totals} activeSetBonuses={activeSetBonuses} armorTotal={defenses.armor} resistTotals={{ spirit: defenses.spirit, elemental: defenses.elemental, corporeal: defenses.corporeal }} />
            </div>
          </div>
          <div className="classic-bottom">
            {bottomWeapons.map((name) => (
              <GearSlot key={name} name={name} gridArea={undefined} item={equipped[name]} allItems={allItems} iconFallbacks={iconFallbacks || {}} variant={variant} />
            ))}
          </div>
        </div>
        <ItemPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          items={pickerItems && pickerItems.length ? pickerItems : filteredItems}
          slotName={pickerSlot}
          onPick={onPick}
          loading={pickerLoading}
          error={pickerError}
          filterName={filterName}
          setFilterName={setFilterName}
          filterStat={filterStat}
          setFilterStat={setFilterStat}
          filterRarity={filterRarity}
          setFilterRarity={setFilterRarity}
        />
      </div>
    );
  };

  const renderRor = () => {
    const byName = Object.fromEntries(slots.map(s => [s.name, s]));
  const leftArmorOrder = ['Helm', 'Shoulders', 'Cloak', 'Body', 'Gloves', 'Belt', 'Boots'];
  const midOrder = ['Main Hand', 'Off Hand', 'Ranged Weapon', 'Event Item', 'Pocket 1', 'Pocket 2'];
    const jewelOrder = ['Jewelry Slot 1', 'Jewelry Slot 2', 'Jewelry Slot 3', 'Jewelry Slot 4'];
    return (
      <div className="ror-container">
        <div className="ror-frame">
        <div
          className="ror-root"
          onClick={(e) => {
            const el = e.target.closest('.gear-slot');
            if (!el) return;
            setPickerSlot(el.getAttribute('data-slotname'));
            setPickerOpen(true);
          }}
        >
          <div className="ror-toolbar ror-panel">
            <label>
              Career:
              <select value={career} onChange={(e) => setCareer(e.target.value)} style={{ marginLeft: 6 }}>
                {CAREERS.map((c) => (
                  <option key={c} value={c}>{c.replaceAll('_', ' ')}</option>
                ))}
              </select>
            </label>
            <label>
              CR:
              <input type="number" min={1} max={100} value={careerRank} onChange={(e) => setCareerRank(parseInt(e.target.value || 0, 10))} style={{ width: 64, marginLeft: 6 }} />
            </label>
            <label>
              RR:
              <input type="number" min={0} max={100} value={renownRank} onChange={(e) => setRenownRank(parseInt(e.target.value || 0, 10))} style={{ width: 64, marginLeft: 6 }} />
            </label>
            <button onClick={() => setEquipped({})}>Reset</button>
            {/* Max CR / RR removed per request */}
          </div>
          <div className="ror-armor ror-panel">
            {leftArmorOrder.map((name) => (
              <GearSlot key={name} name={name} item={equipped[name]} allItems={allItems} iconFallbacks={iconFallbacks || {}} variant={variant} />
            ))}
          </div>
          <div className="ror-mid ror-panel">
            {midOrder.map((name) => (
              <GearSlot key={name} name={name} item={equipped[name]} allItems={allItems} iconFallbacks={iconFallbacks || {}} variant={variant} />
            ))}
          </div>
          <div className="ror-jewels ror-panel">
            {jewelOrder.map((name) => (
              <GearSlot key={name} name={name} item={equipped[name]} allItems={allItems} iconFallbacks={iconFallbacks || {}} variant={variant} />
            ))}
          </div>
          <div className="ror-stats">
            <StatsPanel totals={totals} activeSetBonuses={activeSetBonuses} armorTotal={defenses.armor} resistTotals={{ spirit: defenses.spirit, elemental: defenses.elemental, corporeal: defenses.corporeal }} />
          </div>
        </div>
        </div>
        <ItemPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          items={pickerItems && pickerItems.length ? pickerItems : filteredItems}
          slotName={pickerSlot}
          onPick={onPick}
          loading={pickerLoading}
          error={pickerError}
          filterName={filterName}
          setFilterName={setFilterName}
          filterStat={filterStat}
          setFilterStat={setFilterStat}
          filterRarity={filterRarity}
          setFilterRarity={setFilterRarity}
        />
      </div>
    );
  };

  return variant === 'ror' ? renderRor() : variant === 'classic' ? renderClassic() : renderGrid();
}
