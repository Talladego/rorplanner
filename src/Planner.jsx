import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchItems, fetchItemDetails, mapCareerEnum, mapCareerEnumDynamic, warmCareerEnums } from './gqlClient';
import './Planner.css';
import { CAREERS, DEFAULT_CAREER, CAREER_TO_RACE, CAREER_ICON_URLS } from './config';
import pkg from '../package.json';

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

// Rarity buckets used across warmers and sorting
const RARITIES = ['UTILITY','COMMON','UNCOMMON','RARE','VERY_RARE','MYTHIC'];

// Revert to per-slot filtering only; no career/type weapon logic for now.

function StatsPanel({ totals, activeSetBonuses, defenseList = [], offenseList = [], magicList = [], primaryContrib = {}, defContrib = {}, offContrib = {}, magContrib = {}, sourceMeta = {} }) {
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
  const renderContribTip = (entries) => {
    if (!Array.isArray(entries) || !entries.length) return null;
    const rows = entries.map((e, i) => {
      const src = String(e.source || '');
      const isSet = src.startsWith('Set:');
      const meta = sourceMeta[src] || {};
      const icon = isSet ? EMPTY_ICON : (meta.icon || EMPTY_ICON);
      const rarityClass = isSet ? '' : (meta.rarityClass || '');
      const parts = [];
      if (e.flat) parts.push(`+${e.flat}`);
      if (e.pct) parts.push(`+${Number.isInteger(e.pct) ? e.pct : e.pct.toFixed(2)}%`);
      const val = parts.join(' ');
      return (
        <div key={i} className="talis-line">
          <img className="talis-icon" src={icon} alt="" />
          <span className={`tooltip-name ${rarityClass}`}>{src}</span>
          {val ? <span style={{ marginLeft: 6, opacity: 0.9 }}>{val}</span> : null}
        </div>
      );
    });
    return (
      <div className="gear-tooltip">
        <div className="tooltip-card" role="tooltip">
          <div className="tooltip-body" style={{ paddingTop: 6, paddingBottom: 6 }}>{rows}</div>
        </div>
      </div>
    );
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
              {renderContribTip(primaryContrib[name] || [])}
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
            {renderContribTip(defContrib[s.label] || [])}
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
            {renderContribTip(offContrib[s.label] || [])}
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
            {renderContribTip(magContrib[s.label] || [])}
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

function GearSlot({ name, gridArea, item, allItems, iconFallbacks, variant = 'grid', talisCount = 0, talismans = [], onTalisPick, onTalisClear, onItemClear }) {
  const tipClass = `gear-tooltip`;
  const formatTitle = (s) => String(s || '').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  const buildEmptyGearTooltip = () => (
    <div className={`tooltip-card`} role="tooltip">
      <div className="tooltip-header">
        <img className="tooltip-icon" src={'https://armory.returnofreckoning.com/item/1'} alt="" />
        <div>
          <div className="tooltip-name">Empty Slot</div>
        </div>
      </div>
      <div className="tooltip-body">
        <div className="tooltip-section"><div>Click to choose {name}</div></div>
      </div>
    </div>
  );
  const buildEmptyTalisTooltip = () => (
    <div className={`tooltip-card`} role="tooltip">
      <div className="tooltip-header">
        <img className="tooltip-icon" src={'https://armory.returnofreckoning.com/item/1'} alt="" />
        <div>
          <div className="tooltip-name">Empty Talisman Slot</div>
        </div>
      </div>
      <div className="tooltip-body">
        <div className="tooltip-section"><div>Click to choose talisman</div></div>
      </div>
    </div>
  );
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
          {/* Talisman slots: show attached if present */}
          {typeof talis === 'number' && talis > 0 && (
            <div className="tooltip-section">
              <div className="section-title">Talisman Slots</div>
              <div className="talis-list">
                {Array.from({ length: talis }).map((_, i) => {
                  const t = Array.isArray(talismans) ? talismans[i] : null;
                  if (t) {
                    const tdet = t.details || {};
                    const ticon = tdet.iconUrl || t.iconUrl || (tdet.iconId ? `https://armory.returnofreckoning.com/item/${tdet.iconId}` : 'https://armory.returnofreckoning.com/item/1');
                    const tstats = Array.isArray(tdet.stats) ? tdet.stats : (Array.isArray(t.stats) ? t.stats : []);
                    return (
                      <div key={i} className="talis-line">
                        <img className="talis-icon" src={ticon} alt="" /> {t.name}
                        {tstats && tstats.length ? (
                          <ul className="stat-list" style={{ marginTop: 4 }}>
                            {tstats.map((s, j) => (
                              <li key={j} className="stat-line">
                                <span className="plus">+</span>
                                <span className="val">{typeof s.value === 'number' ? s.value : ''}{s.percentage || s.unit === '%' ? '%' : ''}</span>
                                <span className="label">{formatTitle(s.stat || s.name || s.type)}</span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    );
                  }
                  return (<div key={i} className="talis-line"><img className="talis-icon" src={'https://armory.returnofreckoning.com/item/1'} alt="" /> Empty Talisman Slot</div>);
                })}
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
    const tType = det.type || t.type;
    const desc = det.description || t.description;
    return (
      <div className={`tooltip-card ${rarity ? 'rarity-' + rarity : ''}`} role="tooltip">
        <div className="tooltip-header">
          <img className="tooltip-icon" src={icon} alt="" />
          <div>
            <div className={`tooltip-name`}>{t.name}</div>
          </div>
        </div>
        <div className="tooltip-body">
          {tType ? (
            <div className="tooltip-section"><div>{formatTitle(String(tType))}</div></div>
          ) : null}
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
          {desc ? (
            <div className="tooltip-section">
              <div className="section-title">Description</div>
              <div style={{ opacity: 0.95 }}>{desc}</div>
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
              <div
                className="gear-slot"
                data-slotname={name}
                aria-label={itemLabel}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (item) onItemClear?.(name);
                }}
              >
                <img src={iconUrl} alt={item?.name || name} className="gear-icon" />
                <div className={tipClass}>{item ? buildTooltip() : buildEmptyGearTooltip()}</div>
                {/* Clear button removed; right-click clears the item */}
              </div>
              {/* Fixed-width talisman column to align labels even when empty */}
              <div className="talis-col">
                {Array.from({ length: talisCount || 0 }).map((_, i) => {
                  const t = talismans?.[i] || null;
                  const tIcon = t?.details?.iconUrl || t?.iconUrl || (t?.details?.iconId ? `https://armory.returnofreckoning.com/item/${t.details.iconId}` : 'https://armory.returnofreckoning.com/item/1');
                  return (
                    <div
                      key={i}
                      className={`talis-slot${t ? ' filled' : ''}`}
                      data-slotname={`${name}::talis::${i}`}
                      onClick={(e) => { e.stopPropagation(); onTalisPick?.(name, i); }}
                      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); if (t) onTalisClear?.(name, i); }}
                    >
                      <img className="talis-icon-small" src={t ? tIcon : 'https://armory.returnofreckoning.com/item/1'} alt="" />
                      <div className={tipClass}>{t ? buildTalisTooltip(t) : buildEmptyTalisTooltip()}</div>
                      {/* Clear button removed; right-click clears the talisman */}
                    </div>
                  );
                })}
              </div>
              <div className="item-label-right">
                {rightLines.map((ln, idx) => (
                  <span key={idx} className={idx === 0 ? `line name-line ${rarityClass}` : 'line meta-line'}>{ln}</span>
                ))}
              </div>
            </div>
          );
        })() : (
      <div
        className="gear-slot"
        data-slotname={name}
        aria-label={itemLabel}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); if (item) onItemClear?.(name); }}
      >
            <img src={iconUrl} alt={item?.name || name} className="gear-icon" />
        <div className={tipClass}>{item ? buildTooltip() : buildEmptyGearTooltip()}</div>
  {/* Clear button removed; right-click clears the item */}
          </div>
        )}
      </div>
    );
  }
  return (
    <div
      className="gear-slot"
      style={{ gridArea }}
      data-slotname={name}
      aria-label={itemLabel}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); if (item) onItemClear?.(name); }}
    >
      <img src={iconUrl} alt={item?.name || name} className="gear-icon" />
      <div className={tipClass}>{item ? buildTooltip() : ('Click to choose ' + name)}</div>
  <div className={`gear-label ${rarityClass}`}>{itemLabel}</div>
  {/* Clear button removed; right-click clears the item */}
      {talisCount > 0 && (
        <div className="talis-row" onClick={(e) => e.stopPropagation()}>
          {Array.from({ length: talisCount }).map((_, i) => {
            const t = talismans?.[i] || null;
            const tIcon = t?.details?.iconUrl || t?.iconUrl || (t?.details?.iconId ? `https://armory.returnofreckoning.com/item/${t.details.iconId}` : 'https://armory.returnofreckoning.com/item/1');
            return (
              <div
                key={i}
                className={`talis-slot${t ? ' filled' : ''}`}
                onClick={() => onTalisPick?.(name, i)}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); if (t) onTalisClear?.(name, i); }}
              >
                <img className="talis-icon-small" src={t ? tIcon : 'https://armory.returnofreckoning.com/item/1'} alt="" />
                <div className={tipClass}>{t ? buildTalisTooltip(t) : buildEmptyTalisTooltip()}</div>
                {/* Clear button removed; right-click clears the talisman */}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ItemPicker({ open, onClose, items, slotName, onPick, loading, error, filterName, setFilterName, filterStat, setFilterStat, filterRarity, setFilterRarity, filterSetOnly, setFilterSetOnly, filterCareerLockedOnly, setFilterCareerLockedOnly, isTalis = false, activeCareer, debugInfo = null }) {
  if (!open) return null;
  const fmt = (s) => String(s || '').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  const [copied, setCopied] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const isLoading = !!loading;
  const statOptions = useMemo(() => {
    const all = [...statOrder, ...defenseOrder, ...offenseOrder, ...magicOrder];
    const seen = new Set();
    const out = [];
    for (const s of all) { const k = String(s); if (!seen.has(k)) { seen.add(k); out.push(k); } }
    return out;
  }, []);
  // Helper checks for filters
  const hasStats = (it) => {
    const armor = typeof it?.armor === 'number' ? it.armor : (typeof it?.details?.armor === 'number' ? it.details.armor : null);
    const dps = typeof it?.dps === 'number' ? it.dps : (typeof it?.details?.dps === 'number' ? it.details.dps : null);
    const stats = Array.isArray(it?.stats) ? it.stats : (Array.isArray(it?.details?.stats) ? it.details.stats : []);
    return (typeof armor === 'number' && armor > 0) || (typeof dps === 'number' && dps > 0) || (Array.isArray(stats) && stats.length > 0);
  };
  const isCareerLockedForActive = (it) => {
    const arr = Array.isArray(it?.careerRestriction) ? it.careerRestriction : [];
    if (!arr.length) return false;
    try { return arr.includes(mapCareerEnum(activeCareer)); } catch { return false; }
  };
  const isVanity = (it) => {
    const typeUp = String(it?.type || it?.details?.type || '').toUpperCase();
    const slotRaw = String(it?.slotRaw || it?.slot || '').toUpperCase();
    // Pocket items are legitimate gear (often set-bound); do NOT treat as vanity even if type is NONE
    if (slotRaw.startsWith('POCKET')) return false;
    // Trophies are generally cosmetic; allow hiding them with the vanity toggle
    if (slotRaw.startsWith('TROPHY')) return true;
    // Treat explicit NONE type/slot as vanity-like
    return typeUp === 'NONE' || slotRaw === 'NONE';
  };
  // Items visible after picker-side filters (e.g., Set items only and toggles)
  const visibleItems = useMemo(() => {
    if (!Array.isArray(items)) return [];
    return items
      .filter(it => {
        if (isTalis || !filterSetOnly) return true;
        const top = it?.itemSet?.name;
        const detSet = it?.details?.set?.name || it?.details?.itemSet?.name;
        return !!(top || detSet);
      })
      .filter(it => isTalis || !filterCareerLockedOnly || isCareerLockedForActive(it))
  // Always enforce stats-present for both items and talismans
  .filter(it => hasStats(it))
    // Always hide vanity/admin-like items for non-talisman lists
    .filter(it => isTalis ? true : !isVanity(it));
  }, [items, isTalis, filterSetOnly, filterCareerLockedOnly, activeCareer]);
  const exportQuery = useMemo(() => {
    const q = { ...(debugInfo || {}) };
    // Ensure filters reflect current UI state (server snapshot may be stale)
    q.filters = {
      name: filterName || '',
      stat: filterStat || '',
      rarity: filterRarity || '',
      setOnly: !!filterSetOnly,
      careerLockedOnly: !!filterCareerLockedOnly,
    // Always-on client-side filters for items (not applied to talismans)
    statsOnly: !isTalis,
    hideVanity: !isTalis,
    };
    // Keep slot/career flags current
    q.slotName = slotName;
    q.isTalis = !!isTalis;
    q.careerUi = activeCareer || q.careerUi;
    // Add a client-side final count for clarity
    const final = q.final || {};
    q.final = { ...final, clientFinalCount: Array.isArray(visibleItems) ? visibleItems.length : 0 };
    return q;
  }, [debugInfo, filterName, filterStat, filterRarity, filterSetOnly, filterCareerLockedOnly, slotName, isTalis, activeCareer, visibleItems]);
  const exportPayload = useMemo(() => ({ query: exportQuery, results: visibleItems }), [exportQuery, visibleItems]);
  const exportText = useMemo(() => {
    try { return JSON.stringify(exportPayload, null, 2); } catch { return '// Failed to stringify export payload'; }
  }, [exportPayload]);
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
              <option className="rarity-utility" value="UTILITY">Utility</option>
              <option className="rarity-common" value="COMMON">Common</option>
              <option className="rarity-uncommon" value="UNCOMMON">Uncommon</option>
              <option className="rarity-rare" value="RARE">Rare</option>
              <option className="rarity-very_rare" value="VERY_RARE">Very Rare</option>
              <option className="rarity-mythic" value="MYTHIC">Mythic</option>
            </select>
            {!isTalis && (
              <>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" checked={!!filterSetOnly} onChange={(e) => setFilterSetOnly(e.target.checked)} />
                  Set items only
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} title="Only show items that explicitly list this career">
                  <input type="checkbox" checked={!!filterCareerLockedOnly} onChange={(e) => setFilterCareerLockedOnly(e.target.checked)} />
                  Career-locked only
                </label>
              </>
            )}
            <button onClick={() => { setFilterName(''); setFilterStat(''); setFilterRarity(''); setFilterSetOnly(false); setFilterCareerLockedOnly(false); }}>Clear</button>
            <button onClick={() => setShowJson(v => !v)}>{showJson ? 'Hide JSON' : 'Show JSON'}</button>
            {copied ? <span style={{ color: 'var(--accent-color, #2aa198)' }}>Copied</span> : null}
          </div>
          {showJson && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontWeight: 600 }}>Export JSON</div>
                  {isLoading ? <div style={{ fontSize: 12, opacity: 0.8 }}>Loading… results will update automatically</div> : null}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={(e) => {
                    const ta = e.currentTarget.closest('.modal-body')?.querySelector('textarea.export-json');
                    if (ta) { ta.focus(); ta.select(); }
                  }}>Select All</button>
                  <button
                    disabled={isLoading}
                    title={isLoading ? 'Please wait for items to finish loading' : 'Copy JSON'}
                    style={isLoading ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
                    onClick={async () => { if (isLoading) return; try { await navigator.clipboard.writeText(exportText); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch {} }}
                  >Copy</button>
                </div>
              </div>
              <textarea className="export-json" readOnly value={exportText}
                rows={Math.min(30, Math.max(10, exportText.split('\n').length + 2))}
                style={{ width: '100%', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', fontSize: 12, lineHeight: 1.4 }}
                onFocus={(e) => e.target.select()}
              />
            </div>
          )}
          {loading && <div>Loading…</div>}
          {error && <div style={{ color: 'crimson' }}>Failed to load items. {(error?.message || '').toString()}</div>}
          {!loading && !error && items && items.length === 0 && (
            <div>No items found.</div>
          )}
          {!loading && !error && items && items.length > 0 && visibleItems.length === 0 && (
            <div>No items match your filters.</div>
          )}
    {!loading && !error && items && items.length > 0 && visibleItems.length > 0 && (
  <div className="item-list">
  {visibleItems.map((it) => {
                const icon = it.iconUrl || it?.details?.iconUrl || (it?.details?.iconId ? `https://armory.returnofreckoning.com/item/${it.details.iconId}` : EMPTY_ICON);
    const isSet = !!(it?.itemSet?.name || it?.details?.set?.name || it?.details?.itemSet?.name);
    const rarityClass = isSet ? 'name-set' : (String(it?.rarity || '').toLowerCase() ? `rarity-${String(it?.rarity || '').toLowerCase()}` : '');
    const il = Number(it?.itemLevel || it?.details?.itemLevel || 0) || null;
    // For talismans, compute a primary stat bonus display like "+24 Willpower"
    let talisStatText = '';
    if (isTalis) {
      const stats = Array.isArray(it?.stats) ? it.stats : (Array.isArray(it?.details?.stats) ? it.details.stats : []);
      const first = (stats || []).find(s => typeof s?.value === 'number' && s.value !== 0);
      if (first) {
        const unit = (first?.percentage || first?.unit === '%') ? '%' : '';
        const statName = fmt(first?.stat || first?.name || first?.type || '');
        talisStatText = `+${first.value}${unit ? unit : ''} ${statName}`.trim();
      }
    }
        return (
                  <button key={it.id} className="item-row" onClick={() => onPick(it)}>
                    <span className="item-left">
                      <img className="item-icon" src={icon} alt="" />
          <span className={`item-name ${rarityClass}`}>{it.name}</span>
          <span className="item-meta">
  {it?.id ? <span className="meta-id">ID {String(it.id)}</span> : null}
    {il ? <span className="meta-il">Item level {il}</span> : null}
    {isTalis && talisStatText ? <span className="meta-stat">{talisStatText}</span> : null}
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
  // App version/build for status row in RoR view
  const appVersion = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_APP_VERSION) ? import.meta.env.VITE_APP_VERSION : (pkg?.version || '0.0.0');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSlot, setPickerSlot] = useState(null);
  const [pickerIsTalis, setPickerIsTalis] = useState(false);
  const [pickerTalisHost, setPickerTalisHost] = useState({ slotName: '', index: 0 });
  const [allItems] = useState([]); // legacy; no static preload
  const [career, setCareer] = useState('');
  const [careerRank, setCareerRank] = useState(40);
  const [renownRank, setRenownRank] = useState(80);
  const [filterName, setFilterName] = useState('');
  const [filterStat, setFilterStat] = useState('');
  const [filterRarity, setFilterRarity] = useState('');
  const [filterSetOnly, setFilterSetOnly] = useState(false);
  const [filterCareerLockedOnly, setFilterCareerLockedOnly] = useState(false);
  // Stats-only and Hide vanity are now always-on for items (not talismans), so no state
  // Apply sensible defaults for item picker filters only once per session
  const [itemFilterDefaultsApplied, setItemFilterDefaultsApplied] = useState(false);
  // Remember last-used filters separately for item and talisman pickers
  const [lastItemFilters, setLastItemFilters] = useState({ name: '', stat: '', rarity: '', setOnly: false, careerLockedOnly: false });
  const [lastTalisFilters, setLastTalisFilters] = useState({ name: '', stat: '', rarity: '' });
  // Max caps removed; default filtering uses current Career Rank and Renown Rank
  const [equipped, setEquipped] = useState({}); // { [slotDisplayName]: item }
  const [iconFallbacks] = useState(null); // no remote fallbacks on Pages
  const [setsIndex] = useState(null); // no static sets index on Pages
  const [pickerItems, setPickerItems] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState(null);
  const [pickerDebug, setPickerDebug] = useState(null);
  // talismans equipped per gear slot: { [slotName]: [t1,t2,...] }
  const [talismans, setTalismans] = useState({});
  // Memory usage sampling (client-only)
  const [memText, setMemText] = useState('N/A');
  const [memTitle, setMemTitle] = useState('');
  // Active race resolved from selected career (used to enforce race-restricted items)
  const activeRace = useMemo(() => {
    const key = String(career || '').toUpperCase();
    return key ? (CAREER_TO_RACE[key] || null) : null;
  }, [career]);
  // Caches to avoid refetching when slot + filters + context unchanged
  const itemPickerCacheRef = useRef(new Map()); // key -> { items, debug, ts }
  const talisPickerCacheRef = useRef(new Map()); // key -> { items, debug, ts }
  // Cached totals for status indicator (unique IDs)
  const [cachedItemCount, setCachedItemCount] = useState(0);
  const [cachedTalisCount, setCachedTalisCount] = useState(0);
  const recalcCacheCount = () => {
    try {
      const itemIds = new Set();
      const talisIds = new Set();
      try {
        for (const v of itemPickerCacheRef.current.values()) {
          const arr = Array.isArray(v?.base) ? v.base : (Array.isArray(v?.items) ? v.items : null);
          if (Array.isArray(arr)) {
            for (const n of arr) {
              const id = String(n?.id || '');
              if (id) itemIds.add(id);
            }
          }
        }
      } catch {}
      try {
        for (const v of talisPickerCacheRef.current.values()) {
          const arr = Array.isArray(v?.base) ? v.base : null;
          if (Array.isArray(arr)) {
            for (const n of arr) {
              const id = String(n?.id || '');
              if (id) talisIds.add(id);
            }
          }
        }
      } catch {}
      setCachedItemCount(itemIds.size);
      setCachedTalisCount(talisIds.size);
    } catch {}
  };
  const dedupeById = (arr) => {
    const map = new Map();
    for (const n of Array.isArray(arr) ? arr : []) {
      const id = String(n?.id || '');
      if (id && !map.has(id)) map.set(id, n);
    }
    return Array.from(map.values());
  };
  const sortByLevelRarity = (a, b) => {
    const ilA = Number(a?.itemLevel || a?.levelRequirement || a?.details?.itemLevel || a?.details?.levelRequirement || 0);
    const ilB = Number(b?.itemLevel || b?.levelRequirement || b?.details?.itemLevel || b?.details?.levelRequirement || 0);
    if (ilA !== ilB) return ilB - ilA;
    const rarOrder = ['UTILITY','COMMON','UNCOMMON','RARE','VERY_RARE','MYTHIC'];
    const ra = rarOrder.indexOf(String(a?.rarity || a?.details?.rarity || '').toUpperCase());
    const rb = rarOrder.indexOf(String(b?.rarity || b?.details?.rarity || '').toUpperCase());
    return rb - ra;
  };
  const setItemCache = (key, value) => {
    try {
      const base = Array.isArray(value?.base) ? dedupeById(value.base).sort(sortByLevelRarity) : value?.base;
      const val = base ? { ...value, base } : value;
      itemPickerCacheRef.current.set(key, val);
    } catch {}
    recalcCacheCount();
  };
  const setTalisCache = (key, value) => {
    try {
      const base = Array.isArray(value?.base) ? dedupeById(value.base).sort(sortByLevelRarity) : value?.base;
      const val = base ? { ...value, base } : value;
      talisPickerCacheRef.current.set(key, val);
    } catch {}
    recalcCacheCount();
  };
  // Precache activity indicator
  const [isPrecaching, setIsPrecaching] = useState(false);
  const precacheOpsRef = useRef(0);
  const incPrecache = () => { precacheOpsRef.current += 1; setIsPrecaching(true); };
  const decPrecache = () => {
    const v = Math.max(0, (precacheOpsRef.current || 0) - 1);
    precacheOpsRef.current = v;
    if (v === 0) setIsPrecaching(false);
  };

  // No static item preload on Pages; rely on live GraphQL only
  // Build source metadata for stats tooltip contributions
  const sourceMeta = useMemo(() => {
    const meta = {};
    const add = (name, icon, rarity) => {
      if (!name) return;
      const rar = String(rarity || '').toLowerCase();
      meta[name] = { icon: icon || EMPTY_ICON, rarityClass: rar ? `rarity-${rar}` : '' };
    };
    for (const [hostName, it] of Object.entries(equipped || {})) {
      if (!it) continue;
      const i = it?.details?.iconUrl || it?.iconUrl || (it?.details?.iconId ? `https://armory.returnofreckoning.com/item/${it.details.iconId}` : EMPTY_ICON);
      add(it.name, i, it?.details?.rarity || it?.rarity);
      const hostTal = talismans?.[hostName] || [];
      const maxTal = Number(it?.details?.talismanSlots || 0) || 0;
      for (let idx = 0; idx < Math.min(hostTal.length, maxTal); idx++) {
        const t = hostTal[idx];
        if (!t) continue;
        const ti = t?.details?.iconUrl || t?.iconUrl || (t?.details?.iconId ? `https://armory.returnofreckoning.com/item/${t.details.iconId}` : EMPTY_ICON);
        add(t.name, ti, t?.details?.rarity || t?.rarity);
      }
    }
    return meta;
  }, [equipped, talismans]);

  // No external icon fallbacks; default placeholder icon will be used

  // No static sets index; use bonuses from equipped item details

  // Load saved equipped items when career changes
  useEffect(() => {
    if (!career) { setEquipped({}); setTalismans({}); return; }
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
    if (!career) return;
    try {
      localStorage.setItem(`equipped:${career}`, JSON.stringify(equipped || {}));
    } catch { /* ignore save error */ }
  }, [equipped, career]);

  useEffect(() => {
    if (!career) return;
    try { localStorage.setItem(`talismans:${career}`, JSON.stringify(talismans || {})); } catch {}
  }, [talismans, career]);

  // Periodically sample approximate JS heap usage; best-effort (not supported in all browsers)
  useEffect(() => {
    let timer = null;
    const fmtMB = (bytes) => {
      const mb = bytes / (1024 * 1024);
      if (!isFinite(mb)) return 'N/A';
      return mb >= 100 ? Math.round(mb) + ' MB' : mb.toFixed(1) + ' MB';
    };
    const sample = async () => {
      try {
        // Chrome-specific detailed API (async); may throw if not cross-origin isolated
        const anyPerf = performance;
        if (anyPerf && typeof anyPerf.measureUserAgentSpecificMemory === 'function') {
          try {
            const r = await anyPerf.measureUserAgentSpecificMemory();
            const used = Number(r?.bytes || 0);
            setMemText(fmtMB(used));
            setMemTitle('UserAgent memory');
            return;
          } catch { /* fall through to basic heap sampling */ }
        }
        // Basic Chrome API
        const pm = (performance && performance.memory) ? performance.memory : null;
        if (pm && typeof pm.usedJSHeapSize === 'number') {
          const used = Number(pm.usedJSHeapSize || 0);
          const limit = Number(pm.jsHeapSizeLimit || 0);
          const total = Number(pm.totalJSHeapSize || 0);
          setMemText(fmtMB(used));
          const pct = (limit && used) ? Math.round((used / limit) * 100) : null;
          setMemTitle(`Heap used: ${fmtMB(used)} / limit: ${fmtMB(limit)}${total ? `, total: ${fmtMB(total)}` : ''}${pct != null ? ` (${pct}%)` : ''}`);
          return;
        }
        // Unsupported
        setMemText('N/A');
        setMemTitle('Memory usage not available');
      } catch {
        setMemText('N/A');
        setMemTitle('');
      }
    };
    // Initial sample and interval
    sample();
    timer = setInterval(sample, 8000);
    return () => { if (timer) clearInterval(timer); };
  }, []);

  // Concurrency tuning for precache (configurable via env; falls back to hardwareConcurrency)
  const hwc = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) ? navigator.hardwareConcurrency : 8;
  const PRECACHE_ITEMS_CONC = (() => {
    const v = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_PRECACHE_ITEMS_CONC) ? Number(import.meta.env.VITE_PRECACHE_ITEMS_CONC) : NaN;
    if (!Number.isNaN(v) && v > 0) return Math.floor(v);
    return Math.min(16, Math.max(6, hwc));
  })();
  const PRECACHE_ITEMS_SET_CONC = (() => {
    const v = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_PRECACHE_ITEMS_SET_CONC) ? Number(import.meta.env.VITE_PRECACHE_ITEMS_SET_CONC) : NaN;
    if (!Number.isNaN(v) && v > 0) return Math.floor(v);
    return Math.max(4, Math.min(PRECACHE_ITEMS_CONC, Math.ceil(PRECACHE_ITEMS_CONC * 0.6)));
  })();
  const PRECACHE_TALIS_CONC = (() => {
    const v = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_PRECACHE_TALIS_CONC) ? Number(import.meta.env.VITE_PRECACHE_TALIS_CONC) : NaN;
    if (!Number.isNaN(v) && v > 0) return Math.floor(v);
    return Math.max(3, Math.floor(PRECACHE_ITEMS_CONC / 2));
  })();

  // Narrow precache bands around current CR/RR (env overrideable)
  const PRECACHE_CR_BAND = (() => {
    const v = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_PRECACHE_CR_BAND) ? Number(import.meta.env.VITE_PRECACHE_CR_BAND) : NaN;
    if (!Number.isNaN(v) && v >= 0) return Math.floor(v);
    return 6; // default: within 6 CR below current CR
  })();
  const PRECACHE_RR_BELOW = (() => {
    const v = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_PRECACHE_RR_BELOW) ? Number(import.meta.env.VITE_PRECACHE_RR_BELOW) : NaN;
    if (!Number.isNaN(v) && v >= 0) return Math.floor(v);
    return 10; // default: within 10 RR below current RR
  })();
  const PRECACHE_TALIS_CR_BELOW = (() => {
    const v = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_PRECACHE_TALIS_CR_BELOW) ? Number(import.meta.env.VITE_PRECACHE_TALIS_CR_BELOW) : NaN;
    if (!Number.isNaN(v) && v >= 0) return Math.floor(v);
    return 12; // default: talismans within 12 CR below current CR
  })();

  // Precaching: warm global item bases per rarity (career-scoped) and talisman bases per rarity
  useEffect(() => {
  let cancelled = false;
  // Avoid precaching while a picker is open to reduce contention
  if (!career || pickerOpen) return;
  // Small delay to prioritize user's first paint
  let startTimer = null;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const run = async () => {
      try {
  // Mark precache activity starting
  incPrecache();
    // Warm GraphQL career enums to avoid early round-trips during mapping
    try { warmCareerEnums(); } catch {}
        const defaultOrder = [ { itemLevel: 'DESC' }, { rarity: 'DESC' } ];
        const careerEnum = await mapCareerEnumDynamic(career);
        // Helpers to filter out vanity and non-stat items
        const hasStats = (it) => {
          const armor = typeof it?.armor === 'number' ? it.armor : (typeof it?.details?.armor === 'number' ? it.details.armor : null);
          const dps = typeof it?.dps === 'number' ? it.dps : (typeof it?.details?.dps === 'number' ? it.details.dps : null);
          const stats = Array.isArray(it?.stats) ? it.stats : (Array.isArray(it?.details?.stats) ? it.details.stats : []);
          return (typeof armor === 'number' && armor > 0) || (typeof dps === 'number' && dps > 0) || (Array.isArray(stats) && stats.length > 0);
        };
        const isVanity = (it) => {
          const typeUp = String(it?.type || it?.details?.type || '').toUpperCase();
          const slotRaw = String(it?.slotRaw || it?.slot || '').toUpperCase();
          if (slotRaw.startsWith('TROPHY')) return true;
          return typeUp === 'NONE' || slotRaw === 'NONE';
        };
        // Global per-rarity warm-up (career-scoped, CR/RR banded)
    const warmItemsByRarity = async (rarityVal) => {
          const key = JSON.stringify({ picker: 'item-global', rarity: String(rarityVal || ''), career, careerRank, renownRank, defaultMode: true });
          if (itemPickerCacheRef.current.has(key)) return;
          const byId = new Map();
          try {
            const arr = await fetchItems({ career: careerEnum, perPage: 50, totalLimit: 2000, allowAnyName: true, rarityEq: rarityVal, maxLevelRequirement: careerRank, maxRenownRankRequirement: renownRank, order: defaultOrder });
            for (const it of (arr || [])) byId.set(String(it.id), it);
          } catch {}
          // Build base: stats-only, non-vanity, within CR/RR band
          const base = Array.from(byId.values())
            .filter((n) => hasStats(n) && !isVanity(n))
            .filter((n) => {
      const reqLvlNum = Number(n?.levelRequirement || n?.details?.levelRequirement || 0);
      const reqRRNum = Number(n?.renownRankRequirement || n?.details?.renownRankRequirement || 0);
      // Limit scope: items should be no lower than 10 less than selected CR/RR
      const withinLvl = !reqLvlNum ? true : ((careerRank - reqLvlNum) >= 0 && (careerRank - reqLvlNum) <= 10);
      const withinRR = !reqRRNum ? true : ((renownRank - reqRRNum) >= 0 && (renownRank - reqRRNum) <= 10);
              return withinLvl && withinRR;
            })
            .sort((a,b) => {
              const ilA = Number(a?.itemLevel || a?.details?.itemLevel || 0);
              const ilB = Number(b?.itemLevel || b?.details?.itemLevel || 0);
              if (ilA !== ilB) return ilB - ilA;
              const rarOrder = ['UTILITY','COMMON','UNCOMMON','RARE','VERY_RARE','MYTHIC'];
              const ra = rarOrder.indexOf(String(a?.rarity || a?.details?.rarity || '').toUpperCase());
              const rb = rarOrder.indexOf(String(b?.rarity || b?.details?.rarity || '').toUpperCase());
              return rb - ra;
            });
          if (!cancelled) setItemCache(key, { base, ts: Date.now() });
        };
    // Process warm-ups with tuned concurrency (one worker per rarity bucket)
  const runQueue = async (tasks, limit = PRECACHE_ITEMS_CONC) => {
          let i = 0;
          const workers = new Array(Math.max(1, limit)).fill(0).map(async () => {
            while (!cancelled && i < tasks.length) {
              const idx = i++;
              try { await tasks[idx](); } catch {}
      await sleep(0);
            }
          });
          await Promise.all(workers);
        };
        // Warm a talisman base list for given rarity (stats-only)
        const warmTalisBase = async (rarityVal = '') => {
          // Cache talisman bases by rarity only; UI filters will be applied at recomposition time
          const talisBaseKey = JSON.stringify({ picker: 'talis-base', rarity: String(rarityVal || '') });
          if (talisPickerCacheRef.current.has(talisBaseKey)) return;
          const byId = new Map();
          // Merge across known type aliases and slot NONE; apply server rarity filter when provided
          const args = (extra) => ({ perPage: 50, totalLimit: 2000, ...(rarityVal ? { rarityEq: rarityVal } : {}), ...extra });
          try { const arr = await fetchItems(args({ typeEq: 'ENHANCEMENT' })); for (const n of (arr||[])) byId.set(String(n.id), n); } catch {}
          if (cancelled) return;
          try { const arr = await fetchItems(args({ typeEq: 'ENCHANTMENT' })); for (const n of (arr||[])) byId.set(String(n.id), n); } catch {}
          if (cancelled) return;
          try { const arr = await fetchItems(args({ typeEq: 'TALISMAN' })); for (const n of (arr||[])) byId.set(String(n.id), n); } catch {}
          if (cancelled) return;
          try { const arr = await fetchItems(args({ slotEq: 'NONE' })); for (const n of (arr||[])) byId.set(String(n.id), n); } catch {}
          const base = Array.from(byId.values())
            // Only keep talismans that actually have stats
            .filter((n) => {
              const stats = Array.isArray(n?.stats) ? n.stats : (Array.isArray(n?.details?.stats) ? n.details.stats : []);
              return Array.isArray(stats) && stats.length > 0;
            })
            .sort((a,b) => {
            const ilA = Number(a?.itemLevel || a?.levelRequirement || a?.details?.itemLevel || a?.details?.levelRequirement || 0);
            const ilB = Number(b?.itemLevel || b?.levelRequirement || b?.details?.itemLevel || b?.details?.levelRequirement || 0);
            if (ilA !== ilB) return ilB - ilA;
            const rarOrder = ['UTILITY','COMMON','UNCOMMON','RARE','VERY_RARE','MYTHIC'];
            const ra = rarOrder.indexOf(String(a?.rarity || a?.details?.rarity || '').toUpperCase());
            const rb = rarOrder.indexOf(String(b?.rarity || b?.details?.rarity || '').toUpperCase());
            return rb - ra;
          });
          if (!cancelled) setTalisCache(talisBaseKey, { base, ts: Date.now() });
        };
        // Warm item global bases per rarity
        const itemTasks = RARITIES.map((r) => () => warmItemsByRarity(r));
        await runQueue(itemTasks, Math.min(RARITIES.length, PRECACHE_ITEMS_CONC));
        // Initial batch done
        decPrecache();
        // Warm talisman bases per rarity shortly after
        setTimeout(() => {
          if (cancelled) return;
          incPrecache();
          const talisTasks = RARITIES.map(r => () => warmTalisBase(r));
          runQueue(talisTasks, Math.min(RARITIES.length, PRECACHE_TALIS_CONC)).catch(() => {}).finally(() => { decPrecache(); });
        }, 200);
      } catch {}
    };
    startTimer = setTimeout(run, 80);
  return () => { cancelled = true; if (startTimer) clearTimeout(startTimer); precacheOpsRef.current = 0; setIsPrecaching(false); };
  }, [career, careerRank, renownRank, pickerOpen]);

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
        const want = mapCareerEnum(career);
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
        if (hostIlvl && tMinRank && tMinRank > hostIlvl) { setPickerOpen(false); setPickerIsTalis(false); return; }
        // Legendary talisman gating: only allow if host description indicates support
        const talisRarity = String(detail?.rarity || item?.rarity || '').toUpperCase();
        const isLegendaryTalis = talisRarity === 'MYTHIC';
        if (isLegendaryTalis) {
          const hostDesc = String(hostItem?.details?.description || '').toLowerCase();
          const allowsLegendary = /legendary\s+talisman/.test(hostDesc);
          if (!allowsLegendary) { setPickerOpen(false); setPickerIsTalis(false); return; }
        }
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
        if (hostIlvl && tMinRank && tMinRank > hostIlvl) { setPickerOpen(false); setPickerIsTalis(false); return; }
        const talisRarity = String(item?.rarity || '').toUpperCase();
        const isLegendaryTalis = talisRarity === 'MYTHIC';
        if (isLegendaryTalis) {
          const hostDesc = String(hostItem?.details?.description || '').toLowerCase();
          const allowsLegendary = /legendary\s+talisman/.test(hostDesc);
          if (!allowsLegendary) { setPickerOpen(false); setPickerIsTalis(false); return; }
        }
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
      // Persist filters when closing picker after a pick
      if (pickerIsTalis) {
        setLastTalisFilters({ name: filterName, stat: filterStat, rarity: filterRarity });
      } else {
        setLastItemFilters({ name: filterName, stat: filterStat, rarity: filterRarity, setOnly: filterSetOnly, careerLockedOnly: filterCareerLockedOnly });
      }
      setPickerOpen(false);
      setPickerIsTalis(false);
    }
  };

  const openTalisPicker = (hostSlotName, i) => {
    setPickerIsTalis(true);
    setPickerTalisHost({ slotName: hostSlotName, index: i });
    setPickerSlot(`Talisman ${i + 1}`);
  // Ensure no stale item results leak into talisman picker
  setPickerItems([]);
  // Decide loading state based on cache availability for the to-be-restored filters
  const rarityKey = String(lastTalisFilters.rarity || '');
  const keyExact = JSON.stringify({ picker: 'talis-base', rarity: rarityKey });
  const keyAll = JSON.stringify({ picker: 'talis-base', rarity: '' });
  const hasCached = talisPickerCacheRef.current.has(keyExact) || talisPickerCacheRef.current.has(keyAll);
  setPickerLoading(!hasCached);
    // Restore last talisman filters
    setFilterName(lastTalisFilters.name || '');
    setFilterStat(lastTalisFilters.stat || '');
    setFilterRarity(lastTalisFilters.rarity || '');
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
      try {
        // Collect debug context for export
  const debug = {
          careerUi: career,
          careerRank,
          renownRank,
          slotName: pickerSlot,
          isTalis: !!pickerIsTalis,
          filters: { name: filterName, stat: filterStat, rarity: filterRarity, setOnly: filterSetOnly, careerLockedOnly: filterCareerLockedOnly },
          slotVariants: [],
          requests: [],
          notes: [],
        };
  // Normalize and map slot names (declare before use)
  const normalize = (s) => (s || '').trim().toLowerCase().replaceAll('jewellry', 'jewelry');
  const jewelrySlots = ['jewelry slot 1','jewelry slot 2','jewelry slot 3','jewelry slot 4'];
  const isTalisPicker = pickerIsTalis;
  // Default mode: no explicit filters and not talisman picker
  const defaultMode = !isTalisPicker && !filterName && !filterStat && !filterRarity && !filterSetOnly;
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
        ]);
  const target = normalize(pickerSlot);
        const isJewelryTarget = jewelrySlots.includes(target);
        // Precompute slot variants and friendly slot label helpers before any cache derivation
        const slotVariants = (() => {
          if (target === 'helm') return ['HELM'];
          if (target === 'shoulders') return ['SHOULDER'];
          if (target === 'cloak') return ['BACK'];
          if (target === 'body') return ['BODY'];
          if (target === 'gloves') return ['GLOVES'];
          if (target === 'belt') return ['BELT'];
          if (target === 'boots') return ['BOOTS'];
          if (target === 'main hand') return ['MAIN_HAND','EITHER_HAND'];
          if (target === 'off hand') return ['OFF_HAND','EITHER_HAND'];
          if (target === 'ranged weapon') return ['RANGED_WEAPON'];
          if (target === 'event item') return ['EVENT'];
          if (target === 'pocket 1') return ['POCKET1','POCKET2'];
          if (target === 'pocket 2') return ['POCKET1','POCKET2'];
          return [];
        })();
        const friendlySlot = (s) => {
          const raw = String(s || '').toUpperCase();
          if (/^JEWELLERY([1-4])$/.test(raw)) {
            const n = raw.slice(-1);
            return `jewelry slot ${n}`;
          }
          if (raw === 'HELM') return 'helm';
          if (raw === 'SHOULDER') return 'shoulders';
          if (raw === 'BACK') return 'cloak';
          if (raw === 'BODY') return 'body';
          if (raw === 'GLOVES') return 'gloves';
          if (raw === 'BELT') return 'belt';
          if (raw === 'BOOTS') return 'boots';
          if (raw === 'POCKET1') return 'pocket 1';
          if (raw === 'POCKET2') return 'pocket 2';
          if (raw === 'EVENT') return 'event item';
          return raw.replace(/_/g, ' ').toLowerCase();
        };
        const acceptable = Array.from(new Set([...(mapExact.get(target) || []), target]));
        // Race restriction helper
        const matchesRace = (it) => {
          try {
            const arr = Array.isArray(it?.raceRestriction) ? it.raceRestriction : (Array.isArray(it?.details?.raceRestriction) ? it.details.raceRestriction : []);
            if (!Array.isArray(arr) || arr.length === 0) return true;
            if (!activeRace) return true;
            const want = String(activeRace).toUpperCase();
            return arr.map(String).map(s => s.toUpperCase()).includes(want);
          } catch { return true; }
        };
  if (isTalisPicker) {
          // host context for validation
          const hostName = pickerTalisHost?.slotName || '';
          const hostItem = equipped[hostName];
          const hostIlvl = Number(hostItem?.details?.itemLevel || hostItem?.details?.levelRequirement || hostItem?.itemLevel || hostItem?.levelRequirement || 0) || 0;
          const existing = Array.isArray(talismans?.[hostName]) ? talismans[hostName] : [];
          const currentAtIdx = existing?.[pickerTalisHost?.index || 0];
          const excludeIds = new Set(existing.map((t, j) => (t && j !== (pickerTalisHost?.index || 0)) ? String(t.id) : null).filter(Boolean));
          const hostDesc = String(hostItem?.details?.description || '').toLowerCase();
          const hostAllowsLegendary = /legendary\s+talisman/.test(hostDesc);
          // Base cache key for talisman picker: keyed by rarity only (UI name/stat applied later)
          const rarityKey = String(filterRarity || '');
          const keyExact = JSON.stringify({ picker: 'talis-base', rarity: rarityKey });
          const keyAll = JSON.stringify({ picker: 'talis-base', rarity: '' });
          let talisBaseHit = talisPickerCacheRef.current.get(keyExact) || (rarityKey ? talisPickerCacheRef.current.get(keyAll) : talisPickerCacheRef.current.get(keyAll));
          if (talisBaseHit && Array.isArray(talisBaseHit.base)) {
            // Recompute final list using current host constraints; no loading on cache hit
            const base = talisBaseHit.base;
            let final = base
              // Apply UI filters (name, stat, and optionally rarity if we fell back to 'all' base)
              .filter((n) => {
                if (filterName && !String(n?.name || '').toLowerCase().includes(String(filterName).toLowerCase())) return false;
                if (filterStat) {
                  const stats = Array.isArray(n?.stats) ? n.stats : (Array.isArray(n?.details?.stats) ? n.details.stats : []);
                  const has = stats.some(s => String(s?.stat || s?.name || s?.type || '').toLowerCase().includes(String(filterStat).toLowerCase()));
                  if (!has) return false;
                }
                if (rarityKey) {
                  const r = String(n?.rarity || n?.details?.rarity || '').toUpperCase();
                  if (r !== rarityKey.toUpperCase()) return false;
                }
                return true;
              })
              .filter((n) => {
                if (hostIlvl) {
                  const tMin = Number(n?.levelRequirement || n?.itemLevel || n?.minimumRank || n?.details?.levelRequirement || n?.details?.itemLevel || 0) || 0;
                  if (tMin && tMin > hostIlvl) return false;
                }
                const isLegendaryTalis = String(n?.rarity || n?.details?.rarity || '').toUpperCase() === 'MYTHIC';
                if (isLegendaryTalis && !hostAllowsLegendary) return false;
                const idStr = String(n?.id || '');
                if (!idStr || excludeIds.has(idStr)) return false;
                return true;
              })
              .sort((a,b) => {
                const ilA = Number(a?.itemLevel || a?.levelRequirement || a?.details?.itemLevel || a?.details?.levelRequirement || 0);
                const ilB = Number(b?.itemLevel || b?.levelRequirement || b?.details?.itemLevel || b?.details?.levelRequirement || 0);
                if (ilA !== ilB) return ilB - ilA;
                const rarOrder = ['UTILITY','COMMON','UNCOMMON','RARE','VERY_RARE','MYTHIC'];
                const ra = rarOrder.indexOf(String(a?.rarity || a?.details?.rarity || '').toUpperCase());
                const rb = rarOrder.indexOf(String(b?.rarity || b?.details?.rarity || '').toUpperCase());
                return rb - ra;
              });
            if (!ignore) {
              setPickerItems(final);
              setPickerDebug({ ...debug, cached: true, notes: [...(debug.notes||[]), 'talis-cache-hit-early'], final: { finalCount: final.length } });
              setPickerLoading(false);
            }
            return;
          }
          // No cache available; only proceed to fetch for named searches
          if (!filterName) {
            setPickerLoading(false);
            setPickerDebug({ ...debug, cached: true, notes: [...(debug.notes||[]), 'talis-cache-miss-no-name'] });
            return;
          }
          // Proceed to fetch talismans for named search
          // Fetch talisman items: most have slot 'TALISMAN' or type includes 'TALISMAN'.
          // We'll try by type first, then by slot if available.
          let byId = new Map();
          const hasStatsLocal = (n) => {
            const stats = Array.isArray(n?.stats) ? n.stats : (Array.isArray(n?.details?.stats) ? n.details.stats : []);
            return Array.isArray(stats) && stats.length > 0;
          };
          // Start loading only if not served from cache
          setPickerLoading(true);
          setPickerError(null);
          setPickerItems([]);
          try {
            // Talismans are type ENHANCEMENT in the API
            debug.requests.push({ typeEq: 'ENHANCEMENT', perPage: 50, totalLimit: 2000, nameContains: filterName || undefined });
            const byType = await fetchItems({ perPage: 50, totalLimit: 2000, typeEq: 'ENHANCEMENT', nameContains: filterName || undefined });
            for (const n of (byType || [])) byId.set(String(n.id), n);
          } catch {}
          try {
            // Some sources may use ENCHANTMENT; include as well
            debug.requests.push({ typeEq: 'ENCHANTMENT', perPage: 50, totalLimit: 2000, nameContains: filterName || undefined });
            const byTypeAlt = await fetchItems({ perPage: 50, totalLimit: 2000, typeEq: 'ENCHANTMENT', nameContains: filterName || undefined });
            for (const n of (byTypeAlt || [])) byId.set(String(n.id), n);
          } catch {}
          try {
            // Some datasets might still expose talismans under TALISMAN type; merge if any
            debug.requests.push({ typeEq: 'TALISMAN', perPage: 50, totalLimit: 2000, nameContains: filterName || undefined });
            const byTypeLegacy = await fetchItems({ perPage: 50, totalLimit: 2000, typeEq: 'TALISMAN', nameContains: filterName || undefined });
            for (const n of (byTypeLegacy || [])) byId.set(String(n.id), n);
          } catch {}
          try {
            // Many show slot NONE; merge those too
            debug.requests.push({ slotEq: 'NONE', perPage: 50, totalLimit: 2000, nameContains: filterName || undefined });
            const bySlot = await fetchItems({ perPage: 50, totalLimit: 2000, slotEq: 'NONE', nameContains: filterName || undefined });
            for (const n of (bySlot || [])) byId.set(String(n.id), n);
          } catch {}
          // Build base list (pre-host constraints and pre-UI name/stat) from fetched talismans
          const baseAll = Array.from(byId.values())
            .filter((n) => hasStatsLocal(n))
            .sort((a,b) => {
              const ilA = Number(a?.itemLevel || a?.levelRequirement || a?.details?.itemLevel || a?.details?.levelRequirement || 0);
              const ilB = Number(b?.itemLevel || b?.levelRequirement || b?.details?.itemLevel || b?.details?.levelRequirement || 0);
              if (ilA !== ilB) return ilB - ilA;
              const rarOrder = ['UTILITY','COMMON','UNCOMMON','RARE','VERY_RARE','MYTHIC'];
              const ra = rarOrder.indexOf(String(a?.rarity || a?.details?.rarity || '').toUpperCase());
              const rb = rarOrder.indexOf(String(b?.rarity || b?.details?.rarity || '').toUpperCase());
              return rb - ra;
            });
          // Apply UI filters then host constraints to compute final
          const applyUi = (arr) => arr.filter((n) => {
            if (filterName && !String(n?.name || '').toLowerCase().includes(String(filterName).toLowerCase())) return false;
            if (filterStat) {
              const stats = Array.isArray(n?.stats) ? n.stats : (Array.isArray(n?.details?.stats) ? n.details.stats : []);
              const has = stats.some(s => String(s?.stat || s?.name || s?.type || '').toLowerCase().includes(String(filterStat).toLowerCase()));
              if (!has) return false;
            }
            if (filterRarity) {
              const r = String(n?.rarity || n?.details?.rarity || '').toUpperCase();
              if (r !== String(filterRarity).toUpperCase()) return false;
            }
            return true;
          });
          const baseUi = applyUi(baseAll);
          // Apply host constraints to base for final (reuse excludeIds declared above)
          let items = baseUi.filter((n) => {
            if (hostIlvl) {
              const tMin = Number(n?.levelRequirement || n?.itemLevel || n?.minimumRank || n?.details?.levelRequirement || n?.details?.itemLevel || 0) || 0;
              if (tMin && tMin > hostIlvl) return false;
            }
            const isLegendaryTalis = String(n?.rarity || n?.details?.rarity || '').toUpperCase() === 'MYTHIC';
            if (isLegendaryTalis && !hostAllowsLegendary) return false;
            const idStr = String(n?.id || '');
            if (!idStr || excludeIds.has(idStr)) return false;
            return true;
          });
          if (items.length === 0) {
            try {
              debug.requests.push({ nameContains: 'talisman', allowAnyName: false, perPage: 50, totalLimit: 1000 });
              const byName = await fetchItems({ perPage: 50, totalLimit: 1000, allowAnyName: false, nameContains: 'talisman' });
              items = (byName || [])
                .filter((n) => {
                  const idStr = String(n?.id || '');
                  if (!idStr) return false;
                  if (excludeIds.has(idStr)) return false;
                  return true;
                })
                .sort((a,b) => (Number(b?.itemLevel||b?.levelRequirement||0) - Number(a?.itemLevel||a?.levelRequirement||0)));
            } catch {}
          }
          // If saved talisman filters are too strict for this host, relax name/stat but keep rarity
          if (items.length === 0 && (filterName || filterStat)) {
            const itemsRelaxed = Array.from(byId.values())
              .filter((n) => {
                if (filterRarity) {
                  const r = String(n?.rarity || n?.details?.rarity || '').toUpperCase();
                  if (r !== String(filterRarity).toUpperCase()) return false;
                }
                if (hostIlvl) {
                  const tMin = Number(n?.levelRequirement || n?.itemLevel || n?.minimumRank || n?.details?.levelRequirement || n?.details?.itemLevel || 0) || 0;
                  if (tMin && tMin > hostIlvl) return false;
                }
                const idStr = String(n?.id || '');
                if (!idStr) return false;
                if (excludeIds.has(idStr)) return false;
                return true;
              })
              .sort((a,b) => (Number(b?.itemLevel||b?.levelRequirement||0) - Number(a?.itemLevel||a?.levelRequirement||0)));
            if (!ignore) { setPickerItems(itemsRelaxed); setPickerDebug({ ...debug, final: { rawCareerCount: itemsRelaxed.length, finalCount: itemsRelaxed.length } }); }
            return;
          }
          if (!ignore) {
            setPickerItems(items);
            const dbg = { ...debug, final: { rawCareerCount: items.length, finalCount: items.length } };
            setPickerDebug(dbg);
            // Merge results into caches (do not overwrite broader bases with name-limited sets)
            try {
              const hitAll = talisPickerCacheRef.current.get(keyAll);
              const mergedAll = Array.isArray(hitAll?.base) ? dedupeById([...(hitAll.base || []), ...baseAll]).sort(sortByLevelRarity) : baseAll;
              setTalisCache(keyAll, { base: mergedAll, ts: Date.now() });
              if (rarityKey) {
                const baseRar = baseAll.filter(n => String(n?.rarity || n?.details?.rarity || '').toUpperCase() === rarityKey.toUpperCase());
                const hitExact = talisPickerCacheRef.current.get(keyExact);
                const mergedExact = Array.isArray(hitExact?.base) ? dedupeById([...(hitExact.base || []), ...baseRar]).sort(sortByLevelRarity) : baseRar;
                setTalisCache(keyExact, { base: mergedExact, ts: Date.now() });
              }
            } catch {}
          }
          return;
        }
  // Precompute likely server slot enums for this target for fetch and raw matching
  const defaultOrder = defaultMode ? [ { itemLevel: 'DESC' }, { rarity: 'DESC' } ] : undefined;
        // Fetch career-scoped; for jewelry, fetch with and without type filter and merge
  let itemsRawCareer = [];
        // Base cache key for item picker: slot target + filters + caps (pre-unique filtering)
        const itemBaseKey = JSON.stringify({
          picker: 'item-base', slot: pickerSlot, target, isJewelryTarget, career, careerRank, renownRank,
          name: filterName || '', stat: filterStat || '', rarity: filterRarity || '',
          setOnly: !!filterSetOnly, defaultMode: !!defaultMode
        });
        const itemBaseHit = itemPickerCacheRef.current.get(itemBaseKey);
        if (itemBaseHit && Array.isArray(itemBaseHit.base)) {
          // Reapply unique-equips filtering against current equipped and client-only toggles (careerLockedOnly)
          const base = itemBaseHit.base;
          const equippedEntries = Object.entries(equipped || {});
          const uniqueIsEquippedElsewhere = (id) => equippedEntries.some(([slotName, it]) => it && String(it.id) === String(id) && slotName !== pickerSlot);
          let items = base
            .filter((n) => !(n?.uniqueEquipped && uniqueIsEquippedElsewhere(n.id)))
            // Enforce race restriction if present
            .filter((n) => matchesRace(n))
            .filter((n) => {
              if (!filterCareerLockedOnly) return true;
              return Array.isArray(n.careerRestriction) && n.careerRestriction.length
                ? n.careerRestriction.includes(mapCareerEnum(career))
                : false;
            });
          if (!ignore) {
            setPickerItems(items);
            setPickerDebug({ ...debug, cached: true, final: { finalCount: items.length } });
            if (!filterName) setPickerLoading(false);
          }
          // For name searches, seed from cache but continue to server to merge more hits
          if (!filterName) return;
        }
        // Try deriving from global per-rarity caches (career-scoped) before fetching
        const raritiesWanted = filterRarity ? [String(filterRarity).toUpperCase()] : RARITIES.slice();
        const globalBases = [];
        for (const rar of raritiesWanted) {
          const gkey = JSON.stringify({ picker: 'item-global', rarity: String(rar || ''), career, careerRank, renownRank, defaultMode: true });
          const hit = itemPickerCacheRef.current.get(gkey);
          if (hit && Array.isArray(hit.base)) globalBases.push(hit.base);
        }
        if (globalBases.length) {
          const merged = [].concat(...globalBases);
          const byId = new Map();
          for (const n of merged) byId.set(String(n.id), n);
          const itemsPre = Array.from(byId.values())
            .map((n) => ({ ...n, slotRaw: n.slot, slot: friendlySlot(n.slot) }));
          const targetJewNum = isJewelryTarget ? Number((target.match(/(\d)$/) || [])[1] || 0) : 0;
      let items = itemsPre
            .filter((n) => {
              const ns = normalize(String(n.slot || ''));
              const raw = String(n.slotRaw || '').toUpperCase();
              if (isJewelryTarget && targetJewNum >= 1 && targetJewNum <= 4) {
                return raw === 'JEWELLERY1' || ns === `jewelry slot ${targetJewNum}`;
              }
              const allowed = new Set(slotVariants);
              if (target === 'main hand') allowed.add('TWO_HAND');
              const rawMatch = allowed.has(raw);
              return acceptable.includes(ns) || rawMatch;
            })
            .filter((n) => {
              // Name/stat/rarity UI filters
              if (filterName && !String(n.name || '').toLowerCase().includes(filterName.toLowerCase())) return false;
              if (filterStat) {
                const stats = Array.isArray(n?.stats) ? n.stats : (Array.isArray(n?.details?.stats) ? n.details.stats : []);
                const has = stats.some(s => String(s?.stat || s?.name || s?.type || '').toLowerCase().includes(String(filterStat).toLowerCase()));
                if (!has) return false;
              }
              if (filterRarity) {
                const r = String(n?.rarity || n?.details?.rarity || '').toUpperCase();
                if (r !== String(filterRarity).toUpperCase()) return false;
              }
        // Enforce race restrictions if present
        if (!matchesRace(n)) return false;
              return true;
            })
            .sort((a,b) => {
              const ilA = Number(a?.itemLevel || a?.details?.itemLevel || 0);
              const ilB = Number(b?.itemLevel || b?.details?.itemLevel || 0);
              if (ilA !== ilB) return ilB - ilA;
              const rarOrder = ['UTILITY','COMMON','UNCOMMON','RARE','VERY_RARE','MYTHIC'];
              const ra = rarOrder.indexOf(String(a?.rarity || a?.details?.rarity || '').toUpperCase());
              const rb = rarOrder.indexOf(String(b?.rarity || b?.details?.rarity || '').toUpperCase());
              return (rb - ra);
            });
          const equippedEntries = Object.entries(equipped || {});
          const uniqueIsEquippedElsewhere = (id) => equippedEntries.some(([slotName, it]) => it && String(it.id) === String(id) && slotName !== pickerSlot);
          const itemsPreUnique = items.slice();
          items = items.filter((n) => !(n?.uniqueEquipped && uniqueIsEquippedElsewhere(n.id)));
          if (!ignore && items.length) {
            setPickerItems(items);
            setPickerDebug({ ...debug, cached: true, notes: [...(debug.notes||[]), 'item-global-cache-derived'], final: { finalCount: items.length } });
            if (!filterName) setPickerLoading(false);
            // Store a slot-specific base for quicker reuse next time
            setItemCache(itemBaseKey, { base: itemsPreUnique, ts: Date.now() });
            if (!filterName) return; // for name search, keep going to merge more from server
          }
        }
        // If no name filter and nothing cached/derived, stay cache-only (don't fetch)
        if (!filterName) {
          setPickerLoading(false);
          setPickerDebug({ ...debug, cached: true, notes: [...(debug.notes||[]), 'cache-only-no-name'] });
          return;
        }
        // Start loading only if not served from cache
        setPickerLoading(true);
        setPickerError(null);
        setPickerItems([]);
  if (isJewelryTarget) {
          // Query specific accessory equip slots (JEWELLERY1..4). Merge career-scoped and no-career results.
          // Some universal rings (e.g., Annulus) can be under-returned by usableByCareer for certain careers.
          const slotsToTry = ['JEWELLERY1', 'JEWELLERY2', 'JEWELLERY3', 'JEWELLERY4'];
          const mapCareer = async (c) => await mapCareerEnumDynamic(c);
          const careerEnum = await mapCareer(career);
          debug.slotVariants = slotsToTry.slice();
          for (const s of slotsToTry) debug.requests.push({ slotEq: s, usableByCareer: careerEnum, perPage: 50, totalLimit: 500, nameContains: filterName || undefined, rarityEq: filterRarity || undefined, caps: { levelRequirementLte: careerRank, renownRankRequirementLte: renownRank } });
          const withCareerSettled = await Promise.allSettled(
            slotsToTry.map(async s => fetchItems({ career: careerEnum, perPage: 50, totalLimit: 500, slotEq: s, allowAnyName: !filterName, nameContains: filterName || undefined, rarityEq: filterRarity || undefined, maxLevelRequirement: careerRank, maxRenownRankRequirement: renownRank, order: defaultOrder }))
          );
          const byId = new Map();
          for (const r of withCareerSettled) {
            if (r.status === 'fulfilled') {
              for (const it of (r.value || [])) byId.set(String(it.id), it);
            }
          }
          itemsRawCareer = Array.from(byId.values());
          // Merge fetched name results into global per-rarity caches
          if (filterName && itemsRawCareer.length) {
            try {
              for (const it of itemsRawCareer) {
                const rar = String(it?.rarity || it?.details?.rarity || '').toUpperCase();
                if (!rar) continue;
                const gkey = JSON.stringify({ picker: 'item-global', rarity: rar, career, careerRank, renownRank, defaultMode: true });
                const hit = itemPickerCacheRef.current.get(gkey);
                const base = hit?.base || [];
                const m = new Map(base.map(n => [String(n.id), n]));
                m.set(String(it.id), it);
                setItemCache(gkey, { base: Array.from(m.values()), ts: Date.now() });
              }
            } catch {}
          }
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
            if (target === 'event item') return 'EVENT';
            if (target === 'pocket 1') return 'POCKET1';
            if (target === 'pocket 2') return 'POCKET2';
            return undefined;
          })();
          void slotEnum; // silence unused var; kept for clarity
          // Try likely slot enum variants sequentially; skip invalid enum errors
          const byId = new Map();
          const mapCareer = async (c) => await mapCareerEnumDynamic(c);
          debug.slotVariants = slotVariants.slice();
          for (const sv of slotVariants) {
            try {
              const careerEnum = await mapCareer(career);
              debug.requests.push({ slotEq: sv, usableByCareer: careerEnum, perPage: 50, totalLimit: 500, nameContains: filterName || undefined, rarityEq: filterRarity || undefined, caps: { levelRequirementLte: careerRank, renownRankRequirementLte: renownRank } });
              const arr = await fetchItems({ career: careerEnum, perPage: 50, totalLimit: 500, slotEq: sv, allowAnyName: !filterName, nameContains: filterName || undefined, rarityEq: filterRarity || undefined, maxLevelRequirement: careerRank, maxRenownRankRequirement: renownRank, order: defaultOrder });
              for (const n of (arr || [])) byId.set(String(n.id), n);
              // If we found items for one variant, we can continue to merge, or break early; keep merging to be safe
            } catch {
              // invalid enum value or other error; try next variant
              continue;
            }
          }
          // No boosters or fallbacks without career; rely on server-side career filtering exclusively
          itemsRawCareer = Array.from(byId.values());
          // Merge fetched name results into global per-rarity caches
          if (filterName && itemsRawCareer.length) {
            try {
              for (const it of itemsRawCareer) {
                const rar = String(it?.rarity || it?.details?.rarity || '').toUpperCase();
                if (!rar) continue;
                const gkey = JSON.stringify({ picker: 'item-global', rarity: rar, career, careerRank, renownRank, defaultMode: true });
                const hit = itemPickerCacheRef.current.get(gkey);
                const base = hit?.base || [];
                const m = new Map(base.map(n => [String(n.id), n]));
                m.set(String(it.id), it);
                setItemCache(gkey, { base: Array.from(m.values()), ts: Date.now() });
              }
            } catch {}
          }
        }
        // Apply client-side slot filtering to handle naming differences (e.g., jewelry)
  // acceptable and friendlySlot precomputed earlier
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
            // Default mode band: prefer items close to current CR and not far below RR
            if (defaultMode) {
              const withinLvl = !reqLvlNum || (careerRank - reqLvlNum) >= 0 && (careerRank - reqLvlNum) <= PRECACHE_CR_BAND;
              const withinRR = !reqRRNum || (renownRank - reqRRNum) >= 0 && (renownRank - reqRRNum) <= PRECACHE_RR_BELOW;
              if (!withinLvl || !withinRR) return false;
            }
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
      // Enforce race restriction if present
      if (!matchesRace(n)) return false;
            return true;
          })
          .filter((n) => {
            // Enforce career restrictions if provided
            if (Array.isArray(n.careerRestriction) && n.careerRestriction.length) {
              const want = mapCareerEnum(career);
              return n.careerRestriction.includes(want);
            }
            return true;
          })
          .sort((a,b) => {
            // Prefer set items in default mode
            if (defaultMode) {
              const aSet = !!(a?.itemSet?.name || a?.details?.set?.name);
              const bSet = !!(b?.itemSet?.name || b?.details?.set?.name);
              if (aSet !== bSet) return bSet ? 1 : -1;
            }
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
  const itemsPreUnique = items.slice();
  items = items.filter((n) => !(n?.uniqueEquipped && uniqueIsEquippedElsewhere(n.id)));
        // No jewelry fallback without career; results may be empty by design
        if (isJewelryTarget && items.length === 0) {
          // keep items empty; rely on server career filtering
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
          const dbg = { ...debug, final: { rawCareerCount: (itemsRawCareer || []).length, finalCount: items ? items.length : 0 } };
          setPickerDebug(dbg);
          // Store pre-uniqueness base list keyed by context; on reuse we reapply unique filtering
          const baseToStore = itemsPreUnique || items || [];
          setItemCache(itemBaseKey, { base: baseToStore, ts: Date.now() });
        }
      } catch (e) {
  if (!ignore) setPickerError(e);
      } finally {
        if (!ignore) setPickerLoading(false);
      }
    }
    loadFromGraphQL();
    return () => { ignore = true; };
  }, [pickerOpen, pickerSlot, pickerIsTalis, pickerTalisHost, talismans, career, careerRank, renownRank, equipped, filterName, filterStat, filterRarity, filterSetOnly, filterCareerLockedOnly]);

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
        {/* Persistent icon slot to reserve space; render icon when career chosen */}
        <span className="career-icon-slot">
          {CAREER_ICON_URLS?.[career] ? (
            <img key={career} className="career-icon" src={CAREER_ICON_URLS[career]} alt="" />
          ) : null}
        </span>
  <select title="Career" value={career || ''} onChange={(e) => setCareer(e.target.value)}>
          <option value="">Choose career...</option>
          {CAREERS.map((c) => (
            <option key={c} value={c}>{c.replaceAll('_', ' ')}</option>
          ))}
        </select>
      </label>
      <label>
        Career Rank:
        <input
          type="number"
          min={1}
          max={40}
          value={careerRank}
          onChange={(e) => {
            const n = parseInt(e.target.value || 0, 10);
            const v = Math.max(1, Math.min(40, isNaN(n) ? 1 : n));
            setCareerRank(v);
          }}
          style={{ width: 70, marginLeft: 6 }}
        />
      </label>
      <label>
        Renown Rank:
        <input
          type="number"
          min={1}
          max={255}
          value={renownRank}
          onChange={(e) => {
            const n = parseInt(e.target.value || 0, 10);
            const v = Math.max(1, Math.min(255, isNaN(n) ? 1 : n));
            setRenownRank(v);
          }}
          style={{ width: 70, marginLeft: 6 }}
        />
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
          // If previous mode was talisman, show loading to avoid momentary wrong list
          if (pickerIsTalis) setPickerLoading(true);
          setPickerItems([]);
          setPickerIsTalis(false);
          setPickerTalisHost({ slotName: '', index: 0 });
          // Restore last item filters; no default checkboxes active now
          const isPristine = !lastItemFilters.name && !lastItemFilters.stat && !lastItemFilters.rarity && !lastItemFilters.setOnly && !lastItemFilters.careerLockedOnly;
          if (!itemFilterDefaultsApplied && isPristine) {
            const defaults = { name: '', stat: '', rarity: '', setOnly: false, careerLockedOnly: false };
            setFilterName('');
            setFilterStat('');
            setFilterRarity('');
            setFilterSetOnly(false);
            setFilterCareerLockedOnly(false);
            setLastItemFilters(defaults);
            setItemFilterDefaultsApplied(true);
          } else {
            setFilterName(lastItemFilters.name || '');
            setFilterStat(lastItemFilters.stat || '');
            setFilterRarity(lastItemFilters.rarity || '');
            setFilterSetOnly(!!lastItemFilters.setOnly);
            setFilterCareerLockedOnly(!!lastItemFilters.careerLockedOnly);
          }
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
              talisCount={talisCount} talismans={tals} onTalisPick={openTalisPicker} onTalisClear={clearTalis} onItemClear={(slotName) => setEquipped(prev => ({ ...prev, [slotName]: null }))}
            />
          );
        })}
  <StatsPanel totals={totals} activeSetBonuses={activeSetBonuses} defenseList={combatSections.defenseList} offenseList={combatSections.offenseList} magicList={combatSections.magicList} primaryContrib={primaryContrib} defContrib={combatSections.defContrib} offContrib={combatSections.offContrib} magContrib={combatSections.magContrib} />
      </div>
  <ItemPicker
        open={pickerOpen}
        onClose={() => { 
          if (pickerIsTalis) {
            setLastTalisFilters({ name: filterName, stat: filterStat, rarity: filterRarity });
          } else {
            setLastItemFilters({ name: filterName, stat: filterStat, rarity: filterRarity, setOnly: filterSetOnly, careerLockedOnly: filterCareerLockedOnly });
          }
          setPickerOpen(false); setPickerIsTalis(false); setPickerTalisHost({ slotName: '', index: 0 });
        }}
  items={pickerIsTalis ? (pickerItems || []) : (pickerItems && pickerItems.length ? pickerItems : filteredItems)}
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
  filterCareerLockedOnly={filterCareerLockedOnly}
  setFilterCareerLockedOnly={setFilterCareerLockedOnly}
  isTalis={pickerIsTalis}
  activeCareer={career}
  debugInfo={pickerDebug}
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
            if (pickerIsTalis) setPickerLoading(true);
            setPickerItems([]);
            setPickerIsTalis(false);
            setPickerTalisHost({ slotName: '', index: 0 });
            const isPristine = !lastItemFilters.name && !lastItemFilters.stat && !lastItemFilters.rarity && !lastItemFilters.setOnly && !lastItemFilters.careerLockedOnly;
            if (!itemFilterDefaultsApplied && isPristine) {
              const defaults = { name: '', stat: '', rarity: '', setOnly: false, careerLockedOnly: false };
              setFilterName('');
              setFilterStat('');
              setFilterRarity('');
              setFilterSetOnly(false);
              setFilterCareerLockedOnly(false);
              setLastItemFilters(defaults);
              setItemFilterDefaultsApplied(true);
            } else {
              setFilterName(lastItemFilters.name || '');
              setFilterStat(lastItemFilters.stat || '');
              setFilterRarity(lastItemFilters.rarity || '');
              setFilterSetOnly(!!lastItemFilters.setOnly);
              setFilterCareerLockedOnly(!!lastItemFilters.careerLockedOnly);
            }
            setPickerSlot(el.getAttribute('data-slotname'));
            setPickerOpen(true);
          }}
        >
          {Toolbar}
          <div className="classic-gear-left">
            {leftArmorOrder.map((name) => (
              <GearSlot key={name} name={name} gridArea={undefined} item={equipped[name]} allItems={allItems} iconFallbacks={iconFallbacks || {}} variant={variant} onItemClear={(slotName) => setEquipped(prev => ({ ...prev, [slotName]: null }))} />
            ))}
          </div>
          <div className="classic-doll" />
          <div className="classic-jewels">
            {jewelOrder.map((name) => (
              <GearSlot key={name} name={name} gridArea={undefined} item={equipped[name]} allItems={allItems} iconFallbacks={iconFallbacks || {}} variant={variant} onItemClear={(slotName) => setEquipped(prev => ({ ...prev, [slotName]: null }))} />
            ))}
          </div>
          <div className="classic-right">
            <div className="classic-stats">
              <StatsPanel totals={totals} activeSetBonuses={activeSetBonuses} defenseList={combatSections.defenseList} offenseList={combatSections.offenseList} magicList={combatSections.magicList} primaryContrib={primaryContrib} defContrib={combatSections.defContrib} offContrib={combatSections.offContrib} magContrib={combatSections.magContrib} sourceMeta={sourceMeta} />
            </div>
          </div>
          <div className="classic-bottom">
            {bottomWeapons.map((name) => (
              <GearSlot key={name} name={name} gridArea={undefined} item={equipped[name]} allItems={allItems} iconFallbacks={iconFallbacks || {}} variant={variant} onItemClear={(slotName) => setEquipped(prev => ({ ...prev, [slotName]: null }))} />
            ))}
          </div>
        </div>
  <ItemPicker
          open={pickerOpen}
          onClose={() => { 
            if (pickerIsTalis) {
              setLastTalisFilters({ name: filterName, stat: filterStat, rarity: filterRarity });
            } else {
              setLastItemFilters({ name: filterName, stat: filterStat, rarity: filterRarity, setOnly: filterSetOnly, careerLockedOnly: filterCareerLockedOnly });
            }
            setPickerOpen(false); setPickerIsTalis(false); setPickerTalisHost({ slotName: '', index: 0 });
          }}
          items={pickerIsTalis ? (pickerItems || []) : (pickerItems && pickerItems.length ? pickerItems : filteredItems)}
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
  filterCareerLockedOnly={filterCareerLockedOnly}
  setFilterCareerLockedOnly={setFilterCareerLockedOnly}
          isTalis={pickerIsTalis}
      activeCareer={career}
          debugInfo={pickerDebug}
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
            if (pickerIsTalis) setPickerLoading(true);
            setPickerItems([]);
            setPickerIsTalis(false);
            setPickerTalisHost({ slotName: '', index: 0 });
            const isPristine = !lastItemFilters.name && !lastItemFilters.stat && !lastItemFilters.rarity && !lastItemFilters.setOnly && !lastItemFilters.careerLockedOnly;
            if (!itemFilterDefaultsApplied && isPristine) {
              const defaults = { name: '', stat: '', rarity: '', setOnly: false, careerLockedOnly: false };
              setFilterName('');
              setFilterStat('');
              setFilterRarity('');
              setFilterSetOnly(false);
              setFilterCareerLockedOnly(false);
              setLastItemFilters(defaults);
              setItemFilterDefaultsApplied(true);
            } else {
              setFilterName(lastItemFilters.name || '');
              setFilterStat(lastItemFilters.stat || '');
              setFilterRarity(lastItemFilters.rarity || '');
              setFilterSetOnly(!!lastItemFilters.setOnly);
              setFilterCareerLockedOnly(!!lastItemFilters.careerLockedOnly);
            }
            setPickerSlot(el.getAttribute('data-slotname'));
            setPickerOpen(true);
          }}
        >
          <div className="ror-toolbar ror-panel">
            <label>
              <span className="career-icon-slot">
                {CAREER_ICON_URLS?.[career] ? (
                  <img key={career} className="career-icon" src={CAREER_ICON_URLS[career]} alt="" />
                ) : null}
              </span>
              <select title="Career" value={career || ''} onChange={(e) => setCareer(e.target.value)}>
                <option value="">Choose career...</option>
                {CAREERS.map((c) => (
                  <option key={c} value={c}>{c.replaceAll('_', ' ')}</option>
                ))}
              </select>
            </label>
            <label>
              CR:
              <input
                type="number"
                min={1}
                max={40}
                value={careerRank}
                onChange={(e) => {
                  const n = parseInt(e.target.value || 0, 10);
                  const v = Math.max(1, Math.min(40, isNaN(n) ? 1 : n));
                  setCareerRank(v);
                }}
                style={{ width: 64, marginLeft: 6 }}
              />
            </label>
            <label>
              RR:
              <input
                type="number"
                min={1}
                max={255}
                value={renownRank}
                onChange={(e) => {
                  const n = parseInt(e.target.value || 0, 10);
                  const v = Math.max(1, Math.min(255, isNaN(n) ? 1 : n));
                  setRenownRank(v);
                }}
                style={{ width: 64, marginLeft: 6 }}
              />
            </label>
            <button onClick={() => { setEquipped({}); setTalismans({}); }}>Reset</button>
            {/* Max CR / RR removed per request */}
          </div>
          <div className="ror-armor ror-panel">
            {leftArmorOrder.map((name) => {
              const it = equipped[name];
              const tc = Number(it?.details?.talismanSlots || 0) || 0;
              return (
                <GearSlot key={name} name={name} item={it} allItems={allItems} iconFallbacks={iconFallbacks || {}} variant={variant} talisCount={tc} talismans={talismans?.[name] || []} onTalisPick={openTalisPicker} onTalisClear={clearTalis} onItemClear={(slotName) => setEquipped(prev => ({ ...prev, [slotName]: null }))} />
              );
            })}
          </div>
          <div className="ror-mid ror-panel">
            {midOrder.map((name) => {
              const it = equipped[name];
              const tc = Number(it?.details?.talismanSlots || 0) || 0;
              return (
                <GearSlot key={name} name={name} item={it} allItems={allItems} iconFallbacks={iconFallbacks || {}} variant={variant} talisCount={tc} talismans={talismans?.[name] || []} onTalisPick={openTalisPicker} onTalisClear={clearTalis} onItemClear={(slotName) => setEquipped(prev => ({ ...prev, [slotName]: null }))} />
              );
            })}
          </div>
          <div className="ror-jewels ror-panel">
            {jewelOrder.map((name) => {
              const it = equipped[name];
              const tc = Number(it?.details?.talismanSlots || 0) || 0;
              return (
                <GearSlot key={name} name={name} item={it} allItems={allItems} iconFallbacks={iconFallbacks || {}} variant={variant} talisCount={tc} talismans={talismans?.[name] || []} onTalisPick={openTalisPicker} onTalisClear={clearTalis} onItemClear={(slotName) => setEquipped(prev => ({ ...prev, [slotName]: null }))} />
              );
            })}
          </div>
          <div className="ror-stats">
            <StatsPanel totals={totals} activeSetBonuses={activeSetBonuses} defenseList={combatSections.defenseList} offenseList={combatSections.offenseList} magicList={combatSections.magicList} primaryContrib={primaryContrib} defContrib={combatSections.defContrib} offContrib={combatSections.offContrib} magContrib={combatSections.magContrib} sourceMeta={sourceMeta} />
          </div>
        </div>
        </div>
        {/* Status row at bottom of container */}
        <div className="ror-status">
          <div className="status-left prefetch" title={isPrecaching ? 'Loading items...' : 'Items loaded.'}>
            <span className={`dot${isPrecaching ? ' busy' : ''}`} />
            <span>{isPrecaching ? 'Loading items...' : 'Items loaded.'} (items: {cachedItemCount}, talismans: {cachedTalisCount})</span>
          </div>
          <div className="status-right">
            <span className="mem" title={memTitle || undefined}>mem: {memText}</span>
            <span className="ver" title={`Version ${appVersion}`}>v{appVersion}</span>
          </div>
        </div>
  <ItemPicker
          open={pickerOpen}
          onClose={() => { 
            if (pickerIsTalis) {
              setLastTalisFilters({ name: filterName, stat: filterStat, rarity: filterRarity });
            } else {
              setLastItemFilters({ name: filterName, stat: filterStat, rarity: filterRarity, setOnly: filterSetOnly, careerLockedOnly: filterCareerLockedOnly });
            }
            setPickerOpen(false); setPickerIsTalis(false); setPickerTalisHost({ slotName: '', index: 0 });
          }}
          items={pickerIsTalis ? (pickerItems || []) : (pickerItems && pickerItems.length ? pickerItems : filteredItems)}
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
      filterCareerLockedOnly={filterCareerLockedOnly}
      setFilterCareerLockedOnly={setFilterCareerLockedOnly}
          isTalis={pickerIsTalis}
      activeCareer={career}
          debugInfo={pickerDebug}
        />
      </div>
    );
  };

  return variant === 'ror' ? renderRor() : variant === 'classic' ? renderClassic() : renderGrid();
}
