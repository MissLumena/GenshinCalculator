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
  UserResultsPage,
} from './pages';

import { getDefaultConfig, normalizeArtifacts } from './mockData';
import { findCharacterById, CHARACTERS as LOCAL_CHARACTERS } from './characters';
import { getSupabaseConfigError } from './lib/supabase';
import { fetchCatalog } from './services/catalogService';
import {
  fetchUserData,
  upsertUserCharacter,
  syncTeam,
} from './services/userDataService';
import {
  signIn,
  signUp,
  signOut,
  onAuthStateChange,
  getInitialSession,
  fetchMyProfile,
  claimOwnerRole,
  updateDisplayName as saveDisplayName,
} from './services/authService';
import { ROLES } from './lib/permissions';
import { toApiError } from './lib/apiErrors';
import {
  fetchTeamComposition,
  buildLocalTeamComposition,
} from './services/teamService';

const STORAGE_KEY = 'genshin-calc-v2';

function formatErrorMessage(err) {
  const apiError = toApiError(err);
  if (apiError.status === 400 || apiError.status === 403) {
    return `[${apiError.status}] ${apiError.message}`;
  }
  return apiError.message;
}

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
  const [profile, setProfile] = useState(null);
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

  const isAuthenticated = Boolean(session?.user);
  const userRole = profile?.role ?? ROLES.USER;

  const loadProfile = useCallback(async () => {
    try {
      await claimOwnerRole().catch(() => {});
      const nextProfile = await fetchMyProfile();
      setProfile(nextProfile);
      return nextProfile;
    } catch {
      setProfile(null);
      return null;
    }
  }, []);

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
          setCatalogError(formatErrorMessage(err));
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
        if (!cancelled) {
          setSession(initialSession);
          if (initialSession?.user) {
            await loadProfile();
          } else {
            setProfile(null);
          }
        }
      } catch {
        if (!cancelled) {
          setSession(null);
          setProfile(null);
        }
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    }

    initAuth();
    const unsubscribe = onAuthStateChange(async (nextSession) => {
      setSession(nextSession);
      if (nextSession?.user) {
        await loadProfile();
      } else {
        setProfile(null);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [loadProfile]);

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
        const data = await fetchUserData(session.user.id, session.user.id, userRole);
        if (!cancelled) {
          setSavedConfigs(data.savedConfigs);
          setTeam(data.team);
          setTeamId(data.teamId);
          setTeamComposition(data.teamComposition);
          setTeamTotalAtk(data.teamTotalAtk);
        }
      } catch (err) {
        if (!cancelled) {
          setUserDataError(formatErrorMessage(err));
        }
      } finally {
        if (!cancelled) setUserDataLoading(false);
      }
    }

    loadUserData();
    return () => { cancelled = true; };
  }, [session?.user?.id, authLoading, userRole]);

  useEffect(() => {
    if (authLoading) return;

    if (isAuthenticated && teamId) {
      let cancelled = false;
      fetchTeamComposition(teamId)
        .then(({ slots, totalAtk }) => {
          if (!cancelled) {
            setTeamComposition(slots);
            setTeamTotalAtk(totalAtk);
          }
        })
        .catch(() => {
          if (!cancelled) {
            const local = buildLocalTeamComposition(team, savedConfigs, findCharacter);
            setTeamComposition(local.slots);
            setTeamTotalAtk(local.totalAtk);
          }
        });
      return () => { cancelled = true; };
    }

    const local = buildLocalTeamComposition(team, savedConfigs, findCharacter);
    setTeamComposition(local.slots);
    setTeamTotalAtk(local.totalAtk);
    return undefined;
  }, [team, teamId, savedConfigs, findCharacter, isAuthenticated, authLoading]);

  useEffect(() => {
    if (!isAuthenticated && !authLoading) {
      saveLocalState(savedConfigs, team);
    }
  }, [savedConfigs, team, isAuthenticated, authLoading]);

  const persistTeam = useCallback(async (nextTeam, configs, currentTeamId) => {
    if (!session?.user) return currentTeamId;
    return syncTeam(
      session.user.id,
      currentTeamId,
      nextTeam,
      configs,
      session.user.id,
      userRole,
    );
  }, [session?.user, userRole]);

  const saveConfig = useCallback(async (config) => {
    setActionError(null);

    if (session?.user) {
      setActionLoading(true);
      try {
        const saved = await upsertUserCharacter(
          session.user.id,
          config,
          userRole,
          session.user.id,
        );
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
        setActionError(formatErrorMessage(err));
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
  }, [session?.user, userRole]);

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
        setActionError(formatErrorMessage(err));
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
        setActionError(formatErrorMessage(err));
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
          const saved = await upsertUserCharacter(
            session.user.id,
            defaultConfig,
            userRole,
            session.user.id,
          );
          configs = [...savedConfigs, saved];
          setSavedConfigs(configs);
        } catch (err) {
          setActionError(formatErrorMessage(err));
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
        setActionError(formatErrorMessage(err));
      }
    }
  }, [findCharacter, savedConfigs, session?.user, userRole, team, teamId, persistTeam]);

  const handleSignIn = useCallback(async (email, password) => {
    setActionError(null);
    setActionLoading(true);
    try {
      const nextSession = await signIn(email, password);
      setSession(nextSession);
      await loadProfile();
    } catch (err) {
      setActionError(formatErrorMessage(err));
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [loadProfile]);

  const handleSignUp = useCallback(async (email, password) => {
    setActionError(null);
    setActionLoading(true);
    try {
      const nextSession = await signUp(email, password);
      setSession(nextSession);
      await loadProfile();
    } catch (err) {
      setActionError(formatErrorMessage(err));
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [loadProfile]);

  const handleSignOut = useCallback(async () => {
    setActionError(null);
    try {
      await signOut();
      setSession(null);
      setProfile(null);
      const local = loadLocalState();
      setSavedConfigs(local.savedConfigs);
      setTeam(local.team);
      setTeamId(null);
    } catch (err) {
      setActionError(formatErrorMessage(err));
    }
  }, []);

  const handleUpdateDisplayName = useCallback(async (displayName) => {
    setActionError(null);
    const saved = await saveDisplayName(displayName);
    await loadProfile();
    return saved;
  }, [loadProfile]);

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
    profile,
    userRole,
    isAuthenticated,
    authLoading,
    userDataLoading,
    userDataError,
    actionError,
    actionLoading,
    signIn: handleSignIn,
    signUp: handleSignUp,
    signOut: handleSignOut,
    updateDisplayName: handleUpdateDisplayName,
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
    profile,
    userRole,
    isAuthenticated,
    authLoading,
    userDataLoading,
    userDataError,
    actionError,
    actionLoading,
    handleSignIn,
    handleSignUp,
    handleSignOut,
    handleUpdateDisplayName,
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
          <Route path="/results/:userId" element={<UserResultsPage />} />
        </Routes>
      </main>
    </AppContext.Provider>
  );
}
