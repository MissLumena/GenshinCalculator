import { useState, useEffect, useRef, useCallback } from 'react';
import {
  characterConfigsEqual,
  resolveCharacterConfig,
} from '../lib/characterConfigEditor';

const AUTO_SAVE_MS = 500;

/**
 * Редактор конфига персонажа с синхронизацией из savedConfigs и автосохранением.
 */
export function useCharacterConfigEditor({
  character,
  savedConfigs,
  saveConfig,
  authLoading,
  userDataLoading,
}) {
  const [config, setConfig] = useState(() => resolveCharacterConfig(character, savedConfigs));
  const [saveError, setSaveError] = useState(null);
  const [saveState, setSaveState] = useState('idle');

  const isDirtyRef = useRef(false);
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    if (!character || authLoading || userDataLoading) return;
    if (isDirtyRef.current) return;

    const next = resolveCharacterConfig(character, savedConfigs);
    setConfig((prev) => (characterConfigsEqual(prev, next) ? prev : next));
  }, [character, savedConfigs, authLoading, userDataLoading]);

  const patchConfig = useCallback((updater) => {
    isDirtyRef.current = true;
    setSaveState('pending');
    setConfig((prev) => (typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }));
  }, []);

  const persistConfig = useCallback(async (nextConfig = configRef.current) => {
    if (!character) return nextConfig;
    setSaveError(null);
    setSaveState('saving');
    try {
      const saved = await saveConfig(nextConfig);
      isDirtyRef.current = false;
      setSaveState('saved');
      setConfig((prev) => (characterConfigsEqual(prev, saved) ? prev : saved));
      return saved;
    } catch (err) {
      setSaveState('error');
      setSaveError(err.message || 'Ошибка сохранения');
      throw err;
    }
  }, [character, saveConfig]);

  useEffect(() => {
    if (!character || authLoading || userDataLoading) return;
    if (!isDirtyRef.current) return;

    const timer = setTimeout(() => {
      persistConfig(configRef.current).catch(() => {});
    }, AUTO_SAVE_MS);

    return () => clearTimeout(timer);
  }, [config, character, authLoading, userDataLoading, persistConfig]);

  useEffect(() => {
    return () => {
      if (isDirtyRef.current) {
        persistConfig(configRef.current).catch(() => {});
      }
    };
  }, [persistConfig]);

  const flushBeforeLeave = useCallback(async () => {
    if (!isDirtyRef.current) return true;
    await persistConfig(configRef.current);
    return true;
  }, [persistConfig]);

  return {
    config,
    patchConfig,
    saveError,
    saveState,
    persistConfig,
    flushBeforeLeave,
    isDirty: () => isDirtyRef.current,
  };
}
