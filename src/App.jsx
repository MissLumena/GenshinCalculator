/**
 * Корневой компонент: роутинг, Supabase, глобальное состояние.
 */
import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { Routes, Route } from 'react-router-dom';
import { Header } from './components';
import { AppContext } from './context';
import {
  HomePage,
  CharactersPage,
  CharacterSettingsPage,
  TeamPage,
  ResultsPage,
  UserResultsPage,
} from './pages';

import { getDefaultConfig, normalizeArtifacts, ARTIFACT_SETS as LOCAL_ARTIFACT_SETS } from './mockData';
import { findCharacterById, CHARACTERS as LOCAL_CHARACTERS } from './characters';
import { getSupabaseConfigError } from './lib/supabase';
import { fetchCatalog } from './services/catalogService';
import {
  fetchUserData,
  upsertUserCharacter,
  syncTeam,
  signIn,
  signUp,
  signOut,
  onAuthStateChange,
  getInitialSession,
} from './services/userDataService';
import {
  buildLocalTeamComposition,
} from './services/teamService';
import { updateMyDisplayName } from './services/resultsService';
import { formatDisplayName } from './lib/displayName';
import { ensureCatalogForConfig } from './services/catalogSyncService';

const STORAGE_KEY = 'genshin-calc-v2';

export { useAppState } from './context';

function loadLocalState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { savedConfigs: [], team: [null, null, null, null] };
  } catch {
    return { savedConfigs: [], team: [null, null, null, null] };
  }
}

function saveLocalState(savedConfigs, team) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ savedConfigs, team }));
  } catch {
    // localStorage может быть недоступен
  }
}

