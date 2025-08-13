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
const defenseOrder = [
  'Armor',
  'Spiritual Resistance','Corporeal Resistance','Elemental Resistance',
  'Block','Parry','Dodge','Disrupt'
];
const offenseOrder = [
  'Melee Critical Hit Bonus','Melee Power',
  'Ranged Critical Hit Bonus','Ranged Power',
  'Armor Penetration'
];
const magicOrder = [
  'Magic Critical Hit Bonus','Magic Power',
  'Healing Critical Bonus','Healing Power'
];

// Revert to per-slot filtering only; no career/type weapon logic for now.

function StatsPanel({ totals, activeSetBonuses, defenseList = [], offenseList = [], magicList = [], primaryContrib = {}, defContrib = {}, offContrib = {}, magContrib = {} }) {
  const fmtTitle = (entries) => {
    if (!Array.isArray(entries) || !entries.length) return '';
    return entries
      .map((e) => {
        const parts = [];
        if (typeof e.flat === 'number' && e.flat) parts.push(`+${e.flat}`);
        if (typeof e.pct === 'number' && e.pct) parts.push(`+${Number.isInteger(e.pct) ? e.pct : e.pct.toFixed(2)}%`);
        const val = parts.join(' ');
        return `${e.source}${val ? `: ${val}` : ''}`;
      })
      .join('\n');
  };
  return (
    <div className="stats-panel">
      <div className="stats-lines">
        {statOrder.filter((name) => (totals[name] || 0) !== 0).map((name) => {
          const val = totals[name] || 0;
          const title = fmtTitle(primaryContrib[name] || []);
          return (
            <div key={name} className="stats-line" title={title}>
              <span className="label">{name}</span>
              <span className="value">{val}</span>
            </div>
          );
        })}
      </div>
      <div className="stats-separator" />
      {/* Defense */}
      <div className="stats-lines">
        {defenseList.filter((s) => s && String(s.value) !== '0').map((s) => (
          <div key={s.label} className="stats-line" title={fmtTitle(defContrib[s.label] || [])}>
            <span className="label">{s.label}</span>
            <span className="value">{s.value}</span>
          </div>
        ))}
      </div>
      <div className="stats-separator" />
      {/* Offense */}
      <div className="stats-lines">
        {offenseList.filter((s) => s && String(s.value) !== '0').map((s) => (
          <div key={s.label} className="stats-line" title={fmtTitle(offContrib[s.label] || [])}>
            <span className="label">{s.label}</span>
            <span className="value">{s.value}</span>
          </div>
        ))}
      </div>
      <div className="stats-separator" />
      {/* Magic */}
      <div className="stats-lines">
        {magicList.filter((s) => s && String(s.value) !== '0').map((s) => (
          <div key={s.label} className="stats-line" title={fmtTitle(magContrib[s.label] || [])}>
            <span className="label">{s.label}</span>
            <span className="value">{s.value}</span>
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

function GearSlot({ name, gridArea, item, allItems, iconFallbacks, variant = 'grid', talisCount = 0, talismans = [], onTalisPick, onTalisClear }) {
  const tipClass = `gear-tooltip`;
  const formatTitle = (s) => String(s || '').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  const buildTooltip = () => {
    if (!item) return null;
    const det = item.details || {};
  const rarity = String(item.rarity || det.rarity || '').toLowerCase();
  const itemLevelNum = Number(det.itemLevel || item.itemLevel || 0) || null;
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
      {(slotLabel || det?.type || itemLevelNum) && (
            <div className="tooltip-section">
              {slotLabel ? <div>{slotLabel}</div> : null}
              {det?.type ? <div>{String(det.type).replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</div> : null}
        {itemLevelNum ? <div>{itemLevelNum}</div> : null}
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
  const buildTalisTooltip = (t) => {
    if (!t) return null;
    const det = t.details || {};
    const rarity = String(t.rarity || det.rarity || '').toLowerCase();
    const stats = Array.isArray(det.stats) ? det.stats : [];
    const icon = det.iconUrl || t.iconUrl || (det.iconId ? `https://armory.returnofreckoning.com/item/${det.iconId}` : EMPTY_ICON);
  const minRank = Number(det.levelRequirement || det.itemLevel || det.minimumRank || 0) || null;
    return (
      <div className={`tooltip-card ${rarity ? 'rarity-' + rarity : ''}`} role="tooltip">
        <div className="tooltip-header">
          <img className="tooltip-icon" src={icon} alt="" />
          <div>
            <div className={`tooltip-name`}>{t.name}</div>
          </div>
        </div>
        <div className="tooltip-body">
          {minRank ? (
            <div className="tooltip-section"><div>Minimum Rank: {minRank}</div></div>
          ) : null}
          {stats.length ? (
            <div className="tooltip-section">
              <div className="section-title">Stats</div>
              <ul className="stat-list">
                {stats.map((s, i) => (
                  <li key={i} className="stat-line">
                    <span className="plus">+</span>
                    <span className="val">{typeof s.value === 'number' ? s.value : ''}{s.percentage || s.unit === '%' ? '%' : ''}</span>
                    <span className="label">{formatTitle(s.stat || s.name || s.type)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
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
  // const summaryText = buildSummary(); // currently unused
  // const titleText = item ? (summaryText ? `${itemLabel} — ${summaryText}` : itemLabel) : itemLabel; // not used, keep for potential future aria-label
  const rarityStr = String(item?.rarity || item?.details?.rarity || '').toLowerCase();
  const isSet = !!(item?.details?.set?.name || item?.details?.itemSet?.name);
  const rarityClass = isSet ? 'name-set' : (rarityStr ? `rarity-${rarityStr}` : '');
  if (variant !== 'grid') {
    return (
  <div className={variant === 'classic' ? 'classic-slot' : 'ror-slot'} style={gridArea ? { gridArea } : undefined}>
    {variant === 'classic' && (<div className="slot-label">{name}</div>)}
        {variant === 'ror' ? (() => {
          const lvl = Number(item?.details?.itemLevel || item?.itemLevel || 0) || 0;
          const rightLines = item
            ? [
                String(itemLabel || '').trim() || name,
                name,
                lvl ? `Item Level ${lvl}` : null,
              ].filter(Boolean)
            : [name];
          return (
            <div className="slot-row">
      <div className="gear-slot" data-slotname={name} aria-label={itemLabel}>
                <img src={iconUrl} alt={item?.name || name} className="gear-icon" />
                <div className={tipClass}>{item ? buildTooltip() : ('Click to choose ' + name)}</div>
              </div>
        <div className="item-label-right">
                {rightLines.map((ln, idx) => (
          <span key={idx} className={idx === 0 ? `line name-line ${rarityClass}` : 'line meta-line'}>{ln}</span>
                ))}
              </div>
              {talisCount > 0 && (
                <div className="talis-row">
                  {Array.from({ length: talisCount }).map((_, i) => {
                    const t = talismans?.[i] || null;
                    const tIcon = t?.iconUrl || (t?.details?.iconId ? `https://armory.returnofreckoning.com/item/${t.details.iconId}` : 'https://armory.returnofreckoning.com/item/1');
                    return (
                      <div key={i} className={`talis-slot${t ? ' filled' : ''}`} data-slotname={`${name}::talis::${i}`} onClick={(e) => { e.stopPropagation(); onTalisPick?.(name, i); }}>
                        {t ? <img className="talis-icon-small" src={tIcon} alt="" /> : null}
                        {t ? <div className={tipClass}>{buildTalisTooltip(t)}</div> : null}
                        {t ? <button className="talis-clear" title="Clear" onClick={(e) => { e.stopPropagation(); onTalisClear?.(name, i); }}>×</button> : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })() : (
      <div className="gear-slot" data-slotname={name} aria-label={itemLabel}>
            <img src={iconUrl} alt={item?.name || name} className="gear-icon" />
            <div className={tipClass}>{item ? buildTooltip() : ('Click to choose ' + name)}</div>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="gear-slot" style={{ gridArea }} data-slotname={name} aria-label={itemLabel}>
      <img src={iconUrl} alt={item?.name || name} className="gear-icon" />
      <div className={tipClass}>{item ? buildTooltip() : ('Click to choose ' + name)}</div>
  <div className={`gear-label ${rarityClass}`}>{itemLabel}</div>
      {talisCount > 0 && (
        <div className="talis-row" onClick={(e) => e.stopPropagation()}>
          {Array.from({ length: talisCount }).map((_, i) => {
            const t = talismans?.[i] || null;
            const tIcon = t?.iconUrl || (t?.details?.iconId ? `https://armory.returnofreckoning.com/item/${t.details.iconId}` : 'https://armory.returnofreckoning.com/item/1');
            return (
              <div key={i} className={`talis-slot${t ? ' filled' : ''}`} onClick={() => onTalisPick?.(name, i)}>
                {t ? <img className="talis-icon-small" src={tIcon} alt="" /> : null}
                {t ? <div className={tipClass}>{buildTalisTooltip(t)}</div> : null}
                {t ? <button className="talis-clear" title="Clear" onClick={(e) => { e.stopPropagation(); onTalisClear?.(name, i); }}>×</button> : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ItemPicker({ open, onClose, items, slotName, onPick, loading, error, filterName, setFilterName, filterStat, setFilterStat, filterRarity, setFilterRarity, filterSetOnly, setFilterSetOnly, isTalis = false }) {
  if (!open) return null;
  const fmt = (s) => String(s || '').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  const statOptions = useMemo(() => {
    const all = [...statOrder, ...defenseOrder, ...offenseOrder, ...magicOrder];
    const seen = new Set();
    const out = [];
    for (const s of all) { const k = String(s); if (!seen.has(k)) { seen.add(k); out.push(k); } }
    return out;
  }, []);
  const renderTooltip = (it) => {
    if (!it) return null;
    const rarity = String(it.rarity || it?.details?.rarity || '').toLowerCase();
    const il = Number(it.itemLevel || it?.details?.itemLevel || 0) || null;
    const armor = typeof it.armor === 'number' ? it.armor : (typeof it?.details?.armor === 'number' ? it.details.armor : null);
    const dps = typeof it.dps === 'number' ? it.dps : (typeof it?.details?.dps === 'number' ? it.details.dps : null);
    const speed = typeof it.speed === 'number' ? it.speed : (typeof it?.details?.speed === 'number' ? it.details.speed : null);
    const stats = Array.isArray(it.stats) ? it.stats : (Array.isArray(it?.details?.stats) ? it.details.stats : []);
    const icon = it.iconUrl || it?.details?.iconUrl || (it?.details?.iconId ? `https://armory.returnofreckoning.com/item/${it.details.iconId}` : EMPTY_ICON);
    return (
      <div className={`gear-tooltip`}>
        <div className={`tooltip-card ${rarity ? 'rarity-' + rarity : ''}`} role="tooltip">
          <div className="tooltip-header">
            <img className="tooltip-icon" src={icon} alt="" />
            <div>
              <div className={`tooltip-name${it?.itemSet?.name || it?.details?.set?.name ? ' name-set' : ''}`}>{it.name}</div>
            </div>
          </div>
          <div className="tooltip-body">
            {(it.slot || il) && (
              <div className="tooltip-section">
                {it.slot ? <div>{fmt(it.slot)}</div> : null}
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
                      <span className="label">{fmt(s.stat || s.name || s.type)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Select Item for {slotName}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
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
              {statOptions.map((s) => (
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
            {!isTalis && (
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={!!filterSetOnly} onChange={(e) => setFilterSetOnly(e.target.checked)} />
                Set items only
              </label>
            )}
            <button onClick={() => { setFilterName(''); setFilterStat(''); setFilterRarity(''); setFilterSetOnly(false); }}>Clear</button>
          </div>
          {loading && <div>Loading…</div>}
          {error && <div style={{ color: 'crimson' }}>Failed to load items. {(error?.message || '').toString()}</div>}
          {!loading && !error && items && items.length === 0 && (
            <div>No items found.</div>
          )}
          {!loading && !error && items && items.length > 0 && (
    <div className="item-list">
  {(items.filter(it => isTalis || !filterSetOnly || !!(it?.itemSet?.name || it?.details?.set?.name || it?.details?.itemSet?.name))).map((it) => {
                const icon = it.iconUrl || it?.details?.iconUrl || (it?.details?.iconId ? `https://armory.returnofreckoning.com/item/${it.details.iconId}` : EMPTY_ICON);
    const isSet = !!(it?.itemSet?.name || it?.details?.set?.name || it?.details?.itemSet?.name);
    const rarityClass = isSet ? 'name-set' : (String(it?.rarity || '').toLowerCase() ? `rarity-${String(it?.rarity || '').toLowerCase()}` : '');
    const il = Number(it?.itemLevel || it?.details?.itemLevel || 0) || null;
    const setName = it?.itemSet?.name || it?.details?.set?.name || it?.details?.itemSet?.name || '';
    const setBonuses = (it?.itemSet?.bonuses || [])
      .map(b => typeof b?.itemsRequired === 'number' ? b.itemsRequired : 0);
    const setPieces = setBonuses.length ? Math.max(...setBonuses) : null;
        return (
                  <button key={it.id} className="item-row" onClick={() => onPick(it)}>
                    <span className="item-left">
                      <img className="item-icon" src={icon} alt="" />
          <span className={`item-name ${rarityClass}`}>{it.name}</span>
          <span className="item-meta">
            {il ? <span className="meta-il">iLvl {il}</span> : null}
            {isSet && setName ? <span className="meta-set">Set: {setName}{setPieces ? ` (${setPieces}pc)` : ''}</span> : null}
          </span>
                    </span>
                    <span className="item-slot">{fmt(it.slot || '')}</span>
            {renderTooltip(it)}
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
  const [pickerIsTalis, setPickerIsTalis] = useState(false);
  const [pickerTalisHost, setPickerTalisHost] = useState({ slotName: '', index: 0 });
  const [allItems] = useState([]); // legacy; no static preload
  const [career, setCareer] = useState(DEFAULT_CAREER);
  const [careerRank, setCareerRank] = useState(40);
  const [renownRank, setRenownRank] = useState(80);
  const [filterName, setFilterName] = useState('');
  const [filterStat, setFilterStat] = useState('');
  const [filterRarity, setFilterRarity] = useState('');
  const [filterSetOnly, setFilterSetOnly] = useState(false);
  // Max caps removed; default filtering uses current Career Rank and Renown Rank
  const [equipped, setEquipped] = useState({}); // { [slotDisplayName]: item }
  const [iconFallbacks] = useState(null); // no remote fallbacks on Pages
  const [setsIndex] = useState(null); // no static sets index on Pages
  const [pickerItems, setPickerItems] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState(null);
  // talismans equipped per gear slot: { [slotName]: [t1,t2,...] }
  const [talismans, setTalismans] = useState({});

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
          const tRaw = localStorage.getItem(`talismans:${career}`);
          if (tRaw) {
            try { const t = JSON.parse(tRaw); if (t && typeof t === 'object') setTalismans(t); } catch {}
          } else {
            setTalismans({});
          }
          return;
        }
      }
  } catch { /* ignore load error */ }
    setEquipped({});
    setTalismans({});
  }, [career]);

  // Persist equipped items whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(`equipped:${career}`, JSON.stringify(equipped || {}));
  } catch { /* ignore save error */ }
  }, [equipped, career]);

  useEffect(() => {
    try { localStorage.setItem(`talismans:${career}`, JSON.stringify(talismans || {})); } catch {}
  }, [talismans, career]);

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
    // Enforce jewelry rules silently (picker already filters; keep as safety)
    if (isJewelrySlotName(itemSlotNorm) && isJewelrySlotName(pickSlotNorm) && itemSlotNorm !== pickSlotNorm) {
      const raw = String(item?.slotRaw || item?.slot || '').toUpperCase();
      if (raw !== 'JEWELLERY1') return; // silently no-op
    }
    // Enforce uniqueEquipped from list data if available
    if (item?.uniqueEquipped) {
      const already = Object.values(equipped || {}).some((it) => it && String(it.id) === String(item.id));
      if (already) return; // silently no-op
    }
    try {
      // Hydrate details so totals and bonuses work consistently
      const detail = await fetchItemDetails(item.id);
      // Post-validate with authoritative details
  const isUnique = detail?.uniqueEquipped ?? item?.uniqueEquipped;
  if (isUnique) {
        const already = Object.values(equipped || {}).some((it) => it && String(it.id) === String(detail?.id || item.id));
        if (already) return; // silently no-op
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
      if (pickerIsTalis) {
        const host = pickerTalisHost.slotName;
        const idx = pickerTalisHost.index;
        // Enforce talisman Minimum Rank equals host item level
        const hostItem = equipped[host];
  const hostIlvl = Number(hostItem?.details?.itemLevel || hostItem?.details?.levelRequirement || hostItem?.itemLevel || hostItem?.levelRequirement || 0) || 0;
        const tMinRank = Number(detail?.levelRequirement || detail?.minimumRank || item?.details?.levelRequirement || item?.levelRequirement || 0) || 0;
        if (hostIlvl && tMinRank && hostIlvl !== tMinRank) { setPickerOpen(false); setPickerIsTalis(false); return; }
        // Enforce no duplicate identical talisman on the same host
        const idStr = String(detail?.id || item.id);
        const existing = Array.isArray(talismans?.[host]) ? talismans[host] : [];
        if (existing.some((t, j) => t && j !== idx && String(t.id) === idStr)) { setPickerOpen(false); setPickerIsTalis(false); return; }
        setTalismans((prev) => {
          const arr = Array.isArray(prev[host]) ? [...prev[host]] : [];
          arr[idx] = mapped;
          return { ...prev, [host]: arr };
        });
      } else if (pickerSlot) {
        setEquipped((prev) => ({ ...prev, [pickerSlot]: mapped }));
      }
    } catch {
      if (pickerIsTalis) {
        const host = pickerTalisHost.slotName;
        const idx = pickerTalisHost.index;
        const hostItem = equipped[host];
  const hostIlvl = Number(hostItem?.details?.itemLevel || hostItem?.details?.levelRequirement || hostItem?.itemLevel || hostItem?.levelRequirement || 0) || 0;
        const tMinRank = Number(item?.details?.levelRequirement || item?.levelRequirement || 0) || 0;
        if (hostIlvl && tMinRank && hostIlvl !== tMinRank) { setPickerOpen(false); setPickerIsTalis(false); return; }
        // Enforce no duplicate identical talisman on the same host
        const idStr = String(item?.id);
        const existing = Array.isArray(talismans?.[host]) ? talismans[host] : [];
        if (existing.some((t, j) => t && j !== idx && String(t.id) === idStr)) { setPickerOpen(false); setPickerIsTalis(false); return; }
        setTalismans((prev) => {
          const arr = Array.isArray(prev[host]) ? [...prev[host]] : [];
          arr[idx] = item;
          return { ...prev, [host]: arr };
        });
      } else if (pickerSlot) {
        setEquipped((prev) => ({ ...prev, [pickerSlot]: item }));
      }
    } finally {
      setPickerOpen(false);
      setPickerIsTalis(false);
    }
  };

  const openTalisPicker = (hostSlotName, i) => {
    setPickerIsTalis(true);
    setPickerTalisHost({ slotName: hostSlotName, index: i });
    setPickerSlot(`Talisman ${i + 1}`);
  // Clear item filters so talismans are shown regardless of prior filters
  setFilterName('');
  setFilterStat('');
  setFilterRarity('');
  setFilterSetOnly(false);
    setPickerOpen(true);
  };
  const clearTalis = (hostSlotName, i) => {
    setTalismans((prev) => {
      const arr = Array.isArray(prev[hostSlotName]) ? [...prev[hostSlotName]] : [];
      arr[i] = null;
      return { ...prev, [hostSlotName]: arr };
    });
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
  const isTalisPicker = pickerIsTalis;
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
        if (isTalisPicker) {
          // Fetch talisman items: most have slot 'TALISMAN' or type includes 'TALISMAN'.
          // We'll try by type first, then by slot if available.
          let byId = new Map();
            try {
              // Talismans are type ENHANCEMENT in the API
              const byType = await fetchItems({ perPage: 50, totalLimit: 500, typeEq: 'ENHANCEMENT' });
            for (const n of (byType || [])) byId.set(String(n.id), n);
          } catch {}
          try {
              // Many show slot NONE; merge those too
              const bySlot = await fetchItems({ perPage: 50, totalLimit: 500, slotEq: 'NONE' });
            for (const n of (bySlot || [])) byId.set(String(n.id), n);
          } catch {}
          // host context for validation
          const hostName = pickerTalisHost?.slotName || '';
          const hostItem = equipped[hostName];
          const hostIlvl = Number(hostItem?.details?.itemLevel || hostItem?.details?.levelRequirement || hostItem?.itemLevel || hostItem?.levelRequirement || 0) || 0;
          const existing = Array.isArray(talismans?.[hostName]) ? talismans[hostName] : [];
          const currentAtIdx = existing?.[pickerTalisHost?.index || 0];
          const excludeIds = new Set(existing.map((t, j) => (t && j !== (pickerTalisHost?.index || 0)) ? String(t.id) : null).filter(Boolean));
          let items = Array.from(byId.values())
            .filter((n) => {
              // Minimum Rank (talisman) must equal host item level
              if (hostIlvl) {
                const tMin = Number(n?.levelRequirement || n?.itemLevel || n?.minimumRank || n?.details?.levelRequirement || n?.details?.itemLevel || 0) || 0;
                if (!tMin || tMin !== hostIlvl) return false;
              }
              // Exclude duplicates already slotted (allow same id at current index)
              const idStr = String(n?.id || '');
              if (!idStr) return false;
              if (excludeIds.has(idStr)) return false;
              return true;
            })
            .sort((a,b) => {
      const ilA = Number(a?.itemLevel || a?.levelRequirement || 0);
      const ilB = Number(b?.itemLevel || b?.levelRequirement || 0);
              if (ilA !== ilB) return ilB - ilA;
              const rarOrder = ['UTILITY','COMMON','UNCOMMON','RARE','VERY_RARE','MYTHIC'];
              const ra = rarOrder.indexOf(String(a?.rarity || '').toUpperCase());
              const rb = rarOrder.indexOf(String(b?.rarity || '').toUpperCase());
              return (rb - ra);
            });
          if (items.length === 0) {
            try {
              const byName = await fetchItems({ perPage: 50, totalLimit: 200, allowAnyName: false, nameContains: 'talisman' });
              items = (byName || [])
                .filter((n) => {
                  if (hostIlvl) {
                    const tMin = Number(n?.levelRequirement || n?.itemLevel || n?.minimumRank || n?.details?.levelRequirement || n?.details?.itemLevel || 0) || 0;
                    if (!tMin || tMin !== hostIlvl) return false;
                  }
                  const idStr = String(n?.id || '');
                  if (!idStr) return false;
                  if (excludeIds.has(idStr)) return false;
                  return true;
                })
        .sort((a,b) => (Number(b?.itemLevel||b?.levelRequirement||0) - Number(a?.itemLevel||a?.levelRequirement||0)));
            } catch {}
          }
          if (!ignore) setPickerItems(items);
          return;
        }
        // Precompute likely server slot enums for this target for fetch and raw matching
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
          return [];
        })();
        // Fetch career-scoped; for jewelry, fetch with and without type filter and merge
  let itemsRawCareer = [];
        if (isJewelryTarget) {
          // Query specific accessory equip slots (JEWELLERY1..4). Merge career-scoped and no-career results.
          // Some universal rings (e.g., Annulus) can be under-returned by usableByCareer for certain careers.
          const slotsToTry = ['JEWELLERY1', 'JEWELLERY2', 'JEWELLERY3', 'JEWELLERY4'];
          const mapCareer = (c) => {
            const v = String(c || '').trim().toUpperCase();
            return v === 'BLACKGUARD' ? 'BLACK_GUARD' : v;
          };
          const withCareerSettled = await Promise.allSettled(
            slotsToTry.map(s => fetchItems({ career: mapCareer(career), perPage: 50, totalLimit: 500, slotEq: s, allowAnyName: !filterName, nameContains: filterName || undefined, rarityEq: filterRarity || undefined }))
          );
          const withoutCareerSettled = await Promise.allSettled(
            slotsToTry.map(s => fetchItems({ perPage: 50, totalLimit: 500, slotEq: s, allowAnyName: !filterName, nameContains: filterName || undefined, rarityEq: filterRarity || undefined }))
          );
          const byId = new Map();
          for (const r of [...withCareerSettled, ...withoutCareerSettled]) {
            if (r.status === 'fulfilled') {
              for (const it of (r.value || [])) byId.set(String(it.id), it);
            }
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
          void slotEnum; // silence unused var; kept for clarity
          // Try likely slot enum variants sequentially; skip invalid enum errors
          const byId = new Map();
          const mapCareer = (c) => {
            const v = String(c || '').trim().toUpperCase();
            return v === 'BLACKGUARD' ? 'BLACK_GUARD' : v;
          };
          for (const sv of slotVariants) {
            try {
              const arr = await fetchItems({ career: mapCareer(career), perPage: 50, totalLimit: 500, slotEq: sv, allowAnyName: !filterName, nameContains: filterName || undefined, rarityEq: filterRarity || undefined });
              for (const n of (arr || [])) byId.set(String(n.id), n);
              // If we found items for one variant, we can continue to merge, or break early; keep merging to be safe
            } catch {
              // invalid enum value or other error; try next variant
              continue;
            }
          }
          // Include 2H for main hand visibility (many planners list 2H in main hand)
          if (target === 'main hand') {
            try {
              const twoHand = await fetchItems({ career: mapCareer(career), perPage: 50, totalLimit: 500, slotEq: 'TWO_HAND', allowAnyName: !filterName, nameContains: filterName || undefined, rarityEq: filterRarity || undefined });
              for (const n of (twoHand || [])) byId.set(String(n.id), n);
            } catch { /* ignore TWO_HAND fetch issues */ }
          }
          // Fallback without career filter if results are unexpectedly sparse
          if (byId.size === 0) {
            for (const sv of slotVariants) {
              try {
                const noCareer = await fetchItems({ perPage: 50, totalLimit: 500, slotEq: sv, allowAnyName: !filterName, nameContains: filterName || undefined, rarityEq: filterRarity || undefined });
                for (const n of (noCareer || [])) byId.set(String(n.id), n);
                if (byId.size) break;
              } catch { /* ignore no-career fetch issues */ }
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
          const results = await Promise.all(slotsToTry.map(s => fetchItems({ perPage: 50, totalLimit: 500, slotEq: s, allowAnyName: !filterName, nameContains: filterName || undefined, rarityEq: filterRarity || undefined })));
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
            const more = await Promise.all(slotsToTry.map(s => fetchItems({ perPage: 50, totalLimit: 500, slotEq: s, allowAnyName: !filterName, nameContains: filterName || undefined, rarityEq: filterRarity || undefined })));
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
          // debug only in dev
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
  }, [pickerOpen, pickerSlot, pickerIsTalis, pickerTalisHost, talismans, career, careerRank, renownRank, equipped, filterName, filterStat, filterRarity]);

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
    const entries = Object.entries(equipped).filter(([, it]) => !!it);
    const addStats = (sourceName, statsArr) => {
      for (const s of statsArr) {
        if (s?.unit === '%') continue; // ignore percent for core totals
        const key = mapKey(s?.stat);
        if (key && typeof s?.value === 'number') out[key] += s.value;
      }
    };
    // Base item stats
    for (const [hostName, it] of entries) {
      const stats = it?.details?.stats || [];
      addStats(it.name, stats);
      const hostTal = talismans?.[hostName] || [];
      const maxTal = Number(it?.details?.talismanSlots || 0) || 0;
      if (Array.isArray(hostTal) && maxTal > 0) {
        for (let i = 0; i < Math.min(hostTal.length, maxTal); i++) {
          const t = hostTal[i];
          if (!t) continue;
          const tstats = t?.details?.stats || t?.stats || [];
          addStats(t.name || 'Talisman', tstats);
        }
      }
    }
  // Set bonuses
    const normalize = (s) => (s || '').trim().toLowerCase();
    const variantOf = (n) => {
      const m = String(n || '').match(/of the\s+([\w\-']+)/i);
      return m ? normalize(m[1]) : '';
    };
    const variantToSetKey = new Map();
  const eqItems = Object.values(equipped).filter(Boolean);
  for (const it of eqItems) {
      const sk = (it?.details?.setKey || '').trim();
      if (sk) {
        const v = variantOf(it?.name);
        if (v && !variantToSetKey.has(v)) variantToSetKey.set(v, sk);
      }
    }
    const setGroups = new Map(); // key -> { count, bonuses }
  for (const it of eqItems) {
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
  }, [equipped, talismans, setsIndex]);

  // defenses block moved below activeSetBonuses to avoid TDZ

  // Compute active set bonuses for display
  const activeSetBonuses = useMemo(() => {
  const eqItems = Object.values(equipped).filter(Boolean);
    if (!eqItems.length) return [];
    const normalize = (s) => (s || '').trim().toLowerCase();
    const variantOf = (n) => {
      const m = String(n || '').match(/of the\s+([\w\-']+)/i);
      return m ? normalize(m[1]) : '';
    };
    const variantToSetKey = new Map();
  for (const it of eqItems) {
      const sk = (it?.details?.setKey || '').trim();
      if (sk) {
        const v = variantOf(it?.name);
        if (v && !variantToSetKey.has(v)) variantToSetKey.set(v, sk);
      }
    }
    // Build groups and pick active bonuses
    const groups = new Map(); // key -> { name, count, bonuses }
  for (const it of eqItems) {
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

  // Compute Defense, Offense, Magic aggregated stats from equipped items and active set bonuses
  const combatSections = useMemo(() => {
    const mkAgg = () => new Map(); // label -> { flat: number, pct: number }
    const defAgg = mkAgg();
    const offAgg = mkAgg();
    const magAgg = mkAgg();
    const defSrc = new Map(); // label -> Map(source -> {flat,pct})
    const offSrc = new Map();
    const magSrc = new Map();
    const add = (agg, label, kind, val) => {
      if (!label || !val) return;
      const cur = agg.get(label) || { flat: 0, pct: 0 };
      if (kind === 'pct') cur.pct += val; else cur.flat += val;
      agg.set(label, cur);
    };
    const addSrc = (srcMap, label, source, kind, val) => {
      if (!label || !source || !val) return;
      let bySrc = srcMap.get(label);
      if (!bySrc) { bySrc = new Map(); srcMap.set(label, bySrc); }
      const cur = bySrc.get(source) || { flat: 0, pct: 0 };
      if (kind === 'pct') cur.pct += val; else cur.flat += val;
      bySrc.set(source, cur);
    };
    const title = (s) => String(s || '').replace(/[_%]+/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).trim();
    const canon = (raw, unitIsPct = false) => {
      const n = String(raw || '').trim().toLowerCase();
      // Defenses
      if (n === 'armor') return { cat: 'def', key: 'Armor', pct: unitIsPct };
      if (n.includes('resist')) {
        if (n.includes('spirit')) return { cat: 'def', key: 'Spiritual Resistance', pct: unitIsPct };
        if (n.includes('elemental')) return { cat: 'def', key: 'Elemental Resistance', pct: unitIsPct };
        if (n.includes('corporeal')) return { cat: 'def', key: 'Corporeal Resistance', pct: unitIsPct };
      }
      if (/(^|\s)block(\s|$)/.test(n)) return { cat: 'def', key: 'Block', pct: unitIsPct };
      if (/(^|\s)parry(\s|$)/.test(n)) return { cat: 'def', key: 'Parry', pct: unitIsPct };
      if (/(^|\s)dodge(\s|$)/.test(n)) return { cat: 'def', key: 'Dodge', pct: unitIsPct };
      if (/(^|\s)disrupt(\s|$)/.test(n)) return { cat: 'def', key: 'Disrupt', pct: unitIsPct };
      // Offense
      if (/armor\s*pen(etration)?/.test(n)) return { cat: 'off', key: 'Armor Penetration', pct: unitIsPct };
      if (/melee\s*power/.test(n)) return { cat: 'off', key: 'Melee Power', pct: unitIsPct };
      if (/ranged\s*power/.test(n)) return { cat: 'off', key: 'Ranged Power', pct: unitIsPct };
      if (/melee.*crit|crit.*melee/.test(n)) return { cat: 'off', key: 'Melee Critical Hit Bonus', pct: true };
      if (/ranged.*crit|crit.*ranged/.test(n)) return { cat: 'off', key: 'Ranged Critical Hit Bonus', pct: true };
      // Magic
      if (/magic\s*power|spell\s*power/.test(n)) return { cat: 'mag', key: 'Magic Power', pct: unitIsPct };
      if (/healing\s*power/.test(n)) return { cat: 'mag', key: 'Healing Power', pct: unitIsPct };
      if (/(magic|spell).*crit|crit.*(magic|spell)/.test(n)) return { cat: 'mag', key: 'Magic Critical Hit Bonus', pct: true };
      if (/healing.*crit|crit.*healing/.test(n)) return { cat: 'mag', key: 'Healing Critical Bonus', pct: true };
      return null;
    };
  const eqEntries = Object.entries(equipped).filter(([, it]) => !!it);
    // Items: base armor and stats
  for (const [hostName, it] of eqEntries) {
      const det = it?.details || {};
      const armorVal = typeof det?.armor === 'number' ? det.armor : undefined;
      if (typeof armorVal === 'number' && !Number.isNaN(armorVal)) {
        add(defAgg, 'Armor', 'flat', armorVal);
        addSrc(defSrc, 'Armor', it.name, 'flat', armorVal);
      }
      const stats = Array.isArray(det?.stats) ? det.stats : [];
      for (const s of stats) {
        const nm = title(s?.stat);
        const v = typeof s?.value === 'number' ? s.value : 0;
        if (!v) continue;
        const m = canon(nm, s?.unit === '%');
        if (!m) continue;
        const catAgg = m.cat === 'def' ? defAgg : m.cat === 'off' ? offAgg : magAgg;
        const catSrc = m.cat === 'def' ? defSrc : m.cat === 'off' ? offSrc : magSrc;
        const kind = m.pct ? 'pct' : (s?.unit === '%' ? 'pct' : 'flat');
        add(catAgg, m.key, kind, v);
        addSrc(catSrc, m.key, it.name, kind, v);
      }
      // Add talismans attached to this gear
      const hostTal = talismans?.[hostName] || [];
      const maxTal = Number(it?.details?.talismanSlots || 0) || 0;
      for (let i = 0; i < Math.min(hostTal.length, maxTal); i++) {
        const t = hostTal[i];
        if (!t) continue;
        const tstats = Array.isArray(t?.details?.stats) ? t.details.stats : (Array.isArray(t?.stats) ? t.stats : []);
        for (const s of tstats) {
          const nm = title(s?.stat);
          const v = typeof s?.value === 'number' ? s.value : 0;
          if (!v) continue;
          const m = canon(nm, s?.unit === '%');
          if (!m) continue;
          const catAgg = m.cat === 'def' ? defAgg : m.cat === 'off' ? offAgg : magAgg;
          const catSrc = m.cat === 'def' ? defSrc : m.cat === 'off' ? offSrc : magSrc;
          const kind = m.pct ? 'pct' : (s?.unit === '%' ? 'pct' : 'flat');
          add(catAgg, m.key, kind, v);
          addSrc(catSrc, m.key, `${t.name}`, kind, v);
        }
  }
    }
    // Active set bonuses: parse bonus lines
    for (const grp of (activeSetBonuses || [])) {
      for (const b of (grp?.bonuses || [])) {
        const line = String(b?.bonus || '');
        let m = line.match(/^\+\s*(\d+(?:\.\d+)?)\s*%\s+(.+)$/i);
        if (m) {
          const val = parseFloat(m[1]);
          const lab = title(m[2]);
          const c = canon(lab, true);
          if (c) {
            const catAgg = c.cat === 'def' ? defAgg : c.cat === 'off' ? offAgg : magAgg;
            const catSrc = c.cat === 'def' ? defSrc : c.cat === 'off' ? offSrc : magSrc;
            const src = `Set: ${grp.name}`;
            add(catAgg, c.key, 'pct', val);
            addSrc(catSrc, c.key, src, 'pct', val);
          }
          continue;
        }
        m = line.match(/^\+\s*(\d+)\s+(.+)$/i);
        if (m) {
          const val = parseInt(m[1], 10);
          const lab = title(m[2]);
          const c = canon(lab, false);
          if (c) {
            const catAgg = c.cat === 'def' ? defAgg : c.cat === 'off' ? offAgg : magAgg;
            const catSrc = c.cat === 'def' ? defSrc : c.cat === 'off' ? offSrc : magSrc;
            const src = `Set: ${grp.name}`;
            add(catAgg, c.key, 'flat', val);
            addSrc(catSrc, c.key, src, 'flat', val);
          }
        }
      }
    }
    const fmt = (flat, pct) => {
      const parts = [];
      if (flat) parts.push(String(flat));
      if (pct) parts.push(`${Number.isInteger(pct) ? pct : pct.toFixed(2)}%`);
      return parts.join(' + ') || '0';
    };
    const toList = (agg, order) => order.map((label) => {
      const v = agg.get(label) || { flat: 0, pct: 0 };
      return { label, value: fmt(v.flat, v.pct) };
    });
    const toContrib = (srcMap, order) => Object.fromEntries(order.map((label) => {
      const bySrc = srcMap.get(label) || new Map();
      const arr = Array.from(bySrc.entries()).map(([source, vals]) => ({ source, flat: vals.flat || 0, pct: vals.pct || 0 }))
        .filter(e => e.flat || e.pct);
      return [label, arr];
    }));
    return {
      defenseList: toList(defAgg, defenseOrder),
      offenseList: toList(offAgg, offenseOrder),
      magicList: toList(magAgg, magicOrder),
      defContrib: toContrib(defSrc, defenseOrder),
      offContrib: toContrib(offSrc, offenseOrder),
      magContrib: toContrib(magSrc, magicOrder),
    };
  }, [equipped, talismans, activeSetBonuses]);

  // Primary stats contributions for tooltip
  const primaryContrib = useMemo(() => {
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
    const out = new Map(); // label -> Map(source -> {flat})
    const add = (label, source, val) => {
      if (!label || !source || !val) return;
      let bySrc = out.get(label);
      if (!bySrc) { bySrc = new Map(); out.set(label, bySrc); }
      const cur = bySrc.get(source) || { flat: 0, pct: 0 };
      cur.flat += val;
      bySrc.set(source, cur);
    };
  const eqEntries2 = Object.entries(equipped).filter(([, it]) => !!it);
  for (const [hostName, it] of eqEntries2) {
      const stats = Array.isArray(it?.details?.stats) ? it.details.stats : [];
      for (const s of stats) {
        if (s?.unit === '%') continue;
        const key = mapKey(s?.stat);
        const v = typeof s?.value === 'number' ? s.value : 0;
        if (key && v) add(key, it.name, v);
      }
      const hostTal = talismans?.[hostName] || [];
      const maxTal = Number(it?.details?.talismanSlots || 0) || 0;
      for (let i = 0; i < Math.min(hostTal.length, maxTal); i++) {
        const t = hostTal[i];
        if (!t) continue;
        const tstats = Array.isArray(t?.details?.stats) ? t.details.stats : (Array.isArray(t?.stats) ? t.stats : []);
        for (const s of tstats) {
          if (s?.unit === '%') continue;
          const key = mapKey(s?.stat);
          const v = typeof s?.value === 'number' ? s.value : 0;
          if (key && v) add(key, t.name, v);
        }
      }
    }
    for (const grp of (activeSetBonuses || [])) {
      for (const b of (grp?.bonuses || [])) {
        const line = String(b?.bonus || '');
        const m = line.match(/^\+\s*(\d+)\s+(.+)$/i);
        if (!m) continue;
        const val = parseInt(m[1], 10);
        const label = mapKey(m[2]);
        if (label && val) add(label, `Set: ${grp.name}`, val);
      }
    }
    return Object.fromEntries(Array.from(out.entries()).map(([label, bySrc]) => [label, Array.from(bySrc.entries()).map(([source, vals]) => ({ source, flat: vals.flat || 0 }))]));
  }, [equipped, talismans, activeSetBonuses]);

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
  <button onClick={() => { setEquipped({}); setTalismans({}); }}>Reset Gear</button>
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
        {slots.map((slot) => {
          const item = equipped[slot.name];
          const talisCount = Number(item?.details?.talismanSlots || 0) || 0;
          const tals = talismans?.[slot.name] || [];
          return (
            <GearSlot key={slot.name} name={slot.name} gridArea={slot.gridArea} item={item} allItems={allItems} iconFallbacks={iconFallbacks || {}} variant={variant}
              talisCount={talisCount} talismans={tals} onTalisPick={openTalisPicker} onTalisClear={clearTalis}
            />
          );
        })}
  <StatsPanel totals={totals} activeSetBonuses={activeSetBonuses} defenseList={combatSections.defenseList} offenseList={combatSections.offenseList} magicList={combatSections.magicList} primaryContrib={primaryContrib} defContrib={combatSections.defContrib} offContrib={combatSections.offContrib} magContrib={combatSections.magContrib} />
      </div>
    <ItemPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        items={pickerItems && pickerItems.length ? pickerItems : filteredItems}
  slotName={pickerIsTalis ? `${pickerSlot} (Talisman)` : pickerSlot}
        onPick={onPick}
        loading={pickerLoading}
        error={pickerError}
        filterName={filterName}
        setFilterName={setFilterName}
        filterStat={filterStat}
  setFilterStat={setFilterStat}
  filterRarity={filterRarity}
  setFilterRarity={setFilterRarity}
  filterSetOnly={filterSetOnly}
  setFilterSetOnly={setFilterSetOnly}
  isTalis={pickerIsTalis}
      />
    </div>
  );

  const renderClassic = () => {
  // const byName = Object.fromEntries(slots.map(s => [s.name, s]));
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
            {leftArmorOrder.map((name) => (
              <GearSlot key={name} name={name} gridArea={undefined} item={equipped[name]} allItems={allItems} iconFallbacks={iconFallbacks || {}} variant={variant} />
            ))}
          </div>
          <div className="classic-doll" />
          <div className="classic-jewels">
            {jewelOrder.map((name) => (
              <GearSlot key={name} name={name} gridArea={undefined} item={equipped[name]} allItems={allItems} iconFallbacks={iconFallbacks || {}} variant={variant} />
            ))}
          </div>
          <div className="classic-right">
            <div className="classic-stats">
              <StatsPanel totals={totals} activeSetBonuses={activeSetBonuses} defenseList={combatSections.defenseList} offenseList={combatSections.offenseList} magicList={combatSections.magicList} primaryContrib={primaryContrib} defContrib={combatSections.defContrib} offContrib={combatSections.offContrib} magContrib={combatSections.magContrib} />
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
          filterSetOnly={filterSetOnly}
          setFilterSetOnly={setFilterSetOnly}
          isTalis={pickerIsTalis}
        />
      </div>
    );
  };

  const renderRor = () => {
    // const byName = Object.fromEntries(slots.map(s => [s.name, s]));
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
            <button onClick={() => { setEquipped({}); setTalismans({}); }}>Reset</button>
            {/* Max CR / RR removed per request */}
          </div>
          <div className="ror-armor ror-panel">
            {leftArmorOrder.map((name) => {
              const it = equipped[name];
              const tc = Number(it?.details?.talismanSlots || 0) || 0;
              return (
                <GearSlot key={name} name={name} item={it} allItems={allItems} iconFallbacks={iconFallbacks || {}} variant={variant} talisCount={tc} talismans={talismans?.[name] || []} onTalisPick={openTalisPicker} onTalisClear={clearTalis} />
              );
            })}
          </div>
          <div className="ror-mid ror-panel">
            {midOrder.map((name) => {
              const it = equipped[name];
              const tc = Number(it?.details?.talismanSlots || 0) || 0;
              return (
                <GearSlot key={name} name={name} item={it} allItems={allItems} iconFallbacks={iconFallbacks || {}} variant={variant} talisCount={tc} talismans={talismans?.[name] || []} onTalisPick={openTalisPicker} onTalisClear={clearTalis} />
              );
            })}
          </div>
          <div className="ror-jewels ror-panel">
            {jewelOrder.map((name) => {
              const it = equipped[name];
              const tc = Number(it?.details?.talismanSlots || 0) || 0;
              return (
                <GearSlot key={name} name={name} item={it} allItems={allItems} iconFallbacks={iconFallbacks || {}} variant={variant} talisCount={tc} talismans={talismans?.[name] || []} onTalisPick={openTalisPicker} onTalisClear={clearTalis} />
              );
            })}
          </div>
          <div className="ror-stats">
            <StatsPanel totals={totals} activeSetBonuses={activeSetBonuses} defenseList={combatSections.defenseList} offenseList={combatSections.offenseList} magicList={combatSections.magicList} primaryContrib={primaryContrib} defContrib={combatSections.defContrib} offContrib={combatSections.offContrib} magContrib={combatSections.magContrib} />
          </div>
        </div>
        </div>
        <ItemPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          items={pickerItems && pickerItems.length ? pickerItems : filteredItems}
          slotName={pickerIsTalis ? `${pickerSlot} (Talisman)` : pickerSlot}
          onPick={onPick}
          loading={pickerLoading}
          error={pickerError}
          filterName={filterName}
          setFilterName={setFilterName}
          filterStat={filterStat}
          setFilterStat={setFilterStat}
          filterRarity={filterRarity}
          setFilterRarity={setFilterRarity}
          filterSetOnly={filterSetOnly}
          setFilterSetOnly={setFilterSetOnly}
          isTalis={pickerIsTalis}
        />
      </div>
    );
  };

  return variant === 'ror' ? renderRor() : variant === 'classic' ? renderClassic() : renderGrid();
}
