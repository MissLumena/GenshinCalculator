/**
 * Все страницы приложения V2.
 */
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  CharacterCard,
  CharacterAvatar,
  ConstellationPanel,
  CharacterTalentsPanel,
  CharacterPickerBar,
  ActionButton,
  InputField,
  ElementalResBonusPicker,
  Tooltip,
  ConfirmModal,
  BarChart,
  PieChart,
  LoadingState,
  ErrorState,
  PageBackLink,
  ModalOverlay,
  CharacterShowcaseCard,
  CharacterNameLabel,
  WeaponPicker,
  WeaponIcon,
  DualArtifactSetPicker,
  ArtifactSetIcon,
  NotionResultsSection,
  NotionSavePanel,
  ResultSummaryStrip,
  PlayerDisplayName,
} from './components';
import {
  FORMULAS,
  ELEMENT_COLORS,
  getSetBonuses,
  calculateMockDps,
  normalizeArtifacts,
  getConfigTotalAtk,
  applyConfigTotalAtk,
  getElementalResBonusSlots,
  patchElementalResBonusSlot,
} from './mockData';
import {
  findWeaponById,
  getWeaponLabel,
  getWeaponsForType,
  getWeaponCatalogTotal,
  getWeaponMeta,
  normalizeWeaponType,
} from './weapons';
import {
  findArtifactSetById,
  getArtifactCatalogTotal,
  ARTIFACT_CATALOG_MAX_VERSION,
} from './artifacts';
import { CHARACTER_REGIONS } from './characters';
import { useAppState } from './context';
import { useCharacterConfigEditor } from './hooks/useCharacterConfigEditor';
import {
  canReachTalentLevel13,
  formatTalentLevelsLabel,
  getTalentConstellationBoosts,
  getTalentLevelLimits,
  normalizeStoredTalentLevel,
} from './lib/talentLevelLimits';
import { LOCAL_USER_ID, buildLocalResultsEntry } from './lib/displayName';
import {
  RESULTS_TAB_MINE,
  RESULTS_TAB_PLAYERS,
  resolveResultsTabFromHash,
  resultsPageHref,
  resultsTabHash,
} from './lib/resultsTabs';
import { canDeleteAnyNotionResult, canDeleteNotionResult } from './lib/permissions';
import { fetchSessionPermissions } from './services/authSessionService';
import {
  fetchResultsUsers,
  fetchUserResults,
  filterMyResultsUsers,
  shouldUseLocalResultsSummary,
} from './services/resultsService';
import { computeTeamDpsSummary, buildGetConfigFromPayload } from './lib/resultsSummary';
import {
  buildNotionSavePayload,
  saveResultToNotion,
  fetchNotionResults,
  deleteNotionResult,
  getSupabaseAccessToken,
  validateNotionSavePayload,
} from './services/notionService';
import { getSupabaseClient } from './lib/supabase';

/* ═══════════════════════════════════════════
   1. Главная страница
   ═══════════════════════════════════════════ */
const HOME_SHOWCASE_IDS = ['flins', 'varka', 'loen'];

