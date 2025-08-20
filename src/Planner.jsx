import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { fetchItems, fetchItemDetails, mapCareerEnum, mapCareerEnumDynamic } from './gqlClient';
import schemaLoader from './schemaLoader';
import './Planner.css';
import { getCareers, getDefaultCareer, getRaceForCareer, getCareerIconUrl } from './config';
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
      // rarityClass is applied to the tooltip card so CSS rules like
      // .tooltip-card.rarity-rare .tooltip-name take effect.
      const rarityClass = isSet ? '' : (meta.rarityClass || '');
  const nameClass = isSet ? 'name-set' : '';
  const perRowRarity = isSet ? '' : (meta.rarityClass || '');
      const parts = [];
      if (e.flat) parts.push(`+${e.flat}`);
      if (e.pct) parts.push(`+${Number.isInteger(e.pct) ? e.pct : e.pct.toFixed(2)}%`);
      const val = parts.join(' ');
      return (
        <div key={i} className="talis-line">
          <img className="talis-icon" src={icon} alt="" />
          <span className={`tooltip-name ${perRowRarity} ${nameClass}`}>{src}</span>
          {val ? <span style={{ marginLeft: 6, opacity: 0.9 }}>{val}</span> : null}
        </div>
      );
    });
    return (
      <div className="gear-tooltip">
  <div className={`tooltip-card ${entries.length === 1 ? (sourceMeta[String(entries[0].source || '')]?.rarityClass || '') : ''}`} role="tooltip">
          <div className="tooltip-body" style={{ paddingTop: 6, paddingBottom: 6 }}>{rows}</div>
        </div>
      </div>
    );
  };
  // Apply UI filters to live arrays so they match `visibleItems` behavior
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

// Default per-slot fallback icons when no item is equipped
const DEFAULT_ICON_FALLBACKS = {
  'main hand': 'https://armory.returnofreckoning.com/icon/6',
  'off hand': 'https://armory.returnofreckoning.com/icon/7',
  'ranged weapon': 'https://armory.returnofreckoning.com/icon/8',
  'body': 'https://armory.returnofreckoning.com/icon/9',
  'gloves': 'https://armory.returnofreckoning.com/icon/10',
  'boots': 'https://armory.returnofreckoning.com/icon/11',
  'helm': 'https://armory.returnofreckoning.com/icon/12',
  'shoulders': 'https://armory.returnofreckoning.com/icon/13',
  'cloak': 'https://armory.returnofreckoning.com/icon/16',
  'belt': 'https://armory.returnofreckoning.com/icon/17',
  'jewelry slot 1': 'https://armory.returnofreckoning.com/icon/20',
  'jewelry slot 2': 'https://armory.returnofreckoning.com/icon/20',
  'jewelry slot 3': 'https://armory.returnofreckoning.com/icon/20',
  'jewelry slot 4': 'https://armory.returnofreckoning.com/icon/20',
  'event item': 'https://armory.returnofreckoning.com/icon/20',
  'pocket 1': 'https://armory.returnofreckoning.com/icon/36',
  'pocket 2': 'https://armory.returnofreckoning.com/icon/36',
  'trophy': 'https://armory.returnofreckoning.com/icon/37'
};

