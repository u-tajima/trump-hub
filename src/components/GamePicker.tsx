import React, { useMemo, useState } from 'react';
import { Search, Star, Users, X } from 'lucide-react';
import { GAME_LIST, type GameCategory, type GameMeta } from '../games/registry';
import type { GameId } from '../types/game';
import { GameIcon } from './GameIcon';
import './GamePicker.css';

type FilterTab = 'all' | 'favorites' | Exclude<GameCategory, 'tool'>;
type PlayerFilter = 'any' | 'solo' | 'two' | 'threePlus' | 'fitRoom';

interface GamePickerProps {
  selectedGame: GameId;
  onSelect: (gameId: GameId) => void;
  favorites: GameId[];
  onToggleFavorite: (gameId: GameId) => void;
  /** ロビー内でのゲーム変更時に現在の参加人数を渡すと「今の人数で遊べる」フィルタが有効になる */
  currentPlayerCount?: number;
  /** モーダル内で使うときのコンパクト表示 */
  compact?: boolean;
}

function normalizeQuery(str: string): string {
  // ひらがなをカタカナに寄せて検索ヒット率を上げる
  return str
    .trim()
    .toLowerCase()
    .replace(/[\u3041-\u3096]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));
}

function matchesSearch(game: GameMeta, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true;
  const haystack = normalizeQuery(`${game.name} ${game.subtitle} ${game.id}`);
  return haystack.includes(normalizedQuery);
}

