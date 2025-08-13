import { useEffect, useMemo, useState } from 'react';
import { fetchSovereignItems, fetchItemDetails } from './gqlClient';
import './Planner.css';
import { CAREERS, DEFAULT_CAREER, getCareerDataPaths } from './config';

const slots = [
  { name: "Event Item", gridArea: "event" },
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

function StatsPanel({ totals, activeSetBonuses }) {
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

function GearSlot({ name, gridArea, item, allItems, iconFallbacks }) {
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
  const labelText = item?.name || name;
  const summaryText = buildSummary();
  const titleText = item ? (summaryText ? `${labelText} — ${summaryText}` : labelText) : labelText;
  return (
    <div className="gear-slot" style={{ gridArea }} data-slotname={name} title={titleText} aria-label={titleText}>
      <img src={iconUrl} alt={item?.name || name} className="gear-icon" />
      <div className="gear-tooltip">{item ? (summaryText ? `${labelText} — ${summaryText}` : labelText) : ('Click to choose ' + name)}</div>
      <div className="gear-label">{labelText}</div>
    </div>
  );
}

function ItemPicker({ open, onClose, items, slotName, onPick, loading, error, filterName, setFilterName, filterStat, setFilterStat }) {
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
            {(filterName || filterStat) && (
              <button onClick={() => { setFilterName(''); setFilterStat(''); }}>Clear</button>
            )}
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
                return (
                  <button key={it.id} className="item-row" onClick={() => onPick(it)}>
                    <span className="item-left">
                      <img className="item-icon" src={icon} alt="" />
                      <span className="item-name">{it.name}</span>
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

export default function Planner() {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSlot, setPickerSlot] = useState(null);
  const [allItems, setAllItems] = useState([]);
  const [career, setCareer] = useState(DEFAULT_CAREER);
  const [careerRank, setCareerRank] = useState(40);
  const [renownRank, setRenownRank] = useState(80);
  const [filterName, setFilterName] = useState('');
  const [filterStat, setFilterStat] = useState('');
  const [maxCareerRank, setMaxCareerRank] = useState(100);
  const [maxRenownRank, setMaxRenownRank] = useState(100);
  const [equipped, setEquipped] = useState({}); // { [slotDisplayName]: item }
  const [iconFallbacks, setIconFallbacks] = useState(null);
  const [setsIndex, setSetsIndex] = useState(null);
  const [pickerItems, setPickerItems] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState(null);

  // Load items for selected career from available data sources
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const urls = getCareerDataPaths(career);
      const byId = new Map();
      const pickBetter = (a, b) => {
        if (!a) return b;
        if (!b) return a;
        const ad = a?.details || {}; const bd = b?.details || {};
        const as = (ad.stats?.length ? 1 : 0) + (ad.iconId ? 1 : 0) + (ad.set?.bonuses?.length ? 1 : 0);
        const bs = (bd.stats?.length ? 1 : 0) + (bd.iconId ? 1 : 0) + (bd.set?.bonuses?.length ? 1 : 0);
        return bs > as ? b : a;
      };
      for (const url of urls) {
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const data = await res.json();
          if (Array.isArray(data) && data.length) {
            // If this is combined file, filter to selected career if present
            const subset = data.filter((it) => !it.career || it.career === career.toUpperCase());
            for (const it of subset) {
              const id = String(it?.id || '');
              if (!id) continue;
              const prev = byId.get(id);
              byId.set(id, pickBetter(prev, it));
            }
          }
        } catch {}
      }
      if (!cancelled) setAllItems(Array.from(byId.values()));
    }
    load();
    return () => { cancelled = true; };
  }, [career]);

  // Load icon fallbacks
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (ICON_FALLBACKS_CACHE) { setIconFallbacks(ICON_FALLBACKS_CACHE); return; }
      try {
        const res = await fetch('/data/icon_fallbacks.json');
        if (!res.ok) return;
        const data = await res.json();
        ICON_FALLBACKS_CACHE = data;
        if (!cancelled) setIconFallbacks(data);
      } catch {}
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Load sets index once
  useEffect(() => {
    let cancelled = false;
    async function loadSetsIndex() {
      try {
        const res = await fetch('/data/sets_index_ALL_SOVEREIGN.json');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setSetsIndex(data);
      } catch {}
    }
    loadSetsIndex();
    return () => { cancelled = true; };
  }, []);

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
      ['event item', ['event', 'event item', 'pocket']],
  ['helm', ['helm']],
  ['shoulders', ['shoulder']],
  ['cloak', ['back']],
  ['body', ['body']],
  ['gloves', ['gloves']],
  ['belt', ['belt']],
  ['boots', ['boots']],
  // Any jewelry slot should accept any normalized jewelry plus common labels and all 4 specific jewelry slot labels
  ['jewelry slot 1', ['jewelry', 'jewelery', 'jewellery', 'jewel', 'accessory', 'accessories', 'ring', 'neck', 'necklace', 'amulet', 'talisman', 'trinket', 'pendant', 'charm', 'pocket', 'potion', ...jewelrySlots]],
  ['jewelry slot 2', ['jewelry', 'jewelery', 'jewellery', 'jewel', 'accessory', 'accessories', 'ring', 'neck', 'necklace', 'amulet', 'talisman', 'trinket', 'pendant', 'charm', 'pocket', 'potion', ...jewelrySlots]],
  ['jewelry slot 3', ['jewelry', 'jewelery', 'jewellery', 'jewel', 'accessory', 'accessories', 'ring', 'neck', 'necklace', 'amulet', 'talisman', 'trinket', 'pendant', 'charm', 'pocket', 'potion', ...jewelrySlots]],
  ['jewelry slot 4', ['jewelry', 'jewelery', 'jewellery', 'jewel', 'accessory', 'accessories', 'ring', 'neck', 'necklace', 'amulet', 'talisman', 'trinket', 'pendant', 'charm', 'pocket', 'potion', ...jewelrySlots]],
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
      if (reqLvlNum > maxCareerRank) return false;
      if (reqRRNum > maxRenownRank) return false;
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
  }, [allItems, pickerSlot, careerRank, renownRank, filterName, filterStat, maxCareerRank, maxRenownRank, career]);

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
        career: career?.toUpperCase?.() || undefined,
        details: {
          iconUrl: detail?.iconUrl || item.iconUrl,
          iconId: undefined,
          itemLevel: detail?.itemLevel,
          renownRank: detail?.renownRankRequirement,
          renownRankRequirement: detail?.renownRankRequirement,
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

  // When opening the picker, fetch Sovereign items for that slot and career via GraphQL
  useEffect(() => {
    let ignore = false;
    async function loadFromGraphQL() {
      if (!pickerOpen || !pickerSlot) return;
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
          ['event item', ['event', 'event item', 'pocket']],
          ['helm', ['helm']],
          ['shoulders', ['shoulder']],
          ['cloak', ['back']],
          ['body', ['body']],
          ['gloves', ['gloves']],
          ['belt', ['belt']],
          ['boots', ['boots']],
          ['jewelry slot 1', ['jewelry', 'jewelery', 'jewellery', 'jewel', 'accessory', 'accessories', 'ring', 'neck', 'necklace', 'amulet', 'talisman', 'trinket', 'pendant', 'charm', 'pocket', 'potion', ...jewelrySlots]],
          ['jewelry slot 2', ['jewelry', 'jewelery', 'jewellery', 'jewel', 'accessory', 'accessories', 'ring', 'neck', 'necklace', 'amulet', 'talisman', 'trinket', 'pendant', 'charm', 'pocket', 'potion', ...jewelrySlots]],
          ['jewelry slot 3', ['jewelry', 'jewelery', 'jewellery', 'jewel', 'accessory', 'accessories', 'ring', 'neck', 'necklace', 'amulet', 'talisman', 'trinket', 'pendant', 'charm', 'pocket', 'potion', ...jewelrySlots]],
          ['jewelry slot 4', ['jewelry', 'jewelery', 'jewellery', 'jewel', 'accessory', 'accessories', 'ring', 'neck', 'necklace', 'amulet', 'talisman', 'trinket', 'pendant', 'charm', 'pocket', 'potion', ...jewelrySlots]],
        ]);
  const target = normalize(pickerSlot);
        const isJewelryTarget = jewelrySlots.includes(target);
        // Fetch career-scoped; for jewelry, fetch with and without type filter and merge
        let itemsRawCareer = [];
        if (isJewelryTarget) {
          // Query specific accessory equip slots (JEWELLERY1..4) without name-based filters
          const slotsToTry = ['JEWELLERY1', 'JEWELLERY2', 'JEWELLERY3', 'JEWELLERY4'];
          const results = await Promise.all(slotsToTry.map(s => fetchSovereignItems({ career, perPage: 50, totalLimit: 400, slotEq: s, allowAnyName: true })));
          const byId = new Map();
          for (const arr of results) {
            for (const it of (arr || [])) byId.set(String(it.id), it);
          }
          itemsRawCareer = Array.from(byId.values());
        } else {
          itemsRawCareer = await fetchSovereignItems({ career, perPage: 50, totalLimit: 200 });
        }
        // Apply client-side slot filtering to handle naming differences (e.g., jewelry)
        const acceptable = Array.from(new Set([...(mapExact.get(target) || []), target]));
        const friendlySlot = (s) => {
          const raw = String(s || '').toUpperCase();
          if (/^JEWELLERY([1-4])$/.test(raw)) {
            const n = raw.slice(-1);
            return `jewelry slot ${n}`;
          }
          if (/^POCKET[12]$/.test(raw)) return 'pocket';
          return raw.replace(/_/g, ' ').toLowerCase();
        };
        const isAccessoryLike = (s) => /^(accessory|accessories|jewellery|jewelry|neck|ring|pocket)$/.test(String(s||''));
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
            return acceptable.includes(ns) || isAccessoryLike(ns);
          })
          .filter((n) => {
            // Rank caps
            const reqLvlNum = Number(n?.levelRequirement || 0);
            const reqRRNum = Number(n?.renownRankRequirement || 0);
            if (reqLvlNum > maxCareerRank) return false;
            if (reqRRNum > maxRenownRank) return false;
            // Name filter
            if (filterName && !String(n.name || '').toLowerCase().includes(filterName.toLowerCase())) return false;
            // Stat presence filter
            if (filterStat) {
              const stats = n?.stats || [];
              const has = stats.some(s => String(s?.stat || '').toLowerCase().includes(filterStat.toLowerCase()));
              if (!has) return false;
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
          const results = await Promise.all(slotsToTry.map(s => fetchSovereignItems({ perPage: 50, totalLimit: 400, slotEq: s, allowAnyName: true })));
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
            const more = await Promise.all(slotsToTry.map(s => fetchSovereignItems({ career, perPage: 50, totalLimit: 400, slotEq: s, allowAnyName: true })));
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
        if (!ignore) setPickerItems(items);
      } catch (e) {
        if (!ignore) setPickerError(e);
      } finally {
        if (!ignore) setPickerLoading(false);
      }
    }
    loadFromGraphQL();
    return () => { ignore = true; };
  }, [pickerOpen, pickerSlot, career, renownRank, equipped, filterName, filterStat, maxCareerRank, maxRenownRank]);

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

  return (
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
        <div className="toolbar" style={{ display: 'flex', gap: 12 }}>
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
          <label>
            Max Rank:
            <input type="number" min={1} max={100} value={maxCareerRank} onChange={(e) => setMaxCareerRank(parseInt(e.target.value || 0, 10))} style={{ width: 70, marginLeft: 6 }} />
          </label>
          <label>
            Max Renown:
            <input type="number" min={0} max={100} value={maxRenownRank} onChange={(e) => setMaxRenownRank(parseInt(e.target.value || 0, 10))} style={{ width: 70, marginLeft: 6 }} />
          </label>
        </div>
  {slots.map((slot) => (
          <GearSlot key={slot.name} name={slot.name} gridArea={slot.gridArea} item={equipped[slot.name]} allItems={allItems} iconFallbacks={iconFallbacks || {}} />
        ))}
  <StatsPanel totals={totals} activeSetBonuses={activeSetBonuses} />
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
      />
    </div>
  );
}
