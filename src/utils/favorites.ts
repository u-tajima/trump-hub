import { useCallback, useEffect, useState } from 'react';
import { GAME_REGISTRY } from '../games/registry';
import type { GameId } from '../types/game';

const STORAGE_KEY = 'table-hub:favorites:v1';
const FAVORITES_EVENT = 'table-hub:favorites-changed';

export function loadFavoriteGameIds(): GameId[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is GameId => typeof id === 'string' && id in GAME_REGISTRY);
  } catch {
    return [];
  }
}

export function saveFavoriteGameIds(ids: GameId[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    window.dispatchEvent(new CustomEvent(FAVORITES_EVENT, { detail: ids }));
  } catch {
    // ignore storage errors
  }
}

export function useFavoriteGames() {
  const [favorites, setFavorites] = useState<GameId[]>(() => loadFavoriteGameIds());

  useEffect(() => {
    const handleSync = (ev: Event) => {
      const custom = ev as CustomEvent<GameId[]>;
      if (Array.isArray(custom.detail)) {
        setFavorites(custom.detail);
      } else {
        setFavorites(loadFavoriteGameIds());
      }
    };
    const handleStorage = (ev: StorageEvent) => {
      if (ev.key === STORAGE_KEY) {
        setFavorites(loadFavoriteGameIds());
      }
    };
    window.addEventListener(FAVORITES_EVENT, handleSync);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(FAVORITES_EVENT, handleSync);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const toggleFavorite = useCallback((gameId: GameId) => {
    setFavorites((prev) => {
      const exists = prev.includes(gameId);
      const next = exists ? prev.filter((id) => id !== gameId) : [gameId, ...prev];
      saveFavoriteGameIds(next);
      return next;
    });
  }, []);

  const isFavorite = useCallback(
    (gameId: GameId) => favorites.includes(gameId),
    [favorites]
  );

  return { favorites, toggleFavorite, isFavorite };
}