function GearSlot({ name, gridArea, item, allItems, iconFallbacks, variant = 'grid', talisCount = 0, talismans = [], onTalisPick, onTalisClear, onItemClear }) {
  const tipClass = `gear-tooltip`;
  const formatTitle = (s) => String(s || '').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  const buildEmptyGearTooltip = () => (
    <div className={`tooltip-card`} role="tooltip">
      <div className="tooltip-header">
  <img className="tooltip-icon" src={iconFallbacks?.[(name || '').trim().toLowerCase()] || EMPTY_ICON} alt="" />
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
  <img className="tooltip-icon" src={iconFallbacks?.[(name || '').trim().toLowerCase()] || EMPTY_ICON} alt="" />
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

function ItemPicker({ open, onClose, items, slotName, onPick, loading, error, filterName, setFilterName, filterStat, setFilterStat, filterRarity, setFilterRarity, filterSetOnly, setFilterSetOnly, isTalis = false, activeCareer, debugInfo = null, careerRank = 0, renownRank = 0 }) {
  if (!open) return null;
  // Normalize naming: internal code historically referenced `career` instead of `activeCareer`
  const career = activeCareer;
  const fmt = (s) => String(s || '').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  const [copied, setCopied] = useState(false);
  const [showJson, setShowJson] = useState(false);
  // Track when we've actually sent a query and are waiting for results
  const [isQuerying, setIsQuerying] = useState(false);
  const isLoading = !!isQuerying;
  const statOptions = useMemo(() => {
    // Try to read Stat enum from runtime schema introspection
    try {
      const enums = schemaLoader.getEnumValues('Stat') || [];
      if (Array.isArray(enums) && enums.length) {
        return enums.map(v => ({ value: v, label: String(v || '').toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }));
      }
    } catch (e) {}
    // Fallback: use local stat order lists and convert to enum-like values
    const all = [...statOrder, ...defenseOrder, ...offenseOrder, ...magicOrder];
    const seen = new Set();
    const out = [];
    for (const s of all) {
      const label = String(s || '');
      const value = String(label || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');
      if (!seen.has(value)) { seen.add(value); out.push({ value, label }); }
    }
    return out;
  }, []);
  // Helper checks for filters
  const hasStats = (it) => {
    const armor = typeof it?.armor === 'number' ? it.armor : (typeof it?.details?.armor === 'number' ? it.details.armor : null);
    const dps = typeof it?.dps === 'number' ? it.dps : (typeof it?.details?.dps === 'number' ? it.details.dps : null);
    const stats = Array.isArray(it?.stats) ? it.stats : (Array.isArray(it?.details?.stats) ? it.details.stats : []);
    return (typeof armor === 'number' && armor > 0) || (typeof dps === 'number' && dps > 0) || (Array.isArray(stats) && stats.length > 0);
  };
  // Career-locked filter removed; server-side career scoping applies in fetchers
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
    const lc = (s) => String(s || '').toLowerCase();
    const statMatches = (it, needle) => {
      if (!needle) return true;
      const stats = Array.isArray(it?.stats) ? it.stats : (Array.isArray(it?.details?.stats) ? it.details.stats : []);
      // needle is expected to be the enum name (e.g., WILLPOWER)
      return stats.some(s => {
        if (!s) return false;
        if (s?.stat && String(s.stat) === String(needle)) return true;
        // fallback: compare normalized stat name strings
        const n = String(s?.stat || s?.name || s?.type || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');
        return n === String(needle).trim().toUpperCase();
      });
    };
    const rarityMatches = (it, wanted) => {
      if (!wanted) return true;
      const r = String(it?.rarity || it?.details?.rarity || '').toUpperCase();
      return r === String(wanted).toUpperCase();
    };
    const nameMatches = (it, needle) => {
      if (!needle) return true;
      return lc(it?.name).includes(lc(needle));
    };
    return items
      // UI: filter by set-only when enabled (items only)
      .filter(it => {
        if (isTalis || !filterSetOnly) return true;
        const top = it?.itemSet?.name;
        const detSet = it?.details?.set?.name || it?.details?.itemSet?.name;
        return !!(top || detSet);
      })
      // UI: name filter always applies to currently visible list
      .filter(it => nameMatches(it, filterName))
      // UI: stat filter always applies
      .filter(it => statMatches(it, filterStat))
      // UI: rarity filter always applies
      .filter(it => rarityMatches(it, filterRarity))
      // Always enforce stats-present for both items and talismans
      .filter(it => hasStats(it))
      // Always hide vanity/admin-like items for non-talisman lists
      .filter(it => isTalis ? true : !isVanity(it));
  }, [items, isTalis, filterSetOnly, filterName, filterStat, filterRarity, activeCareer]);
  // Reusable UI filter for arrays (applies same rules as `visibleItems`)
  function applyUiFilters(arr) {
    if (!Array.isArray(arr)) return [];
    const lc = (s) => String(s || '').toLowerCase();
    const statMatches = (it, needle) => {
      if (!needle) return true;
      const stats = Array.isArray(it?.stats) ? it.stats : (Array.isArray(it?.details?.stats) ? it.details.stats : []);
      return stats.some(s => {
        if (!s) return false;
        if (s?.stat && String(s.stat) === String(needle)) return true;
        const n = String(s?.stat || s?.name || s?.type || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');
        return n === String(needle).trim().toUpperCase();
      });
    };
    const rarityMatches = (it, wanted) => {
      if (!wanted) return true;
      const r = String(it?.rarity || it?.details?.rarity || '').toUpperCase();
      return r === String(wanted).toUpperCase();
    };
    const nameMatches = (it, needle) => {
      if (!needle) return true;
      return lc(it?.name).includes(lc(needle));
    };
    return arr
      .filter(it => {
        if (isTalis || !filterSetOnly) return true;
        const top = it?.itemSet?.name;
        const detSet = it?.details?.set?.name || it?.details?.itemSet?.name;
        return !!(top || detSet);
      })
      .filter(it => nameMatches(it, filterName))
      .filter(it => statMatches(it, filterStat))
      .filter(it => rarityMatches(it, filterRarity))
      .filter(it => hasStats(it))
      .filter(it => isTalis ? true : !isVanity(it));
  }
  const exportQuery = useMemo(() => {
    const q = { ...(debugInfo || {}) };
    // Ensure filters reflect current UI state (server snapshot may be stale)
    q.filters = {
      name: filterName || '',
      stat: filterStat || '',
      rarity: filterRarity || '',
      setOnly: !!filterSetOnly,
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
  }, [debugInfo, filterName, filterStat, filterRarity, filterSetOnly, slotName, isTalis, activeCareer, visibleItems]);
  const exportPayload = useMemo(() => ({ query: exportQuery, results: visibleItems }), [exportQuery, visibleItems]);
  const exportText = useMemo(() => {
    try { return JSON.stringify(exportPayload, null, 2); } catch { return '// Failed to stringify export payload'; }
  }, [exportPayload]);
  // Live pagination state (no-caching mode)
  const [liveHasNext, setLiveHasNext] = useState(false);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveItems, setLiveItems] = useState([]);
  const liveCursorsRef = useRef({}); // per-slot cursors: { SLOT_ENUM: cursor|null }
  const [lastQuery, setLastQuery] = useState(null);
  const [lastResponseSummary, setLastResponseSummary] = useState(null);
  // Indicates we've attempted at least one server query for this open picker
  const [hasQueried, setHasQueried] = useState(false);
  // Per-open full-slot fetch + client-side paging
  const [liveAllItems, setLiveAllItems] = useState([]);
  const [pageIndex, setPageIndex] = useState(0);
  const PAGE_SIZE = 10;

  // Dev logging: print server/debug info and live results when picker opens
  useEffect(() => {
    if (!open) return;
    try {
      if (import.meta && import.meta.env && import.meta.env.DEV) {
        console.debug('[ItemPicker] open', { slotName, activeCareer, debugInfo, liveCount: (liveItems || []).length });
      }
    } catch {}
  }, [open, slotName, activeCareer, debugInfo, liveItems]);

  const resetLive = () => {
    liveCursorsRef.current = {};
    setLiveItems([]);
    setLiveHasNext(false);
    setLiveLoading(false);
  setHasQueried(false);
  setIsQuerying(false);
  };

  const fetchNextLivePage = async () => {
    // Require a selected career (UI string) before fetching pages
    if (!career) return;
  setLiveLoading(true);
  setIsQuerying(true);
    try {
      const normalize = (s) => (s || '').trim().toLowerCase();
      const target = normalize(slotName || '');
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
        if (target === 'pocket 1' || target === 'pocket 2') return ['POCKET1','POCKET2'];
        if (/^jewelry slot (\d)$/.test(target)) {
          const n = Number(target.slice(-1));
          const arr = ['JEWELLERY1'];
          if (n >= 2 && n <= 4) arr.push(`JEWELLERY${n}`);
          return arr;
        }
        return [];
      })();
          const pageSize = 10; 
      const accum = [];
      const seen = new Set();
      let anyHasNext = false;

      for (const sv of slotVariants) {
        const after = liveCursorsRef.current[sv] || undefined;
        // Build variables for debugging
            const vars = { first: pageSize, after, slotEq: sv, nameContains: filterName || undefined, rarityEq: filterRarity || undefined, order: [{ itemLevel: 'DESC' }] }; 
            setLastQuery(vars);
        if (import.meta && import.meta.env && import.meta.env.DEV) console.debug('[Picker] fetchItemsPage vars', vars, 'career=', career);
  // Ask the server to return items usable by the selected career so results are authoritative.
  // Include level/renown caps so server-side filtering reduces noise.
  const res = await fetchItemsPage({ ...vars, career, maxLevelRequirement: careerRank, maxRenownRankRequirement: renownRank });
        if (import.meta && import.meta.env && import.meta.env.DEV) console.debug('[Picker] fetchItemsPage response', sv, 'nodes=', (res.nodes || []).length, (res.nodes || []).slice(0,5).map(n => n?.id));
        for (const n of (res.nodes || [])) {
          const id = String(n?.id || '');
          if (!id || seen.has(id)) continue;
          // Server returned only items usable by the selected career (or agnostic items per server logic);
          // don't apply careerRestriction checks here so results remain authoritative from the server.
          // Enforce career rank (levelRequirement) and renown caps client-side
          const lvlReq = Number(n?.levelRequirement || n?.details?.levelRequirement || 0) || 0;
          if (lvlReq && lvlReq > careerRank) continue;
          const rrReq = Number(n?.renownRankRequirement || n?.details?.renownRankRequirement || n?.details?.renownRank || 0) || 0;
          if (rrReq && rrReq > renownRank) continue;
          seen.add(id);
          accum.push(n);
          if (accum.length >= pageSize) break;
        }
        if (res.pageInfo && res.pageInfo.hasNextPage) {
          anyHasNext = true;
          liveCursorsRef.current[sv] = res.pageInfo.endCursor || liveCursorsRef.current[sv] || null;
        } else {
          liveCursorsRef.current[sv] = null;
        }
        if (accum.length >= pageSize) break;
      }

      // Sort by itemLevel desc, then rarity order as tiebreaker
      const rarOrder = ['UTILITY','COMMON','UNCOMMON','RARE','VERY_RARE','MYTHIC'];
      accum.sort((a,b) => {
        const ilA = Number(a?.itemLevel || a?.details?.itemLevel || 0);
        const ilB = Number(b?.itemLevel || b?.details?.itemLevel || 0);
        if (ilA !== ilB) return ilB - ilA;
        const ra = rarOrder.indexOf(String(a?.rarity || a?.details?.rarity || '').toUpperCase());
        const rb = rarOrder.indexOf(String(b?.rarity || b?.details?.rarity || '').toUpperCase());
        return rb - ra;
      });
      const newItems = accum.slice(0, pageSize);
      setLiveItems(prev => [...(Array.isArray(prev) ? prev : []), ...newItems]);
      // anyHasNext true OR any cursor still non-null implies more pages
      const anyCursorRemaining = Object.values(liveCursorsRef.current).some(v => v);
      setLiveHasNext(anyHasNext || anyCursorRemaining);
    } catch (err) {
      // ignore
    } finally {
      setLiveLoading(false);
      setIsQuerying(false);
      setHasQueried(true);
    }
  };
  // Reset live results when controlling inputs change
  useEffect(() => {
    resetLive();
  }, [slotName, filterName, filterStat, filterRarity, isTalis, activeCareer]);

  // Auto-fetch first page when opened
  useEffect(() => {
    if (open && (!liveItems || liveItems.length === 0)) {
      // fire-and-forget
      fetchNextLivePage();
    }
  }, [open]);

  // When picker opens, fetch full slot list once (per-open), then compute pages
  useEffect(() => {
    let ignore = false;
    async function loadFullSlot() {
      if (!open) return;
      // require career selected
      if (!activeCareer) return;
  // mark that we haven't queried yet for this open session
  setHasQueried(false);
  setIsQuerying(true);
  setLiveAllItems([]);
  setPageIndex(0);
  setLiveLoading(true);
      try {
        const normalize = (s) => (s || '').trim().toLowerCase();
        const target = normalize(slotName || '');
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
          if (target === 'pocket 1' || target === 'pocket 2') return ['POCKET1','POCKET2'];
          if (/^jewelry slot (\d)$/.test(target)) {
            const n = Number(target.slice(-1));
            const arr = ['JEWELLERY1'];
            if (n >= 2 && n <= 4) arr.push(`JEWELLERY${n}`);
            return arr;
          }
          return [];
        })();
        const byId = new Map();
        const defaultOrder = [{ itemLevel: 'DESC' }];
        for (const sv of slotVariants) {
          try {
            const vars = { slotEq: sv, perPage: 50, totalLimit: 1000, allowAnyName: !filterName, nameContains: filterName || undefined, rarityEq: filterRarity || undefined, maxLevelRequirement: careerRank, maxRenownRankRequirement: renownRank, career: activeCareer, order: defaultOrder };
            setLastQuery(vars);
            const arr = await fetchItems({ career: activeCareer, perPage: vars.perPage, totalLimit: vars.totalLimit, slotEq: sv, allowAnyName: vars.allowAnyName, nameContains: vars.nameContains, rarityEq: vars.rarityEq, maxLevelRequirement: vars.maxLevelRequirement, maxRenownRankRequirement: vars.maxRenownRankRequirement, order: vars.order });
            setLastResponseSummary({ slotVariant: sv, nodes: (arr || []).length });
            for (const n of (arr || [])) byId.set(String(n.id), n);
          } catch (e) {
            // ignore per-variant errors
          }
        }
        // Merge, filter by careerRestriction and caps, sort by itemLevel desc
        const all = Array.from(byId.values()).filter(n => {
          // Rely on server-side usableByCareer filtering; only enforce level/renown caps here.
          const lvlReq = Number(n?.levelRequirement || n?.details?.levelRequirement || 0) || 0;
          if (lvlReq && lvlReq > careerRank) return false;
          const rrReq = Number(n?.renownRankRequirement || n?.details?.renownRankRequirement || n?.details?.renownRank || 0) || 0;
          if (rrReq && rrReq > renownRank) return false;
          return true;
        }).sort((a,b) => {
          const ilA = Number(a?.itemLevel || a?.details?.itemLevel || 0);
          const ilB = Number(b?.itemLevel || b?.details?.itemLevel || 0);
          if (ilA !== ilB) return ilB - ilA;
          const rarOrder = ['UTILITY','COMMON','UNCOMMON','RARE','VERY_RARE','MYTHIC'];
          const ra = rarOrder.indexOf(String(a?.rarity || a?.details?.rarity || '').toUpperCase());
          const rb = rarOrder.indexOf(String(b?.rarity || b?.details?.rarity || '').toUpperCase());
          return rb - ra;
        });
        if (!ignore) {
          setLiveAllItems(all);
          setPageIndex(0);
          setLiveHasNext(all.length > PAGE_SIZE);
        }
      } catch (e) {
        if (!ignore) setLiveAllItems([]);
      } finally {
        if (!ignore) {
          setLiveLoading(false);
          setIsQuerying(false);
          setHasQueried(true);
        }
      }
    }
    loadFullSlot();
    return () => { ignore = true; };
  }, [open, slotName, filterName, filterRarity, activeCareer, careerRank, renownRank]);
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
              { (isLoading || liveLoading) && <div>Loading…</div>}
              {error && <div style={{ color: 'crimson' }}>Failed to load items. {(error?.message || '').toString()}</div>}
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
  // Apply UI filters to live arrays so they match `visibleItems` behavior
  const displayedLiveAll = applyUiFilters(liveAllItems || []);
  const displayedLive = applyUiFilters(liveItems || []);
  // Ensure we have the next page loaded (one extra page) so we can determine if the current page is last
  const ensureExtraPage = async (currentPageIndex) => {
    try {
      // We need at least one item beyond the end of the next page to be sure there's more.
      const needed = (currentPageIndex + 1) * PAGE_SIZE + 1; // items required to know whether next page has any items
      if (Array.isArray(liveAllItems) && liveAllItems.length >= needed) return;
      if (!activeCareer) return; // can't fetch without career
      setLiveLoading(true);
      setIsQuerying(true);
      const normalize = (s) => (s || '').trim().toLowerCase();
      const target = normalize(slotName || '');
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
        if (target === 'pocket 1' || target === 'pocket 2') return ['POCKET1','POCKET2'];
        if (/^jewelry slot (\d)$/.test(target)) {
          const n = Number(target.slice(-1));
          const arr = ['JEWELLERY1'];
          if (n >= 2 && n <= 4) arr.push(`JEWELLERY${n}`);
          return arr;
        }
        return [];
      })();
  // Start from existing map to avoid duplicates
      const byId = new Map();
      for (const it of Array.isArray(liveAllItems) ? liveAllItems : []) byId.set(String(it?.id || ''), it);
      const defaultOrder = [{ itemLevel: 'DESC' }];
      for (const sv of slotVariants) {
        try {
          const perPage = PAGE_SIZE;
          const totalLimit = needed; // ask server for enough items to cover pages
          const vars = { slotEq: sv, perPage, totalLimit, allowAnyName: !filterName, nameContains: filterName || undefined, rarityEq: filterRarity || undefined, maxLevelRequirement: careerRank, maxRenownRankRequirement: renownRank, career: activeCareer, order: defaultOrder };
          setLastQuery(vars);
          const arr = await fetchItems({ career: activeCareer, perPage: vars.perPage, totalLimit: vars.totalLimit, slotEq: sv, allowAnyName: vars.allowAnyName, nameContains: vars.nameContains, rarityEq: vars.rarityEq, maxLevelRequirement: vars.maxLevelRequirement, maxRenownRankRequirement: vars.maxRenownRankRequirement, order: vars.order });
          setLastResponseSummary({ slotVariant: sv, nodes: (arr || []).length });
          for (const n of (arr || [])) {
            if (!n || !n.id) continue;
            const id = String(n.id);
            if (!byId.has(id)) byId.set(id, n);
          }
        } catch (e) {
          // ignore per-variant errors
        }
      }
      const all = Array.from(byId.values()).filter(n => {
        // Rely on server-side usableByCareer filtering; only enforce level/renown caps here.
        const lvlReq = Number(n?.levelRequirement || n?.details?.levelRequirement || 0) || 0;
        if (lvlReq && lvlReq > careerRank) return false;
        const rrReq = Number(n?.renownRankRequirement || n?.details?.renownRankRequirement || n?.details?.renownRank || 0) || 0;
        if (rrReq && rrReq > renownRank) return false;
        return true;
      }).sort((a,b) => {
        const ilA = Number(a?.itemLevel || a?.details?.itemLevel || 0);
        const ilB = Number(b?.itemLevel || b?.details?.itemLevel || 0);
        if (ilA !== ilB) return ilB - ilA;
        const rarOrder = ['UTILITY','COMMON','UNCOMMON','RARE','VERY_RARE','MYTHIC'];
        const ra = rarOrder.indexOf(String(a?.rarity || a?.details?.rarity || '').toUpperCase());
        const rb = rarOrder.indexOf(String(b?.rarity || b?.details?.rarity || '').toUpperCase());
        return rb - ra;
      });
      setLiveAllItems(all);
      // There is a next page if we have more items than the end of the next page
      const hasNext = all.length > ((currentPageIndex + 1) * PAGE_SIZE);
      setLiveHasNext(hasNext);
      return hasNext;
    } catch (e) {
      // ignore
      return false;
    } finally {
      setLiveLoading(false);
      setIsQuerying(false);
      setHasQueried(true);
    }
  };

  // Keep pageIndex within bounds if the source list shrinks
  useEffect(() => {
    try {
      const srcLen = (displayedLiveAll && displayedLiveAll.length > 0) ? displayedLiveAll.length : ((displayedLive && displayedLive.length > 0) ? displayedLive.length : (visibleItems ? visibleItems.length : 0));
      const maxIndex = Math.max(0, Math.floor((Math.max(0, srcLen - 1)) / PAGE_SIZE));
      if (pageIndex > maxIndex) setPageIndex(maxIndex);
    } catch (e) {}
  }, [(displayedLiveAll || []).length, (displayedLive || []).length, (visibleItems || []).length]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Select Item for {slotName}</div>
          <div style={{ marginLeft: 12, fontSize: 12, opacity: 0.85 }}>
      {((displayedLiveAll && displayedLiveAll.length) || (displayedLive && displayedLive.length) || (items && items.length)) ? (
        <span>Results: {(displayedLiveAll && displayedLiveAll.length) ? displayedLiveAll.length : ((displayedLive && displayedLive.length) ? displayedLive.length : (items ? items.length : 0))}{(liveHasNext || (displayedLiveAll && displayedLiveAll.length > PAGE_SIZE)) ? ' (more)' : ''}</span>
  ) : null }
          </div>
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
                <option key={s.value} value={s.value}>{s.label}</option>
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
              </>
            )}
            <button onClick={() => { setFilterName(''); setFilterStat(''); setFilterRarity(''); setFilterSetOnly(false); }}>Clear</button>
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
          {isLoading && <div>Loading…</div>}
          {error && <div style={{ color: 'crimson' }}>Failed to load items. {(error?.message || '').toString()}</div>}
          {!loading && !error && hasQueried && ((items && items.length === 0) && (!(displayedLive && displayedLive.length) && !(displayedLiveAll && displayedLiveAll.length))) && (
            <div>No items found.</div>
          )}
          {!loading && !error && hasQueried && ((items && items.length > 0 && visibleItems.length === 0) && (!(displayedLive && displayedLive.length) && !(displayedLiveAll && displayedLiveAll.length))) && (
            <div>No items match your filters.</div>
          )}
          {/* prefer liveItems when present (no-caching paginated mode), otherwise fall back to client-provided items */}
    {!loading && !error && ((displayedLiveAll && displayedLiveAll.length > 0) || (displayedLive && displayedLive.length > 0) || (items && items.length > 0 && visibleItems.length > 0)) && (
  <div className="item-list">
          {((displayedLiveAll && displayedLiveAll.length > 0) ? (displayedLiveAll.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE)) : (displayedLive && displayedLive.length > 0 ? displayedLive : visibleItems)).map((it) => {
                const icon = it.iconUrl || it?.details?.iconUrl || (it?.details?.iconId ? `https://armory.returnofreckoning.com/item/${it.details.iconId}` : EMPTY_ICON);
    const isSet = !!(it?.itemSet?.name || it?.details?.set?.name || it?.details?.itemSet?.name);
    const rarityClass = isSet ? 'name-set' : (String(it?.rarity || '').toLowerCase() ? `rarity-${String(it?.rarity || '').toLowerCase()}` : '');
    // Item level
    const itemLevel = Number(it?.itemLevel || it?.details?.itemLevel || 0) || null;
    // For talismans, compute full stat bonuses like "+24 Willpower, +2% Magic Power"
    let talisStatText = '';
    if (isTalis) {
      const stats = Array.isArray(it?.stats) ? it.stats : (Array.isArray(it?.details?.stats) ? it.details.stats : []);
      const parts = (stats || [])
        .filter(s => typeof s?.value === 'number' && s.value !== 0)
        .map(s => {
          const unit = (s?.percentage || s?.unit === '%') ? '%' : '';
          const statName = fmt(s?.stat || s?.name || s?.type || '');
          return `+${s.value}${unit ? unit : ''} ${statName}`.trim();
        });
      talisStatText = parts.join(', ');
    }
    // If a stat filter is active for non-talis items, try to extract that stat's value
    let filteredStatText = '';
    if (!isTalis && filterStat) {
      const stats = Array.isArray(it?.stats) ? it.stats : (Array.isArray(it?.details?.stats) ? it.details.stats : []);
      const needle = String(filterStat || '').toLowerCase();
      for (const s of (stats || [])) {
        const name = String(s?.stat || s?.name || s?.type || '').toLowerCase();
        if (!name) continue;
        if (name.includes(needle) || needle.includes(name)) {
          const unit = (s?.percentage || s?.unit === '%') ? '%' : '';
          const statName = fmt(s?.stat || s?.name || s?.type || '');
          if (typeof s?.value === 'number') {
            filteredStatText = `+${s.value}${unit ? unit : ''} ${statName}`.trim();
          }
          break;
        }
      }
    }
        return (
                  <button key={it.id} className="item-row" onClick={() => onPick(it)}>
                    <span className="item-left">
                      <img className="item-icon" src={icon} alt="" />
          <span className={`item-name ${rarityClass}`}>{it.name}</span>
          <span className="item-meta">
    {/* Always show item level */}
    {itemLevel ? <span className="meta-il">IL {itemLevel}</span> : null}
    {/* For talismans show full stat text, otherwise show filtered stat if present */}
    {isTalis && talisStatText ? <span className="meta-stat">{talisStatText}</span> : null}
    {!isTalis && filteredStatText ? <span className="meta-stat">{filteredStatText}</span> : null}
          </span>
                    </span>
                    <span className="item-slot">{fmt(it.slot || '')}</span>
            {renderTooltip(it)}
                  </button>
                );
                })}
            </div>
          )}
              {/* Pagination controls */}
              {(!loading && !error) && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 8, gap: 8 }}>
                  <button disabled={pageIndex <= 0} onClick={() => { setPageIndex(0); }}>First</button>
                  <button disabled={pageIndex <= 0} onClick={() => { setPageIndex(p => Math.max(0, p - 1)); }}>Back</button>
                  <span style={{ alignSelf: 'center' }}>{`Page ${pageIndex + 1}`}</span>
                  <button disabled={!( (displayedLiveAll && ((pageIndex + 1) * PAGE_SIZE < displayedLiveAll.length)) || ((displayedLive && displayedLive.length > 0 && ((pageIndex + 1) * PAGE_SIZE < displayedLive.length))) || (visibleItems && visibleItems.length > 0 && ((pageIndex + 1) * PAGE_SIZE < visibleItems.length)) )} onClick={async () => { 
                    // Ensure next page is loaded (fetch one extra page) so we can detect if it's the last
                    const hasNext = await ensureExtraPage(pageIndex);
                    // Advance page only if the source list has items for that page
                    const srcLen = (displayedLiveAll && displayedLiveAll.length > 0) ? displayedLiveAll.length : ((displayedLive && displayedLive.length > 0) ? displayedLive.length : (visibleItems ? visibleItems.length : 0));
                    if (hasNext || (srcLen > ((pageIndex + 1) * PAGE_SIZE))) setPageIndex(p => p + 1);
                  }}>Next</button>
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
  // Career-locked filter removed; server-side filtering is authoritative
  // Stats-only and Hide vanity are now always-on for items (not talismans), so no state
  // Apply sensible defaults for item picker filters only once per session
  const [itemFilterDefaultsApplied, setItemFilterDefaultsApplied] = useState(false);
  // Remember last-used filters separately for item and talisman pickers
  const [lastItemFilters, setLastItemFilters] = useState({ name: '', stat: '', rarity: '', setOnly: false });
  const [lastTalisFilters, setLastTalisFilters] = useState({ name: '', stat: '', rarity: '' });
  // Max caps removed; default filtering uses current Career Rank and Renown Rank
  const [equipped, setEquipped] = useState({}); // { [slotDisplayName]: item }
  const [iconFallbacks] = useState(DEFAULT_ICON_FALLBACKS); // use per-slot fallbacks
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
    return key ? (getRaceForCareer(key) || null) : null;
  }, [career]);

  // Ensure a sensible default career is selected on first mount so pickers fetch live results
  // NOTE: Do not auto-select a career on mount. User must choose a career explicitly before
  // pickers may open. This prevents accidental queries and matches UX requirement.
  // No client-side item caches: pickers fetch live from GraphQL only
  // Keep inert refs/helpers for compatibility with older code paths (they are no-ops)
  const itemPickerCacheRef = useRef(new Map());
  const talisPickerCacheRef = useRef(new Map());
  const slotBaseCacheRef = useRef(new Map());
  const [cachedItemCount, setCachedItemCount] = useState(0);
  const [cachedTalisCount, setCachedTalisCount] = useState(0);
  const recalcCacheCount = () => { try { setCachedItemCount(0); setCachedTalisCount(0); } catch {} };
  const setItemCache = () => {};
  const setTalisCache = () => {};
  const setSlotBaseCache = () => {};
  const [isPrecaching, setIsPrecaching] = useState(false);
  const precacheOpsRef = useRef(0);
  const incPrecache = () => {};
  const decPrecache = () => {};
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
  // No precaching or cache indicators; live-only mode

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
      // Prefer the armory icon image endpoint when an iconId is available.
      const i = (it?.details?.iconId || it?.iconId) ? `https://armory.returnofreckoning.com/icon/${it.details?.iconId || it.iconId}`
        : (it?.details?.iconUrl || it?.iconUrl || EMPTY_ICON);
      add(it.name, i, it?.details?.rarity || it?.rarity);
      const hostTal = talismans?.[hostName] || [];
      const maxTal = Number(it?.details?.talismanSlots || 0) || 0;
      for (let idx = 0; idx < Math.min(hostTal.length, maxTal); idx++) {
        const t = hostTal[idx];
        if (!t) continue;
        const ti = (t?.details?.iconId || t?.iconId) ? `https://armory.returnofreckoning.com/icon/${t.details?.iconId || t.iconId}`
          : (t?.details?.iconUrl || t?.iconUrl || EMPTY_ICON);
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

  // Concurrency tuning for prefetchers (configurable via env; falls back to hardwareConcurrency)
  const hwc = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) ? navigator.hardwareConcurrency : 8;
  // Feature flag: disable precache/prefetch since pickers are live-only now
  const ENABLE_PRECACHE = false;
  const PREFETCH_SLOT_CONC = (() => {
    const v = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_PRECACHE_ITEMS_CONC) ? Number(import.meta.env.VITE_PRECACHE_ITEMS_CONC) : NaN;
    if (!Number.isNaN(v) && v > 0) return Math.floor(v);
    return Math.max(4, Math.min(8, hwc));
  })();
  const PREFETCH_TALIS_CONC = (() => {
    const v = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_PRECACHE_TALIS_CONC) ? Number(import.meta.env.VITE_PRECACHE_TALIS_CONC) : NaN;
    if (!Number.isNaN(v) && v > 0) return Math.floor(v);
    return Math.max(2, Math.floor(PREFETCH_SLOT_CONC / 2));
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
  // Per-slot prefetchers: top 25 by item level per slot for the active career
  useEffect(() => {
  let cancelled = false;
  if (!ENABLE_PRECACHE) return () => { cancelled = true; };
  if (!career || pickerOpen) return;
    let startTimer = null;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const runQueue = async (tasks, limit = PREFETCH_SLOT_CONC) => {
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
    const friendlyToEnums = (target) => {
      const t = (target || '').trim().toLowerCase();
      if (t === 'helm') return ['HELM'];
      if (t === 'shoulders') return ['SHOULDER'];
      if (t === 'cloak') return ['BACK'];
      if (t === 'body') return ['BODY'];
      if (t === 'gloves') return ['GLOVES'];
      if (t === 'belt') return ['BELT'];
      if (t === 'boots') return ['BOOTS'];
  // GraphQL schema EquipSlot has no TWO_HAND; two-handed weapons are represented as MAIN_HAND
  if (t === 'main hand') return ['MAIN_HAND','EITHER_HAND'];
      if (t === 'off hand') return ['OFF_HAND','EITHER_HAND'];
      if (t === 'ranged weapon') return ['RANGED_WEAPON'];
      if (t === 'event item') return ['EVENT'];
      if (t === 'pocket 1' || t === 'pocket 2') return ['POCKET1','POCKET2'];
      if (/^jewelry slot (\d)$/.test(t)) {
        const n = Number(t.slice(-1));
        const arr = ['JEWELLERY1'];
        if (n >= 2 && n <= 4) arr.push(`JEWELLERY${n}`);
        return arr;
      }
      return [];
    };
  const order = [{ itemLevel: 'DESC' }];
  const targets = slots.map(s => s.name);
  const normKeyTarget = (s) => (String(s || '').trim().toLowerCase().replaceAll('jewellry', 'jewelry'));
  const mkKey = (target) => JSON.stringify({ picker: 'slot-base', career, careerRank, renownRank, target: normKeyTarget(target) });
    const careerEnumPromise = mapCareerEnumDynamic(career);
    const prefetchOne = (target) => async () => {
      const key = mkKey(target);
      const hit = slotBaseCacheRef.current.get(key);
      if (hit && Array.isArray(hit.base) && hit.base.length) return;
      if (hit && hit.inFlight) { try { await hit.inFlight; } catch {} return; }
      const enums = friendlyToEnums(target);
      if (!enums.length) return;
      const careerEnum = await careerEnumPromise;
      const byId = new Map();
      const run = async () => {
        for (const sv of enums) {
          if (cancelled) break;
          try {
            const arr = await fetchItems({ career: careerEnum, perPage: 50, totalLimit: 200, slotEq: sv, allowAnyName: true, maxLevelRequirement: careerRank, maxRenownRankRequirement: renownRank, order });
            for (const n of (arr || [])) {
              // race restriction enforcement; if no activeRace, safe-allow
              const races = Array.isArray(n?.raceRestriction) ? n.raceRestriction : (Array.isArray(n?.details?.raceRestriction) ? n.details.raceRestriction : []);
              if (Array.isArray(races) && races.length) {
                if (activeRace && !races.map(String).map(s => s.toUpperCase()).includes(String(activeRace).toUpperCase())) continue;
              }
              if (!hasStats(n) || isVanity(n)) continue;
              const reqLvlNum = Number(n?.levelRequirement || n?.details?.levelRequirement || 0);
              const reqRRNum = Number(n?.renownRankRequirement || n?.details?.renownRankRequirement || 0);
              if (reqLvlNum > careerRank || reqRRNum > renownRank) continue;
              byId.set(String(n.id), n);
              if (byId.size >= 25) break;
            }
          } catch {}
          if (byId.size >= 25) break;
        }
        return Array.from(byId.values()).sort(sortByLevelRarity).slice(0, 25);
      };
      const p = run().then((base) => { setSlotBaseCache(key, { base, ts: Date.now(), inFlight: null }); }).catch(() => {});
      setSlotBaseCache(key, { base: hit?.base || [], ts: hit?.ts || 0, inFlight: p });
      await p;
    };
    incPrecache();
    startTimer = setTimeout(async () => {
      try {
        const tasks = targets.map(t => prefetchOne(t));
        await runQueue(tasks, PREFETCH_SLOT_CONC);
      } finally { decPrecache(); }
    }, 120);
    return () => { cancelled = true; if (startTimer) clearTimeout(startTimer); };
  }, [career, careerRank, renownRank, pickerOpen, activeRace]);

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
        setLastItemFilters({ name: filterName, stat: filterStat, rarity: filterRarity, setOnly: filterSetOnly });
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
  // Live-only mode: no talisman precache performed here; picker will fetch live results
  // Decide loading state based on cache availability for the to-be-restored filters
  const rarityKey = String(lastTalisFilters.rarity || '');
  const keyExact = JSON.stringify({ picker: 'talis-base', rarity: rarityKey });
  const keyAll = JSON.stringify({ picker: 'talis-base', rarity: '' });
  const hasCached = talisPickerCacheRef.current.has(keyExact) || talisPickerCacheRef.current.has(keyAll);
  if (!hasCached) setPickerLoading(true);
    // Restore last talisman filters
    setFilterName(lastTalisFilters.name || '');
    setFilterStat(lastTalisFilters.stat || '');
    setFilterRarity(lastTalisFilters.rarity || '');
    setFilterSetOnly(false);
      if (!career) {
        setPickerDebug({ slotName: `Talisman ${i + 1}`, notes: ['select-career-first'] });
        return;
      }
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
      if (!career) {
        setPickerItems([]);
        setPickerLoading(false);
        setPickerDebug({ slotName: pickerSlot, isTalis: !!pickerIsTalis, notes: ['no-career-selected'] });
        return;
      }
  // Live GraphQL enabled even on GitHub Pages; ensure endpoint allows CORS
      try {
        // Collect debug context for export
  const debug = {
          careerUi: career,
          careerRank,
          renownRank,
          slotName: pickerSlot,
          isTalis: !!pickerIsTalis,
          filters: { name: filterName, stat: filterStat, rarity: filterRarity, setOnly: filterSetOnly },
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
          const hostKey = JSON.stringify({ picker: 'talis-host', hostIlvl });
          let talisHostHit = hostIlvl ? talisPickerCacheRef.current.get(hostKey) : null;
          // If host cache is missing or empty, briefly wait for the in-flight prefetch to complete
          if (!talisHostHit || !Array.isArray(talisHostHit.base) || talisHostHit.base.length === 0) {
            const start = Date.now();
            // Show loading spinner while we wait
            setPickerLoading(true);
            while (!ignore && Date.now() - start < 1800) {
              const cur = talisPickerCacheRef.current.get(hostKey);
              if (Array.isArray(cur?.base) && cur.base.length > 0) { talisHostHit = cur; break; }
              if (cur?.inFlight && typeof cur.inFlight.then === 'function') {
                try { await cur.inFlight; } catch {}
              } else {
                await new Promise(r => setTimeout(r, 100));
              }
            }
          }
          if (talisHostHit && Array.isArray(talisHostHit.base)) {
            const base = talisHostHit.base;
            let final = base
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
              .sort(sortByLevelRarity);
            if (!ignore) {
              setPickerItems(final);
              setPickerDebug({ ...debug, cached: true, notes: [...(debug.notes||[]), 'talis-host-cache-hit'], final: { finalCount: final.length } });
              setPickerLoading(false);
            }
            return;
          }
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
            // Keep UI responsive: if we got here, host cache didn't arrive in time
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
        // Try per-slot base cache first (prefetched or seeded previously)
        const slotKey = JSON.stringify({ picker: 'slot-base', career, careerRank, renownRank, target });
        let slotHit = slotBaseCacheRef.current.get(slotKey);
        if (slotHit && Array.isArray(slotHit.base) && !filterName) {
          const base = slotHit.base;
          const equippedEntries = Object.entries(equipped || {});
          const uniqueIsEquippedElsewhere = (id) => equippedEntries.some(([slotName, it]) => it && String(it.id) === String(id) && slotName !== pickerSlot);
          let items = base
            .filter((n) => !(n?.uniqueEquipped && uniqueIsEquippedElsewhere(n.id)))
            // Enforce race restriction if present
            .filter((n) => matchesRace(n));
          if (!ignore) {
            setPickerItems(items);
            setPickerDebug({ ...debug, cached: true, notes: [...(debug.notes||[]), 'slot-base-cache-hit'], final: { finalCount: items.length } });
            setPickerLoading(false);
          }
          return;
        }
        // If no name filter and nothing cached, wait briefly for prefetch to land (or an inFlight to resolve)
        if (!filterName) {
          // If a prefetch is in-flight for this slot, await it once
          if (slotHit && slotHit.inFlight && typeof slotHit.inFlight.then === 'function') {
            try {
              setPickerLoading(true);
              await slotHit.inFlight;
              slotHit = slotBaseCacheRef.current.get(slotKey);
            } catch { /* fall through */ }
          }
          // If still no base, poll up to ~2s for the cache to fill
          if (!slotHit || !Array.isArray(slotHit.base) || slotHit.base.length === 0) {
            setPickerLoading(true);
            const t0 = Date.now();
            while (!ignore && Date.now() - t0 < 2000) {
              await new Promise(r => setTimeout(r, 100));
              slotHit = slotBaseCacheRef.current.get(slotKey);
              if (slotHit && Array.isArray(slotHit.base) && slotHit.base.length) break;
            }
          }
          if (slotHit && Array.isArray(slotHit.base) && slotHit.base.length) {
            const base = slotHit.base;
            const equippedEntries = Object.entries(equipped || {});
            const uniqueIsEquippedElsewhere = (id) => equippedEntries.some(([slotName, it]) => it && String(it.id) === String(id) && slotName !== pickerSlot);
            let items = base
              .filter((n) => !(n?.uniqueEquipped && uniqueIsEquippedElsewhere(n.id)))
              .filter((n) => matchesRace(n));
            if (!ignore) {
              setPickerItems(items);
              setPickerDebug({ ...debug, cached: true, notes: [...(debug.notes||[]), 'slot-base-cache-waited'], final: { finalCount: items.length } });
              setPickerLoading(false);
            }
            return;
          }
          // Fall back to empty if cache didn’t arrive in time
          if (!ignore) {
            setPickerLoading(false);
            setPickerDebug({ ...debug, cached: true, notes: [...(debug.notes||[]), 'cache-wait-timeout-no-name'] });
          }
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
            slotsToTry.map(async s => fetchItems({ perPage: 50, totalLimit: 500, slotEq: s, allowAnyName: !filterName, nameContains: filterName || undefined, rarityEq: filterRarity || undefined, maxLevelRequirement: careerRank, maxRenownRankRequirement: renownRank, order: defaultOrder }))
          );
          const byId = new Map();
          for (const r of withCareerSettled) {
            if (r.status === 'fulfilled') {
              for (const it of (r.value || [])) byId.set(String(it.id), it);
            }
          }
          itemsRawCareer = Array.from(byId.values());
          // live-only mode: no client-side cache merging
        } else {
    // Ask server for exact slot (name search only); base lists should come from slot prefetch
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
              debug.requests.push({ slotEq: sv, perPage: 50, totalLimit: 500, nameContains: filterName || undefined, rarityEq: filterRarity || undefined, caps: { levelRequirementLte: careerRank, renownRankRequirementLte: renownRank } });
              const arr = await fetchItems({ perPage: 50, totalLimit: 500, slotEq: sv, allowAnyName: !filterName, nameContains: filterName || undefined, rarityEq: filterRarity || undefined, maxLevelRequirement: careerRank, maxRenownRankRequirement: renownRank, order: defaultOrder });
              for (const n of (arr || [])) byId.set(String(n.id), n);
              // If we found items for one variant, we can continue to merge, or break early; keep merging to be safe
            } catch {
              // invalid enum value or other error; try next variant
              continue;
            }
          }
          // No boosters or fallbacks without career; rely on server-side career filtering exclusively
          itemsRawCareer = Array.from(byId.values());
          // live-only mode: no client-side cache merging for fetched names
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
            // No TWO_HAND in schema; two-handed weapons are represented as MAIN_HAND
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
            // UI filters: name/stat/rarity
            if (filterName && !String(n.name || '').toLowerCase().includes(filterName.toLowerCase())) return false;
            if (filterStat) {
              const stats = Array.isArray(n?.stats) ? n.stats : (Array.isArray(n?.details?.stats) ? n.details.stats : []);
              const has = stats.some(s => String(s?.stat || s?.name || s?.type || '').toLowerCase().includes(filterStat.toLowerCase()));
              if (!has) return false;
            }
            if (filterRarity) {
              const r = String(n?.rarity || n?.details?.rarity || '').toUpperCase();
              if (r !== String(filterRarity).toUpperCase()) return false;
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
          // Merge pre-uniqueness base into per-slot base cache for reuse
          try {
            const slotKey = JSON.stringify({ picker: 'slot-base', career, careerRank, renownRank, target });
            const hit = slotBaseCacheRef.current.get(slotKey);
            const prev = Array.isArray(hit?.base) ? hit.base : [];
            const merged = dedupeById([...(prev || []), ...(itemsPreUnique || items || [])]).sort(sortByLevelRarity);
            setSlotBaseCache(slotKey, { base: merged, ts: Date.now() });
          } catch {}
        }
      } catch (e) {
  if (!ignore) setPickerError(e);
      } finally {
        if (!ignore) setPickerLoading(false);
      }
    }
    loadFromGraphQL();
    return () => { ignore = true; };
  }, [pickerOpen, pickerSlot, pickerIsTalis, pickerTalisHost, talismans, career, careerRank, renownRank, equipped, filterName, filterStat, filterRarity, filterSetOnly]);

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
          {getCareerIconUrl(career) ? (
            <img key={career} className="career-icon" src={getCareerIconUrl(career)} alt="" />
          ) : null}
        </span>
  <select title="Career" value={career || ''} onChange={(e) => setCareer(e.target.value)}>
          <option value="">Choose career...</option>
          {getCareers()
            .slice()
            .sort((a, b) => a.replaceAll('_', ' ').localeCompare(b.replaceAll('_', ' '), undefined, { sensitivity: 'base' }))
            .map((c) => (
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
          const isPristine = !lastItemFilters.name && !lastItemFilters.stat && !lastItemFilters.rarity && !lastItemFilters.setOnly;
          if (!itemFilterDefaultsApplied && isPristine) {
            const defaults = { name: '', stat: '', rarity: '', setOnly: false };
            setFilterName('');
            setFilterStat('');
            setFilterRarity('');
            setFilterSetOnly(false);
            setLastItemFilters(defaults);
            setItemFilterDefaultsApplied(true);
          } else {
            setFilterName(lastItemFilters.name || '');
            setFilterStat(lastItemFilters.stat || '');
            setFilterRarity(lastItemFilters.rarity || '');
            setFilterSetOnly(!!lastItemFilters.setOnly);
          }
          setPickerSlot(el.getAttribute('data-slotname'));
          if (!career) {
            setPickerDebug({ slotName: el.getAttribute('data-slotname'), notes: ['select-career-first'] });
            return;
          }
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
            setLastItemFilters({ name: filterName, stat: filterStat, rarity: filterRarity, setOnly: filterSetOnly });
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
            const isPristine = !lastItemFilters.name && !lastItemFilters.stat && !lastItemFilters.rarity && !lastItemFilters.setOnly;
            if (!itemFilterDefaultsApplied && isPristine) {
              const defaults = { name: '', stat: '', rarity: '', setOnly: false };
              setFilterName('');
              setFilterStat('');
              setFilterRarity('');
              setFilterSetOnly(false);
              setLastItemFilters(defaults);
              setItemFilterDefaultsApplied(true);
            } else {
              setFilterName(lastItemFilters.name || '');
              setFilterStat(lastItemFilters.stat || '');
              setFilterRarity(lastItemFilters.rarity || '');
              setFilterSetOnly(!!lastItemFilters.setOnly);
            }
            setPickerSlot(el.getAttribute('data-slotname'));
            if (!career) { setPickerDebug({ slotName: el.getAttribute('data-slotname'), notes: ['select-career-first'] }); return; }
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
              setLastItemFilters({ name: filterName, stat: filterStat, rarity: filterRarity, setOnly: filterSetOnly });
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
          careerRank={careerRank}
          renownRank={renownRank}
          filterSetOnly={filterSetOnly}
          setFilterSetOnly={setFilterSetOnly}
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
            const isPristine = !lastItemFilters.name && !lastItemFilters.stat && !lastItemFilters.rarity && !lastItemFilters.setOnly;
            if (!itemFilterDefaultsApplied && isPristine) {
              const defaults = { name: '', stat: '', rarity: '', setOnly: false };
              setFilterName('');
              setFilterStat('');
              setFilterRarity('');
              setFilterSetOnly(false);
              setLastItemFilters(defaults);
              setItemFilterDefaultsApplied(true);
            } else {
              setFilterName(lastItemFilters.name || '');
              setFilterStat(lastItemFilters.stat || '');
              setFilterRarity(lastItemFilters.rarity || '');
              setFilterSetOnly(!!lastItemFilters.setOnly);
            }
            setPickerSlot(el.getAttribute('data-slotname'));
            if (!career) { setPickerDebug({ slotName: el.getAttribute('data-slotname'), notes: ['select-career-first'] }); return; }
            setPickerOpen(true);
          }}
        >
          <div className="ror-toolbar ror-panel">
            <label>
              <span className="career-icon-slot">
                {getCareerIconUrl(career) ? (
                  <img key={career} className="career-icon" src={getCareerIconUrl(career)} alt="" />
                ) : null}
              </span>
              <select title="Career" value={career || ''} onChange={(e) => setCareer(e.target.value)}>
                <option value="">Choose career...</option>
                {getCareers()
                  .slice()
                  .sort((a, b) => a.replaceAll('_', ' ').localeCompare(b.replaceAll('_', ' '), undefined, { sensitivity: 'base' }))
                  .map((c) => (
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
              setLastItemFilters({ name: filterName, stat: filterStat, rarity: filterRarity, setOnly: filterSetOnly });
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
          careerRank={careerRank}
          renownRank={renownRank}
          filterSetOnly={filterSetOnly}
          setFilterSetOnly={setFilterSetOnly}
          isTalis={pickerIsTalis}
      activeCareer={career}
          debugInfo={pickerDebug}
        />
      </div>
    );
  };

  return variant === 'ror' ? renderRor() : variant === 'classic' ? renderClassic() : renderGrid();
}
