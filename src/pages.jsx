/**
 * Все страницы приложения V2.
 */
import { useState, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  CharacterCard,
  CharacterAvatar,
  ConstellationPanel,
  ActionButton,
  InputField,
  Tooltip,
  ConfirmModal,
  BarChart,
  PieChart,
} from './components';
import {
  ARTIFACT_SUMMARY_FIELDS,
  CONSTELLATION_DESCRIPTIONS,
  FORMULAS,
  ELEMENT_COLORS,
  getDefaultConfig,
  getSetBonuses,
  calculateMockDps,
  normalizeArtifacts,
} from './mockData';
import { CHARACTER_REGIONS } from './characters';
import { useAppState } from './context';

/* ═══════════════════════════════════════════
   1. Главная страница
   ═══════════════════════════════════════════ */
export function HomePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 text-center">
      <h1 className="font-display mb-4 text-4xl font-bold text-genshin-goldbright">
        Genshin Impact Calculator
      </h1>
      <p className="mb-8 text-lg text-gray-300">
        Рассчитывайте DPS, настраивайте артефакты и собирайте команду из четырёх персонажей.
      </p>

      <div className="mb-12 grid gap-4 sm:grid-cols-3">
        {[
          { to: '/team', label: 'Начать расчёт', desc: 'Соберите команду' },
          { to: '/characters', label: 'Персонажи', desc: 'Созвездия и описания' },
          { to: '/team', label: 'Мои команды', desc: 'Сборка отряда' },
        ].map(({ to, label, desc }) => (
          <Link
            key={label}
            to={to}
            className="glass-panel p-6 transition hover:border-genshin-gold hover:shadow-lg"
          >
            <h2 className="text-lg font-semibold text-white">{label}</h2>
            <p className="mt-2 text-sm text-gray-400">{desc}</p>
          </Link>
        ))}
      </div>

      <section className="glass-panel p-6 text-left">
        <h2 className="mb-2 text-xl font-semibold text-white">Возможности</h2>
        <p className="text-gray-300">
          Настройка билдов, расчёт урона и сравнение команд — всё необходимое для оптимизации отряда.
        </p>
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════
   2. Справочник персонажей — созвездия
   ═══════════════════════════════════════════ */
