/**
 * Корневой компонент: роутинг и глобальное состояние (localStorage).
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Header } from './components';
import {
  HomePage,
  CharactersPage,
  CharacterSettingsPage,
  TeamPage,
  ResultsPage,
} from './pages';

import { getDefaultConfig } from './mockData';
import { findCharacterById } from './characters';

const STORAGE_KEY = 'genshin-calc-v2';

const AppContext = createContext(null);

/** Хук доступа к глобальному состоянию */
export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used within AppProvider');
  return ctx;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { savedConfigs: [], team: [null, null, null, null] };
  } catch {
    return { savedConfigs: [], team: [null, null, null, null] };
  }
}

export default function App() {
  const [savedConfigs, setSavedConfigs] = useState(() => loadState().savedConfigs);
  const [team, setTeam] = useState(() => loadState().team);

  // Синхронизация с localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ savedConfigs, team }));
  }, [savedConfigs, team]);

  const saveConfig = useCallback((config) => {
    setSavedConfigs((prev) => {
      const idx = prev.findIndex((c) => c.characterId === config.characterId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = config;
        return next;
      }
      return [...prev, config];
    });
  }, []);

  const setTeamSlot = useCallback((slotIdx, characterId) => {
    setTeam((prev) => {
      const next = [...prev];
      next[slotIdx] = characterId;
      return next;
    });
  }, []);

  const clearTeamSlot = useCallback((slotIdx) => {
    setTeam((prev) => {
      const next = [...prev];
      next[slotIdx] = null;
      return next;
    });
  }, []);

  const getConfig = useCallback((characterId) => {
    const char = findCharacterById(characterId);
    if (!char) return null;
    const saved = savedConfigs.find((c) => c.characterId === characterId);
    return saved || getDefaultConfig(char);
  }, [savedConfigs]);

  const addToTeam = useCallback((slotIdx, characterId) => {
    const char = findCharacterById(characterId);
    if (!char) return;
    setSavedConfigs((prev) => {
      if (prev.some((c) => c.characterId === characterId)) return prev;
      return [...prev, getDefaultConfig(char)];
    });
    setTeam((prev) => {
      const next = [...prev];
      next[slotIdx] = characterId;
      return next;
    });
  }, []);

  const value = {
    savedConfigs,
    team,
    saveConfig,
    setTeamSlot,
    clearTeamSlot,
    getConfig,
    addToTeam,
  };

  return (
    <AppContext.Provider value={value}>
      <Header />
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
