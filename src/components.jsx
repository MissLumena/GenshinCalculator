/**
 * V2 — общие UI-компоненты: шапка, аватары, карточки, графики.
 */
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ELEMENT_COLORS, ELEMENTAL_RES_BONUS_OPTIONS, getCharacterIconUrls, getCharacterSplashUrls, getCharacterConstellationPortraitUrls, getTravelerDuoPortraitSets } from './mockData';
import { OAUTH_PROVIDER_MAILRU } from './lib/oauthPolicy';
import {
  fetchCharacterConstellationData,
  getConstellationLevelIconUrl,
  getConstellationShapeUrl,
} from './services/constellationService';
import { fetchCharacterTalents } from './services/talentService';
import { getConstellationElementKey } from './constellationThemes';
import { prepareConstellationImageCandidates, prepareConstellationImageUrl } from './constellationImageUtils';
import { resolveNotionTeamCharacters } from './lib/notionCharacterMatch';
import {
  isTravelerCharacter,
  normalizeTravelerElement,
  TRAVELER_CONSTELLATION_ELEMENTS,
  TRAVELER_ELEMENT_LABELS_RU,
} from './travelerConstellations';
import { useAppState } from './context';
import { validateDisplayName, formatDisplayName, isSuperuserDisplayName } from './lib/displayName';
import { fetchAuthCountryPolicy } from './services/geoCountryService';
import { resultsPageHref } from './lib/resultsTabs';
import {
  formatCharacterChartLabel,
  getCharacterNameEn,
  getCharacterNameRu,
} from './lib/characterName';
import {
  getWeaponIconUrls,
  findWeaponById,
  getWeaponsForType,
  getEnrichedWeaponsGrouped,
  getWeaponCatalogTotal,
  normalizeWeaponType,
  enrichWeapon,
  WEAPON_TYPE_LABELS_RU,
  getSignatureWeaponId,
  sortWeaponsWithSignatureFirst,
} from './weapons';
import {
  getEnrichedArtifactSets,
  getArtifactSetIconUrls,
  findArtifactSetById,
  getArtifactCatalogTotal,
  ARTIFACT_CATALOG_MAX_VERSION,
} from './artifacts';

/* ─── Подпись персонажа (RU + EN) ─── */
export function CharacterNameLabel({
  character,
  primaryClassName = 'font-medium text-white',
  secondaryClassName = 'text-xs text-white/60',
  layout = 'stack',
  showSecondary = true,
  className = '',
}) {
  if (!character) return null;

  const nameRu = getCharacterNameRu(character);
  const nameEn = getCharacterNameEn(character);
  const showEn = showSecondary && Boolean(nameEn);

  if (layout === 'inline') {
    return (
      <span className={className}>
        <span className={primaryClassName}>{nameRu}</span>
        {showEn && (
          <>
            {' '}
            <span className={secondaryClassName}>({nameEn})</span>
          </>
        )}
      </span>
    );
  }

  return (
    <div className={className}>
      <p className={primaryClassName}>{nameRu}</p>
      {showEn && <p className={secondaryClassName}>{nameEn}</p>}
    </div>
  );
}

/* ─── Состояния загрузки и ошибки ─── */
export function LoadingState({ message = 'Загрузка...' }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-4 py-12">
      <p className="text-lg font-medium text-white" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
        {message}
      </p>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-4 py-12 text-center">
      <p className="max-w-md text-red-300">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="btn-pill-gold px-4 py-2"
        >
          Повторить
        </button>
      )}
    </div>
  );
}

export function PageBackLink({ to, label, className = '' }) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-2 text-sm font-medium text-white transition hover:text-white/75 ${className}`}
    >
      <span className="text-base leading-none" aria-hidden="true">←</span>
      <span>{label}</span>
    </Link>
  );
}

const WEAPON_ICON_SIZES = {
  xs: 'h-8 w-8',
  sm: 'h-10 w-10',
  md: 'h-12 w-12',
  lg: 'h-14 w-14',
};

export function WeaponIcon({ weaponId, size = 'sm', className = '', rarity = 5 }) {
  const [urlIndex, setUrlIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const sizeClass = WEAPON_ICON_SIZES[size] || WEAPON_ICON_SIZES.sm;
  const weapon = findWeaponById(weaponId);
  const urls = weaponId ? getWeaponIconUrls(weapon || weaponId) : [];
  const currentUrl = urls[urlIndex];
  const resolvedRarity = weapon?.rarity ?? rarity;

  useEffect(() => {
    setUrlIndex(0);
    setFailed(false);
  }, [weaponId]);

  const handleError = () => {
    if (urlIndex < urls.length - 1) {
      setUrlIndex((index) => index + 1);
      return;
    }
    setFailed(true);
  };

  if (!currentUrl || failed) {
    const rarityTone = resolvedRarity >= 5 ? 'text-amber-200' : 'text-white/90';
    return (
      <div
        className={`${sizeClass} flex shrink-0 items-center justify-center rounded-lg border border-white/25 bg-white/15 text-lg ${rarityTone} ${className}`}
        aria-hidden="true"
        title={weapon?.nameEn || ''}
      >
        ⚔
      </div>
    );
  }

  return (
    <img
      src={currentUrl}
      alt={weapon?.nameEn || ''}
      className={`${sizeClass} shrink-0 rounded-lg border border-white/20 bg-white/10 object-cover ${className}`}
      loading="lazy"
      onError={handleError}
    />
  );
}

function weaponMatchesQuery(weapon, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return weapon.nameEn.toLowerCase().includes(q)
    || weapon.nameRu.toLowerCase().includes(q)
    || (weapon.passiveName || '').toLowerCase().includes(q)
    || (weapon.description || '').toLowerCase().includes(q);
}

function WeaponPickerCard({ weapon, selected, disabled, disabledReason, onSelect, isSignature }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(weapon.id)}
      title={disabled ? disabledReason : weapon.description}
      className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
        disabled
          ? 'cursor-not-allowed border-white/10 bg-slate-900/25 opacity-55'
          : selected
            ? 'border-genshin-gold bg-slate-900/70 ring-1 ring-genshin-gold/60'
            : isSignature
              ? 'border-genshin-gold/45 bg-slate-900/60 hover:bg-slate-900/75'
              : 'border-white/30 bg-slate-900/55 hover:bg-slate-900/70'
      }`}
    >
      <WeaponIcon weaponId={weapon.id} size="lg" rarity={weapon.rarity} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium leading-snug text-white">{weapon.nameRu}</p>
          {isSignature ? (
            <span className="accent-badge-sm">сигна</span>
          ) : null}
        </div>
        <p className="text-xs text-white/85">{weapon.nameEn} · {weapon.rarity}★</p>
        {weapon.passiveName ? (
          <p className="mt-1 text-xs font-semibold text-genshin-gold">{weapon.passiveName}</p>
        ) : null}
        {weapon.subStat ? (
          <p className="text-[11px] text-white/75">Доп. стат: {weapon.subStat}</p>
        ) : null}
        {weapon.description ? (
          <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-white/90">
            {weapon.description}
          </p>
        ) : null}
      </div>
    </button>
  );
}