export const GamePicker: React.FC<GamePickerProps> = ({
  selectedGame,
  onSelect,
  favorites,
  onToggleFavorite,
  currentPlayerCount,
  compact = false,
}) => {
  const [query, setQuery] = useState('');
  const [categoryTab, setCategoryTab] = useState<FilterTab>('all');
  const [playerFilter, setPlayerFilter] = useState<PlayerFilter>('any');

  const roomGames = useMemo(
    () => GAME_LIST.filter((g) => g.id !== 'scoreboard'),
    []
  );

  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);
  const favoriteCount = useMemo(
    () => roomGames.filter((g) => favoriteSet.has(g.id)).length,
    [roomGames, favoriteSet]
  );

  const categoryTabs = useMemo(
    () =>
      [
        { id: 'all' as const, label: 'すべて', count: roomGames.length },
        { id: 'favorites' as const, label: 'お気に入り', count: favoriteCount },
        {
          id: 'card' as const,
          label: 'カード',
          count: roomGames.filter((g) => g.category === 'card').length,
        },
        {
          id: 'board' as const,
          label: 'ボード',
          count: roomGames.filter((g) => g.category === 'board').length,
        },
        {
          id: 'action' as const,
          label: 'アクション',
          count: roomGames.filter((g) => g.category === 'action').length,
        },
        {
          id: 'dice' as const,
          label: 'ダイス',
          count: roomGames.filter((g) => g.category === 'dice').length,
        },
        {
          id: 'party' as const,
          label: 'パーティ',
          count: roomGames.filter((g) => g.category === 'party').length,
        },
      ] as const,
    [roomGames, favoriteCount]
  );

  const visibleGames = useMemo(() => {
    const nq = normalizeQuery(query);
    const filtered = roomGames.filter((g) => {
      if (categoryTab === 'favorites' && !favoriteSet.has(g.id)) return false;
      if (categoryTab !== 'all' && categoryTab !== 'favorites' && g.category !== categoryTab) {
        return false;
      }
      if (!matchesSearch(g, nq)) return false;

      if (playerFilter === 'solo' && g.minPlayers > 1) return false;
      if (playerFilter === 'two' && (g.minPlayers > 2 || g.maxPlayers < 2)) return false;
      if (playerFilter === 'threePlus' && g.maxPlayers < 3) return false;
      if (
        playerFilter === 'fitRoom' &&
        currentPlayerCount !== undefined &&
        (currentPlayerCount < g.minPlayers || currentPlayerCount > g.maxPlayers)
      ) {
        return false;
      }
      return true;
    });

    // お気に入り登録済みのゲームを先頭に優先表示
    return [...filtered].sort((a, b) => {
      const aFav = favoriteSet.has(a.id) ? 0 : 1;
      const bFav = favoriteSet.has(b.id) ? 0 : 1;
      return aFav - bFav;
    });
  }, [roomGames, categoryTab, query, playerFilter, currentPlayerCount, favoriteSet]);

  const handleClearFilters = () => {
    setQuery('');
    setCategoryTab('all');
    setPlayerFilter('any');
  };

  return (
    <div className={`game-picker ${compact ? 'is-compact' : ''}`}>
      <div className="game-picker-search-row">
        <div className="game-search-box">
          <Search size={15} className="game-search-icon" />
          <input
            type="text"
            className="game-search-input"
            placeholder="ゲーム名で検索（例: カロム、将棋、ポーカー）"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="ゲーム名で検索"
          />
          {query && (
            <button
              type="button"
              className="game-search-clear"
              onClick={() => setQuery('')}
              aria-label="検索をクリア"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="game-cat-strip" role="tablist" aria-label="ゲームカテゴリ">
        {categoryTabs.map((cat) => {
          const active = categoryTab === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`game-cat-pill ${active ? 'active' : ''} ${cat.id === 'favorites' ? 'fav-tab' : ''}`}
              onClick={() => setCategoryTab(cat.id)}
            >
              {cat.id === 'favorites' && (
                <Star size={12} fill={active ? 'currentColor' : 'none'} />
              )}
              <span>{cat.label}</span>
              <span className="game-cat-count">{cat.count}</span>
            </button>
          );
        })}
      </div>

      <div className="game-player-filters">
        {currentPlayerCount !== undefined ? (
          <>
            <button
              type="button"
              className={`game-sub-chip ${playerFilter === 'any' ? 'active' : ''}`}
              onClick={() => setPlayerFilter('any')}
            >
              全人数
            </button>
            <button
              type="button"
              className={`game-sub-chip ${playerFilter === 'fitRoom' ? 'active' : ''}`}
              onClick={() =>
                setPlayerFilter((prev) => (prev === 'fitRoom' ? 'any' : 'fitRoom'))
              }
            >
              <Users size={12} />
              今の人数 ({currentPlayerCount}人) で遊べる
            </button>
          </>
        ) : (
          <>
            {(
              [
                { id: 'any', label: '全人数' },
                { id: 'solo', label: '1人OK' },
                { id: 'two', label: '2人対戦' },
                { id: 'threePlus', label: '3人以上' },
              ] as const
            ).map((pf) => (
              <button
                key={pf.id}
                type="button"
                className={`game-sub-chip ${playerFilter === pf.id ? 'active' : ''}`}
                onClick={() => setPlayerFilter(pf.id)}
              >
                {pf.label}
              </button>
            ))}
          </>
        )}
      </div>

      {visibleGames.length === 0 ? (
        <div className="game-picker-empty">
          <div className="game-picker-empty-title">
            {categoryTab === 'favorites' && favoriteCount === 0
              ? 'お気に入りがまだありません'
              : '条件に合うゲームがありません'}
          </div>
          <p className="game-picker-empty-desc">
            {categoryTab === 'favorites' && favoriteCount === 0
              ? '各ゲームの星アイコンをタップすると、ここにすぐ呼び出せるようになります。'
              : '検索ワードやフィルタを解除して探してみてください。'}
          </p>
          <button type="button" className="chip-btn" onClick={handleClearFilters}>
            すべて表示する
          </button>
        </div>
      ) : (
        <div className={`game-grid ${compact ? 'game-grid-compact' : ''}`}>
          {visibleGames.map((game) => {
            const active = game.id === selectedGame;
            const fav = favoriteSet.has(game.id);
            const fitsCurrent =
              currentPlayerCount === undefined ||
              (currentPlayerCount >= game.minPlayers && currentPlayerCount <= game.maxPlayers);

            return (
              <div
                key={game.id}
                role="button"
                tabIndex={0}
                className={`game-select-card ${active ? 'active' : ''} ${!fitsCurrent ? 'is-mismatch' : ''}`}
                onClick={() => onSelect(game.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(game.id);
                  }
                }}
              >
                <div className="game-card-top">
                  <span className="game-icon">
                    <GameIcon name={game.icon} size={19} />
                  </span>
                  <div className="game-card-top-right">
                    <span className="game-players">
                      <Users size={12} />
                      {game.minPlayers === game.maxPlayers
                        ? `${game.minPlayers}人`
                        : `${game.minPlayers}〜${game.maxPlayers}人`}
                    </span>
                    <button
                      type="button"
                      className={`fav-star-btn ${fav ? 'is-fav' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(game.id);
                      }}
                      aria-label={fav ? `${game.name}をお気に入り解除` : `${game.name}をお気に入り追加`}
                      aria-pressed={fav}
                    >
                      <Star size={15} fill={fav ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                </div>
                <div className="game-name">{game.name}</div>
                <div className="game-sub">{game.subtitle}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