export function CharactersPage() {
  const { characters, findCharacter } = useAppState();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return characters;
    const q = search.toLowerCase();
    return characters.filter(
      (c) => c.name.toLowerCase().includes(q) || c.nameRu.toLowerCase().includes(q),
    );
  }, [search, characters]);

  const regionsWithChars = useMemo(() => {
    return CHARACTER_REGIONS.map((region) => ({
      ...region,
      characters: filtered.filter((c) => c.region === region.id),
    })).filter((r) => r.characters.length > 0);
  }, [filtered]);

  const selectedChar = selectedId ? findCharacter(selectedId) : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold text-genshin-gold">Персонажи</h1>
      <p className="mb-4 text-sm text-gray-400">
        Справочник созвездий. Для расчёта DPS добавляйте персонажей на вкладке «Команда».
      </p>

      <input
        type="text"
        placeholder="Поиск по имени..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="glass-input mb-6 w-full max-w-sm px-3 py-2 text-sm"
      />

      {selectedChar && (
        <div className="mb-8">
          <ConstellationPanel
            character={selectedChar}
            descriptions={CONSTELLATION_DESCRIPTIONS}
          />
        </div>
      )}

      {regionsWithChars.map((region) => (
        <section key={region.id} className="mb-8">
          <h2 className="mb-3 border-b border-genshin-gold/30 pb-1 text-lg font-semibold text-genshin-gold">
            {region.label}
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {region.characters.map((char) => (
              <CharacterCard
                key={char.id}
                character={char}
                selected={selectedId === char.id}
                onClick={() => setSelectedId((prev) => (prev === char.id ? null : char.id))}
              />
            ))}
          </div>
        </section>
      ))}

      {regionsWithChars.length === 0 && (
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
  const { savedConfigs, saveConfig, findCharacter, artifactSets, actionLoading } = useAppState();
  const character = findCharacter(id);
  const [tab, setTab] = useState('stats');
  const [config, setConfig] = useState(() => {
    if (!character) return getDefaultConfig({ id: 'unknown', name: '', nameRu: '' });
    const saved = savedConfigs.find((c) => c.characterId === character.id);
    const base = saved || getDefaultConfig(character);
    return { ...base, artifacts: normalizeArtifacts(base.artifacts) };
  });
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveError, setSaveError] = useState(null);

  if (!character) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-gray-400">Персонаж не найден</p>
        <Link to="/team" className="mt-4 inline-block text-genshin-gold">← К команде</Link>
      </div>
    );
  }

  const setBonus = getSetBonuses(config.artifacts, artifactSets);

  const updateArtifactField = (field, value) => {
    setConfig((prev) => ({
      ...prev,
      artifacts: { ...prev.artifacts, [field]: value },
    }));
  };

  const handleSave = async () => {
    setSaveError(null);
    try {
      await saveConfig(config);
      setShowSaveModal(false);
      navigate('/team');
    } catch (err) {
      setSaveError(err.message || 'Ошибка сохранения');
      setShowSaveModal(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Заголовок персонажа */}
      <div className="mb-6 flex items-center gap-4">
        <CharacterAvatar character={character} size="xl" />
        <div>
          <h1 className="text-2xl font-bold">{character.nameRu}</h1>
          <p className="text-gray-400">{character.name} · {character.element} · {character.weapon} · {character.rarity}★</p>
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
                ? 'border-b-2 border-genshin-gold text-genshin-gold'
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
          <InputField label="Уровень" value={config.level} onChange={(v) => setConfig({ ...config, level: v })} min={1} max={90} />
          <InputField label="ATK (база)" value={config.atk.base} onChange={(v) => setConfig({ ...config, atk: { ...config.atk, base: v } })} min={0} />
          <InputField label="ATK (бонус)" value={config.atk.bonus} onChange={(v) => setConfig({ ...config, atk: { ...config.atk, bonus: v } })} min={0} />
          <InputField label="HP" value={config.hp} onChange={(v) => setConfig({ ...config, hp: v })} min={0} />
          <InputField label="Защита" value={config.def} onChange={(v) => setConfig({ ...config, def: v })} min={0} />
          <InputField label="Мастерство стихий" value={config.em} onChange={(v) => setConfig({ ...config, em: v })} min={0} />
        </div>
      )}

      {/* ── Крит & Энергия ── */}
      {tab === 'crit' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <InputField
            label="Шанс крит. попадания"
            value={config.critRate}
            onChange={(v) => setConfig({ ...config, critRate: v })}
            min={0}
            max={100}
            suffix="%"
            tooltip={{ text: 'CRIT Rate', formula: FORMULAS.avgDmg }}
          />
          <InputField
            label="Крит. урон"
            value={config.critDmg}
            onChange={(v) => setConfig({ ...config, critDmg: v })}
            min={0}
            suffix="%"
            tooltip={{ text: 'CRIT DMG', formula: FORMULAS.critDmg }}
          />
          <InputField
            label="Восстановление энергии"
            value={config.energyRecharge}
            onChange={(v) => setConfig({ ...config, energyRecharge: v })}
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
              <h3 className="mb-2 font-medium text-genshin-gold">Бонусы сетов</h3>
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
        <div>
          <div className="mb-4 flex gap-2">
            {[0, 1, 2, 3, 4, 5, 6].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setConfig({ ...config, constellation: c })}
                className={`flex h-12 w-12 items-center justify-center rounded-full border-2 text-lg font-bold transition ${
                  config.constellation === c
                    ? 'border-genshin-gold bg-genshin-gold/20 text-genshin-gold'
                    : 'border-gray-600 text-gray-400 hover:border-gray-400'
                }`}
              >
                C{c}
              </button>
            ))}
          </div>
          <div className="glass-panel-sm p-4">
            <p className="text-gray-200">{CONSTELLATION_DESCRIPTIONS[config.constellation]}</p>
            <p className="mt-2 text-sm text-genshin-accent">⚠ Влияет на расчёт</p>
          </div>
        </div>
      )}

      {/* Кнопка сохранения */}
      <div className="mt-8 flex gap-3">
        <ActionButton onClick={() => setShowSaveModal(true)}>Сохранить</ActionButton>
        <ActionButton variant="secondary" onClick={() => navigate('/team')}>Назад к команде</ActionButton>
      </div>

      {saveError && (
        <p className="mt-4 text-center text-sm text-red-300">{saveError}</p>
      )}

      <ConfirmModal
        open={showSaveModal}
        title="Сохранить персонажа?"
        message={`Сохранить настройки билда для ${character.nameRu}?`}
        onConfirm={handleSave}
        onCancel={() => setShowSaveModal(false)}
      />
      {actionLoading && (
        <p className="mt-2 text-center text-sm text-genshin-gold">Загрузка...</p>
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
    navigate('/results');
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold text-genshin-gold">Сборка команды</h1>
      <p className="mb-6 text-sm text-gray-400">
        Добавьте до 4 персонажей для расчёта DPS
        {!isAuthenticated && ' · Без входа данные сохраняются локально'}
      </p>

      {(actionLoading || userDataLoading) && (
        <p className="mb-4 text-center text-sm text-genshin-gold">Загрузка...</p>
      )}

      {teamTotalAtk > 0 && (
        <div className="glass-panel-sm mb-6 flex items-center justify-between px-4 py-3">
          <span className="text-sm text-gray-400">Суммарный ATK команды</span>
          <span className="text-xl font-bold text-genshin-gold">{teamTotalAtk.toLocaleString()}</span>
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
                    <p className="font-semibold">{slot.nameRu}</p>
                    <span className="rounded bg-genshin-gold/20 px-2 py-0.5 text-xs font-bold text-genshin-gold">
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
                      className="text-xs text-genshin-gold hover:underline"
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
                  className="flex flex-col items-center gap-2 text-gray-400 transition hover:text-genshin-gold"
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

      {/* Выбор персонажа из полного списка */}
      {pickerSlot !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="glass-modal flex max-h-[85vh] w-full max-w-2xl flex-col p-6">
            <h3 className="mb-3 text-lg font-semibold text-genshin-gold">Выберите персонажа</h3>
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
                  <h4 className="mb-2 text-sm font-medium text-genshin-gold">{region.label}</h4>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {region.characters.map((char) => {
                      const inTeam = teamIds.has(char.id);
                      return (
                        <CharacterCard
                          key={char.id}
                          character={char}
                          disabled={inTeam}
                          onClick={() => {
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
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   5. Результаты DPS
   ═══════════════════════════════════════════ */
export function ResultsPage() {
  const { team, getConfig, findCharacter } = useAppState();
  const [rotationTime, setRotationTime] = useState(20);
  const [comparison, setComparison] = useState({ a: null, b: null });

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
  }, [team, getConfig]);

  const totalDps = teamData.reduce((s, d) => s + d.totalDps, 0);
  const pieData = teamData.map((d) => ({ name: d.name, value: d.totalDps }));

  const saveForComparison = (slot) => {
    setComparison((prev) => ({ ...prev, [slot]: { teamData, totalDps, rotationTime } }));
  };

  if (teamData.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-gray-400">Нет данных для расчёта. Сформируйте команду.</p>
        <Link to="/team" className="mt-4 inline-block text-genshin-gold">← К команде</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-genshin-gold">Результаты DPS</h1>

      {/* ── Урон персонажей ── */}
      <section className="glass-panel mb-8 p-6">
        <h2 className="mb-4 text-lg font-semibold">Урон персонажей</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-600 text-left text-gray-400">
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
                            {d.name}
                          </span>
                        </td>
                      )}
                      <td className="py-2 pr-4">
                        {skillName}
                        {skill.affectedByConst && (
                          <span className="ml-1 text-genshin-gold" title={`C${d.constellation} влияет`}>★</span>
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

      {/* ── Итого команды ── */}
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
        <p className="mb-4 text-3xl font-bold text-genshin-gold">
          {(totalDps * rotationTime / 20).toLocaleString()} <span className="text-base font-normal text-gray-400">урона за {rotationTime}с</span>
        </p>
        <div className="grid gap-6 md:grid-cols-2">
          <BarChart data={pieData.map((d) => ({ name: d.name, value: d.value }))} />
          <PieChart data={pieData} />
        </div>
      </section>

      {/* ── Сравнение билдов ── */}
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
                  <h3 className="mb-3 font-medium text-genshin-gold">Билд {slot === 'a' ? 'A' : 'B'}</h3>
                  {build ? (
                    <>
                      <p className="mb-2 text-2xl font-bold">{build.totalDps.toLocaleString()} DPS</p>
                      <p className="mb-3 text-sm text-gray-400">Ротация: {build.rotationTime}с</p>
                      <ul className="space-y-1 text-sm">
                        {build.teamData.map((d) => (
                          <li key={d.characterId} className="flex items-center gap-2">
                            <CharacterAvatar character={findCharacter(d.characterId)} size="xs" />
                            {d.name}: {d.totalDps.toLocaleString()}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="text-gray-500">Не сохранён</p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-400">Нажмите «Добавить для сравнения», чтобы сохранить текущий расчёт.</p>
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
    </div>
  );
}
