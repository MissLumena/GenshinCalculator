/**
 * Все страницы приложения V2.
 */
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  CharacterCard,
  CharacterAvatar,
  ConstellationPanel,
  CharacterPickerBar,
  ActionButton,
  InputField,
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
} from './components';
import {
  ARTIFACT_SUMMARY_FIELDS,
  FORMULAS,
  ELEMENT_COLORS,
  getSetBonuses,
  calculateMockDps,
  normalizeArtifacts,
} from './mockData';
import { CHARACTER_REGIONS } from './characters';
import { useAppState } from './context';
import { useCharacterConfigEditor } from './hooks/useCharacterConfigEditor';
import { LOCAL_USER_ID } from './lib/displayName';
import { fetchResultsUsers, fetchUserResults } from './services/resultsService';
import {
  buildNotionSavePayload,
  saveResultToNotion,
  fetchNotionResults,
  deleteNotionResult,
  getSupabaseAccessToken,
} from './services/notionService';

/* ═══════════════════════════════════════════
   1. Главная страница
   ═══════════════════════════════════════════ */
const HOME_SHOWCASE_IDS = ['flins', 'varka', 'loen'];

export function HomePage() {
  const { findCharacter } = useAppState();
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
            <Link to="/results" className="btn-pill-ghost">
              Результаты игроков
            </Link>
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
            <ConstellationPanel character={selectedChar} />
          )}
        </>
      ) : (
        <p className="mt-8 text-center text-gray-400">Персонажи не найдены</p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   3. Настройки персонажа (4 вкладки)
   ═══════════════════════════════════════════ */
const TABS = [
  { key: 'stats', label: 'Базовые статы' },
  { key: 'crit', label: 'Крит & Энергия' },
  { key: 'artifacts', label: 'Артефакты' },
  { key: 'const', label: 'Созвездия' },
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
        <p className="text-gray-400">Персонаж не найден</p>
        <Link to="/team" className="mt-4 inline-block text-white">← К команде</Link>
      </div>
    );
  }

  const setBonus = getSetBonuses(config.artifacts, artifactSets);

  const updateArtifactField = (field, value) => {
    patchConfig((prev) => ({
      ...prev,
      artifacts: { ...prev.artifacts, [field]: value },
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Заголовок персонажа */}
      <div className="mb-6 flex items-center gap-4">
        <CharacterAvatar character={character} size="xl" />
        <div>
          <CharacterNameLabel
            character={character}
            primaryClassName="text-2xl font-bold text-white"
            secondaryClassName="text-gray-400"
          />
          <p className="mt-1 text-gray-400">{character.element} · {character.weapon} · {character.rarity}★</p>
        </div>
      </div>

      {/* Вкладки */}
      <div className="mb-6 flex flex-wrap gap-1 border-b border-gray-700">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm transition ${
              tab === t.key
                ? 'border-b-2 border-genshin-gold text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Базовые статы ── */}
      {tab === 'stats' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <InputField label="Уровень" value={config.level} onChange={(v) => patchConfig({ level: v })} min={1} max={90} />
          <InputField label="ATK (база)" value={config.atk.base} onChange={(v) => patchConfig((prev) => ({ ...prev, atk: { ...prev.atk, base: v } }))} min={0} />
          <InputField label="ATK (бонус)" value={config.atk.bonus} onChange={(v) => patchConfig((prev) => ({ ...prev, atk: { ...prev.atk, bonus: v } }))} min={0} />
          <InputField label="HP" value={config.hp} onChange={(v) => patchConfig({ hp: v })} min={0} />
          <InputField label="Защита" value={config.def} onChange={(v) => patchConfig({ def: v })} min={0} />
          <InputField label="Мастерство стихий" value={config.em} onChange={(v) => patchConfig({ em: v })} min={0} />
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

      {/* ── Артефакты ── */}
      {tab === 'artifacts' && (
        <div className="space-y-6">
          <div className="glass-panel-sm p-4">
            <label className="mb-4 block">
              <span className="mb-1 block text-sm text-gray-400">Сет</span>
              <select
                value={config.artifacts.set}
                onChange={(e) => updateArtifactField('set', e.target.value)}
                className="select-field w-full"
              >
                {artifactSets.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>

            <h3 className="mb-3 text-sm font-medium text-gray-400">Основной стат</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {ARTIFACT_SUMMARY_FIELDS.map(({ key, label }) => (
                <InputField
                  key={key}
                  label={label}
                  value={config.artifacts[key]}
                  onChange={(v) => updateArtifactField(key, v)}
                  min={0}
                  step={0.1}
                />
              ))}
            </div>
          </div>

          {setBonus.length > 0 && (
            <div className="glass-panel-sm border-genshin-gold/30 bg-genshin-gold/10 p-4">
              <h3 className="mb-2 font-medium text-white">Бонусы сетов</h3>
              {setBonus.map((b, i) => (
                <p key={i} className="text-sm text-gray-300">
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
          onActiveLevelChange={(level) => patchConfig({ constellation: level })}
        />
      )}

      {/* Кнопка сохранения */}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <ActionButton onClick={() => setShowSaveModal(true)}>Сохранить</ActionButton>
        <ActionButton variant="secondary" onClick={handleBackToTeam}>Назад к команде</ActionButton>
        {saveState === 'pending' && (
          <span className="text-sm text-gray-400">Изменения сохраняются...</span>
        )}
        {saveState === 'saving' && (
          <span className="text-sm text-gray-400">Сохранение...</span>
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

  const handleCalculate = () => {
    if (!team.some(Boolean)) return;
    if (isAuthenticated && session?.user?.id) {
      navigate(`/results/${session.user.id}`);
      return;
    }
    navigate(`/results/${LOCAL_USER_ID}`);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="page-heading mb-2">Сборка команды</h1>
      <p className="mb-6 text-sm text-gray-400">
        Добавьте до 4 персонажей для расчёта DPS
        {!isAuthenticated && ' · Без входа данные сохраняются локально'}
      </p>

      {(actionLoading || userDataLoading) && (
        <p className="mb-4 text-center text-sm text-white">Загрузка...</p>
      )}

      {teamTotalAtk > 0 && (
        <div className="glass-panel-sm mb-6 flex items-center justify-between px-4 py-3">
          <span className="text-sm text-gray-400">Суммарный ATK команды</span>
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
                      secondaryClassName="text-xs text-white/60"
                    />
                    <span className="rounded bg-genshin-gold/20 px-2 py-0.5 text-xs font-bold text-white">
                      C{slot.constellation}
                    </span>
                  </div>
                  <span className={`mt-1 rounded px-2 py-0.5 text-xs text-white ${ELEMENT_COLORS[slot.element] || 'bg-gray-500'}`}>
                    {slot.element}
                  </span>
                  <p className="mt-1 text-sm text-gray-400">
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
                  className="flex flex-col items-center gap-2 text-gray-400 transition hover:text-white"
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
            className="mt-4 w-full rounded py-2 text-gray-300 hover:bg-white/10"
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
        return calculateMockDps(config, char);
      })
      .filter(Boolean);
  }, [team, getConfig, findCharacter]);

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
        displayName: profileDisplayName,
      });
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
        <PageBackLink to="/results" label="К списку результатов" className="mb-3" />
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
          <div className="mt-6 border-t border-white/10 pt-4">
            <ActionButton
              variant="secondary"
              onClick={handleSaveToNotion}
              disabled={notionSaveState === 'loading'}
            >
              {notionSaveState === 'loading'
                ? 'Сохранение...'
                : notionSaveState === 'success'
                  ? 'Сохранено в Notion'
                  : 'Сохранить результат'}
            </ActionButton>
            {notionSaveState === 'loading' && (
              <p className="mt-2 text-sm text-white/80">Результат сохраняется, подождите</p>
            )}
            {notionSaveState === 'success' && (
              <p className="mt-2 text-sm text-white">
                Сохранено в Notion.{' '}
                <Link to="/results#notion-results" className="underline hover:text-white/80">
                  Открыть список
                </Link>
              </p>
            )}
            {notionSaveError && (
              <p className="mt-2 text-sm text-red-300">{notionSaveError}</p>
            )}
          </div>
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
  const { isAuthenticated, session } = useAppState();
  const [users, setUsers] = useState([]);
  const [notionResults, setNotionResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hint, setHint] = useState(null);
  const [notionNotice, setNotionNotice] = useState(null);
  const [notionError, setNotionError] = useState(null);
  const [notionRefreshing, setNotionRefreshing] = useState(false);
  const [deletingPageId, setDeletingPageId] = useState(null);

  const loadNotionResults = useCallback(async () => {
    setNotionRefreshing(true);
    setNotionError(null);
    setNotionNotice(null);
    try {
      const notionData = await fetchNotionResults();
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
        const [result, notionData] = await Promise.all([
          fetchResultsUsers({ includeLocal: !isAuthenticated }),
          fetchNotionResults().catch((err) => {
            if (!cancelled) setNotionError(err.message || 'Notion недоступен');
            return { items: [], unavailable: true, message: null };
          }),
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
    if (window.location.hash !== '#notion-results') return undefined;
    const timer = window.setTimeout(() => {
      document.getElementById('notion-results')?.scrollIntoView({ behavior: 'smooth' });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loading]);

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

  const canDeleteNotionItem = (item) => {
    if (!session?.user?.id) return false;
    return item.user_id === session.user.id;
  };

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
      <p className="mb-6 text-sm text-white/80">
        Выберите игрока, чтобы посмотреть расчёт DPS его команды
      </p>

      {hint && (
        <div className="mb-6 rounded border border-genshin-gold/40 bg-genshin-gold/10 px-4 py-3 text-sm text-white">
          {hint}
        </div>
      )}

      {users.length === 0 ? (
        <div className="glass-panel p-6 text-center text-white/80">
          Пока нет сохранённых расчётов. Соберите команду и нажмите «Рассчитать DPS».
          <Link to="/team" className="mt-4 block text-white hover:underline">Перейти к команде</Link>
        </div>
      ) : (
        <ul className="glass-panel divide-y divide-white/10">
          {users.map(({ userId, displayName }) => {
            const isSelf = session?.user?.id === userId;
            return (
              <li key={userId}>
                <Link
                  to={`/results/${userId}`}
                  className="flex items-center justify-between px-5 py-4 transition hover:bg-white/20"
                >
                  <span className={`text-lg ${isSelf ? 'font-semibold text-white' : 'text-white'}`}>
                    {displayName}
                    {isSelf && <span className="ml-2 text-xs text-white/70">(вы)</span>}
                  </span>
                  <span className="text-white">→</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <section id="notion-results" className="mt-10 scroll-mt-24">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-white">Результаты в Notion</h2>
          <button
            type="button"
            onClick={loadNotionResults}
            disabled={notionRefreshing}
            className="text-sm text-white underline transition hover:text-white/75 disabled:opacity-50"
          >
            {notionRefreshing ? 'Обновление...' : 'Обновить'}
          </button>
        </div>
        <p className="mb-4 text-sm text-white/80">
          Публичный список сохранённых расчётов. Сохранять могут только авторизованные пользователи.
        </p>
        {notionNotice && (
          <div className="mb-4 rounded border border-amber-300/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {notionNotice}
          </div>
        )}
        {notionError && (
          <div className="mb-4 rounded border border-red-300/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {notionError}
          </div>
        )}
        {notionResults.length === 0 ? (
          <div className="glass-panel p-5 text-sm text-white/80">
            Пока нет записей в Notion.
          </div>
        ) : (
          <ul className="glass-panel divide-y divide-white/10">
            {notionResults.map((item) => (
              <li key={item.page_id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{item.user_label || 'Игрок'}</p>
                    <p className="text-sm text-white/90">{item.team_label}</p>
                    <p className="mt-1 text-sm text-white/80">
                      DPS: {Math.round(item.total_dps).toLocaleString()}
                      {item.calculated_at ? ` · ${item.calculated_at}` : ''}
                    </p>
                    {item.members?.length > 0 && (
                      <ul className="mt-2 space-y-1 text-xs text-white/75">
                        {item.members.map((member) => (
                          <li key={`${item.page_id}-${member}`}>{member}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {canDeleteNotionItem(item) && (
                    <button
                      type="button"
                      onClick={() => handleDeleteNotionResult(item.page_id)}
                      disabled={deletingPageId === item.page_id}
                      className="text-xs text-red-300 hover:underline disabled:opacity-50"
                    >
                      {deletingPageId === item.page_id ? 'Удаление...' : 'Удалить'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
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
      : `Расчёт: ${remoteData?.displayName || 'Игрок'}`;

  if (loading) {
    return <LoadingState message="Загрузка расчёта..." />;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <PageBackLink to="/results" label="К списку результатов" className="mb-4" />
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
      initialRotationTime={remoteData?.rotationSeconds ?? 20}
      showComparison={isLocalView || isOwnView}
      showNotionSave={isLocalView || isOwnView}
    />
  );
}
