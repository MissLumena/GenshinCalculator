/**
 * Корневой компонент: роутинг, Supabase, глобальное состояние.
 */
import {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { Routes, Route } from 'react-router-dom';
import { Header, LoadingState, ErrorState } from './components';
import { SimpleHeader } from './SimpleHeader';
import { AppContext } from './context';
import {
  HomePage,
  CharactersPage,
  CharacterSettingsPage,
  TeamPage,
  ResultsPage,
} from './pages';

import { getDefaultConfig, normalizeArtifacts } from './mockData';
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
        setCatalogError(configError);
        setCatalogLoading(false);
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
          setCatalogError(err.message || 'Не удалось загрузить справочники');
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
      const local = loadLocalState();
      setSavedConfigs(local.savedConfigs);
      setTeam(local.team);
      setTeamId(null);
      setUserDataError(null);
      return;
    }

    let cancelled = false;

    async function loadUserData() {
      setUserDataLoading(true);
      setUserDataError(null);
      try {
        const data = await fetchUserData(session.user.id);
        if (!cancelled) {
          setSavedConfigs(data.savedConfigs);
          setTeam(data.team);
          setTeamId(data.teamId);
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
    if (!isAuthenticated && !authLoading) {
      saveLocalState(savedConfigs, team);
    }
  }, [savedConfigs, team, isAuthenticated, authLoading]);

  const persistTeam = useCallback(async (nextTeam, configs, currentTeamId) => {
    if (!session?.user) return currentTeamId;
    return syncTeam(session.user.id, currentTeamId, nextTeam, configs);
  }, [session?.user]);

  const saveConfig = useCallback(async (config) => {
    setActionError(null);

    if (session?.user) {
      setActionLoading(true);
      try {
        const saved = await upsertUserCharacter(session.user.id, config);
        setSavedConfigs((prev) => {
          const idx = prev.findIndex((c) => c.characterId === saved.characterId);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = saved;
            return next;
          }
          return [...prev, saved];
        });
        return saved;
      } catch (err) {
        setActionError(err.message || 'Ошибка сохранения');
        throw err;
      } finally {
        setActionLoading(false);
      }
    }

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
  }, [session?.user]);

  const setTeamSlot = useCallback(async (slotIdx, characterId) => {
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
  }, [team, savedConfigs, teamId, session?.user, persistTeam]);

  const clearTeamSlot = useCallback(async (slotIdx) => {
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
  }, [team, savedConfigs, teamId, session?.user, persistTeam]);

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
    setActionError(null);
    const char = findCharacter(characterId);
    if (!char) return;

    let configs = savedConfigs;
    const existing = savedConfigs.find((c) => c.characterId === characterId);

    if (!existing) {
      const defaultConfig = getDefaultConfig(char);
      if (session?.user) {
        setActionLoading(true);
        try {
          const saved = await upsertUserCharacter(session.user.id, defaultConfig);
          configs = [...savedConfigs, saved];
          setSavedConfigs(configs);
        } catch (err) {
          setActionError(err.message || 'Ошибка добавления персонажа');
          setActionLoading(false);
          return;
        }
        setActionLoading(false);
      } else {
        configs = [...savedConfigs, defaultConfig];
        setSavedConfigs(configs);
      }
    }

    const nextTeam = [...team];
    nextTeam[slotIdx] = characterId;
    setTeam(nextTeam);

    if (session?.user) {
      try {
        const newTeamId = await persistTeam(nextTeam, configs, teamId);
        setTeamId(newTeamId);
      } catch (err) {
        setActionError(err.message || 'Ошибка обновления команды');
      }
    }
  }, [findCharacter, savedConfigs, session?.user, team, teamId, persistTeam]);

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

  const handleSignUp = useCallback(async (email, password) => {
    setActionError(null);
    setActionLoading(true);
    try {
      const nextSession = await signUp(email, password);
      setSession(nextSession);
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
    } catch (err) {
      setActionError(err.message || 'Ошибка выхода');
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
    handleSignIn,
    handleSignUp,
    handleSignOut,
  ]);

  if (catalogLoading) {
    return (
      <div className="min-h-screen">
        <SimpleHeader />
        <LoadingState message="Загрузка..." />
      </div>
    );
  }

  if (catalogError) {
    return (
      <div className="min-h-screen">
        <SimpleHeader />
        <ErrorState message={catalogError} />
      </div>
    );
  }

  return (
    <AppContext.Provider value={value}>
      <Header />
      {userDataLoading && isAuthenticated && (
        <div className="border-b border-genshin-gold/30 bg-genshin-gold/10 px-4 py-2 text-center text-sm text-genshin-gold">
          Загрузка...
        </div>
      )}
      {userDataError && (
        <div className="border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-center text-sm text-red-300">
          {userDataError}
        </div>
      )}
      {actionError && (
        <div className="border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-center text-sm text-red-300">
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
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/characters" element={<CharactersPage />} />
          <Route path="/character/:id" element={<CharacterSettingsPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/results" element={<ResultsPage />} />
        </Routes>
      </main>
    </AppContext.Provider>
  );
}