export default function App() {
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(null);
  const [characters, setCharacters] = useState(LOCAL_CHARACTERS);
  const [artifactSets, setArtifactSets] = useState([]);

  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [userDataLoading, setUserDataLoading] = useState(false);
  const [userDataError, setUserDataError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [savedConfigs, setSavedConfigs] = useState(() => loadLocalState().savedConfigs);
  const [team, setTeam] = useState(() => loadLocalState().team);
  const [teamId, setTeamId] = useState(null);
  const [teamComposition, setTeamComposition] = useState([null, null, null, null]);
  const [teamTotalAtk, setTeamTotalAtk] = useState(0);
  const [profileDisplayName, setProfileDisplayName] = useState(null);

  /** Отменяет устаревший fetchUserData, если пользователь уже изменил команду. */
  const userDataLoadSeqRef = useRef(0);

  const isAuthenticated = Boolean(session?.user);

  const findCharacter = useCallback(
    (characterId) => characters.find((c) => c.id === characterId) || findCharacterById(characterId),
    [characters],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      setCatalogLoading(true);
      setCatalogError(null);

      const configError = getSupabaseConfigError();
      if (configError) {
        if (!cancelled) {
          setCharacters(LOCAL_CHARACTERS);
          setArtifactSets(LOCAL_ARTIFACT_SETS);
          setCatalogError(null);
        }
        if (!cancelled) setCatalogLoading(false);
        return;
      }

      try {
        const catalog = await fetchCatalog();
        if (!cancelled) {
          setCharacters(catalog.characters);
          setArtifactSets(catalog.artifactSets);
        }
      } catch (err) {
        if (!cancelled) {
          setCharacters(LOCAL_CHARACTERS);
          setArtifactSets(LOCAL_ARTIFACT_SETS);
          setCatalogError(err.message || 'Не удалось загрузить справочники, используются локальные данные');
        }
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    }

    loadCatalog();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initAuth() {
      setAuthLoading(true);
      try {
        const initialSession = await getInitialSession();
        if (!cancelled) setSession(initialSession);
      } catch {
        if (!cancelled) setSession(null);
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    }

    initAuth();
    const unsubscribe = onAuthStateChange((nextSession) => {
      setSession(nextSession);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!session?.user) {
      setTeamId(null);
      setProfileDisplayName(null);
      setUserDataError(null);
      return;
    }

    let cancelled = false;
    const loadSeq = userDataLoadSeqRef.current + 1;
    userDataLoadSeqRef.current = loadSeq;

    async function loadUserData() {
      setUserDataLoading(true);
      setUserDataError(null);
      try {
        const data = await fetchUserData(session.user.id);
        if (!cancelled && loadSeq === userDataLoadSeqRef.current) {
          setSavedConfigs(data.savedConfigs);
          setTeam(data.team);
          setTeamId(data.teamId);
          setTeamComposition(data.teamComposition);
          setTeamTotalAtk(data.teamTotalAtk);
          setProfileDisplayName(data.displayName);
        }
      } catch (err) {
        if (!cancelled) {
          setUserDataError(err.message || 'Не удалось загрузить данные пользователя');
        }
      } finally {
        if (!cancelled) setUserDataLoading(false);
      }
    }

    loadUserData();
    return () => { cancelled = true; };
  }, [session?.user?.id, authLoading]);

  useEffect(() => {
    if (authLoading) return;

    const { slots, totalAtk } = buildLocalTeamComposition(team, savedConfigs, findCharacter);
    setTeamComposition(slots);
    setTeamTotalAtk(totalAtk);
  }, [team, savedConfigs, findCharacter, authLoading]);

  useEffect(() => {
    saveLocalState(savedConfigs, team);
  }, [savedConfigs, team]);

  const persistSavedConfigs = useCallback((config) => {
    setSavedConfigs((prev) => {
      const idx = prev.findIndex((c) => c.characterId === config.characterId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = config;
        return next;
      }
      return [...prev, config];
    });
    return config;
  }, []);

  const saveConfig = useCallback(async (config) => {
    setActionError(null);
    persistSavedConfigs(config);

    if (!session?.user) {
      return config;
    }

    setActionLoading(true);
    try {
      await ensureCatalogForConfig(config, findCharacter, artifactSets);
      const saved = await upsertUserCharacter(session.user.id, config);
      persistSavedConfigs(saved);
      return saved;
    } catch (err) {
      const message = err.message || 'Ошибка сохранения в облако';
      setActionError(`${message}. Изменения сохранены локально для расчёта DPS.`);
      return config;
    } finally {
      setActionLoading(false);
    }
  }, [session?.user, persistSavedConfigs, findCharacter, artifactSets]);

  const persistTeam = useCallback(async (nextTeam, configs, currentTeamId) => {
    if (!session?.user) return currentTeamId;
    return syncTeam(session.user.id, currentTeamId, nextTeam, configs);
  }, [session?.user]);

  const invalidateUserDataLoad = useCallback(() => {
    userDataLoadSeqRef.current += 1;
  }, []);

  const setTeamSlot = useCallback(async (slotIdx, characterId) => {
    invalidateUserDataLoad();
    setActionError(null);
    const nextTeam = [...team];
    nextTeam[slotIdx] = characterId;
    setTeam(nextTeam);

    if (session?.user) {
      try {
        const newTeamId = await persistTeam(nextTeam, savedConfigs, teamId);
        setTeamId(newTeamId);
      } catch (err) {
        setActionError(err.message || 'Ошибка обновления команды');
      }
    }
  }, [team, savedConfigs, teamId, session?.user, persistTeam, invalidateUserDataLoad]);

  const clearTeamSlot = useCallback(async (slotIdx) => {
    invalidateUserDataLoad();
    setActionError(null);
    const nextTeam = [...team];
    nextTeam[slotIdx] = null;
    setTeam(nextTeam);

    if (session?.user) {
      try {
        const newTeamId = await persistTeam(nextTeam, savedConfigs, teamId);
        setTeamId(newTeamId);
      } catch (err) {
        setActionError(err.message || 'Ошибка обновления команды');
      }
    }
  }, [team, savedConfigs, teamId, session?.user, persistTeam, invalidateUserDataLoad]);

  const getConfig = useCallback((characterId) => {
    const char = findCharacter(characterId);
    if (!char) return null;
    const saved = savedConfigs.find((c) => c.characterId === characterId);
    if (saved) {
      return { ...saved, artifacts: normalizeArtifacts(saved.artifacts) };
    }
    return getDefaultConfig(char);
  }, [savedConfigs, findCharacter]);

  const addToTeam = useCallback(async (slotIdx, characterId) => {
    if (slotIdx == null || slotIdx < 0 || slotIdx > 3) return;

    invalidateUserDataLoad();
    setActionError(null);
    const char = findCharacter(characterId);
    if (!char) return;

    const existing = savedConfigs.find((c) => c.characterId === characterId);
    let defaultConfig = null;
    let configs = savedConfigs;

    if (!existing) {
      defaultConfig = getDefaultConfig(char);
      configs = [...savedConfigs, defaultConfig];
      setSavedConfigs(configs);
    }

    const nextTeam = [...team];
    nextTeam[slotIdx] = characterId;
    setTeam(nextTeam);

    if (!session?.user) return;

    setActionLoading(true);
    try {
      let syncConfigs = configs;
      if (defaultConfig) {
        await ensureCatalogForConfig(defaultConfig, findCharacter, artifactSets);
        const saved = await upsertUserCharacter(session.user.id, defaultConfig);
        syncConfigs = configs.map((c) => (
          c.characterId === characterId ? saved : c
        ));
        setSavedConfigs(syncConfigs);
      }
      const newTeamId = await persistTeam(nextTeam, syncConfigs, teamId);
      setTeamId(newTeamId);
    } catch (err) {
      setActionError(err.message || 'Ошибка добавления персонажа');
    } finally {
      setActionLoading(false);
    }
  }, [
    findCharacter,
    savedConfigs,
    session?.user,
    team,
    teamId,
    persistTeam,
    invalidateUserDataLoad,
    artifactSets,
  ]);

  const handleSignIn = useCallback(async (email, password) => {
    setActionError(null);
    setActionLoading(true);
    try {
      const nextSession = await signIn(email, password);
      setSession(nextSession);
    } catch (err) {
      setActionError(err.message || 'Ошибка входа');
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, []);

  const handleSignUp = useCallback(async (email, password, displayName) => {
    setActionError(null);
    setActionLoading(true);
    try {
      const nextSession = await signUp(email, password, displayName);
      setSession(nextSession);
      setProfileDisplayName(formatDisplayName(displayName));
    } catch (err) {
      setActionError(err.message || 'Ошибка регистрации');
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    setActionError(null);
    try {
      await signOut();
      setSession(null);
      const local = loadLocalState();
      setSavedConfigs(local.savedConfigs);
      setTeam(local.team);
      setTeamId(null);
      setProfileDisplayName(null);
    } catch (err) {
      setActionError(err.message || 'Ошибка выхода');
    }
  }, []);

  const handleUpdateDisplayName = useCallback(async (displayName) => {
    setActionError(null);
    setActionLoading(true);
    try {
      const savedName = await updateMyDisplayName(displayName);
      setProfileDisplayName(savedName);
      return savedName;
    } catch (err) {
      setActionError(err.message || 'Ошибка обновления имени');
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, []);

  const value = useMemo(() => ({
    characters,
    artifactSets,
    catalogLoading,
    catalogError,
    findCharacter,
    savedConfigs,
    team,
    teamComposition,
    teamTotalAtk,
    saveConfig,
    setTeamSlot,
    clearTeamSlot,
    getConfig,
    addToTeam,
    session,
    isAuthenticated,
    authLoading,
    userDataLoading,
    userDataError,
    actionError,
    actionLoading,
    profileDisplayName,
    updateDisplayName: handleUpdateDisplayName,
    signIn: handleSignIn,
    signUp: handleSignUp,
    signOut: handleSignOut,
    clearActionError: () => setActionError(null),
  }), [
    characters,
    artifactSets,
    catalogLoading,
    catalogError,
    findCharacter,
    savedConfigs,
    team,
    teamComposition,
    teamTotalAtk,
    saveConfig,
    setTeamSlot,
    clearTeamSlot,
    getConfig,
    addToTeam,
    session,
    isAuthenticated,
    authLoading,
    userDataLoading,
    userDataError,
    actionError,
    actionLoading,
    profileDisplayName,
    handleUpdateDisplayName,
    handleSignIn,
    handleSignUp,
    handleSignOut,
  ]);

  return (
    <AppContext.Provider value={value}>
      <Header />
      {catalogLoading && (
        <div className="glass-banner border-genshin-gold/40 text-white">
          Обновление справочников...
        </div>
      )}
      {catalogError && (
        <div className="glass-banner border-amber-300/50 text-amber-50">
          {catalogError}
          <button
            type="button"
            onClick={() => setCatalogError(null)}
            className="ml-3 underline hover:text-white"
          >
            Закрыть
          </button>
        </div>
      )}
      {userDataLoading && isAuthenticated && (
        <div className="glass-banner border-genshin-gold/40 text-white">
          Загрузка...
        </div>
      )}
      {userDataError && (
        <div className="glass-banner border-red-300/50 text-red-50">
          {userDataError}
        </div>
      )}
      {actionError && (
        <div className="glass-banner border-red-300/50 text-red-50">
          {actionError}
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="ml-3 underline hover:text-white"
          >
            Закрыть
          </button>
        </div>
      )}
      <main className="app-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/characters" element={<CharactersPage />} />
          <Route path="/character/:id" element={<CharacterSettingsPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/results/:userId" element={<UserResultsPage />} />
        </Routes>
      </main>
    </AppContext.Provider>
  );
}
