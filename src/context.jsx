/**
 * Глобальный React-контекст приложения.
 */
import { createContext, useContext } from 'react';

export const AppContext = createContext(null);

/** Хук доступа к глобальному состоянию */
export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used within AppProvider');
  return ctx;
}

/** Безопасный хук — null, если провайдер ещё не смонтирован */
export function useAppStateOptional() {
  return useContext(AppContext);
}