export function WeaponPicker({ characterWeaponType, characterId, value, onChange }) {
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState('all');

  const normalizedType = normalizeWeaponType(characterWeaponType);
  const signatureWeaponId = useMemo(
    () => getSignatureWeaponId(characterId, normalizedType),
    [characterId, normalizedType],
  );
  const compatibleWeapons = useMemo(
    () => sortWeaponsWithSignatureFirst(
      getWeaponsForType(normalizedType).map(enrichWeapon),
      signatureWeaponId,
    ),
    [normalizedType, signatureWeaponId],
  );
  const catalogTotal = getWeaponCatalogTotal();

  const groupedWeapons = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filterList = (list) => list.filter((weapon) => weaponMatchesQuery(weapon, q));
    const sortList = (list) => sortWeaponsWithSignatureFirst(list, signatureWeaponId);

    if (viewMode === 'compatible') {
      return [{
        type: normalizedType,
        label: WEAPON_TYPE_LABELS_RU[normalizedType] || normalizedType,
        weapons: filterList(compatibleWeapons),
        forCharacter: true,
      }];
    }

    const groups = getEnrichedWeaponsGrouped()
      .map((group) => ({
        ...group,
        forCharacter: group.type === normalizedType,
        weapons: sortList(filterList(group.weapons)),
      }))
      .filter((group) => group.weapons.length > 0);

    const characterGroupIndex = groups.findIndex((group) => group.type === normalizedType);
    if (characterGroupIndex > 0) {
      const [characterGroup] = groups.splice(characterGroupIndex, 1);
      groups.unshift(characterGroup);
    }

    return groups;
  }, [compatibleWeapons, normalizedType, query, signatureWeaponId, viewMode]);

  const visibleCount = groupedWeapons.reduce((sum, group) => sum + group.weapons.length, 0);
  const typeLabel = WEAPON_TYPE_LABELS_RU[normalizedType] || normalizedType;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-white/25 bg-slate-900/45 px-4 py-3">
        <p className="text-sm font-medium text-white">
          Каталог оружия · всего <span className="accent-count">{catalogTotal}</span>
        </p>
        <p className="mt-1 text-xs text-white">
          Для персонажа ({typeLabel}): <span className="accent-count">{compatibleWeapons.length}</span>
          {normalizedType ? '' : ' · тип оружия не распознан'}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setViewMode('all')}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
            viewMode === 'all'
              ? 'accent-filter-active'
              : 'border border-white/30 bg-slate-900/45 text-white hover:bg-slate-900/65'
          }`}
        >
          Весь каталог (<span className={viewMode === 'all' ? '' : 'accent-count'}>{catalogTotal}</span>)
        </button>
        <button
          type="button"
          onClick={() => setViewMode('compatible')}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
            viewMode === 'compatible'
              ? 'accent-filter-active'
              : 'border border-white/30 bg-slate-900/45 text-white hover:bg-slate-900/65'
          }`}
        >
          Только {typeLabel.toLowerCase()} (<span className={viewMode === 'compatible' ? '' : 'accent-count'}>{compatibleWeapons.length}</span>)
        </button>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск оружия..."
          className="glass-input min-w-[12rem] flex-1 px-3 py-2 text-sm text-white sm:max-w-xs"
        />
      </div>

      <button
        type="button"
        onClick={() => onChange(null)}
        className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm text-white transition ${
          !value
            ? 'border-genshin-gold bg-slate-900/70 ring-1 ring-genshin-gold/60'
            : 'border-white/30 bg-slate-900/55 hover:bg-slate-900/70'
        }`}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800/80 text-white/80">—</span>
        <span className="font-medium text-white">Не выбрано</span>
      </button>

      {visibleCount === 0 ? (
        <p className="rounded-xl border border-white/25 bg-slate-900/55 px-4 py-3 text-sm text-white">
          Ничего не найдено. Сбросьте поиск или переключите режим каталога.
        </p>
      ) : (
        <div className="max-h-[36rem] space-y-4 overflow-y-auto pr-1">
          {groupedWeapons.map((group) => (
            <section key={group.type || group.label}>
              <h3 className="mb-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-white">
                <span>{group.label}</span>
                <span className="rounded-full bg-slate-900/60 px-2 py-0.5 text-xs font-normal accent-count">
                  {group.weapons.length}
                </span>
                {group.forCharacter ? (
                  <span className="accent-badge-sm">
                    для персонажа
                  </span>
                ) : null}
              </h3>
              <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
                {group.weapons.map((weapon) => {
                  const canEquip = !normalizedType || weapon.type === normalizedType;
                  return (
                    <WeaponPickerCard
                      key={weapon.id}
                      weapon={weapon}
                      selected={value === weapon.id}
                      disabled={!canEquip}
                      disabledReason={`Только ${typeLabel.toLowerCase()} для этого персонажа`}
                      onSelect={onChange}
                      isSignature={weapon.id === signatureWeaponId}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export function ArtifactSetIcon({ setId, size = 'md', className = '' }) {
  const [urlIndex, setUrlIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const sizes = { sm: 'h-10 w-10', md: 'h-12 w-12', lg: 'h-14 w-14' };
  const sizeClass = sizes[size] || sizes.md;
  const set = findArtifactSetById(setId);
  const urls = setId ? getArtifactSetIconUrls(setId) : [];
  const currentUrl = urls[urlIndex];

  useEffect(() => {
    setUrlIndex(0);
    setFailed(false);
  }, [setId]);

  const handleError = () => {
    if (urlIndex < urls.length - 1) {
      setUrlIndex((index) => index + 1);
      return;
    }
    setFailed(true);
  };

  if (!currentUrl || failed) {
    return (
      <div
        className={`${sizeClass} flex shrink-0 items-center justify-center rounded-lg border border-white/25 bg-slate-800/70 text-lg text-amber-100 ${className}`}
        title={set?.nameRu || ''}
        aria-hidden="true"
      >
        ✦
      </div>
    );
  }

  return (
    <img
      src={currentUrl}
      alt={set?.nameRu || ''}
      className={`${sizeClass} shrink-0 rounded-lg border border-white/20 bg-slate-900/50 object-cover ${className}`}
      loading="lazy"
      onError={handleError}
    />
  );
}

function artifactSetMatchesQuery(set, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return set.nameRu.toLowerCase().includes(q)
    || set.nameEn.toLowerCase().includes(q)
    || set.bonus2.toLowerCase().includes(q)
    || set.bonus4.toLowerCase().includes(q);
}

function ArtifactSetCard({ set, selected, disabled, disabledReason, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onSelect(set.id)}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
        disabled
          ? 'cursor-not-allowed border-white/15 bg-slate-900/35 opacity-50'
          : selected
            ? 'border-genshin-gold bg-slate-900/70 ring-1 ring-genshin-gold/60'
            : 'border-white/30 bg-slate-900/55 hover:bg-slate-900/70'
      }`}
    >
      <ArtifactSetIcon setId={set.id} size="lg" />
      <div className="min-w-0 flex-1">
        <p className="font-medium leading-snug text-white">{set.nameRu}</p>
        <p className="text-xs text-white/85">{set.nameEn} · {set.maxRarity}★</p>
        <p className="mt-1 text-xs text-genshin-gold">2pc: {set.bonus2}</p>
        <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-white/90">4pc: {set.bonus4}</p>
      </div>
    </button>
  );
}