export function HomePage() {
  const { findCharacter, isAuthenticated } = useAppState();
  const showcase = HOME_SHOWCASE_IDS.map((id) => findCharacter(id)).filter(Boolean);

  return (
    <div className="mx-auto max-w-7xl px-4 md:px-8">
      <section className="relative mb-16">
        <div className="relative z-10 max-w-3xl">
          <p className="mb-3 text-xs uppercase tracking-[0.25em] text-white/50">DPS Calculator</p>
          <h1 className="font-display mb-6 text-4xl font-bold leading-[1.1] text-black md:text-5xl lg:text-[3.4rem]">
            Genshin Calculator
          </h1>

          <div className="glass-panel mb-8 p-5 md:p-6">
            <p className="text-sm leading-relaxed text-white/80 md:text-base">
              Рассчитывайте урон, настраивайте артефакты и собирайте команду из четырёх персонажей.
              Сохраняйте билды в облаке и сравнивайте результаты с другими игроками.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link to="/team" className="btn-pill-gold">
              Начать расчёт
            </Link>
            {isAuthenticated ? (
              <Link to={resultsPageHref(true)} className="btn-pill-ghost">
                Результаты игроков
              </Link>
            ) : (
              <Link to={resultsPageHref(false)} className="btn-pill-ghost">
                Мои расчёты
              </Link>
            )}
          </div>
        </div>
      </section>

      {showcase.length > 0 && (
        <section className="mb-10">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 className="page-heading">Персонажи</h2>
              <p className="page-subheading mt-1">Откройте карточку для настройки билда</p>
            </div>
            <Link to="/characters" className="btn-pill-ghost hidden sm:inline-flex">
              Все персонажи
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {showcase.map((char) => (
              <CharacterShowcaseCard
                key={char.id}
                character={char}
                to={`/character/${char.id}`}
                useSplashArt
              />
            ))}
          </div>
        </section>
      )}

      <section className="glass-panel p-6 md:p-8">
        <h2 className="page-heading mb-3 text-xl md:text-2xl">Возможности калькулятора</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { title: 'Билды', desc: 'Статы, артефакты и созвездия каждого персонажа' },
            { title: 'Команда', desc: 'Сборка отряда из 4 героев с расчётом суммарного ATK' },
            { title: 'DPS', desc: 'Таблица урона, графики и сравнение билдов' },
          ].map(({ title, desc }) => (
            <div key={title} className="glass-nested p-4">
              <h3 className="font-medium text-white">{title}</h3>
              <p className="mt-2 text-sm text-white/65">{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════
   2. Справочник персонажей — созвездия
   ═══════════════════════════════════════════ */
export function CharactersPage() {
  const { characters } = useAppState();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [infoTab, setInfoTab] = useState('const');

  const filtered = useMemo(() => {
    if (!search.trim()) return characters;
    const q = search.toLowerCase();
    return characters.filter(
      (c) => c.name.toLowerCase().includes(q) || c.nameRu.toLowerCase().includes(q),
    );
  }, [search, characters]);

  const selectedChar = filtered.find((c) => c.id === selectedId) || null;

  useEffect(() => {
    if (!filtered.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !filtered.some((c) => c.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="page-heading mb-4">Персонажи</h1>

      <input
        type="text"
        placeholder="Поиск по имени..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="glass-input mb-6 w-full max-w-sm px-3 py-2 text-sm"
      />

      {filtered.length > 0 ? (
        <>
          <CharacterPickerBar
            characters={filtered}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          {selectedChar && (
            <>
              <div className="character-info-tabs" role="tablist" aria-label="Раздел справочника">
                <button
                  type="button"
                  role="tab"
                  aria-selected={infoTab === 'const'}
                  className={`character-info-tab ${infoTab === 'const' ? 'is-active' : ''}`}
                  onClick={() => setInfoTab('const')}
                >
                  Созвездия
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={infoTab === 'talents'}
                  className={`character-info-tab ${infoTab === 'talents' ? 'is-active' : ''}`}
                  onClick={() => setInfoTab('talents')}
                >
                  Таланты
                </button>
              </div>
              {infoTab === 'const' ? (
                <ConstellationPanel character={selectedChar} />
              ) : (
                <CharacterTalentsPanel character={selectedChar} />
              )}
            </>
          )}
        </>
      ) : (
        <p className="mt-8 text-center text-gray-400">Персонажи не найдены</p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   3. Настройки персонажа (5 вкладок)
   ═══════════════════════════════════════════ */
const TABS = [
  { key: 'stats', label: 'Базовые статы' },
  { key: 'crit', label: 'Крит & Энергия' },
  { key: 'weapon', label: 'Оружие' },
  { key: 'artifacts', label: 'Артефакты' },
  { key: 'const', label: 'Созвездия' },
  { key: 'talents', label: 'Таланты' },
];

export function CharacterSettingsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    savedConfigs,
    saveConfig,
    findCharacter,
    artifactSets,
    actionLoading,
    authLoading,
    userDataLoading,
    actionError,
  } = useAppState();
  const character = findCharacter(id);
  const [tab, setTab] = useState('stats');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const {
    config,
    patchConfig,
    saveError,
    saveState,
    persistConfig,
    flushBeforeLeave,
  } = useCharacterConfigEditor({
    character,
    savedConfigs,
    saveConfig,
    authLoading,
    userDataLoading,
  });

  const handleBackToTeam = useCallback(async () => {
    await flushBeforeLeave();
    navigate('/team');
  }, [flushBeforeLeave, navigate]);

  if (!character) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-white/85">Персонаж не найден</p>
        <Link to="/team" className="mt-4 inline-block text-white">← К команде</Link>
      </div>
    );
  }

  const setBonus = getSetBonuses(config.artifacts, artifactSets);
  const talentLimits = getTalentLevelLimits(character, config.constellation);
  const talentBoosts = getTalentConstellationBoosts(character);
  const talentLevelHint = canReachTalentLevel13(character)
    ? `Данные genshin-db: +3 к талантам через созвездия. Обычная атака до 13${talentBoosts.auto ? ` (C${talentBoosts.auto}+)` : ''}, навык до 13${talentBoosts.skill ? ` (C${talentBoosts.skill}+)` : ''}, взрыв до 13${talentBoosts.burst ? ` (C${talentBoosts.burst}+)` : ''}. В игре реальный максимум — 13.`
    : 'Максимум 10 — у персонажа нет созвездий с +3 к талантам.';
  const characterWeaponType = normalizeWeaponType(character.weapon);
  const compatibleWeaponCount = useMemo(
    () => getWeaponsForType(characterWeaponType).length,
    [characterWeaponType],
  );
  const catalogTotal = getWeaponCatalogTotal();
  const artifactCatalogTotal = getArtifactCatalogTotal();
  const selectedWeapon = getWeaponMeta(config.equippedWeaponId);
  const selectedSecondaryArtifactSet = config.artifacts.set2
    ? findArtifactSetById(config.artifacts.set2)
    : null;
  const bonusSetIds = useMemo(
    () => [...new Set(setBonus.map((bonus) => bonus.setId).filter(Boolean))],
    [setBonus],
  );

  const updateArtifactSets = ({ set, set2 }) => {
    patchConfig((prev) => ({
      ...prev,
      artifacts: { ...prev.artifacts, set, set2: set2 || null },
    }));
  };

  const handleSave = async () => {
    try {
      await persistConfig();
      setShowSaveModal(false);
      navigate('/team');
    } catch {
      setShowSaveModal(false);
    }
  };

  const resBonusSlots = getElementalResBonusSlots(config.elementalResBonuses);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Заголовок персонажа */}
      <div className="mb-6 flex items-center gap-4">
        <CharacterAvatar character={character} size="xl" />
        {selectedWeapon ? (
          <WeaponIcon weaponId={selectedWeapon.id} size="md" rarity={selectedWeapon.rarity} />
        ) : null}
        <div>
          <CharacterNameLabel
            character={character}
            primaryClassName="text-2xl font-bold text-white"
            secondaryClassName="text-sm text-white/75"
          />
          <p className="mt-1 text-white/90">
            {character.element} · {character.weapon} · {character.rarity}★
            {selectedWeapon ? (
              <span className="text-white"> · {getWeaponLabel(config.equippedWeaponId)}</span>
            ) : null}
          </p>
        </div>
      </div>

      {/* Вкладки */}
      <div className="mb-6 flex flex-wrap gap-1 border-b border-white/20">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm transition ${
              tab === t.key
                ? 'settings-tab-active'
                : 'settings-tab-inactive'
            }`}
          >
            {t.label}
            {t.key === 'weapon' ? (
              <span className="accent-badge">{catalogTotal}</span>
            ) : null}
            {t.key === 'artifacts' ? (
              <>
                <span className="accent-badge">{artifactCatalogTotal}</span>
                {config.artifacts.set2 ? (
                  <span className="accent-badge">4+2</span>
                ) : null}
              </>
            ) : null}
          </button>
        ))}
      </div>

      {/* ── Базовые статы ── */}
      {tab === 'stats' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <InputField label="Уровень" value={config.level} onChange={(v) => patchConfig({ level: v })} min={1} max={90} />
          <InputField
            label="ATK"
            value={getConfigTotalAtk(config.atk)}
            onChange={(v) => patchConfig((prev) => ({
              ...prev,
              atk: applyConfigTotalAtk(v),
            }))}
            min={0}
          />
          <InputField label="HP" value={config.hp} onChange={(v) => patchConfig({ hp: v })} min={0} />
          <InputField label="Защита" value={config.def} onChange={(v) => patchConfig({ def: v })} min={0} />
          <InputField label="Мастерство стихий" value={config.em} onChange={(v) => patchConfig({ em: v })} min={0} />
          {[0, 1].map((slotIndex) => {
            const slot = resBonusSlots[slotIndex];
            const otherElements = resBonusSlots
              .filter((_, index) => index !== slotIndex && resBonusSlots[index]?.element)
              .map((bonus) => bonus.element);

            return (
              <div key={slotIndex} className="contents">
                <ElementalResBonusPicker
                  label={`Бонус сопротивления ${slotIndex + 1}`}
                  value={slot?.element ?? null}
                  disabledElements={otherElements}
                  onChange={(element) => patchConfig((prev) => ({
                    ...prev,
                    elementalResBonuses: patchElementalResBonusSlot(
                      prev.elementalResBonuses,
                      slotIndex,
                      { element },
                    ),
                  }))}
                />
                {slot?.element ? (
                  <InputField
                    label={`Значение бонуса ${slotIndex + 1}`}
                    value={slot.value}
                    onChange={(v) => patchConfig((prev) => ({
                      ...prev,
                      elementalResBonuses: patchElementalResBonusSlot(
                        prev.elementalResBonuses,
                        slotIndex,
                        { value: v },
                      ),
                    }))}
                    min={0}
                    suffix="%"
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Крит & Энергия ── */}
      {tab === 'crit' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <InputField
            label="Шанс крит. попадания"
            value={config.critRate}
            onChange={(v) => patchConfig({ critRate: v })}
            min={0}
            max={100}
            suffix="%"
            tooltip={{ text: 'CRIT Rate', formula: FORMULAS.avgDmg }}
          />
          <InputField
            label="Крит. урон"
            value={config.critDmg}
            onChange={(v) => patchConfig({ critDmg: v })}
            min={0}
            suffix="%"
            tooltip={{ text: 'CRIT DMG', formula: FORMULAS.critDmg }}
          />
          <InputField
            label="Восстановление энергии"
            value={config.energyRecharge}
            onChange={(v) => patchConfig({ energyRecharge: v })}
            min={0}
            suffix="%"
          />
        </div>
      )}

      {/* ── Оружие ── */}
      {tab === 'weapon' && (
        <div className="space-y-4">
          <div className="glass-panel-sm p-4">
            {compatibleWeaponCount === 0 ? (
              <p className="mb-4 rounded-xl border border-amber-300/40 bg-amber-500/20 px-3 py-2 text-sm text-white">
                Не удалось определить тип оружия персонажа («{character.weapon}»). Показан полный каталог {catalogTotal} оружий.
              </p>
            ) : (
              <p className="mb-4 text-sm text-white">
                Персонаж использует «{characterWeaponType}» · доступно{' '}
                <span className="accent-count">{compatibleWeaponCount}</span> из{' '}
                <span className="accent-count">{catalogTotal}</span>
              </p>
            )}
            {selectedWeapon ? (
              <div className="mb-4 flex gap-3 rounded-xl border border-genshin-gold/50 bg-slate-900/55 p-4">
                <WeaponIcon weaponId={selectedWeapon.id} size="lg" rarity={selectedWeapon.rarity} />
                <div className="min-w-0">
                  <p className="font-semibold text-white">{selectedWeapon.nameRu}</p>
                  <p className="text-xs text-white/85">{selectedWeapon.nameEn} · {selectedWeapon.rarity}★</p>
                  {selectedWeapon.passiveName ? (
                    <p className="mt-1 text-sm font-medium text-genshin-gold">{selectedWeapon.passiveName}</p>
                  ) : null}
                  {selectedWeapon.description ? (
                    <p className="mt-2 text-sm leading-relaxed text-white/90">{selectedWeapon.description}</p>
                  ) : null}
                </div>
              </div>
            ) : null}
            <WeaponPicker
              characterWeaponType={characterWeaponType}
              characterId={character.id}
              value={config.equippedWeaponId}
              onChange={(weaponId) => patchConfig({ equippedWeaponId: weaponId })}
            />
          </div>
        </div>
      )}

      {/* ── Артефакты ── */}
      {tab === 'artifacts' && (
        <div className="space-y-6">
          <div className="glass-panel-sm p-4">
            <DualArtifactSetPicker
              set={config.artifacts.set}
              set2={config.artifacts.set2}
              onChange={updateArtifactSets}
            />
          </div>

          {setBonus.length > 0 && (
            <div className="glass-panel-sm border-genshin-gold/30 bg-genshin-gold/10 p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {bonusSetIds.map((setId) => (
                  <ArtifactSetIcon key={setId} setId={setId} size="sm" />
                ))}
                <h3 className="font-medium text-white">
                  Бонусы сетов
                  {selectedSecondaryArtifactSet ? ' (4+2)' : null}
                </h3>
              </div>
              {setBonus.map((b, i) => (
                <p key={i} className="text-sm text-white/90">
                  <Tooltip text={`${b.set} (${b.pieces}pc)`} formula={FORMULAS.setBonus}>
                    <span className="cursor-help underline decoration-dotted">{b.set} ({b.pieces}pc):</span>
                  </Tooltip>{' '}
                  {b.text}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Созвездия ── */}
      {tab === 'const' && (
        <ConstellationPanel
          character={character}
          activeLevel={config.constellation}
          onActiveLevelChange={(level) => {
            const limits = getTalentLevelLimits(character, level);
            const levels = config.talentLevels || {};
            patchConfig({
              constellation: level,
              talentLevels: {
                auto: normalizeStoredTalentLevel(levels.auto, limits.auto),
                skill: normalizeStoredTalentLevel(levels.skill, limits.skill),
                burst: normalizeStoredTalentLevel(levels.burst, limits.burst),
              },
            });
          }}
        />
      )}

      {tab === 'talents' && (
        <div className="talent-tab">
          <section className="talent-levels-card" aria-label="Уровни талантов">
            <p className="talent-tab-hint">{talentLevelHint}</p>
            <div className="talent-level-inputs">
              <InputField
                label={`Обычная атака${talentLimits.auto > 10 ? ` · до 13 (C${talentBoosts.auto}+)` : ''}`}
                value={config.talentLevels?.auto ?? null}
                allowEmpty
                onChange={(v) => patchConfig((prev) => ({
                  ...prev,
                  talentLevels: { ...prev.talentLevels, auto: v },
                }))}
                min={1}
                max={talentLimits.auto}
              />
              <InputField
                label={`Элемент. навык${talentLimits.skill > 10 ? ` · до 13 (C${talentBoosts.skill}+)` : ''}`}
                value={config.talentLevels?.skill ?? null}
                allowEmpty
                onChange={(v) => patchConfig((prev) => ({
                  ...prev,
                  talentLevels: { ...prev.talentLevels, skill: v },
                }))}
                min={1}
                max={talentLimits.skill}
              />
              <InputField
                label={`Взрыв стихии${talentLimits.burst > 10 ? ` · до 13 (C${talentBoosts.burst}+)` : ''}`}
                value={config.talentLevels?.burst ?? null}
                allowEmpty
                onChange={(v) => patchConfig((prev) => ({
                  ...prev,
                  talentLevels: { ...prev.talentLevels, burst: v },
                }))}
                min={1}
                max={talentLimits.burst}
              />
            </div>
          </section>
          <CharacterTalentsPanel character={character} showHeader={false} />
        </div>
      )}

      {/* Кнопка сохранения */}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <ActionButton onClick={() => setShowSaveModal(true)}>Сохранить</ActionButton>
        <ActionButton variant="secondary" onClick={handleBackToTeam}>Назад к команде</ActionButton>
        {saveState === 'pending' && (
          <span className="text-sm text-white/85">Изменения сохраняются...</span>
        )}
        {saveState === 'saving' && (
          <span className="text-sm text-white/85">Сохранение...</span>
        )}
        {saveState === 'saved' && (
          <span className="text-sm text-green-300">Сохранено</span>
        )}
      </div>

      {saveError && (
        <p className="mt-4 text-center text-sm text-red-300">{saveError}</p>
      )}
      {actionError && (
        <p className="mt-4 text-center text-sm text-amber-200">{actionError}</p>
      )}

      <ConfirmModal
        open={showSaveModal}
        title="Сохранить персонажа?"
        message={`Сохранить настройки билда для ${character.nameRu}?`}
        onConfirm={handleSave}
        onCancel={() => setShowSaveModal(false)}
      />
      {actionLoading && (
        <p className="mt-2 text-center text-sm text-white">Загрузка...</p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   4. Формирование команды
   ═══════════════════════════════════════════ */
export function TeamPage() {
  const navigate = useNavigate();
  const {
    team,
    teamComposition,
    teamTotalAtk,
    addToTeam,
    clearTeamSlot,
    characters,
    actionLoading,
    userDataLoading,
    isAuthenticated,
    session,
    syncTeamBeforeResults,
  } = useAppState();
  const [pickerSlot, setPickerSlot] = useState(null);
  const [pickerSearch, setPickerSearch] = useState('');

  const teamIds = useMemo(() => new Set(team.filter(Boolean)), [team]);

  const pickerCharacters = useMemo(() => {
    if (!pickerSearch.trim()) return characters;
    const q = pickerSearch.toLowerCase();
    return characters.filter(
      (c) => c.name.toLowerCase().includes(q) || c.nameRu.toLowerCase().includes(q),
    );
  }, [pickerSearch, characters]);

  const pickerRegions = useMemo(() => {
    return CHARACTER_REGIONS.map((region) => ({
      ...region,
      characters: pickerCharacters.filter((c) => c.region === region.id),
    })).filter((r) => r.characters.length > 0);
  }, [pickerCharacters]);

  const handleCalculate = async () => {
    if (!team.some(Boolean)) return;
    if (isAuthenticated && session?.user?.id) {
      try {
        await syncTeamBeforeResults();
      } catch {
        return;
      }
      navigate(`/results/${session.user.id}`);
      return;
    }
    navigate(`/results/${LOCAL_USER_ID}`);
  };

  return (
    <div className="team-page mx-auto max-w-4xl px-4 py-8 text-white">
      <h1 className="page-heading mb-2">Сборка команды</h1>
      <p className="mb-6 text-sm text-white">
        Добавьте до 4 персонажей для расчёта DPS
        {!isAuthenticated && ' · Без входа данные сохраняются локально'}
      </p>

      {(actionLoading || userDataLoading) && (
        <p className="mb-4 text-center text-sm text-white">Загрузка...</p>
      )}

      {teamTotalAtk > 0 && (
        <div className="glass-panel-sm mb-6 flex items-center justify-between px-4 py-3">
          <span className="text-sm text-white">Суммарный ATK команды</span>
          <span className="text-xl font-bold text-white">{teamTotalAtk.toLocaleString()}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((slotIdx) => {
          const slot = teamComposition[slotIdx];

          return (
            <div
              key={slotIdx}
              className="glass-panel flex min-h-[180px] flex-col items-center justify-center border-2 border-dashed border-white/25 p-4"
            >
              {slot ? (
                <>
                  <CharacterAvatar character={slot.char} size="lg" />
                  <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                    <CharacterNameLabel
                      character={slot.char || { nameRu: slot.nameRu, nameEn: slot.nameEn }}
                      className="text-center"
                      primaryClassName="font-semibold text-white"
                      secondaryClassName="text-xs text-white/85"
                    />
                    <span className="rounded bg-genshin-gold/20 px-2 py-0.5 text-xs font-bold text-white">
                      C{slot.constellation}
                    </span>
                  </div>
                  <span className={`mt-1 rounded px-2 py-0.5 text-xs text-white ${ELEMENT_COLORS[slot.element] || 'bg-gray-500'}`}>
                    {slot.element}
                  </span>
                  <p className="mt-1 text-sm text-white">
                    ATK {slot.atk.toLocaleString()} · Lv. {slot.level}
                  </p>
                  <div className="mt-3 flex gap-3">
                    <button
                      type="button"
                      onClick={() => navigate(`/character/${slot.characterId}`)}
                      className="text-xs text-white hover:underline"
                    >
                      Настроить
                    </button>
                    <button
                      type="button"
                      onClick={() => clearTeamSlot(slotIdx)}
                      className="text-xs text-red-400 hover:underline"
                    >
                      Убрать
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setPickerSearch('');
                    setPickerSlot(slotIdx);
                  }}
                  className="flex flex-col items-center gap-2 text-white transition hover:text-white/90"
                >
                  <span className="text-3xl">+</span>
                  <span>Добавить персонажа</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-8 text-center">
        <ActionButton onClick={handleCalculate} disabled={!team.some(Boolean)}>
          Рассчитать DPS команды
        </ActionButton>
      </div>

      <ModalOverlay
        open={pickerSlot !== null}
        onClose={() => {
          setPickerSlot(null);
          setPickerSearch('');
        }}
      >
        <div
          className="glass-modal flex max-h-[85vh] w-full max-w-2xl flex-col p-6"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <h3 className="mb-3 text-lg font-semibold text-white">Выберите персонажа</h3>
          <input
            type="text"
            placeholder="Поиск..."
            value={pickerSearch}
            onChange={(e) => setPickerSearch(e.target.value)}
            className="glass-input mb-4 px-3 py-2 text-sm"
          />
          <div className="flex-1 overflow-y-auto">
            {pickerRegions.map((region) => (
              <section key={region.id} className="mb-4">
                <h4 className="mb-2 text-sm font-medium text-white">{region.label}</h4>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {region.characters.map((char) => {
                    const inTeam = teamIds.has(char.id);
                    return (
                      <CharacterCard
                        key={char.id}
                        character={char}
                        disabled={inTeam}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (inTeam) return;
                          addToTeam(pickerSlot, char.id);
                          setPickerSlot(null);
                          setPickerSearch('');
                        }}
                      />
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setPickerSlot(null);
              setPickerSearch('');
            }}
            className="mt-4 w-full rounded py-2 text-white hover:bg-white/10"
          >
            Отмена
          </button>
        </div>
      </ModalOverlay>
    </div>
  );
}

/* ═══════════════════════════════════════════
   5. Результаты DPS
   ═══════════════════════════════════════════ */

function TeamResultsView({
  title,
  team,
  getConfig,
  findCharacter,
  artifactSets,
  initialRotationTime = 20,
  showComparison = true,
  showNotionSave = false,
}) {
  const { isAuthenticated, profileDisplayName } = useAppState();
  const [rotationTime, setRotationTime] = useState(initialRotationTime);
  const [comparison, setComparison] = useState({ a: null, b: null });
  const [notionSaveState, setNotionSaveState] = useState('idle');
  const [notionSaveError, setNotionSaveError] = useState(null);

  const teamData = useMemo(() => {
    return team
      .filter(Boolean)
      .map((id) => {
        const config = getConfig(id);
        const char = findCharacter(id);
        if (!config || !char) return null;
        return calculateMockDps(config, char, { artifactSets });
      })
      .filter(Boolean);
  }, [team, getConfig, findCharacter, artifactSets]);

  const totalDps = teamData.reduce((s, d) => s + d.totalDps, 0);
  const pieData = teamData.map((d) => ({ name: d.name, value: d.totalDps }));

  const handleSaveToNotion = async () => {
    setNotionSaveError(null);
    setNotionSaveState('loading');
    try {
      const accessToken = await getSupabaseAccessToken();
      if (!accessToken) {
        throw new Error('Требуется вход в аккаунт');
      }
      const payload = buildNotionSavePayload({
        team,
        getConfig,
        findCharacter,
        totalDps,
      });
      validateNotionSavePayload(payload);
      await saveResultToNotion(payload, accessToken);
      setNotionSaveState('success');
    } catch (err) {
      setNotionSaveState('error');
      setNotionSaveError(err.message || 'Не удалось сохранить результат');
    }
  };

  const saveForComparison = (slot) => {
    setComparison((prev) => ({ ...prev, [slot]: { teamData, totalDps, rotationTime } }));
  };

  if (teamData.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-white/80">Нет данных для расчёта. Сформируйте команду.</p>
        <PageBackLink to="/team" label="К команде" className="mt-4" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <PageBackLink to="/results#notion-results" label="К списку результатов" className="mb-3" />
        <h1 className="page-heading">{title}</h1>
      </div>

      <section className="glass-panel mb-8 p-6">
        <h2 className="mb-4 text-lg font-semibold">Урон персонажей</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/20 text-left text-white/80">
                <th className="pb-2 pr-4">Персонаж</th>
                <th className="pb-2 pr-4">Навык</th>
                <th className="pb-2 pr-4">
                  <Tooltip text="Средний урон" formula={FORMULAS.avgDmg}>Обычный</Tooltip>
                </th>
                <th className="pb-2">
                  <Tooltip text="Крит урон" formula={FORMULAS.critDmg}>Крит</Tooltip>
                </th>
              </tr>
            </thead>
            <tbody>
              {teamData.map((d) =>
                Object.entries({ 'Автоатака': d.skills.auto, 'Скилл': d.skills.skill, 'Взрыв': d.skills.burst }).map(
                  ([skillName, skill], idx) => (
                    <tr key={`${d.characterId}-${skillName}`} className="border-b border-gray-700/50">
                      {idx === 0 && (
                        <td className="py-2 pr-4" rowSpan={3}>
                          <span className="inline-flex items-center gap-2">
                            <CharacterAvatar character={findCharacter(d.characterId)} size="xs" />
                            <CharacterNameLabel
                              character={findCharacter(d.characterId) || { nameRu: d.nameRu, nameEn: d.nameEn }}
                              primaryClassName="text-sm font-medium text-white"
                              secondaryClassName="text-xs text-white/55"
                            />
                          </span>
                        </td>
                      )}
                      <td className="py-2 pr-4">
                        {skillName}
                        {skill.affectedByConst && (
                          <span className="ml-1 text-white" title={`C${d.constellation} влияет`}>★</span>
                        )}
                      </td>
                      <td className="py-2 pr-4">{skill.normal.toLocaleString()}</td>
                      <td className="py-2">{skill.crit.toLocaleString()}</td>
                    </tr>
                  ),
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="glass-panel mb-8 p-6">
        <h2 className="mb-4 text-lg font-semibold">Учтённые параметры билда</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {teamData.map((entry) => (
            <div key={entry.characterId} className="glass-nested p-4 text-sm text-white/90">
              <p className="mb-2 font-semibold text-white">{entry.name}</p>
              <p>ATK: {entry.breakdown?.totalAtk?.toLocaleString() ?? '—'}</p>
              <p>
                CRIT: {entry.breakdown?.critRate ?? '—'}% / {entry.breakdown?.critDmg ?? '—'}%
              </p>
              <p>
                Созвездие C{entry.constellation}
                {' · '}
                Таланты {formatTalentLevelsLabel(entry.breakdown?.sources?.talentLevels)}
              </p>
              <p>
                Оружие: {entry.breakdown?.sources?.weapon?.label || 'не выбрано'}
              </p>
              <p>
                Артефакты:{' '}
                {entry.breakdown?.sources?.artifacts?.setBonuses?.length
                  ? entry.breakdown.sources.artifacts.setBonuses
                    .map((bonus) => `${bonus.set} (${bonus.pieces}pc)`)
                    .join(' + ')
                  : 'без сетов'}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-panel mb-8 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">
            <Tooltip text="Суммарный DPS" formula={FORMULAS.teamDps}>Итого команды</Tooltip>
          </h2>
          <label className="flex items-center gap-2 text-sm">
            Ротация (сек):
            <input
              type="number"
              value={rotationTime}
              min={5}
              max={60}
              onChange={(e) => setRotationTime(Number(e.target.value))}
              className="glass-input w-16 px-2 py-1"
            />
          </label>
        </div>
        <p className="mb-4 text-3xl font-bold text-white">
          {(totalDps * rotationTime / 20).toLocaleString()}{' '}
          <span className="text-base font-normal text-white/80">урона за {rotationTime}с</span>
        </p>
        <div className="grid gap-6 md:grid-cols-2">
          <BarChart data={pieData.map((d) => ({ name: d.name, value: d.value }))} />
          <PieChart data={pieData} />
        </div>

        {showNotionSave && isAuthenticated && (
          <NotionSavePanel
            onSave={handleSaveToNotion}
            saveState={notionSaveState}
            saveError={notionSaveError}
          />
        )}
      </section>

      {showComparison && (
        <section className="glass-panel p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Сравнение билдов</h2>
            <ActionButton variant="secondary" onClick={() => saveForComparison(comparison.a ? 'b' : 'a')}>
              Добавить для сравнения
            </ActionButton>
          </div>

          {(comparison.a || comparison.b) ? (
            <div className="grid gap-4 md:grid-cols-2">
              {['a', 'b'].map((slot) => {
                const build = comparison[slot];
                return (
                  <div key={slot} className="glass-panel-sm p-4">
                    <h3 className="mb-3 font-medium text-white">Билд {slot === 'a' ? 'A' : 'B'}</h3>
                    {build ? (
                      <>
                        <p className="mb-2 text-2xl font-bold">{build.totalDps.toLocaleString()} DPS</p>
                        <p className="mb-3 text-sm text-white/80">Ротация: {build.rotationTime}с</p>
                        <ul className="space-y-1 text-sm">
                          {build.teamData.map((d) => (
                            <li key={d.characterId} className="flex items-center gap-2">
                              <CharacterAvatar character={findCharacter(d.characterId)} size="xs" />
                              <CharacterNameLabel
                                character={findCharacter(d.characterId) || { nameRu: d.nameRu, nameEn: d.nameEn }}
                                primaryClassName="text-sm text-white"
                                secondaryClassName="text-xs text-white/55"
                                layout="inline"
                              />
                              <span className="text-white/70">: {d.totalDps.toLocaleString()}</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <p className="text-white/70">Не сохранён</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-white/80">Нажмите «Добавить для сравнения», чтобы сохранить текущий расчёт.</p>
          )}

          {comparison.a && comparison.b && (
            <p className="mt-4 text-center text-lg">
              Разница:{' '}
              <span className={comparison.b.totalDps > comparison.a.totalDps ? 'text-green-400' : 'text-red-400'}>
                {comparison.b.totalDps > comparison.a.totalDps ? '+' : ''}
                {(comparison.b.totalDps - comparison.a.totalDps).toLocaleString()} DPS
              </span>
            </p>
          )}
        </section>
      )}
    </div>
  );
}

export function ResultsPage() {
  const {
    isAuthenticated,
    authLoading,
    session,
    profileDisplayName,
    authPermissions,
    team,
    getConfig,
    findCharacter,
    artifactSets,
  } = useAppState();
  const hasMyTeam = team.some(Boolean);
  const [users, setUsers] = useState([]);
  const [userSummaries, setUserSummaries] = useState({});
  const [summariesLoading, setSummariesLoading] = useState(false);
  const [notionResults, setNotionResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hint, setHint] = useState(null);
  const [notionNotice, setNotionNotice] = useState(null);
  const [notionError, setNotionError] = useState(null);
  const [notionRefreshing, setNotionRefreshing] = useState(false);
  const [deletingPageId, setDeletingPageId] = useState(null);
  const [localPermissions, setLocalPermissions] = useState(null);
  const [activeTab, setActiveTab] = useState(() => resolveResultsTabFromHash(
    window.location.hash,
    { isAuthenticated: false },
  ));

  const effectivePermissions = authPermissions ?? localPermissions;
  const canDeleteAnyNotion = canDeleteAnyNotionResult(session, effectivePermissions);

  const myUsers = useMemo(
    () => filterMyResultsUsers(users, {
      session,
      isAuthenticated,
      profileDisplayName,
    }),
    [users, session, isAuthenticated, profileDisplayName],
  );

  const mineDisplayUsers = useMemo(() => {
    if (myUsers.length > 0) return myUsers;
    if (!hasMyTeam) return [];
    if (isAuthenticated && session?.user?.id) {
      return [{
        userId: session.user.id,
        displayName: profileDisplayName || 'Вы',
      }];
    }
    return [{ userId: LOCAL_USER_ID, displayName: 'Вы (локально)' }];
  }, [myUsers, hasMyTeam, isAuthenticated, session?.user?.id, profileDisplayName]);

  useEffect(() => {
    if (!session?.user) {
      setLocalPermissions(null);
      return undefined;
    }

    let cancelled = false;

    async function loadPermissions() {
      const token = await getSupabaseAccessToken();
      if (!token || cancelled) return;
      const permissions = await fetchSessionPermissions(token);
      if (!cancelled) setLocalPermissions(permissions);
    }

    loadPermissions();
    return () => { cancelled = true; };
  }, [session?.user?.id, session?.access_token]);

  const loadNotionResults = useCallback(async () => {
    setNotionRefreshing(true);
    setNotionError(null);
    setNotionNotice(null);
    try {
      const accessToken = await getSupabaseAccessToken();
      if (!accessToken) {
        throw new Error('Войдите в аккаунт, чтобы просматривать расчёты игроков');
      }
      const notionData = await fetchNotionResults(accessToken);
      setNotionResults(notionData.items || []);
      if (notionData.unavailable && notionData.message) {
        setNotionNotice(notionData.message);
      }
    } catch (err) {
      setNotionError(err.message || 'Notion недоступен');
    } finally {
      setNotionRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      setLoading(true);
      setError(null);
      setHint(null);
      setNotionError(null);
      setNotionNotice(null);
      try {
        const notionPromise = isAuthenticated
          ? getSupabaseAccessToken()
            .then((token) => (token ? fetchNotionResults(token) : { items: [] }))
            .catch((err) => {
              if (!cancelled) setNotionError(err.message || 'Notion недоступен');
              return { items: [], unavailable: true, message: null };
            })
          : Promise.resolve({ items: [], unavailable: false, message: null });

        const [result, notionData] = await Promise.all([
          fetchResultsUsers({ includeLocal: !isAuthenticated }).catch((err) => ({
            users: !isAuthenticated ? [buildLocalResultsEntry()] : [],
            hint: err.message || 'Не удалось загрузить список пользователей',
            rpcMissing: false,
          })),
          notionPromise,
        ]);
        if (!cancelled) {
          setUsers(result.users);
          setHint(result.hint);
          setNotionResults(notionData.items || []);
          if (notionData.unavailable && notionData.message) {
            setNotionNotice(notionData.message);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Не удалось загрузить список');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadUsers();
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  useEffect(() => {
    if (loading || !hasMyTeam) {
      setUserSummaries({});
      return undefined;
    }

    let cancelled = false;

    async function loadSummaries() {
      setSummariesLoading(true);
      try {
        const entries = await Promise.all(mineDisplayUsers.map(async (user) => {
          if (shouldUseLocalResultsSummary(user.userId, { session, isAuthenticated })) {
            return [
              user.userId,
              computeTeamDpsSummary(team, getConfig, findCharacter, artifactSets),
            ];
          }

          try {
            const data = await fetchUserResults(user.userId);
            if (!data?.team?.length) {
              return [user.userId, null];
            }
            const getRemoteConfig = buildGetConfigFromPayload(data.configs);
            return [
              user.userId,
              computeTeamDpsSummary(data.team, getRemoteConfig, findCharacter, artifactSets),
            ];
          } catch {
            return [user.userId, null];
          }
        }));

        if (!cancelled) {
          setUserSummaries(Object.fromEntries(entries));
        }
      } finally {
        if (!cancelled) setSummariesLoading(false);
      }
    }

    loadSummaries();
    return () => { cancelled = true; };
  }, [mineDisplayUsers, loading, hasMyTeam, team, getConfig, findCharacter, artifactSets, session, isAuthenticated]);

  useEffect(() => {
    const syncTabFromHash = () => {
      setActiveTab(resolveResultsTabFromHash(window.location.hash, { isAuthenticated }));
    };

    syncTabFromHash();
    window.addEventListener('hashchange', syncTabFromHash);
    return () => window.removeEventListener('hashchange', syncTabFromHash);
  }, [isAuthenticated]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated && window.location.hash === '#notion-results') {
      window.history.replaceState(null, '', `${window.location.pathname}${resultsTabHash(RESULTS_TAB_MINE)}`);
      setActiveTab(RESULTS_TAB_MINE);
    }
  }, [authLoading, isAuthenticated]);

  const selectResultsTab = useCallback((tabId) => {
    setActiveTab(tabId);
    window.history.replaceState(null, '', `${window.location.pathname}${resultsTabHash(tabId)}`);
  }, []);

  const handleDeleteNotionResult = async (pageId) => {
    setDeletingPageId(pageId);
    setNotionError(null);
    try {
      const accessToken = await getSupabaseAccessToken();
      if (!accessToken) {
        throw new Error('Требуется вход в аккаунт');
      }
      await deleteNotionResult(pageId, accessToken);
      setNotionResults((prev) => prev.filter((item) => item.page_id !== pageId));
    } catch (err) {
      setNotionError(err.message || 'Не удалось удалить запись');
    } finally {
      setDeletingPageId(null);
    }
  };

  const canDeleteNotionItem = useCallback(
    (item) => canDeleteNotionResult(session, item, effectivePermissions),
    [session, effectivePermissions],
  );

  const pageSubtitle = activeTab === RESULTS_TAB_PLAYERS
    ? 'Расчёты всех игроков. Нажмите на строку, чтобы открыть.'
    : 'Ваш сохранённый расчёт с этого аккаунта. Нажмите на строку, чтобы открыть подробный DPS.';

  if (loading) {
    return <LoadingState message="Загрузка результатов..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageBackLink to="/team" label="К команде" className="mb-4" />
      <h1 className="page-heading mb-2">Результаты</h1>
      <p className="mb-4 text-sm text-white/80">
        {pageSubtitle}
      </p>

      <div className="results-page-tabs" role="tablist" aria-label="Раздел результатов">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === RESULTS_TAB_MINE}
          className={`results-page-tab ${activeTab === RESULTS_TAB_MINE ? 'is-active' : ''}`}
          onClick={() => selectResultsTab(RESULTS_TAB_MINE)}
        >
          Мои расчёты
        </button>
        {isAuthenticated ? (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === RESULTS_TAB_PLAYERS}
            className={`results-page-tab ${activeTab === RESULTS_TAB_PLAYERS ? 'is-active' : ''}`}
            onClick={() => selectResultsTab(RESULTS_TAB_PLAYERS)}
          >
            Расчёт игроков
            {notionResults.length > 0 ? (
              <span className="ml-1.5 rounded-full bg-genshin-mint/20 px-2 py-0.5 text-xs text-genshin-mintbright">
                {notionResults.length}
              </span>
            ) : null}
          </button>
        ) : null}
      </div>

      {hint && activeTab === RESULTS_TAB_MINE ? (
        <div className="mb-6 rounded border border-genshin-gold/40 bg-genshin-gold/10 px-4 py-3 text-sm text-white">
          {hint}
        </div>
      ) : null}

      {activeTab === RESULTS_TAB_MINE ? (
        !hasMyTeam ? (
          <div className="glass-panel p-6 text-center text-white/80">
            Пока нет сохранённых расчётов. Соберите команду и нажмите «Рассчитать DPS».
            <Link to="/team" className="mt-4 block text-white hover:underline">Перейти к команде</Link>
          </div>
        ) : (
          <ul className="result-strip-list glass-panel p-2 md:p-3">
            {mineDisplayUsers.map(({ userId, displayName }) => {
              const isSelf = session?.user?.id === userId;
              const summary = userSummaries[userId];
              const teamEntries = (summary?.teamIds || []).map((characterId) => ({
                key: characterId,
                name: findCharacter(characterId)?.nameRu || characterId,
                character: findCharacter(characterId),
              }));

              return (
                <li key={userId}>
                  <ResultSummaryStrip
                    href={`/results/${userId}`}
                    userName={displayName}
                    isSelf={isSelf}
                    teamEntries={teamEntries}
                    totalDps={summariesLoading && !summary ? null : summary?.totalDps ?? null}
                  />
                </li>
              );
            })}
          </ul>
        )
      ) : (
        <NotionResultsSection
          results={notionResults}
          notice={notionNotice}
          error={notionError}
          refreshing={notionRefreshing}
          onRefresh={loadNotionResults}
          deletingPageId={deletingPageId}
          onDelete={handleDeleteNotionResult}
          canDeleteItem={canDeleteNotionItem}
          canDeleteAny={canDeleteAnyNotion}
          isAuthenticated={isAuthenticated}
          embedded
        />
      )}
    </div>
  );
}

export function UserResultsPage() {
  const { userId } = useParams();
  const {
    team,
    getConfig,
    findCharacter,
    isAuthenticated,
    session,
    artifactSets,
  } = useAppState();
  const [remoteData, setRemoteData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isLocalView = userId === LOCAL_USER_ID;
  const isOwnView = isAuthenticated && session?.user?.id === userId;

  useEffect(() => {
    if (isLocalView || isOwnView) {
      setLoading(false);
      setRemoteData(null);
      return undefined;
    }

    let cancelled = false;

    async function loadRemoteResults() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchUserResults(userId);
        if (!cancelled) {
          if (!data) {
            setError('Пользователь не найден');
          } else {
            setRemoteData(data);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Не удалось загрузить расчёт');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadRemoteResults();
    return () => { cancelled = true; };
  }, [userId, isLocalView, isOwnView]);

  const configByCharacterId = useMemo(() => {
    if (!remoteData?.configs) return null;
    return new Map(remoteData.configs.map((config) => [config.characterId, config]));
  }, [remoteData]);

  const resolvedTeam = isLocalView || isOwnView ? team : (remoteData?.team ?? []);
  const resolvedGetConfig = useMemo(() => {
    if (isLocalView || isOwnView) return getConfig;
    if (!configByCharacterId) return () => null;
    return (characterId) => {
      const config = configByCharacterId.get(characterId);
      if (!config) return null;
      return { ...config, artifacts: normalizeArtifacts(config.artifacts) };
    };
  }, [isLocalView, isOwnView, getConfig, configByCharacterId]);

  const title = isLocalView
    ? 'Ваш расчёт (локально)'
    : isOwnView
      ? 'Ваш расчёт'
      : (
        <>
          Расчёт:
          {' '}
          <PlayerDisplayName name={remoteData?.displayName} />
        </>
      );

  if (loading) {
    return <LoadingState message="Загрузка расчёта..." />;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <PageBackLink to="/results#notion-results" label="К списку результатов" className="mb-4" />
        <ErrorState message={error} />
      </div>
    );
  }

  return (
    <TeamResultsView
      title={title}
      team={resolvedTeam}
      getConfig={resolvedGetConfig}
      findCharacter={findCharacter}
      artifactSets={artifactSets}
      initialRotationTime={remoteData?.rotationSeconds ?? 20}
      showComparison={isLocalView || isOwnView}
      showNotionSave={isLocalView || isOwnView}
    />
  );
}

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function finishAuth() {
      const supabase = getSupabaseClient();
      if (!supabase) {
        if (!cancelled) setError('Supabase не настроен');
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const authError = params.get('error_description') || params.get('error');
      if (authError) {
        if (!cancelled) {
          setError(decodeURIComponent(authError.replace(/\+/g, ' ')));
        }
        return;
      }

      const tokenHash = params.get('token_hash');
      const otpType = params.get('type') || 'email';
      if (tokenHash) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: otpType,
        });
        if (verifyError && !cancelled) {
          setError(verifyError.message);
          return;
        }
        if (!cancelled) {
          navigate('/team', { replace: true });
        }
        return;
      }

      const { error: sessionError } = await supabase.auth.getSession();
      if (sessionError && !cancelled) {
        setError(sessionError.message);
        return;
      }

      if (!cancelled) navigate('/team', { replace: true });
    }

    finishAuth();
    return () => { cancelled = true; };
  }, [navigate]);

  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <ErrorState message={error} />
        <Link to="/" className="mt-4 block text-center text-white hover:underline">На главную</Link>
      </div>
    );
  }

  return <LoadingState message="Завершение входа..." />;
}