export function ArtifactSetPicker({
  value,
  onChange,
  title,
  subtitle,
  excludeSetId = null,
  compact = false,
  showCatalogHeader = true,
  searchPlaceholder = 'Поиск сета...',
}) {
  const [query, setQuery] = useState('');
  const catalogTotal = getArtifactCatalogTotal();
  const allSets = useMemo(() => getEnrichedArtifactSets(), []);

  const filteredSets = useMemo(() => {
    return allSets.filter((set) => artifactSetMatchesQuery(set, query));
  }, [allSets, query]);

  const selectedSet = findArtifactSetById(value);
  const listMaxHeight = compact ? 'max-h-[20rem]' : 'max-h-[36rem]';

  return (
    <div className="space-y-3">
      {showCatalogHeader ? (
        <div className="rounded-xl border border-white/25 bg-slate-900/45 px-4 py-3">
          <p className="text-sm font-medium text-white">
            {title || (
              <>
                Каталог артефактов · всего <span className="accent-count">{catalogTotal}</span>
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-white/90">
            {subtitle || `Все сеты до версии ${ARTIFACT_CATALOG_MAX_VERSION} включительно`}
          </p>
        </div>
      ) : title ? (
        <div>
          <p className="text-sm font-medium text-white">{title}</p>
          {subtitle ? <p className="mt-1 text-xs text-white/85">{subtitle}</p> : null}
        </div>
      ) : null}

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={searchPlaceholder}
        className="glass-input w-full px-3 py-2 text-sm text-white"
      />

      {selectedSet ? (
        <div className="flex gap-3 rounded-xl border border-genshin-gold/50 bg-slate-900/55 p-3">
          <ArtifactSetIcon setId={selectedSet.id} size="lg" />
          <div className="min-w-0">
            <p className="font-semibold text-white">{selectedSet.nameRu}</p>
            <p className="text-xs text-white/85">{selectedSet.nameEn}</p>
          </div>
        </div>
      ) : null}

      {filteredSets.length === 0 ? (
        <p className="rounded-xl border border-white/25 bg-slate-900/55 px-4 py-3 text-sm text-white">
          Ничего не найдено. Сбросьте поиск.
        </p>
      ) : (
        <div className={`grid ${listMaxHeight} gap-3 overflow-y-auto pr-1 sm:grid-cols-1 lg:grid-cols-2`}>
          {filteredSets.map((set) => {
            const disabled = Boolean(excludeSetId && set.id === excludeSetId);
            return (
              <ArtifactSetCard
                key={set.id}
                set={set}
                selected={value === set.id}
                disabled={disabled}
                disabledReason="Уже выбран как основной сет"
                onSelect={onChange}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

const ARTIFACT_LOADOUT_MODES = {
  single: 'single',
  dual: 'dual',
};

export function DualArtifactSetPicker({ set, set2, onChange }) {
  const [loadoutMode, setLoadoutMode] = useState(set2 ? ARTIFACT_LOADOUT_MODES.dual : ARTIFACT_LOADOUT_MODES.single);
  const [activeSlot, setActiveSlot] = useState('primary');
  const primarySet = findArtifactSetById(set);
  const secondarySet = set2 ? findArtifactSetById(set2) : null;
  const catalogTotal = getArtifactCatalogTotal();
  const isDualLoadout = loadoutMode === ARTIFACT_LOADOUT_MODES.dual;

  useEffect(() => {
    if (set2) setLoadoutMode(ARTIFACT_LOADOUT_MODES.dual);
  }, [set2]);

  const switchLoadoutMode = (mode) => {
    setLoadoutMode(mode);
    setActiveSlot('primary');
    if (mode === ARTIFACT_LOADOUT_MODES.single) {
      onChange({ set, set2: null });
      return;
    }
    onChange({ set, set2 });
  };

  const handleCatalogChange = (setId) => {
    if (!isDualLoadout || activeSlot === 'primary') {
      const nextSet2 = set2 === setId ? null : set2;
      onChange({ set: setId, set2: nextSet2 });
      return;
    }
    onChange({ set, set2: setId });
  };

  const catalogValue = isDualLoadout && activeSlot === 'secondary' ? set2 : set;
  const catalogExcludeId = isDualLoadout && activeSlot === 'secondary' ? set : null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border-2 border-genshin-gold/60 bg-gradient-to-br from-slate-900/90 to-slate-800/70 p-4 shadow-lg shadow-genshin-gold/10">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-white">Тип сборки артефактов</p>
            <p className="mt-1 text-xs text-white/90">
              Каталог до версии {ARTIFACT_CATALOG_MAX_VERSION} ·{' '}
              <span className="accent-count">{catalogTotal}</span> сетов
            </p>
          </div>
          {isDualLoadout ? (
            <span className="accent-badge-md">
              4 + 2
            </span>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => switchLoadoutMode(ARTIFACT_LOADOUT_MODES.single)}
            className={`rounded-xl border px-4 py-3 text-left transition ${
              !isDualLoadout
                ? 'border-genshin-gold bg-genshin-gold/20 ring-2 ring-genshin-gold/50'
                : 'border-white/25 bg-slate-900/55 hover:border-white/40'
            }`}
          >
            <p className="font-semibold text-white">Один сет · 5 шт.</p>
            <p className="mt-1 text-xs text-white/85">2pc + 4pc одного сета</p>
          </button>
          <button
            type="button"
            onClick={() => switchLoadoutMode(ARTIFACT_LOADOUT_MODES.dual)}
            className={`rounded-xl border px-4 py-3 text-left transition ${
              isDualLoadout
                ? 'border-genshin-gold bg-genshin-gold/20 ring-2 ring-genshin-gold/50'
                : 'border-white/25 bg-slate-900/55 hover:border-white/40'
            }`}
          >
            <p className="font-semibold text-white">Два сета · 4 + 2</p>
            <p className="mt-1 text-xs text-white/85">4pc основного + 2pc второго</p>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-genshin-gold/40 bg-slate-900/60 px-4 py-3">
            <span className="text-xs font-medium uppercase tracking-wide accent-count">Сборка:</span>
        {primarySet ? (
          <button
            type="button"
            onClick={() => {
              setActiveSlot('primary');
              if (!isDualLoadout) return;
              setLoadoutMode(ARTIFACT_LOADOUT_MODES.dual);
            }}
            className={`inline-flex items-center gap-2 rounded-lg border px-2 py-1 text-sm transition ${
              activeSlot === 'primary'
                ? 'border-genshin-gold bg-genshin-gold/15 text-white'
                : 'border-white/25 bg-slate-900/70 text-white hover:border-white/40'
            }`}
          >
            <ArtifactSetIcon setId={primarySet.id} size="sm" />
            {primarySet.nameRu}
            <span className="accent-count">{isDualLoadout ? '×4' : '×5'}</span>
          </button>
        ) : (
          <span className="text-sm text-white/70">Основной сет не выбран</span>
        )}
        {isDualLoadout ? (
          <>
            <span className="text-white/60">+</span>
            {secondarySet ? (
              <button
                type="button"
                onClick={() => setActiveSlot('secondary')}
                className={`inline-flex items-center gap-2 rounded-lg border px-2 py-1 text-sm transition ${
                  activeSlot === 'secondary'
                    ? 'border-genshin-gold bg-genshin-gold/15 text-white'
                    : 'border-white/25 bg-slate-900/70 text-white hover:border-white/40'
                }`}
              >
                <ArtifactSetIcon setId={secondarySet.id} size="sm" />
                {secondarySet.nameRu}
                <span className="accent-count">×2</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveSlot('secondary')}
                className={`rounded-lg border px-3 py-1 text-sm transition ${
                  activeSlot === 'secondary'
                    ? 'border-genshin-gold bg-genshin-gold/15 text-white'
                    : 'border-dashed border-white/35 text-white/85 hover:border-white/55'
                }`}
              >
                + Выберите 2pc сет
              </button>
            )}
          </>
        ) : null}
      </div>

      {isDualLoadout ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveSlot('primary')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeSlot === 'primary'
                ? 'accent-filter-active'
                : 'bg-slate-900/70 text-white hover:bg-slate-800'
            }`}
          >
            Редактировать сет 1 (<span className={activeSlot === 'primary' ? '' : 'accent-count'}>4pc</span>)
          </button>
          <button
            type="button"
            onClick={() => setActiveSlot('secondary')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeSlot === 'secondary'
                ? 'accent-filter-active'
                : 'bg-slate-900/70 text-white hover:bg-slate-800'
            }`}
          >
            Редактировать сет 2 (<span className={activeSlot === 'secondary' ? '' : 'accent-count'}>2pc</span>)
          </button>
        </div>
      ) : null}

      <ArtifactSetPicker
        value={catalogValue}
        onChange={handleCatalogChange}
        title={
          isDualLoadout
            ? (activeSlot === 'secondary'
              ? <>Каталог · второй сет (<span className="accent-count">2pc</span>)</>
              : <>Каталог · основной сет (<span className="accent-count">4pc</span>)</>)
            : undefined
        }
        subtitle={
          isDualLoadout
            ? (activeSlot === 'secondary'
              ? 'Выберите сет для 2-piece бонуса'
              : 'Выберите сет для 4-piece бонуса')
            : `Все сеты до версии ${ARTIFACT_CATALOG_MAX_VERSION} включительно`
        }
        excludeSetId={catalogExcludeId}
        showCatalogHeader
        searchPlaceholder={
          isDualLoadout && activeSlot === 'secondary'
            ? 'Поиск второго сета...'
            : 'Поиск сета...'
        }
      />
    </div>
  );
}

/* ─── Аватар персонажа (jmp.blue → enka.network fallback) ─── */
export function CharacterAvatar({ character, size = 'md', className = '', nameFallback = '' }) {
  const [urlIndex, setUrlIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const sizes = { xs: 'h-8 w-8', sm: 'h-10 w-10', md: 'h-14 w-14', lg: 'h-20 w-20', xl: 'h-24 w-24' };
  const sizeClass = sizes[size] || sizes.md;

  const urls = character ? getCharacterIconUrls(character) : [];
  const currentUrl = urls[urlIndex];

  useEffect(() => {
    setUrlIndex(0);
    setFailed(false);
  }, [character?.id]);

  const handleError = () => {
    if (urlIndex < urls.length - 1) {
      setUrlIndex((i) => i + 1);
    } else {
      setFailed(true);
    }
  };

  if (!character || failed || !currentUrl) {
    const fallbackLetter = character?.nameRu?.[0] || nameFallback?.[0] || '?';
    return (
      <div className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full border border-white/40 bg-white/25 text-xs text-white/90 ${className}`}>
        {fallbackLetter}
      </div>
    );
  }

  return (
    <img
      key={currentUrl}
      src={currentUrl}
      alt={`${getCharacterNameRu(character)} / ${getCharacterNameEn(character)}`}
      className={`${sizeClass} shrink-0 rounded-full border border-gray-600 bg-genshin-dark object-cover ${className}`}
      loading="lazy"
      onError={handleError}
    />
  );
}

/* ─── Модальное окно (портал в body — не ломается sticky/backdrop-blur шапки) ─── */
export function ModalOverlay({ open, onClose, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose ? (e) => {
        if (e.target === e.currentTarget) onClose();
      } : undefined}
      role="presentation"
    >
      {children}
    </div>,
    document.body,
  );
}

/* ─── Иконки боковой панели ─── */
const NAV_ITEMS = [
  { to: '/', label: 'Главная', icon: 'home' },
  { to: '/characters', label: 'Персонажи', icon: 'characters' },
  { to: '/team', label: 'Команда', icon: 'team' },
  { to: '/results#notion-results', label: 'Результаты', icon: 'results' },
];

function NavIcon({ name }) {
  const cls = 'h-5 w-5';
  switch (name) {
    case 'home':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" strokeLinejoin="round" />
        </svg>
      );
    case 'characters':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c0-3.5 3.1-6 7-6s7 2.5 7 6" strokeLinecap="round" />
        </svg>
      );
    case 'team':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <circle cx="9" cy="8" r="2.5" />
          <circle cx="16" cy="9" r="2" />
          <path d="M4 19c0-2.5 2.2-4.5 5-4.5M15 19c0-2 1.6-3.5 3.5-3.5" strokeLinecap="round" />
        </svg>
      );
    case 'results':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M5 19V9M12 19V5M19 19v-8" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}

function isNavActive(pathname, to) {
  if (to.startsWith('/results')) {
    return pathname === '/results' || pathname.startsWith('/results/');
  }
  return pathname === to || (to !== '/' && pathname.startsWith(to));
}

/* ─── Навигационная шапка ─── */
export function Header() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const {
    isAuthenticated,
    authLoading,
    session,
    signIn,
    signUp,
    signInWithOAuth,
    signOut,
    actionLoading,
    profileDisplayName,
    updateDisplayName,
  } = useAppState();

  const [authOpen, setAuthOpen] = useState(false);
  const [nameEditOpen, setNameEditOpen] = useState(false);
  const [authMode, setAuthMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [editName, setEditName] = useState('');
  const [authError, setAuthError] = useState(null);
  const [authFieldErrors, setAuthFieldErrors] = useState({});
  const [nameEditError, setNameEditError] = useState(null);
  const [authCountryPolicy, setAuthCountryPolicy] = useState(null);
  const [authCountryLoading, setAuthCountryLoading] = useState(false);

  useEffect(() => {
    if (!authOpen) return undefined;

    let cancelled = false;
    setAuthCountryLoading(true);

    fetchAuthCountryPolicy()
      .then((policy) => {
        if (!cancelled) setAuthCountryPolicy(policy);
      })
      .finally(() => {
        if (!cancelled) setAuthCountryLoading(false);
      });

    return () => { cancelled = true; };
  }, [authOpen]);

  const oauthAllowed = authCountryPolicy?.oauthAllowed !== false;
  const resultsHref = resultsPageHref(isAuthenticated);
  const headerDisplayName = profileDisplayName || formatDisplayName(session?.user?.email?.split('@')[0]);

  const resetAuthForm = () => {
    setEmail('');
    setPassword('');
    setRegisterName('');
    setAuthError(null);
    setAuthFieldErrors({});
  };

  const openNameEdit = () => {
    setEditName(profileDisplayName || '');
    setNameEditError(null);
    setNameEditOpen(true);
  };

  const handleNameEditSubmit = async (e) => {
    e.preventDefault();
    setNameEditError(null);
    const nameError = validateDisplayName(editName);
    if (nameError) {
      const err = new Error(nameError);
      err.field = 'displayName';
      setNameEditError(err.message);
      return;
    }
    try {
      await updateDisplayName(editName);
      setNameEditOpen(false);
    } catch (err) {
      setNameEditError(err.message || 'Ошибка обновления имени');
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError(null);
    setAuthFieldErrors({});
    try {
      if (authMode === 'signin') {
        await signIn(email, password);
      } else {
        const nameError = validateDisplayName(registerName);
        if (nameError) {
          setAuthFieldErrors({ displayName: nameError });
          return;
        }
        await signUp(email, password, registerName);
      }
      setAuthOpen(false);
      resetAuthForm();
    } catch (err) {
      const field = err.field || 'form';
      if (field === 'form') {
        setAuthError(err.message || 'Ошибка авторизации');
        setAuthFieldErrors({});
      } else {
        setAuthFieldErrors({ [field]: err.message || 'Ошибка авторизации' });
        setAuthError(null);
      }
    }
  };

  const openAuth = (mode) => {
    setAuthMode(mode);
    setAuthError(null);
    setAuthCountryPolicy(null);
    setAuthOpen(true);
  };

  const handleOAuthClick = async (provider) => {
    setAuthError(null);
    try {
      const policy = authCountryPolicy || await fetchAuthCountryPolicy();
      await signInWithOAuth(provider, policy.countryCode);
    } catch (err) {
      setAuthError(err.message || 'Ошибка OAuth');
    }
  };

  const handleLogout = async () => {
    navigate('/', { replace: true });
    try {
      await signOut();
    } catch {
      // Ошибка выхода показывается через actionError в App.
    }
  };

  return (
    <>
      <aside className="glass-rail" aria-label="Боковая навигация">
        {NAV_ITEMS.map(({ to, label, icon }) => (
          <Link
            key={to}
            to={to.startsWith('/results') ? resultsHref : to}
            title={label}
            className={`rail-link ${isNavActive(pathname, to) ? 'rail-link-active' : ''}`}
          >
            <NavIcon name={icon} />
          </Link>
        ))}
      </aside>

      <header className="glass-topnav">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <nav className="flex items-center gap-0.5 md:hidden" aria-label="Мобильная навигация">
            {NAV_ITEMS.map(({ to, icon, label }) => (
              <Link
                key={to}
                to={to.startsWith('/results') ? resultsHref : to}
                title={label}
                className={`rail-link !h-9 !w-9 ${isNavActive(pathname, to) ? 'rail-link-active' : ''}`}
              >
                <NavIcon name={icon} />
              </Link>
            ))}
          </nav>

          <nav className="hidden flex-1 items-center justify-center gap-1 md:flex" aria-label="Основная навигация">
            {NAV_ITEMS.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`nav-link-pill ${isNavActive(pathname, to) ? 'nav-link-pill-active' : ''}`}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {!authLoading && (
              isAuthenticated ? (
                <>
                  <button
                    type="button"
                    onClick={openNameEdit}
                    className={`btn-pill-ghost max-w-[120px] truncate !px-4 !py-1.5 text-xs sm:max-w-[160px] ${
                      isSuperuserDisplayName(headerDisplayName) ? '!text-genshin-mintbright' : ''
                    }`}
                    title="Изменить имя"
                  >
                    {headerDisplayName}
                  </button>
                  <button type="button" onClick={handleLogout} className="btn-pill-solid !px-4 !py-1.5 text-xs">
                    Выйти
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => openAuth('signin')}
                    className="btn-pill-ghost !px-4 !py-1.5 text-xs"
                  >
                    Вход
                  </button>
                  <button
                    type="button"
                    onClick={() => openAuth('signup')}
                    className="btn-pill-solid !px-4 !py-1.5 text-xs"
                  >
                    Регистрация
                  </button>
                </>
              )
            )}
          </div>
        </div>
      </header>

      <ModalOverlay open={authOpen} onClose={() => {
        setAuthOpen(false);
        resetAuthForm();
      }}
      >
        <div className="glass-modal w-full max-w-sm p-6">
          <h3 className="mb-4 text-lg font-semibold text-white">
            {authMode === 'signin' ? 'Вход' : 'Регистрация'}
          </h3>
          <form onSubmit={handleAuthSubmit} className="space-y-3">
            {authMode === 'signup' && (
              <input
                type="text"
                required
                maxLength={100}
                placeholder="Имя (отображается в результатах)"
                value={registerName}
                onChange={(e) => setRegisterName(e.target.value)}
                className="glass-input w-full px-3 py-2 text-sm"
                autoComplete="nickname"
              />
            )}
            {authFieldErrors.displayName ? (
              <p className="text-sm text-red-300">{authFieldErrors.displayName}</p>
            ) : null}
            <input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="glass-input w-full px-3 py-2 text-sm"
            />
            {authFieldErrors.email ? (
              <p className="text-sm text-red-300">{authFieldErrors.email}</p>
            ) : null}
            <input
              type="password"
              required
              minLength={6}
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="glass-input w-full px-3 py-2 text-sm"
            />
            {authFieldErrors.password ? (
              <p className="text-sm text-red-300">{authFieldErrors.password}</p>
            ) : null}
            {authError && (
              <p className="text-sm text-red-300">{authError}</p>
            )}
            <button
              type="submit"
              disabled={actionLoading}
              className="btn-pill-gold w-full disabled:opacity-50"
            >
              {actionLoading ? 'Загрузка...' : authMode === 'signin' ? 'Войти' : 'Зарегистрироваться'}
            </button>
          </form>

          <div className="mt-4 space-y-2">
            <p className="text-center text-xs text-white/60">или</p>
            <button
              type="button"
              disabled={actionLoading || authCountryLoading}
              onClick={() => handleOAuthClick(OAUTH_PROVIDER_MAILRU)}
              className="btn-pill-ghost w-full disabled:opacity-50"
            >
              {authMode === 'signin' ? 'Войти через Mail.ru' : 'Регистрация через Mail.ru'}
            </button>
            {oauthAllowed ? (
              <>
                <button
                  type="button"
                  disabled={actionLoading || authCountryLoading}
                  onClick={() => handleOAuthClick('google')}
                  className="btn-pill-ghost w-full disabled:opacity-50"
                >
                  {authMode === 'signin' ? 'Войти через Google' : 'Регистрация через Google'}
                </button>
                
              </>
            ) : null}
            {authCountryLoading ? (
              <p className="rounded border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/75">
                Проверка региона…
              </p>
            ) : null}
            {!oauthAllowed && !authCountryLoading ? (
              <p className="rounded border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/75">
                Google недоступен из России. Используйте email, пароль или Mail.ru.
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => {
              setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
              setAuthError(null);
              setRegisterName('');
            }}
            className="mt-3 w-full text-sm text-gray-400 hover:text-white"
          >
            {authMode === 'signin' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthOpen(false);
              resetAuthForm();
            }}
            className="mt-2 w-full text-sm text-gray-500 hover:text-gray-300"
          >
            Отмена
          </button>
        </div>
      </ModalOverlay>

      <ModalOverlay open={nameEditOpen} onClose={() => setNameEditOpen(false)}>
        <div className="glass-modal w-full max-w-sm p-6">
          <h3 className="mb-4 text-lg font-semibold text-white">Изменить имя</h3>
          <p className="mb-4 text-sm text-gray-400">
            Это имя отображается на вкладке «Результаты»
          </p>
          <form onSubmit={handleNameEditSubmit} className="space-y-3">
            <input
              type="text"
              required
              maxLength={100}
              placeholder="Ваше имя"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="glass-input w-full px-3 py-2 text-sm"
              autoComplete="nickname"
            />
            {nameEditError && (
              <p className="text-sm text-red-300">{nameEditError}</p>
            )}
            <button
              type="submit"
              disabled={actionLoading}
              className="btn-pill-gold w-full disabled:opacity-50"
            >
              {actionLoading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </form>
          <button
            type="button"
            onClick={() => setNameEditOpen(false)}
            className="mt-3 w-full text-sm text-gray-500 hover:text-gray-300"
          >
            Отмена
          </button>
        </div>
      </ModalOverlay>
    </>
  );
}

/* ─── Модальное окно подтверждения ─── */
export function ConfirmModal({ open, title, message, onConfirm, onCancel }) {
  return (
    <ModalOverlay open={open} onClose={onCancel}>
      <div className="glass-modal w-full max-w-md p-6">
        <h3 className="mb-2 text-lg font-semibold text-white">{title}</h3>
        <p className="mb-6 text-gray-300">{message}</p>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded px-4 py-2 text-gray-300 hover:bg-white/10">
            Отмена
          </button>
          <button type="button" onClick={onConfirm} className="rounded bg-genshin-accent px-4 py-2 hover:opacity-90">
            Подтвердить
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

/* ─── Тултип с формулой расчёта ─── */
export function Tooltip({ text, formula, children }) {
  const [show, setShow] = useState(false);

  return (
    <span
      className="relative inline-flex cursor-help"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span className="glass-modal absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 p-2 text-xs text-white/90">
          <span className="block font-medium text-white">{text}</span>
          {formula && <span className="mt-1 block font-mono text-white/75">{formula}</span>}
        </span>
      )}
    </span>
  );
}

/* ─── Поле ввода с валидацией диапазона ─── */
export function InputField({
  label, value, onChange, min, max, step = 1, suffix = '', tooltip, allowEmpty = false,
}) {
  const inputRef = useRef(null);
  const [text, setText] = useState(() => (value == null ? '' : String(value)));

  useEffect(() => {
    if (inputRef.current === document.activeElement) return;
    setText(value == null ? '' : String(value));
  }, [value]);

  const commitValue = (raw) => {
    if (raw === '' || raw === '-') {
      setText('');
      if (allowEmpty) onChange(null);
      return;
    }
    let v = parseFloat(raw);
    if (Number.isNaN(v)) return;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    setText(String(v));
    onChange(v);
  };

  const handleChange = (e) => {
    const raw = e.target.value;
    setText(raw);
    if (raw === '' || raw === '-') {
      if (allowEmpty) onChange(null);
      return;
    }
    const v = parseFloat(raw);
    if (Number.isNaN(v)) return;
    let clamped = v;
    if (min !== undefined) clamped = Math.max(min, clamped);
    if (max !== undefined) clamped = Math.min(max, clamped);
    onChange(clamped);
  };

  const handleBlur = () => {
    if (text === '' || text === '-') {
      if (allowEmpty) {
        setText('');
        onChange(null);
      } else if (min !== undefined) {
        setText(String(min));
        onChange(min);
      } else {
        setText('');
      }
      return;
    }
    commitValue(text);
  };

  const field = (
    <label className="block">
      <span className="mb-1 block text-sm text-white/85">{label}</span>
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          type="number"
          value={text}
          min={min}
          max={max}
          step={step}
          onChange={handleChange}
          onBlur={handleBlur}
          className="glass-input w-full px-3 py-2 text-white"
        />
        {suffix && <span className="text-sm text-white/85">{suffix}</span>}
      </div>
    </label>
  );

  if (tooltip) {
    return (
      <Tooltip text={tooltip.text} formula={tooltip.formula}>
        {field}
      </Tooltip>
    );
  }
  return field;
}

/** Кастомный выбор бонуса сопротивления (glass + зелёное выделение). */
export function ElementalResBonusPicker({
  label,
  value,
  onChange,
  disabledElements = [],
  placeholder = 'Не выбрано',
}) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const selectedOption = ELEMENTAL_RES_BONUS_OPTIONS.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  const handleSelect = (nextValue) => {
    onChange(nextValue);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="res-bonus-picker">
      <span className="mb-1 block text-sm text-white/85">{label}</span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={`res-bonus-picker__trigger w-full px-3 py-2 text-left text-sm text-white ${
          selectedOption ? 'is-selected' : ''
        }`}
      >
        {selectedOption?.label ?? placeholder}
      </button>
      {open ? (
        <ul className="res-bonus-picker__menu" role="listbox">
          <li>
            <button
              type="button"
              role="option"
              aria-selected={!value}
              className={`res-bonus-picker__option ${!value ? 'is-selected' : ''}`}
              onClick={() => handleSelect(null)}
            >
              {placeholder}
            </button>
          </li>
          {ELEMENTAL_RES_BONUS_OPTIONS.map((option) => {
            const isDisabled = disabledElements.includes(option.value) && option.value !== value;
            const isSelected = value === option.value;
            return (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={isDisabled}
                  className={`res-bonus-picker__option ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => handleSelect(option.value)}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

/* ─── Карточка персонажа для витрины (главная) ─── */
export function CharacterShowcaseCard({ character, to, useSplashArt = false }) {
  const [urlIndex, setUrlIndex] = useState(0);
  const iconUrls = character ? getCharacterIconUrls(character) : [];
  const splashUrls = character ? getCharacterSplashUrls(character) : [];
  const urls = useSplashArt
    ? [...splashUrls, ...iconUrls]
    : iconUrls;
  const currentUrl = urls[urlIndex];

  const card = (
    <article className="showcase-card group">
      <div className="absolute inset-0 bg-gradient-to-t from-white/30 via-transparent to-white/10" />
      {currentUrl ? (
        <img
          src={currentUrl}
          alt={`${getCharacterNameRu(character)} / ${getCharacterNameEn(character)}`}
          className={`absolute inset-0 h-full w-full object-cover opacity-95 transition duration-500 group-hover:scale-105 ${
            useSplashArt ? 'object-[center_15%] scale-110' : 'scale-125 object-top group-hover:scale-[1.4]'
          }`}
          loading="lazy"
          onError={() => {
            if (urlIndex < urls.length - 1) setUrlIndex((i) => i + 1);
          }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-4xl text-white/30">
          {character?.nameRu?.[0]}
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <CharacterNameLabel character={character} />
        <p className="mt-1 text-xs text-white/60">{character.element} · {'★'.repeat(character.rarity)}</p>
      </div>
    </article>
  );

  if (to) {
    return <Link to={to} className="block">{card}</Link>;
  }
  return card;
}

/* ─── Компактная карточка персонажа ─── */
export function CharacterCard({
  character,
  onClick,
  selected = false,
  disabled = false,
  compact = true,
}) {
  const elColor = ELEMENT_COLORS[character.element] || 'bg-gray-500';

  return (
    <article
      className={`glass-panel-sm border transition ${
        compact ? 'p-2' : 'p-4'
      } ${
        disabled
          ? 'cursor-not-allowed border-white/25 opacity-50'
          : selected
            ? 'cursor-pointer border-genshin-gold shadow-md'
            : 'cursor-pointer border-white/35 hover:border-genshin-gold/60 hover:shadow-md'
      }`}
      onClick={disabled ? undefined : onClick}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onKeyDown={(e) => !disabled && e.key === 'Enter' && onClick?.()}
    >
      <div className="flex items-center gap-2">
        <CharacterAvatar character={character} size={compact ? 'sm' : 'md'} />
        <div className="min-w-0 flex-1">
          <CharacterNameLabel
            character={character}
            primaryClassName="truncate text-sm font-medium text-white"
            secondaryClassName="truncate text-xs text-white/85"
          />
          <div className="mt-1 flex items-center gap-1">
            <span className={`rounded px-1.5 py-0.5 text-[10px] text-white ${elColor}`}>{character.element}</span>
            <span className="text-[10px] text-white">{'★'.repeat(character.rarity)}</span>
          </div>
        </div>
        {disabled && (
          <span className="shrink-0 text-[10px] text-white/90">В команде</span>
        )}
      </div>
    </article>
  );
}

/* ─── Горизонтальный выбор персонажа (как в референсе) ─── */
function PickerAvatar({ character, selected, onClick }) {
  const [urlIndex, setUrlIndex] = useState(0);
  const urls = character ? getCharacterIconUrls(character) : [];
  const currentUrl = urls[urlIndex];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`character-picker-item ${selected ? 'character-picker-item-active' : ''}`}
      title={`${getCharacterNameRu(character)} / ${getCharacterNameEn(character)}`}
      aria-pressed={selected}
    >
      {currentUrl ? (
        <img
          src={currentUrl}
          alt=""
          className="character-picker-avatar"
          onError={() => {
            if (urlIndex < urls.length - 1) setUrlIndex((i) => i + 1);
          }}
        />
      ) : (
        <span className="character-picker-avatar flex items-center justify-center text-xs">
          {character.nameRu?.[0]}
        </span>
      )}
      <span className="character-picker-pointer" aria-hidden />
      <CharacterNameLabel
        character={character}
        primaryClassName="max-w-[4.5rem] truncate text-center text-[10px] font-medium leading-tight text-white"
        secondaryClassName="max-w-[4.5rem] truncate text-center text-[9px] leading-tight text-white/55"
      />
    </button>
  );
}

export function CharacterPickerBar({ characters, selectedId, onSelect }) {
  const scrollRef = useRef(null);

  const scrollBy = (delta) => {
    scrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  };

  if (!characters.length) return null;

  return (
    <div className="character-picker-bar">
      <button
        type="button"
        className="character-picker-arrow left-1"
        onClick={() => scrollBy(-160)}
        aria-label="Прокрутить влево"
      >
        ‹
      </button>
      <div ref={scrollRef} className="character-picker-scroll">
        {characters.map((character) => (
          <PickerAvatar
            key={character.id}
            character={character}
            selected={selectedId === character.id}
            onClick={() => onSelect(character.id)}
          />
        ))}
      </div>
      <button
        type="button"
        className="character-picker-arrow right-1"
        onClick={() => scrollBy(160)}
        aria-label="Прокрутить вправо"
      >
        ›
      </button>
    </div>
  );
}

export function TravelerDuoConstellationPortrait() {
  const [aetherIndex, setAetherIndex] = useState(0);
  const [lumineIndex, setLumineIndex] = useState(0);
  const portraitSets = useMemo(() => getTravelerDuoPortraitSets(), []);

  const aetherUrl = portraitSets.aether[aetherIndex];
  const lumineUrl = portraitSets.lumine[lumineIndex];

  return (
    <div className="constellation-character constellation-character--traveler-duo">
      {aetherUrl ? (
        <img
          src={aetherUrl}
          alt="Эттер"
          className="constellation-portrait-img constellation-portrait-img--traveler-duo"
          onError={() => {
            if (aetherIndex < portraitSets.aether.length - 1) {
              setAetherIndex((index) => index + 1);
            }
          }}
        />
      ) : null}
      {lumineUrl ? (
        <img
          src={lumineUrl}
          alt="Люмин"
          className="constellation-portrait-img constellation-portrait-img--traveler-duo"
          onError={() => {
            if (lumineIndex < portraitSets.lumine.length - 1) {
              setLumineIndex((index) => index + 1);
            }
          }}
        />
      ) : null}
    </div>
  );
}

function ConstellationPortrait({ character }) {
  const [portraitIndex, setPortraitIndex] = useState(0);
  const portraitUrls = useMemo(
    () => getCharacterConstellationPortraitUrls(character),
    [character],
  );

  useEffect(() => {
    setPortraitIndex(0);
  }, [character?.id]);

  if (isTravelerCharacter(character)) {
    return <TravelerDuoConstellationPortrait />;
  }

  return (
    <div className="constellation-character">
      {portraitUrls[portraitIndex] ? (
        <img
          src={portraitUrls[portraitIndex]}
          alt={`${getCharacterNameRu(character)} / ${getCharacterNameEn(character)}`}
          className="constellation-portrait-img"
          onError={() => {
            if (portraitIndex < portraitUrls.length - 1) {
              setPortraitIndex((index) => index + 1);
            }
          }}
        />
      ) : (
        <CharacterAvatar character={character} size="xl" className="!border-0 !bg-transparent" />
      )}
    </div>
  );
}

const CONSTELLATION_FALLBACK_NODES = [
  { level: 1, x: 120, y: 38 },
  { level: 2, x: 188, y: 74 },
  { level: 3, x: 188, y: 146 },
  { level: 4, x: 120, y: 182 },
  { level: 5, x: 52, y: 146 },
  { level: 6, x: 52, y: 74 },
];

const CONSTELLATION_FALLBACK_EDGES = [
  [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 1], [1, 4], [2, 5], [3, 6],
];

export function ConstellationShapeFallback({ constellationName = '', activeLevel = 1 }) {
  const nodeByLevel = Object.fromEntries(
    CONSTELLATION_FALLBACK_NODES.map((node) => [node.level, node]),
  );

  return (
    <svg
      className="constellation-shape-fallback"
      viewBox="0 0 240 240"
      aria-label={constellationName || 'Созвездие'}
      role="img"
    >
      <defs>
        <radialGradient id="constellationFallbackGlow" cx="50%" cy="46%" r="52%">
          <stop offset="0%" stopColor="var(--const-shape-glow)" stopOpacity="0.45" />
          <stop offset="55%" stopColor="var(--const-shape-glow-soft)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="120" cy="110" r="92" fill="url(#constellationFallbackGlow)" />
      {CONSTELLATION_FALLBACK_EDGES.map(([fromLevel, toLevel], index) => {
        const from = nodeByLevel[fromLevel];
        const to = nodeByLevel[toLevel];
        return (
          <line
            key={`edge-${fromLevel}-${toLevel}-${index}`}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            className="constellation-shape-fallback__edge"
          />
        );
      })}
      {CONSTELLATION_FALLBACK_NODES.map((node) => {
        const isActive = node.level === activeLevel;
        return (
          <g
            key={node.level}
            className={isActive ? 'constellation-shape-fallback__node is-active' : 'constellation-shape-fallback__node'}
          >
            {isActive ? (
              <circle
                cx={node.x}
                cy={node.y}
                r={18}
                className="constellation-shape-fallback__halo"
              />
            ) : null}
            <circle
              cx={node.x}
              cy={node.y}
              r={isActive ? 9 : 6.5}
              className="constellation-shape-fallback__star"
            />
          </g>
        );
      })}
      {constellationName ? (
        <text x="120" y="224" textAnchor="middle" className="constellation-shape-fallback__label">
          {constellationName}
        </text>
      ) : null}
    </svg>
  );
}

function ConstellationShapeArt({
  shapeUrlCandidates = [],
  characterId,
  element,
  constellationName,
  activeLevel,
}) {
  const [urlIndex, setUrlIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  const preparedCandidates = useMemo(
    () => prepareConstellationImageCandidates(shapeUrlCandidates),
    [shapeUrlCandidates],
  );

  useEffect(() => {
    setUrlIndex(0);
    setFailed(false);
  }, [preparedCandidates]);

  const currentUrl = preparedCandidates[urlIndex];

  if (!currentUrl || failed) {
    return (
      <ConstellationShapeFallback
        constellationName={constellationName}
        activeLevel={activeLevel}
      />
    );
  }

  const shapeClassName = getConstellationShapeImgClassName(characterId, element);

  return (
    <img
      src={currentUrl}
      alt=""
      className={shapeClassName}
      referrerPolicy="no-referrer"
      decoding="async"
      onError={() => {
        if (urlIndex < preparedCandidates.length - 1) {
          setUrlIndex((index) => index + 1);
          return;
        }
        setFailed(true);
      }}
    />
  );
}

const BRIGHT_CONSTELLATION_SHAPE_IDS = new Set(['ororon']);

export function getConstellationShapeImgClassName(characterId, element) {
  const classes = ['constellation-shape-img'];

  if (element) {
    classes.push('constellation-shape-img--enhanced');
  }
  if (BRIGHT_CONSTELLATION_SHAPE_IDS.has(characterId)) {
    classes.push('constellation-shape-img--extra-bright');
  }

  return classes.join(' ');
}

const HIGHLIGHT_TERMS = [
  'Elemental Burst',
  'Elemental Skill',
  'Normal Attack',
  'Charged Attack',
  'Plunging Attack',
  'CRIT Rate',
  'CRIT DMG',
  'Anemo DMG',
  'Pyro DMG',
  'Hydro DMG',
  'Electro DMG',
  'Cryo DMG',
  'Geo DMG',
  'Dendro DMG',
  'HP',
  'ATK',
  'Energy',
  'DMG',
  'Взрыв стихии',
  'Элементальный навык',
  'Элементальная реакция',
  'Обычная атака',
  'Заряженная атака',
  'Атака в падении',
  'шанс крит. попадания',
  'крит. урон',
  'Анемо',
  'Пиро',
  'Гидро',
  'Электро',
  'Крио',
  'Гео',
  'Дендро',
  'HP',
  'ATK',
  'Энергия',
  'урон',
  'Макс. уровень',
];

export function highlightConstellationText(text) {
  if (!text) return null;

  const pattern = new RegExp(`(${HIGHLIGHT_TERMS.join('|')})`, 'g');
  const parts = text.split(pattern);

  return parts.map((part, index) => (
    HIGHLIGHT_TERMS.includes(part)
      ? <span key={`${part}-${index}`} className="constellation-highlight">{part}</span>
      : part
  ));
}

/* ─── Панель созвездий (референс UI) ─── */
function TravelerElementTabs({ activeElement, onChange }) {
  return (
    <div
      className="constellation-element-tabs"
      role="tablist"
      aria-label="Стихия путешественника"
    >
      {TRAVELER_CONSTELLATION_ELEMENTS.map((element) => {
        const isActive = activeElement === element;
        return (
          <button
            key={element}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`constellation-element-tab constellation-element-tab--${element.toLowerCase()} ${isActive ? 'is-active' : ''}`}
            onClick={() => onChange(element)}
          >
            {TRAVELER_ELEMENT_LABELS_RU[element]}
          </button>
        );
      })}
    </div>
  );
}

export function ConstellationPanel({
  character,
  activeLevel,
  onActiveLevelChange,
}) {
  const [internalLevel, setInternalLevel] = useState(1);
  const [themeElement, setThemeElement] = useState(character?.element);
  const [items, setItems] = useState([]);
  const [constellationName, setConstellationName] = useState('');
  const [shapeUrlCandidates, setShapeUrlCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [unavailable, setUnavailable] = useState(false);
  const [travelerElement, setTravelerElement] = useState(() => normalizeTravelerElement(character?.element));

  const isTraveler = isTravelerCharacter(character);
  const currentLevel = activeLevel ?? internalLevel;

  useEffect(() => {
    setInternalLevel(1);
    setThemeElement(character?.element);
    if (isTravelerCharacter(character)) {
      setTravelerElement(normalizeTravelerElement(character?.element));
    }
  }, [character?.id, character?.element]);

  useEffect(() => {
    if (!character) {
      setItems([]);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setUnavailable(false);

    const fetchOptions = isTravelerCharacter(character)
      ? { element: travelerElement }
      : {};

    fetchCharacterConstellationData(character, fetchOptions)
      .then((data) => {
        if (cancelled) return;
        if (data.unavailable || !data.items?.length) {
          setUnavailable(true);
          setItems([]);
          setConstellationName('');
          setShapeUrlCandidates([]);
          return;
        }
        setItems(data.items);
        setConstellationName(data.constellationName);
        setThemeElement(data.element || character.element);
        setShapeUrlCandidates(
          data.shapeUrlCandidates?.length
            ? data.shapeUrlCandidates
            : (data.shapeUrl ? [data.shapeUrl] : []),
        );
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(error.message || 'Не удалось загрузить созвездия');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [character, travelerElement]);

  if (!character) return null;

  const activeItem = items.find((item) => item.level === currentLevel)
    || items.find((item) => item.level === 1)
    || items[0];

  const handleSelect = (level) => {
    if (onActiveLevelChange) {
      onActiveLevelChange(level);
    } else {
      setInternalLevel(level);
    }
  };

  const handleTravelerElementChange = (element) => {
    setTravelerElement(element);
    handleSelect(1);
  };

  const constellationNodes = items
    .filter((item) => item.level >= 1 && item.level <= 6)
    .sort((a, b) => a.level - b.level);

  const elementKey = getConstellationElementKey(
    isTraveler ? travelerElement : (themeElement || character.element),
  );

  return (
    <section
      className="constellation-panel"
      data-constellation-element={elementKey}
      aria-label={`Созвездия — ${getCharacterNameRu(character)}`}
    >
      <div className="constellation-header">
        <span className="constellation-badge">Созвездие</span>
        {isTraveler ? (
          <TravelerElementTabs
            activeElement={travelerElement}
            onChange={handleTravelerElementChange}
          />
        ) : null}
        {constellationName ? (
          <p className="constellation-subtitle">{constellationName}</p>
        ) : null}
      </div>

      {loading && (
        <p className="mb-4 text-center text-sm text-white/70">Загрузка созвездий...</p>
      )}
      {loadError && (
        <p className="mb-4 text-center text-sm text-red-200">{loadError}</p>
      )}
      {!loading && unavailable && (
        <p className="mb-4 text-center text-sm text-white/70">
          Данные созвездия для этого персонажа недоступны.
        </p>
      )}

      {!loading && items.length > 0 && (
        <div className="constellation-body">
          <ConstellationPortrait character={character} />

          <div className="constellation-side">
            <div className="constellation-art-block">
              <div className="constellation-art-wrap" aria-hidden>
                <ConstellationShapeArt
                  shapeUrlCandidates={shapeUrlCandidates}
                  characterId={character.id}
                  element={isTraveler ? travelerElement : (themeElement || character.element)}
                  constellationName={constellationName}
                  activeLevel={currentLevel}
                />
              </div>

              <div className="constellation-nodes" role="tablist" aria-label="Уровни созвездий">
                {constellationNodes.map((item) => {
                  const isActive = currentLevel === item.level;
                  const nodeIconUrl = item.iconUrl || getConstellationLevelIconUrl(character, item.level);

                  return (
                    <button
                      key={item.level}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      aria-label={`Созвездие ${item.level}`}
                      onClick={() => handleSelect(item.level)}
                      className={`constellation-node ${isActive ? 'constellation-node-active' : ''}`}
                    >
                      {nodeIconUrl ? (
                        <img
                          src={prepareConstellationImageUrl(nodeIconUrl) || nodeIconUrl}
                          alt=""
                          className="constellation-node-icon"
                          referrerPolicy="no-referrer"
                          decoding="async"
                        />
                      ) : (
                        `C${item.level}`
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {activeItem && (
              <div className="constellation-detail">
                <h3 className="constellation-detail-title">
                  {currentLevel === 0
                    ? `${constellationName || activeItem.title}`
                    : `Созвездие ${currentLevel}: ${activeItem.title}`}
                </h3>
                <p className="constellation-detail-text">
                  {highlightConstellationText(activeItem.description)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export function CharacterTalentsPanel({ character, showHeader = true }) {
  const [themeElement, setThemeElement] = useState(character?.element);
  const [talents, setTalents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [unavailable, setUnavailable] = useState(false);
  const [travelerElement, setTravelerElement] = useState(() => normalizeTravelerElement(character?.element));

  const isTraveler = isTravelerCharacter(character);

  useEffect(() => {
    setThemeElement(character?.element);
    if (isTravelerCharacter(character)) {
      setTravelerElement(normalizeTravelerElement(character?.element));
    }
  }, [character?.id, character?.element]);

  useEffect(() => {
    if (!character) {
      setTalents([]);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setUnavailable(false);

    const fetchOptions = isTravelerCharacter(character)
      ? { element: travelerElement }
      : {};

    fetchCharacterTalents(character, fetchOptions)
      .then((data) => {
        if (cancelled) return;
        if (data.unavailable || !data.talents?.length) {
          setUnavailable(true);
          setTalents([]);
          return;
        }
        setTalents(data.talents);
        setThemeElement(data.element || character.element);
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(error.message || 'Не удалось загрузить таланты');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [character, travelerElement]);

  if (!character) return null;

  const elementKey = getConstellationElementKey(
    isTraveler ? travelerElement : (themeElement || character.element),
  );

  return (
    <section
      className="talent-panel"
      data-constellation-element={elementKey}
      aria-label={`Таланты — ${getCharacterNameRu(character)}`}
    >
      {showHeader ? (
        <div className="constellation-header">
          <span className="constellation-badge">Таланты</span>
          {isTraveler ? (
            <TravelerElementTabs
              activeElement={travelerElement}
              onChange={setTravelerElement}
            />
          ) : null}
        </div>
      ) : isTraveler ? (
        <div className="constellation-header">
          <TravelerElementTabs
            activeElement={travelerElement}
            onChange={setTravelerElement}
          />
        </div>
      ) : null}

      {loading && (
        <p className="mb-4 text-center text-sm text-white">Загрузка талантов...</p>
      )}
      {loadError && (
        <p className="mb-4 text-center text-sm text-red-200">{loadError}</p>
      )}
      {!loading && unavailable && (
        <p className="mb-4 text-center text-sm text-white">
          Описания талантов для этого персонажа недоступны.
        </p>
      )}

      {!loading && talents.length > 0 && (
        <div className="talent-list">
          {talents.map((talent) => (
            <article key={talent.key} className="talent-card">
              <div className="talent-card-head">
                {talent.iconUrl ? (
                  <img
                    src={talent.iconUrl}
                    alt=""
                    className="talent-icon"
                    referrerPolicy="no-referrer"
                    decoding="async"
                  />
                ) : (
                  <span className="talent-icon-fallback">{talent.badge}</span>
                )}
                <div className="talent-card-meta">
                  <span className="talent-type">{talent.label}</span>
                  <h3 className="talent-name">{talent.name}</h3>
                </div>
              </div>
              {talent.description ? (
                <p className="constellation-detail-text talent-description">
                  {highlightConstellationText(talent.description)}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function NotionBrandMark({ className = '' }) {
  return (
    <span className={`notion-brand ${className}`.trim()} aria-hidden="true">
      N
    </span>
  );
}

export function formatNotionDate(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  try {
    const parsed = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) return raw;
    return parsed.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return raw;
  }
}

function formatStripDps(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return Math.round(Number(value)).toLocaleString('ru-RU');
}

export function PlayerDisplayName({
  name,
  fallback = 'Игрок',
  className = '',
}) {
  const label = name || fallback;
  const accentClass = isSuperuserDisplayName(label) ? 'text-genshin-mintbright' : '';
  return (
    <span className={[accentClass, className].filter(Boolean).join(' ')}>
      {label}
    </span>
  );
}

export function ResultSummaryStrip({
  userName,
  isSelf = false,
  meta = null,
  teamEntries = [],
  totalDps = null,
  href = null,
  externalHref = null,
  className = '',
  trailing = null,
}) {
  const stripBody = (
    <>
      <div className="result-strip-user min-w-0 shrink-0 sm:w-[7.5rem] md:w-[9rem]">
        <p className="truncate text-sm font-semibold text-white">
          <PlayerDisplayName name={userName} />
          {isSelf ? (
            <span className="ml-1.5 text-xs font-normal text-white/65">(вы)</span>
          ) : null}
        </p>
        {meta ? (
          <p className="truncate text-[11px] text-white/55">{meta}</p>
        ) : null}
      </div>

      <ul className="result-strip-team" aria-label="Состав команды">
        {teamEntries.length > 0 ? (
          teamEntries.map(({ name, character, key }) => (
            <li key={key || name} className="result-strip-avatar">
              <CharacterAvatar
                character={character}
                size="xs"
                nameFallback={name || '?'}
              />
            </li>
          ))
        ) : (
          <li className="text-xs text-white/50">—</li>
        )}
      </ul>

      <div className="result-strip-dps ml-auto shrink-0 text-right">
        <span className="result-strip-dps-label">DPS</span>
        <p className="result-strip-dps-value">{formatStripDps(totalDps)}</p>
      </div>

      {trailing ? (
        <div className="result-strip-trailing shrink-0">{trailing}</div>
      ) : null}
    </>
  );

  const stripClass = `result-strip ${href || externalHref ? 'result-strip-clickable' : ''} ${className}`.trim();

  if (href) {
    return (
      <Link to={href} className={stripClass}>
        {stripBody}
      </Link>
    );
  }

  if (externalHref) {
    return (
      <a
        href={externalHref}
        target="_blank"
        rel="noopener noreferrer"
        className={stripClass}
      >
        {stripBody}
      </a>
    );
  }

  return (
    <article className={stripClass}>
      {stripBody}
    </article>
  );
}

export function NotionResultCard({
  item,
  canDelete = false,
  deleting = false,
  onDelete,
}) {
  const formattedDate = formatNotionDate(item.calculated_at);
  const teamEntries = resolveNotionTeamCharacters(item).map(({ name, character }) => ({
    name,
    character,
    key: `${item.page_id}-${name}`,
  }));

  const resultHref = item.user_id ? `/results/${item.user_id}` : null;

  return (
    <div className="result-strip-row">
      <ResultSummaryStrip
        userName={item.user_label || 'Игрок'}
        meta={formattedDate}
        teamEntries={teamEntries}
        totalDps={item.total_dps}
        href={resultHref}
        externalHref={!resultHref ? item.notion_url : null}
        className="min-w-0 flex-1"
      />
      {canDelete ? (
        <button
          type="button"
          onClick={() => onDelete?.(item.page_id)}
          disabled={deleting}
          className="notion-delete-btn"
        >
          {deleting ? '…' : 'Удалить'}
        </button>
      ) : null}
    </div>
  );
}

export function NotionResultsSection({
  results = [],
  notice = null,
  error = null,
  refreshing = false,
  onRefresh,
  deletingPageId = null,
  onDelete,
  canDeleteItem,
  canDeleteAny = false,
  isAuthenticated = false,
  embedded = false,
}) {
  if (!isAuthenticated) {
    return (
      <section
        id="notion-results"
        className={embedded ? 'scroll-mt-24' : 'mt-10 scroll-mt-24'}
      >
        <div className="glass-panel p-6 text-center text-sm text-white/80">
          Расчёт игроков доступен только зарегистрированным пользователям.
          {' '}
          Войдите или зарегистрируйтесь через кнопку в шапке сайта.
        </div>
      </section>
    );
  }

  return (
    <section
      id="notion-results"
      className={embedded ? 'scroll-mt-24' : 'mt-10 scroll-mt-24'}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        {!embedded ? (
          <h2 className="text-lg font-semibold text-white">Расчёт игроков</h2>
        ) : (
          <p className="min-w-0 flex-1 text-sm text-white/75">
            Нажмите на строку, чтобы открыть расчёт.
            {canDeleteAny ? ' Только суперюзер может удалять записи.' : null}
          </p>
        )}
        <ActionButton
          variant="secondary"
          className="shrink-0"
          onClick={onRefresh}
          disabled={refreshing}
        >
          {refreshing ? 'Обновление…' : 'Обновить'}
        </ActionButton>
      </div>
      {!embedded ? (
        <p className="mb-4 text-sm text-white/75">
          Нажмите на строку, чтобы открыть расчёт.
          {canDeleteAny ? ' Только суперюзер может удалять записи.' : null}
        </p>
      ) : null}

      {notice ? (
        <div className="notion-alert notion-alert-warning mb-4">{notice}</div>
      ) : null}
      {error ? (
        <div className="notion-alert notion-alert-error mb-4">{error}</div>
      ) : null}

      {results.length === 0 ? (
        <div className="glass-panel p-5 text-center text-sm text-white/80">
          Пока нет сохранённых расчётов игроков.
        </div>
      ) : (
        <ul className="result-strip-list glass-panel p-2 md:p-3">
          {results.map((item) => (
            <li key={item.page_id}>
              <NotionResultCard
                item={item}
                canDelete={canDeleteItem?.(item)}
                deleting={deletingPageId === item.page_id}
                onDelete={onDelete}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function NotionSavePanel({
  onSave,
  saveState = 'idle',
  saveError = null,
  listHref = '/results#notion-results',
}) {
  const isLoading = saveState === 'loading';
  const isSuccess = saveState === 'success';

  return (
    <div className="notion-save-panel">
      <div className="flex flex-wrap items-start gap-4">
        <NotionBrandMark className="hidden sm:inline-flex" />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-white">Сохранить в Notion</h3>
          <p className="mt-1 text-sm text-white/75">
            Добавьте текущий расчёт в общий журнал команды.
          </p>
          {isLoading ? (
            <p className="mt-2 text-sm text-white/70">Сохраняем запись…</p>
          ) : null}
          {isSuccess ? (
            <p className="mt-2 text-sm text-genshin-mintbright">
              Готово.{' '}
              <Link to={listHref} className="underline underline-offset-2 hover:text-white">
                Открыть журнал
              </Link>
            </p>
          ) : null}
          {saveError ? (
            <p className="mt-2 text-sm text-red-300">{saveError}</p>
          ) : null}
        </div>
        <ActionButton
          variant={isSuccess ? 'secondary' : 'primary'}
          onClick={onSave}
          disabled={isLoading}
          className="shrink-0"
        >
          {isLoading ? 'Сохранение…' : isSuccess ? 'Сохранено' : 'Сохранить'}
        </ActionButton>
      </div>
    </div>
  );
}

/* ─── Кнопка действия ─── */
export function ActionButton({ children, onClick, variant = 'primary', className = '', disabled = false }) {
  const styles = {
    primary: 'btn-pill-gold disabled:opacity-40',
    secondary: 'btn-pill-ghost border-genshin-mint/50 text-genshin-mintbright hover:bg-genshin-mint/15',
    accent: 'btn-pill-solid bg-genshin-accent/90 hover:bg-genshin-accent',
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`font-medium transition disabled:cursor-not-allowed ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

/* ─── Bar-диаграмма ─── */
export function BarChart({ data, labelKey = 'name', valueKey = 'value' }) {
  const max = Math.max(...data.map((d) => d[valueKey]), 1);

  return (
    <div className="space-y-3">
      {data.map((item) => (
        <div key={item[labelKey]}>
          <div className="mb-1 flex justify-between text-sm">
            <span>{item[labelKey]}</span>
            <span className="text-white">{item[valueKey].toLocaleString()}</span>
          </div>
          <div className="h-4 overflow-hidden rounded-full border border-white/30 bg-white/20">
            <div
              className="h-full rounded bg-gradient-to-r from-genshin-gold to-genshin-accent transition-all"
              style={{ width: `${(item[valueKey] / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Pie-диаграмма ─── */
export function PieChart({ data }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const colors = ['#d4a853', '#e94560', '#4ecca3', '#533483'];
  let cumulative = 0;
  const segments = data.map((d, i) => {
    const start = (cumulative / total) * 360;
    cumulative += d.value;
    const end = (cumulative / total) * 360;
    return `${colors[i % colors.length]} ${start}deg ${end}deg`;
  });

  return (
    <div className="flex items-center gap-6">
      <div
        className="h-36 w-36 shrink-0 rounded-full"
        style={{ background: `conic-gradient(${segments.join(', ')})` }}
      />
      <ul className="space-y-1 text-sm">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ background: colors[i % colors.length] }} />
            {d.name}: {Math.round((d.value / total) * 100)}%
          </li>
        ))}
      </ul>
    </div>
  );
}
